// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, stdJson} from "forge-std/Script.sol";
import {Groth16Verifier} from "../src/Groth16Verifier.sol";
import {HospitalRegistry} from "../src/HospitalRegistry.sol";
import {PolicyRegistry} from "../src/PolicyRegistry.sol";
import {HealthRecords} from "../src/HealthRecords.sol";
import {ClaimsVault} from "../src/ClaimsVault.sol";

contract DeployBaseSepolia is Script {
    using stdJson for string;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        string memory genesisJson = vm.readFile(
            string.concat(vm.projectRoot(), "/test/fixtures/genesis.json")
        );

        vm.startBroadcast(deployerPrivateKey);

        Groth16Verifier verifier = new Groth16Verifier();
        HospitalRegistry hospitalRegistry = new HospitalRegistry(
            deployer,
            genesisJson.readUint(".hospitalRoot")
        );
        PolicyRegistry policyRegistry = new PolicyRegistry();
        HealthRecords healthRecords = new HealthRecords();
        ClaimsVault claimsVault = new ClaimsVault(
            deployer,
            address(verifier),
            address(hospitalRegistry),
            address(policyRegistry),
            address(healthRecords)
        );

        // Seed canonical active + expired policy commitments & initial escrow if deployer funds permit
        policyRegistry.registerPolicy(genesisJson.readUint(".activePolicyCommitment"));
        policyRegistry.registerPolicy(genesisJson.readUint(".expiredPolicyCommitment"));

        uint256 initialEscrow = vm.envOr("INITIAL_ESCROW_WEI", uint256(0.02 ether));
        if (deployer.balance > initialEscrow + 0.005 ether && initialEscrow > 0) {
            claimsVault.depositEscrow{value: initialEscrow}();
        }

        vm.stopBroadcast();

        _writeManifest(
            deployer,
            address(verifier),
            address(hospitalRegistry),
            address(policyRegistry),
            address(healthRecords),
            address(claimsVault)
        );
    }

    function _writeManifest(
        address deployer,
        address verifier,
        address hospitalRegistry,
        address policyRegistry,
        address healthRecords,
        address claimsVault
    ) internal {
        string memory manifestJson = vm.readFile(
            string.concat(vm.projectRoot(), "/../circuits/build/manifest.json")
        );

        string memory obj = "deployment";
        vm.serializeBool(obj, "deployed", true);
        vm.serializeUint(obj, "chainId", block.chainid);
        vm.serializeString(obj, "network", "base-sepolia");
        vm.serializeString(obj, "explorerBaseUrl", "https://sepolia.basescan.org");
        vm.serializeString(obj, "sourcifyBaseUrl", "https://repo.sourcify.dev/contracts/full_match/84532");
        vm.serializeString(obj, "zkeySha256", manifestJson.readString(".zkeySha256"));
        vm.serializeAddress(obj, "seededInsurer", deployer);
        vm.serializeUint(obj, "deployBlock", block.number);

        string memory addrs = "contracts";
        vm.serializeAddress(addrs, "Groth16Verifier", verifier);
        vm.serializeAddress(addrs, "HospitalRegistry", hospitalRegistry);
        vm.serializeAddress(addrs, "PolicyRegistry", policyRegistry);
        vm.serializeAddress(addrs, "HealthRecords", healthRecords);
        string memory addrsJson = vm.serializeAddress(addrs, "ClaimsVault", claimsVault);

        string memory finalJson = vm.serializeString(obj, "contracts", addrsJson);
        vm.writeJson(finalJson, string.concat(vm.projectRoot(), "/../deployments/base-sepolia.json"));
    }
}
