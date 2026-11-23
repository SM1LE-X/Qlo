// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, stdJson} from "forge-std/Test.sol";
import {Groth16Verifier} from "../src/Groth16Verifier.sol";
import {HospitalRegistry} from "../src/HospitalRegistry.sol";
import {PolicyRegistry} from "../src/PolicyRegistry.sol";
import {HealthRecords} from "../src/HealthRecords.sol";
import {ClaimsVault} from "../src/ClaimsVault.sol";

contract QloProtocolTest is Test {
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

    uint256 internal hospitalRoot;
    uint256 internal activePolicyCommitment;

    struct ClaimFixture {
        uint256[2] pA;
        uint256[2][2] pB;
        uint256[2] pC;
        uint256[8] pubSignals;
        string cid;
    }

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
        hospitalRoot = genesisJson.readUint(".hospitalRoot");
        activePolicyCommitment = genesisJson.readUint(".activePolicyCommitment");

        vm.deal(insurer, 10 ether);
        vm.deal(patient, 1 ether);
        vm.deal(hospital, 1 ether);

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
    }

    function test_SequentialRealGroth16ClaimsAndCumulativeCap() public {
        ClaimFixture memory c1 = _loadFixture("/test/fixtures/claim1_proof.json");
        ClaimFixture memory c2 = _loadFixture("/test/fixtures/claim2_proof.json");

        // Warp inside [claimTimestamp - 60, claimTimestamp + 900]
        vm.warp(c1.pubSignals[4] + 30);

        // Patient registers both encrypted records & grants 10-minute access to Hospital
        bytes memory dummyWrappedDek = hex"04112233445566778899aabbccddeeff";
        vm.startPrank(patient);
        uint256 id1 = healthRecords.registerRecord(bytes32(c1.pubSignals[5]), c1.cid);
        healthRecords.grantAccess(id1, hospital, 600, dummyWrappedDek);

        uint256 id2 = healthRecords.registerRecord(bytes32(c2.pubSignals[5]), c2.cid);
        healthRecords.grantAccess(id2, hospital, 600, dummyWrappedDek);
        vm.stopPrank();

        // Claim #1: 0.01 ETH (priorSpent = 0)
        uint256 hospBalBefore = hospital.balance;
        vm.prank(hospital);
        vault.submitClaim(c1.pA, c1.pB, c1.pC, c1.pubSignals);

        assertEq(hospital.balance, hospBalBefore + c1.pubSignals[3], "Claim 1 payout mismatch");
        assertTrue(vault.nullifierUsed(c1.pubSignals[2]), "Claim 1 nullifier not marked");
        assertEq(vault.policySpent(activePolicyCommitment), 0.01 ether, "Claim 1 policySpent mismatch");
        assertEq(vault.insurerEscrow(insurer), 0.99 ether, "Claim 1 escrow mismatch");
        assertEq(vault.totalClaimsSettled(), 1);

        // Claim #2: 0.015 ETH (priorSpent = 0.01 ETH, cumulative = 0.025 ETH <= 0.03 ETH cap)
        vm.warp(c2.pubSignals[4] + 30);
        vm.prank(hospital);
        vault.submitClaim(c2.pA, c2.pB, c2.pC, c2.pubSignals);

        assertEq(
            hospital.balance,
            hospBalBefore + c1.pubSignals[3] + c2.pubSignals[3],
            "Claim 2 cumulative payout mismatch"
        );
        assertTrue(vault.nullifierUsed(c2.pubSignals[2]), "Claim 2 nullifier not marked");
        assertEq(vault.policySpent(activePolicyCommitment), 0.025 ether, "Cumulative spent mismatch");
        assertEq(vault.insurerEscrow(insurer), 0.975 ether, "Escrow after claim 2 mismatch");
        assertEq(vault.totalClaimsSettled(), 2);
        assertEq(vault.totalPayoutWei(), 0.025 ether);
    }
}
