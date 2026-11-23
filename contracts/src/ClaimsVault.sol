// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {HospitalRegistry} from "./HospitalRegistry.sol";
import {PolicyRegistry} from "./PolicyRegistry.sol";
import {HealthRecords} from "./HealthRecords.sol";

interface IGroth16Verifier {
    function verifyProof(
        uint256[2] calldata _pA,
        uint256[2][2] calldata _pB,
        uint256[2] calldata _pC,
        uint256[8] calldata _pubSignals
    ) external view returns (bool);
}

/// @title ClaimsVault
/// @notice Verifies Groth16 claim validity proofs against live registries, consent, clock freshness, and insurer ETH escrow.
contract ClaimsVault is Ownable2Step, Pausable, ReentrancyGuard {
    IGroth16Verifier public immutable verifier;
    HospitalRegistry public immutable hospitalRegistry;
    PolicyRegistry public immutable policyRegistry;
    HealthRecords public immutable healthRecords;

    uint64 public constant MAX_PAST_SKEW = 900;   // 15 minutes
    uint64 public constant MAX_FUTURE_SKEW = 60;  // 1 minute

    mapping(address => uint256) public insurerEscrow;
    mapping(uint256 => bool) public nullifierUsed;
    mapping(uint256 => uint256) public policySpent;

    uint256 public totalClaimsSettled;
    uint256 public totalPayoutWei;

    error ZeroAddress();
    error ZeroDeposit();
    error InsufficientEscrow();
    error InvalidHospitalRoot();
    error PolicyNotActive();
    error NullifierAlreadyUsed();
    error InvalidClaimAmount();
    error ClaimTimestampOutOfWindow();
    error HospitalSenderMismatch();
    error PatientAccessNotActive();
    error PriorSpentMismatch();
    error InvalidProof();
    error TransferFailed();

    event EscrowDeposited(address indexed insurer, uint256 amount, uint256 newBalance);
    event EscrowWithdrawn(address indexed insurer, uint256 amount, uint256 newBalance);
    event ClaimSettled(
        uint256 indexed nullifier,
        uint256 indexed policyCommitment,
        bytes32 indexed recordCommitment,
        address hospital,
        address insurer,
        uint256 amount,
        uint64 settledAt
    );

    constructor(
        address initialOwner,
        address verifier_,
        address hospitalRegistry_,
        address policyRegistry_,
        address healthRecords_
    ) Ownable(initialOwner) {
        if (
            verifier_ == address(0) ||
            hospitalRegistry_ == address(0) ||
            policyRegistry_ == address(0) ||
            healthRecords_ == address(0)
        ) {
            revert ZeroAddress();
        }
        verifier = IGroth16Verifier(verifier_);
        hospitalRegistry = HospitalRegistry(hospitalRegistry_);
        policyRegistry = PolicyRegistry(policyRegistry_);
        healthRecords = HealthRecords(healthRecords_);
    }

    function depositEscrow() external payable {
        if (msg.value == 0) revert ZeroDeposit();
        uint256 newBalance = insurerEscrow[msg.sender] + msg.value;
        insurerEscrow[msg.sender] = newBalance;
        emit EscrowDeposited(msg.sender, msg.value, newBalance);
    }

    function withdrawEscrow(uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidClaimAmount();
        uint256 bal = insurerEscrow[msg.sender];
        if (bal < amount) revert InsufficientEscrow();
        uint256 newBalance = bal - amount;
        insurerEscrow[msg.sender] = newBalance;
        emit EscrowWithdrawn(msg.sender, amount, newBalance);

        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Verifies all 8 frozen ZK public signals + Groth16 pairing and settles ETH atomically.
    /// @dev pubSignals order:
    ///   [0] hospitalRoot
    ///   [1] policyCommitment
    ///   [2] nullifier
    ///   [3] claimAmount
    ///   [4] claimTimestamp
    ///   [5] recordCommitment (248-bit truncated SHA-256 of ciphertext)
    ///   [6] hospitalAddress (uint160(msg.sender))
    ///   [7] priorPolicySpent
    function submitClaim(
        uint256[2] calldata pA,
        uint256[2][2] calldata pB,
        uint256[2] calldata pC,
        uint256[8] calldata pubSignals
    ) external nonReentrant whenNotPaused {
        // 1. Accredited hospital Merkle root check
        if (pubSignals[0] != hospitalRegistry.hospitalRoot()) revert InvalidHospitalRoot();

        // 2. Active insurer policy commitment check
        uint256 policyCommit = pubSignals[1];
        (address insurer, bool active) = policyRegistry.getPolicy(policyCommit);
        if (!active || insurer == address(0)) revert PolicyNotActive();

        // 3. Single-use deterministic nullifier check
        uint256 nullifier = pubSignals[2];
        if (nullifierUsed[nullifier]) revert NullifierAlreadyUsed();

        // 4. Positive claim amount & insurer escrow solvency check
        uint256 claimAmount = pubSignals[3];
        if (claimAmount == 0) revert InvalidClaimAmount();
        if (insurerEscrow[insurer] < claimAmount) revert InsufficientEscrow();

        // 5. Fresh timestamp check (prevents backdated expired-policy proofs)
        uint256 claimTs = pubSignals[4];
        if (claimTs > block.timestamp + MAX_FUTURE_SKEW || block.timestamp > claimTs + MAX_PAST_SKEW) {
            revert ClaimTimestampOutOfWindow();
        }

        // 6. Anti-front-run payout recipient binding
        if (address(uint160(pubSignals[6])) != msg.sender) revert HospitalSenderMismatch();

        // 7. Active patient consent & non-revocation check
        bytes32 recordCommitment = bytes32(pubSignals[5]);
        if (!healthRecords.hasActiveAccessByCommitment(recordCommitment, msg.sender)) {
            revert PatientAccessNotActive();
        }

        // 8. Cumulative annual spend binding check
        if (pubSignals[7] != policySpent[policyCommit]) revert PriorSpentMismatch();

        // 9. Groth16 BN254 pairing verification
        if (!verifier.verifyProof(pA, pB, pC, pubSignals)) revert InvalidProof();

        // Effects before external ETH transfer
        nullifierUsed[nullifier] = true;
        policySpent[policyCommit] += claimAmount;
        insurerEscrow[insurer] -= claimAmount;
        totalClaimsSettled += 1;
        totalPayoutWei += claimAmount;

        emit ClaimSettled(
            nullifier,
            policyCommit,
            recordCommitment,
            msg.sender,
            insurer,
            claimAmount,
            uint64(block.timestamp)
        );

        // Interaction
        (bool ok, ) = payable(msg.sender).call{value: claimAmount}("");
        if (!ok) revert TransferFailed();
    }
}
