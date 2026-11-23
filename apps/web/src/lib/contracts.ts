import deploymentJson from "@/contracts/deployment.json";
import {
  ClaimsVaultAbi,
  Groth16VerifierAbi,
  HealthRecordsAbi,
  HospitalRegistryAbi,
  PolicyRegistryAbi,
} from "@/contracts/abis";

export type DeploymentManifest = typeof deploymentJson;

export const DEPLOYMENT = deploymentJson;

export const CONTRACTS = {
  Groth16Verifier: {
    address: DEPLOYMENT.contracts.Groth16Verifier as `0x${string}`,
    abi: Groth16VerifierAbi,
  },
  HospitalRegistry: {
    address: DEPLOYMENT.contracts.HospitalRegistry as `0x${string}`,
    abi: HospitalRegistryAbi,
  },
  PolicyRegistry: {
    address: DEPLOYMENT.contracts.PolicyRegistry as `0x${string}`,
    abi: PolicyRegistryAbi,
  },
  HealthRecords: {
    address: DEPLOYMENT.contracts.HealthRecords as `0x${string}`,
    abi: HealthRecordsAbi,
  },
  ClaimsVault: {
    address: DEPLOYMENT.contracts.ClaimsVault as `0x${string}`,
    abi: ClaimsVaultAbi,
  },
} as const;

export const IS_CHAIN_DEPLOYED = Boolean(DEPLOYMENT.deployed);

export function explorerTxUrl(txHash: string): string {
  return `${DEPLOYMENT.explorerBaseUrl}/tx/${txHash}`;
}

export function explorerAddressUrl(address: string): string {
  return `${DEPLOYMENT.explorerBaseUrl}/address/${address}`;
}

export function sourcifyContractUrl(address: string): string {
  return `${DEPLOYMENT.sourcifyBaseUrl}/${address}`;
}
