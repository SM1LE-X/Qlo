// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title HospitalRegistry
/// @notice Production-governed Poseidon Merkle root of accredited hospitals and their ECDH P-256 public keys.
contract HospitalRegistry is Ownable2Step {
    uint256 public constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    uint256 public hospitalRoot;
    mapping(address => bytes) public hospitalEncryptionPubKey;

    error FieldOverflow();
    error ZeroRoot();
    error InvalidPubKeyLength();
    error ZeroAddress();

    event HospitalRootUpdated(uint256 indexed previousRoot, uint256 indexed newRoot, uint64 updatedAt);
    event HospitalPubKeyUpdated(address indexed hospital, bytes pubKey, uint64 updatedAt);

    constructor(address initialOwner, uint256 initialRoot) Ownable(initialOwner) {
        if (initialRoot == 0) revert ZeroRoot();
        if (initialRoot >= SNARK_SCALAR_FIELD) revert FieldOverflow();
        hospitalRoot = initialRoot;
        emit HospitalRootUpdated(0, initialRoot, uint64(block.timestamp));
    }

    function updateHospitalRoot(uint256 newRoot) external onlyOwner {
        if (newRoot == 0) revert ZeroRoot();
        if (newRoot >= SNARK_SCALAR_FIELD) revert FieldOverflow();
        uint256 prev = hospitalRoot;
        hospitalRoot = newRoot;
        emit HospitalRootUpdated(prev, newRoot, uint64(block.timestamp));
    }

    /// @notice Allows a hospital to publish or rotate its 65-byte uncompressed ECDH P-256 public key (0x04 || X || Y).
    function registerEncryptionPubKey(bytes calldata pubKey) external {
        _setPubKey(msg.sender, pubKey);
    }

    /// @notice Allows governance to pre-seed a hospital's ECDH P-256 public key during genesis setup.
    function setHospitalEncryptionPubKey(address hospital, bytes calldata pubKey) external onlyOwner {
        if (hospital == address(0)) revert ZeroAddress();
        _setPubKey(hospital, pubKey);
    }

    function _setPubKey(address hospital, bytes calldata pubKey) internal {
        if (pubKey.length != 65 || pubKey[0] != 0x04) revert InvalidPubKeyLength();
        hospitalEncryptionPubKey[hospital] = pubKey;
        emit HospitalPubKeyUpdated(hospital, pubKey, uint64(block.timestamp));
    }
}
