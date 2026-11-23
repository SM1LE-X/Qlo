// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Groth16Verifier} from "../src/Groth16Verifier.sol";
import {HospitalRegistry} from "../src/HospitalRegistry.sol";
import {PolicyRegistry} from "../src/PolicyRegistry.sol";
import {HealthRecords} from "../src/HealthRecords.sol";
import {ClaimsVault} from "../src/ClaimsVault.sol";

contract QloSystemHandler is Test {
    uint256 public constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    ClaimsVault public immutable vault;
    HealthRecords public immutable healthRecords;

    address[] public actors;
    uint256 public ghost_deposited;
    uint256 public ghost_withdrawn;

    uint256[] public grantedIds;
    address[] public grantedPatients;
    address[] public grantedHospitals;

    uint256[] public revokedIds;
    address[] public revokedHospitals;

    address internal currentActor;

    modifier useActor(uint256 seed) {
        currentActor = actors[bound(seed, 0, actors.length - 1)];
        vm.startPrank(currentActor);
        _;
        vm.stopPrank();
    }

    constructor(ClaimsVault vault_, HealthRecords healthRecords_) {
        vault = vault_;
        healthRecords = healthRecords_;
        for (uint256 i = 0; i < 6; i++) {
            address actor = makeAddr(string.concat("qloActor", vm.toString(i)));
            actors.push(actor);
            vm.deal(actor, 100 ether);
        }
    }

    function depositEscrow(uint256 amount, uint256 actorSeed) external useActor(actorSeed) {
        amount = bound(amount, 0.001 ether, 2 ether);
        vault.depositEscrow{value: amount}();
        ghost_deposited += amount;
    }

    function withdrawEscrow(uint256 amount, uint256 actorSeed) external useActor(actorSeed) {
        uint256 bal = vault.insurerEscrow(currentActor);
        if (bal == 0) return;
        amount = bound(amount, 1, bal);
        vault.withdrawEscrow(amount);
        ghost_withdrawn += amount;
    }

    function registerAndGrant(
        uint256 commitSeed,
        uint64 duration,
        uint256 actorSeed,
        uint256 hospSeed
    ) external useActor(actorSeed) {
        bytes32 commit = bytes32(bound(commitSeed, 1, SNARK_SCALAR_FIELD - 1));
        if (healthRecords.commitmentToRecordId(commit) != 0) return;

        duration = uint64(bound(duration, 60, 30 days));
        address targetHospital = actors[bound(hospSeed, 0, actors.length - 1)];

        uint256 recId = healthRecords.registerRecord(commit, "bafkreihqloinvarianttestcidv1");
        healthRecords.grantAccess(recId, targetHospital, duration, hex"04aabbccdd");

        grantedIds.push(recId);
        grantedPatients.push(currentActor);
        grantedHospitals.push(targetHospital);
    }

    function revokeGrant(uint256 idxSeed) external {
        if (grantedIds.length == 0) return;
        uint256 idx = bound(idxSeed, 0, grantedIds.length - 1);
        uint256 recId = grantedIds[idx];
        address patient = grantedPatients[idx];
        address hospital = grantedHospitals[idx];

        vm.prank(patient);
        healthRecords.revokeAccess(recId, hospital);

        revokedIds.push(recId);
        revokedHospitals.push(hospital);
    }

    function getActorCount() external view returns (uint256) {
        return actors.length;
    }

    function getRevokedCount() external view returns (uint256) {
        return revokedIds.length;
    }
}

contract QloInvariantsTest is Test {
    uint256 internal constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    Groth16Verifier internal verifier;
    HospitalRegistry internal hospitalRegistry;
    PolicyRegistry internal policyRegistry;
    HealthRecords internal healthRecords;
    ClaimsVault internal vault;
    QloSystemHandler internal handler;

    function setUp() public {
        address owner = makeAddr("owner");
        verifier = new Groth16Verifier();
        hospitalRegistry = new HospitalRegistry(owner, 123456);
        policyRegistry = new PolicyRegistry();
        healthRecords = new HealthRecords();
        vault = new ClaimsVault(
            owner,
            address(verifier),
            address(hospitalRegistry),
            address(policyRegistry),
            address(healthRecords)
        );
        handler = new QloSystemHandler(vault, healthRecords);
        targetContract(address(handler));
    }

    function invariant_VaultBalanceConservesDeposits() public view {
        assertEq(
            address(vault).balance,
            handler.ghost_deposited() - handler.ghost_withdrawn()
        );
    }

    function invariant_EscrowSumEqualsVaultBalance() public view {
        uint256 sumEscrow = 0;
        uint256 count = handler.getActorCount();
        for (uint256 i = 0; i < count; i++) {
            sumEscrow += vault.insurerEscrow(handler.actors(i));
        }
        assertEq(sumEscrow, address(vault).balance);
    }

    function invariant_RevokedGrantsAlwaysBlockedAndRedacted() public view {
        uint256 revokedCount = handler.getRevokedCount();
        for (uint256 i = 0; i < revokedCount; i++) {
            uint256 recId = handler.revokedIds(i);
            address hosp = handler.revokedHospitals(i);
            assertFalse(healthRecords.hasActiveAccess(recId, hosp));
            (uint64 exp, bytes memory dek) = healthRecords.getGrant(recId, hosp);
            assertEq(exp, 0);
            assertEq(dek.length, 0);
        }
    }

    function testFuzz_HealthRecordsDurationBounds(uint64 duration) public {
        address patient = makeAddr("fuzzPatient");
        address hospital = makeAddr("fuzzHospital");

        vm.startPrank(patient);
        uint256 recId = healthRecords.registerRecord(bytes32(uint256(777)), "bafkreifuzzcid");
        if (duration < 60 || duration > 30 days) {
            vm.expectRevert(HealthRecords.InvalidDuration.selector);
        }
        healthRecords.grantAccess(recId, hospital, duration, hex"04112233");
        vm.stopPrank();
    }

    function testFuzz_PolicyRegistryFieldBounds(uint256 commit) public {
        if (commit == 0) {
            vm.expectRevert(PolicyRegistry.ZeroCommitment.selector);
            policyRegistry.registerPolicy(commit);
            return;
        }
        if (commit >= SNARK_SCALAR_FIELD) {
            vm.expectRevert(PolicyRegistry.FieldOverflow.selector);
            policyRegistry.registerPolicy(commit);
            return;
        }
        policyRegistry.registerPolicy(commit);
        (, bool active) = policyRegistry.getPolicy(commit);
        assertTrue(active);
    }

    function testFuzz_HospitalRegistryPubKeyValidation(uint8 lenRaw, uint8 firstByte) public {
        uint256 len = bound(lenRaw, 0, 90);
        bytes memory key = new bytes(len);
        if (len > 0) key[0] = bytes1(firstByte);

        if (len != 65 || firstByte != 0x04) {
            vm.expectRevert(HospitalRegistry.InvalidPubKeyLength.selector);
        }
        hospitalRegistry.registerEncryptionPubKey(key);
    }
}
