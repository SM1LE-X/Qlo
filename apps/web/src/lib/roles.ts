import canonicalFixtures from "@/lib/canonicalFixtures.json";
import type { SlackRole } from "@/lib/slack/blocks";

export type AppRole = SlackRole;

export interface RoleMeta {
  id: AppRole;
  label: string;
  shortLabel: string;
  accountName: string;
  accountSubtitle: string;
  accountEmail: string;
  accountAddress: `0x${string}`;
  badgeCode: string;
  actorName: string;
  channelName: string;
  portalHref: string;
  portalLabel: string;
  accentHex: string;
  contractGate: string;
  gateDescription: string;
  canSee: ReadonlyArray<string>;
  hiddenFromRole: ReadonlyArray<string>;
}

export const ROLE_ORDER: ReadonlyArray<AppRole> = ["patient", "hospital", "insurer"];

const primaryHospital = canonicalFixtures.hospitals[0];

export const ROLE_META: Record<AppRole, RoleMeta> = {
  patient: {
    id: "patient",
    label: "Patient",
    shortLabel: "Patient",
    accountName: "Alex Rivera",
    accountSubtitle: `Member · Policy #${canonicalFixtures.activePolicy.policyId}`,
    accountEmail: "alex.rivera@member.qlo.health",
    accountAddress: canonicalFixtures.accounts.patient as `0x${string}`,
    badgeCode: "MEMBER",
    actorName: "Alex Rivera",
    channelName: "#patient-vault",
    portalHref: "/patient",
    portalLabel: "Open Records Vault",
    accentHex: "#059669",
    contractGate: "HealthRecords.patient == msg.sender",
    gateDescription:
      "Only the record owner account can seal AES-256-GCM medical records, mint time-bound ECDH grants, or broadcast on-chain revocation.",
    canSee: [
      "Plaintext CMS-1500 bill & local WASM OCR output",
      "Client-side AES-256-GCM key & backup envelope",
      "Active provider grants, TTL expiry & 1-click Revoke",
    ],
    hiddenFromRole: [
      "Provider internal billing queue & NPI witness secrets",
      "Payer treasury escrow liquidity & other members' claims",
    ],
  },
  hospital: {
    id: "hospital",
    label: "Hospital",
    shortLabel: "Provider",
    accountName: primaryHospital.name,
    accountSubtitle: `Provider · NPI ${primaryHospital.licenseId}`,
    accountEmail: "billing@metrocardiac.org",
    accountAddress: primaryHospital.address as `0x${string}`,
    badgeCode: "NPI VERIFIED",
    actorName: primaryHospital.name,
    channelName: "#hospital-claims",
    portalHref: "/hospital",
    portalLabel: "Open Claims Prover",
    accentHex: "#0284C7",
    contractGate: "HospitalRegistry.hospitalRoot & pubSignals[6] == msg.sender",
    gateDescription:
      "Requires an accredited provider account verified in the HospitalRegistry Merkle tree to unwrap ECDH DEKs and settle Groth16 claims.",
    canSee: [
      "Records explicitly granted by patients via wrapped P-256 DEK",
      "Local Groth16 BN254 witness prover (4,349 R1CS constraints)",
      "Eligible claim payout queue & instant Sepolia settlement",
    ],
    hiddenFromRole: [
      "Revoked or unshared patient records (mathematically undecryptable)",
      "Payer private actuarial reserves outside public escrow balance",
    ],
  },
  insurer: {
    id: "insurer",
    label: "Insurer",
    shortLabel: "Payer",
    accountName: "Meridian Health Plan",
    accountSubtitle: "Payer · Escrow Treasury Admin",
    accountEmail: "treasury@meridianhealth.io",
    accountAddress: canonicalFixtures.accounts.insurer as `0x${string}`,
    badgeCode: "ESCROW ADMIN",
    actorName: "Meridian Health Plan",
    channelName: "#insurer-escrow",
    portalHref: "/insurer",
    portalLabel: "Open Escrow Treasury",
    accentHex: "#D97706",
    contractGate: "PolicyRegistry.insurer & ClaimsVault.insurerEscrow",
    gateDescription:
      "Requires a registered payer account or escrow depositor to manage ETH liquidity and audit Zero-PHI settlement proofs.",
    canSee: [
      "Groth16 BN254 proof validity & 8 public signals",
      "Cumulative annual policy spend & deterministic nullifiers",
      "Zero-PHI calldata audit & HL7 FHIR R4 ClaimResponse receipts",
    ],
    hiddenFromRole: [
      "Patient identity, name, SSN, raw bills & ICD-10 diagnoses (0 bytes)",
      "Clinical notes, prescriptions & unredacted encounter records",
    ],
  },
};

export interface WalletRoleFlags {
  isConnected: boolean;
  isPatient: boolean;
  isApprovedHospital: boolean;
  isInsurer: boolean;
}

/**
 * Pure access evaluation for role-restricted channels and actions.
 * - Wallet connected: strictly mirrors verified on-chain roles.
 * - Session account: strictly locks to the currently signed-in role account.
 */
export function canAccessRole(
  target: AppRole,
  activeRole: AppRole,
  wallet: WalletRoleFlags
): boolean {
  if (wallet.isConnected) {
    if (target === "patient") return wallet.isPatient;
    if (target === "hospital") return wallet.isApprovedHospital;
    return wallet.isInsurer;
  }
  return activeRole === target;
}

export function roleForPathname(pathname: string): AppRole | null {
  if (pathname === "/patient" || pathname.startsWith("/patient/")) return "patient";
  if (pathname === "/hospital" || pathname.startsWith("/hospital/")) return "hospital";
  if (pathname === "/insurer" || pathname.startsWith("/insurer/")) return "insurer";
  return null;
}

export function describeLockReason(
  target: AppRole,
  activeRole: AppRole,
  walletConnected: boolean
): string {
  const targetMeta = ROLE_META[target];
  if (walletConnected) {
    return `Connected Ethereum Sepolia wallet does not hold the ${targetMeta.label} role (${targetMeta.contractGate}).`;
  }
  const activeMeta = ROLE_META[activeRole];
  return `Signed in as ${activeMeta.accountName} (${activeMeta.label}). ${targetMeta.channelName} requires an accredited ${targetMeta.label} account (${targetMeta.contractGate}).`;
}
