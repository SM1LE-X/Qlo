// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title PolicyRegistry
/// @notice Stores opaque insurer policy commitments with zero PHI or limit leakage on-chain.
contract PolicyRegistry {
    uint256 public constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    struct PolicyMeta {
        address insurer;
        bool active;
        uint64 registeredAt;
    }

    mapping(uint256 => PolicyMeta) private _policies;
    mapping(address => uint256[]) private _insurerPolicies;

    error FieldOverflow();
    error ZeroCommitment();
    error PolicyAlreadyExists();
    error PolicyNotFound();
    error NotPolicyInsurer();
    error PolicyAlreadyInactive();

    event PolicyRegistered(uint256 indexed policyCommitment, address indexed insurer, uint64 registeredAt);
    event PolicyDeactivated(uint256 indexed policyCommitment, address indexed insurer, uint64 deactivatedAt);

    function registerPolicy(uint256 policyCommitment) external {
        if (policyCommitment == 0) revert ZeroCommitment();
        if (policyCommitment >= SNARK_SCALAR_FIELD) revert FieldOverflow();
        if (_policies[policyCommitment].insurer != address(0)) revert PolicyAlreadyExists();

        uint64 nowTs = uint64(block.timestamp);
        _policies[policyCommitment] = PolicyMeta({
            insurer: msg.sender,
            active: true,
            registeredAt: nowTs
        });
        _insurerPolicies[msg.sender].push(policyCommitment);

        emit PolicyRegistered(policyCommitment, msg.sender, nowTs);
    }

    function deactivatePolicy(uint256 policyCommitment) external {
        PolicyMeta storage meta = _policies[policyCommitment];
        if (meta.insurer == address(0)) revert PolicyNotFound();
        if (meta.insurer != msg.sender) revert NotPolicyInsurer();
        if (!meta.active) revert PolicyAlreadyInactive();

        meta.active = false;
        emit PolicyDeactivated(policyCommitment, msg.sender, uint64(block.timestamp));
    }

    function getPolicy(uint256 policyCommitment) external view returns (address insurer, bool active) {
        PolicyMeta storage meta = _policies[policyCommitment];
        return (meta.insurer, meta.active);
    }

    function getPolicyMeta(uint256 policyCommitment) external view returns (PolicyMeta memory) {
        return _policies[policyCommitment];
    }

    function getPoliciesByInsurer(address insurer) external view returns (uint256[] memory) {
        return _insurerPolicies[insurer];
    }
}
