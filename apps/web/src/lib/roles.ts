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
    accountName: "Patient",
    accountSubtitle: `Member · Policy #${canonicalFixtures.activePolicy.policyId}`,
    accountEmail: "alex.rivera@member.qlo.health",
    accountAddress: canonicalFixtures.accounts.patient as `0x${string}`,
    badgeCode: "MEMBER",
    actorName: "Patient",
    channelName: "#patient-vault",
    portalHref: "/patient",
    portalLabel: "Open Records Vault",
    accentHex: "#059669",
    contractGate: "HealthRecords.patient == msg.sender",
    gateDescription:
      "Record owner signs encryption, grants, and revocations.",
    canSee: [
      "Local OCR and bill fields",
      "AES-256-GCM key and backup",
      "Active grants and revocation",
    ],
    hiddenFromRole: [
      "Provider billing queue",
      "Payer treasury reserves",
    ],
  },
  hospital: {
    id: "hospital",
    label: "Hospital",
    shortLabel: "Provider",
    accountName: "Hospital",
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
      "Verified hospital address required for Groth16 settlement.",
    canSee: [
      "Patient-authorized records",
      "Local Groth16 proof builder",
      "Claim settlement queue",
    ],
    hiddenFromRole: [
      "Revoked or unshared records",
      "Payer internal reserves",
    ],
  },
  insurer: {
    id: "insurer",
    label: "Insurer",
    shortLabel: "Payer",
    accountName: "Insurer",
    accountSubtitle: "Payer · Escrow Treasury Admin",
    accountEmail: "treasury@meridianhealth.io",
    accountAddress: canonicalFixtures.accounts.insurer as `0x${string}`,
    badgeCode: "ESCROW ADMIN",
    actorName: "Insurer",
    channelName: "#insurer-escrow",
    portalHref: "/insurer",
    portalLabel: "Open Escrow Treasury",
    accentHex: "#D97706",
    contractGate: "PolicyRegistry.insurer & ClaimsVault.insurerEscrow",
    gateDescription:
      "Registered payer account required for escrow and audit.",
    canSee: [
      "Groth16 proofs and public signals",
      "Policy spend and nullifiers",
      "Zero-PHI calldata and FHIR receipts",
    ],
    hiddenFromRole: [
      "Patient identity and diagnoses",
      "Clinical notes and raw bills",
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
    return `Connected Ethereum Sepolia wallet lacks ${targetMeta.label} access (${targetMeta.contractGate}).`;
  }
  const activeMeta = ROLE_META[activeRole];
  return `Signed in as ${activeMeta.accountName}. This page requires ${targetMeta.label} access. Switch to an approved wallet in MetaMask.`;
}
