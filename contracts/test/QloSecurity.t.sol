// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, Vm, stdJson} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {Groth16Verifier} from "../src/Groth16Verifier.sol";
import {HospitalRegistry} from "../src/HospitalRegistry.sol";
import {PolicyRegistry} from "../src/PolicyRegistry.sol";
import {HealthRecords} from "../src/HealthRecords.sol";
import {ClaimsVault} from "../src/ClaimsVault.sol";

contract ReentrantHospitalMock {
    ClaimsVault public immutable vault;
    uint256[2] internal _pA;
    uint256[2][2] internal _pB;
    uint256[2] internal _pC;
    uint256[8] internal _pubSignals;
    bool internal _attacked;

    constructor(ClaimsVault vault_) {
        vault = vault_;
    }

    function executeReentrantClaim(
        uint256[2] calldata pA,
        uint256[2][2] calldata pB,
        uint256[2] calldata pC,
        uint256[8] calldata pubSignals
    ) external {
        _pA = pA;
        _pB = pB;
        _pC = pC;
        _pubSignals = pubSignals;
        vault.submitClaim(pA, pB, pC, pubSignals);
    }

    receive() external payable {
        if (!_attacked) {
            _attacked = true;
            vault.submitClaim(_pA, _pB, _pC, _pubSignals);
        }
    }
}

contract QloSecurityTest is Test {
    using stdJson for string;

    Groth16Verifier internal verifier;
    HospitalRegistry internal hospitalRegistry;
    PolicyRegistry internal policyRegistry;
    HealthRecords internal healthRecords;
    ClaimsVault internal vault;

    address internal owner;
    address internal insurer;
    address internal patient;
    address internal hospital;
    address internal attacker;

    uint256 internal hospitalRoot;
    uint256 internal activePolicyCommitment;

    struct ClaimFixture {
        uint256[2] pA;
        uint256[2][2] pB;
        uint256[2] pC;
        uint256[8] pubSignals;
        string cid;
    }

    ClaimFixture internal c1;
    ClaimFixture internal c2;
    uint256 internal recId1;
    uint256 internal recId2;

    function _loadFixture(string memory relPath) internal view returns (ClaimFixture memory f) {
        string memory json = vm.readFile(string.concat(vm.projectRoot(), relPath));
        f.pA[0] = json.readUint(".pA[0]");
        f.pA[1] = json.readUint(".pA[1]");
        f.pB[0][0] = json.readUint(".pB[0][0]");
        f.pB[0][1] = json.readUint(".pB[0][1]");
        f.pB[1][0] = json.readUint(".pB[1][0]");
        f.pB[1][1] = json.readUint(".pB[1][1]");
        f.pC[0] = json.readUint(".pC[0]");
        f.pC[1] = json.readUint(".pC[1]");
        for (uint256 i = 0; i < 8; i++) {
            f.pubSignals[i] = json.readUint(string.concat(".pubSignals[", vm.toString(i), "]"));
        }
        f.cid = json.readString(".cid");
    }

    function setUp() public {
        string memory genesisJson = vm.readFile(
            string.concat(vm.projectRoot(), "/test/fixtures/genesis.json")
        );
        owner = genesisJson.readAddress(".accounts.deployer");
        insurer = genesisJson.readAddress(".accounts.insurer");
        patient = genesisJson.readAddress(".accounts.patient");
        hospital = genesisJson.readAddress(".accounts.hospital1");
        attacker = genesisJson.readAddress(".accounts.attacker");
        hospitalRoot = genesisJson.readUint(".hospitalRoot");
        activePolicyCommitment = genesisJson.readUint(".activePolicyCommitment");

        c1 = _loadFixture("/test/fixtures/claim1_proof.json");
        c2 = _loadFixture("/test/fixtures/claim2_proof.json");

        vm.deal(insurer, 10 ether);
        vm.deal(patient, 1 ether);
        vm.deal(hospital, 1 ether);
        vm.deal(attacker, 1 ether);

        vm.startPrank(owner);
        verifier = new Groth16Verifier();
        hospitalRegistry = new HospitalRegistry(owner, hospitalRoot);
        policyRegistry = new PolicyRegistry();
        healthRecords = new HealthRecords();
        vault = new ClaimsVault(
            owner,
            address(verifier),
            address(hospitalRegistry),
            address(policyRegistry),
            address(healthRecords)
        );
        vm.stopPrank();

        vm.startPrank(insurer);
        policyRegistry.registerPolicy(activePolicyCommitment);
        vault.depositEscrow{value: 1 ether}();
        vm.stopPrank();

        vm.warp(c1.pubSignals[4] + 30);

        bytes memory dummyDek = hex"04112233445566778899aabbccddeeff";
        vm.startPrank(patient);
        recId1 = healthRecords.registerRecord(bytes32(c1.pubSignals[5]), c1.cid);
        healthRecords.grantAccess(recId1, hospital, 600, dummyDek);
        recId2 = healthRecords.registerRecord(bytes32(c2.pubSignals[5]), c2.cid);
        healthRecords.grantAccess(recId2, hospital, 600, dummyDek);
        vm.stopPrank();
    }

    function test_01_ReplayAttackReverts() public {
        vm.startPrank(hospital);
        vault.submitClaim(c1.pA, c1.pB, c1.pC, c1.pubSignals);
        vm.expectRevert(ClaimsVault.NullifierAlreadyUsed.selector);
        vault.submitClaim(c1.pA, c1.pB, c1.pC, c1.pubSignals);
        vm.stopPrank();
    }

    function test_02_FrontRunAttackReverts() public {
        vm.prank(attacker);
        vm.expectRevert(ClaimsVault.HospitalSenderMismatch.selector);
        vault.submitClaim(c1.pA, c1.pB, c1.pC, c1.pubSignals);
    }

    function test_03_BackdatedTimestampReverts() public {
        vm.warp(c1.pubSignals[4] + 901);
        vm.prank(hospital);
        vm.expectRevert(ClaimsVault.ClaimTimestampOutOfWindow.selector);
        vault.submitClaim(c1.pA, c1.pB, c1.pC, c1.pubSignals);
    }

    function test_04_FutureTimestampReverts() public {
        vm.warp(c1.pubSignals[4] - 61);
        vm.prank(hospital);
        vm.expectRevert(ClaimsVault.ClaimTimestampOutOfWindow.selector);
        vault.submitClaim(c1.pA, c1.pB, c1.pC, c1.pubSignals);
    }

    function test_05_PostRevokeClaimRevertsAndClearsDek() public {
        vm.prank(patient);
        healthRecords.revokeAccess(recId1, hospital);

        (uint64 exp, bytes memory dek) = healthRecords.getGrant(recId1, hospital);
        assertEq(exp, 0);
        assertEq(dek.length, 0);

        vm.prank(hospital);
        vm.expectRevert(ClaimsVault.PatientAccessNotActive.selector);
        vault.submitClaim(c1.pA, c1.pB, c1.pC, c1.pubSignals);
    }

    function test_06_ExpiredGrantRevertsAndRedactsDek() public {
        // Grant was 600s starting at c1.pubSignals[4] + 30
        vm.warp(c1.pubSignals[4] + 631);

        (uint64 exp, bytes memory dek) = healthRecords.getGrant(recId1, hospital);
        assertEq(exp, 0);
        assertEq(dek.length, 0);

        // Claim timestamp is still inside 900s window, so failure proves HealthRecords consent gate
        vm.prank(hospital);
        vm.expectRevert(ClaimsVault.PatientAccessNotActive.selector);
        vault.submitClaim(c1.pA, c1.pB, c1.pC, c1.pubSignals);
    }

    function test_07_StalePriorPolicySpentReverts() public {
        // Submit Claim #2 BEFORE Claim #1 so pubSignals[7] (0.01 ETH) != policySpent (0)
        vm.warp(c2.pubSignals[4] + 30);
        vm.prank(hospital);
        vm.expectRevert(ClaimsVault.PriorSpentMismatch.selector);
        vault.submitClaim(c2.pA, c2.pB, c2.pC, c2.pubSignals);
    }

    function test_08_CorruptedProofReverts() public {
        // (1, 2) is a valid BN254 G1 generator point, so pairing executes cleanly and fails verification
        uint256[2] memory badPa = [uint256(1), uint256(2)];
        vm.prank(hospital);
        vm.expectRevert(ClaimsVault.InvalidProof.selector);
        vault.submitClaim(badPa, c1.pB, c1.pC, c1.pubSignals);
    }

    function test_09_InsufficientEscrowReverts() public {
        vm.prank(insurer);
        vault.withdrawEscrow(0.995 ether); // leaves 0.005 < 0.01 ETH

        vm.prank(hospital);
        vm.expectRevert(ClaimsVault.InsufficientEscrow.selector);
        vault.submitClaim(c1.pA, c1.pB, c1.pC, c1.pubSignals);
    }

    function test_10_PausedVaultBlocksSettlement() public {
        vm.prank(owner);
        vault.pause();

        vm.prank(hospital);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vault.submitClaim(c1.pA, c1.pB, c1.pC, c1.pubSignals);
    }

    function test_11_ReentrancyAttackBlocked() public {
        // Deploy reentrant contract bytecode directly at the accredited hospital address
        // so all 8 public signals & Groth16 pass, testing ClaimsVault's nonReentrant guard
        ReentrantHospitalMock impl = new ReentrantHospitalMock(vault);
        vm.etch(hospital, address(impl).code);

        // Because ReentrantHospitalMock's receive() reverts when reentering submitClaim,
        // the outer ETH .call fails and ClaimsVault reverts with TransferFailed()
        vm.prank(attacker);
        vm.expectRevert(ClaimsVault.TransferFailed.selector);
        ReentrantHospitalMock(payable(hospital)).executeReentrantClaim(c1.pA, c1.pB, c1.pC, c1.pubSignals);
    }

    function test_12_StrictGovernanceAndAccessControls() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        hospitalRegistry.updateHospitalRoot(123);

        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        vault.pause();

        vm.prank(attacker);
        vm.expectRevert(PolicyRegistry.PolicyAlreadyExists.selector);
        policyRegistry.registerPolicy(activePolicyCommitment);

        vm.prank(attacker);
        vm.expectRevert(PolicyRegistry.NotPolicyInsurer.selector);
        policyRegistry.deactivatePolicy(activePolicyCommitment);

        vm.prank(attacker);
        vm.expectRevert(HealthRecords.NotRecordOwner.selector);
        healthRecords.grantAccess(recId1, attacker, 600, hex"01");

        vm.prank(attacker);
        vm.expectRevert(HealthRecords.NotRecordOwner.selector);
        healthRecords.revokeAccess(recId1, hospital);
    }

    function test_13_ZeroPhiInAllEmittedEvents() public {
        vm.recordLogs();

        vm.prank(hospital);
        healthRecords.logAccess(recId1);

        vm.prank(hospital);
        vault.submitClaim(c1.pA, c1.pB, c1.pC, c1.pubSignals);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertGt(logs.length, 0);

        bytes memory forbiddenIcd = bytes("I21.0");
        bytes memory forbiddenCpt = bytes("99285");
        bytes memory forbiddenRx = bytes("Ticagrelor");

        for (uint256 i = 0; i < logs.length; i++) {
            assertFalse(_containsBytes(logs[i].data, forbiddenIcd), "ICD-10 leaked in event");
            assertFalse(_containsBytes(logs[i].data, forbiddenCpt), "CPT leaked in event");
            assertFalse(_containsBytes(logs[i].data, forbiddenRx), "Rx leaked in event");
        }
    }

    function _containsBytes(bytes memory haystack, bytes memory needle) internal pure returns (bool) {
        if (needle.length == 0 || haystack.length < needle.length) return false;
        for (uint256 i = 0; i <= haystack.length - needle.length; i++) {
            bool matchAll = true;
            for (uint256 j = 0; j < needle.length; j++) {
                if (haystack[i + j] != needle[j]) {
                    matchAll = false;
                    break;
                }
            }
            if (matchAll) return true;
        }
        return false;
    }
}
