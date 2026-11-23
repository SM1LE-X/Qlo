"use client";

import canonicalFixtures from "./canonicalFixtures.json";

export interface LocalRecordMeta {
  recordId: string;
  patient: string;
  recordCommitmentHex: `0x${string}`;
  cid: string;
  createdAt: number;
}

export interface LocalGrant {
  expiresAt: number;
  encryptedDekHex: `0x${string}`;
}

export interface LocalAuditEntry {
  id: string;
  kind: "registered" | "granted" | "revoked" | "accessed" | "settled";
  title: string;
  detail: string;
  timestamp: string;
  txHash?: string;
}

export interface LocalSettledClaim {
  txHash: string;
  nullifier: string;
  policyCommitment: string;
  recordCommitmentHex: string;
  hospital: string;
  amountWei: string;
  settledAt: number;
  rawCalldataHex: string;
  pubSignals: string[];
}

export interface LocalChainMirror {
  hospitalPubKeys: Record<string, string>;
  insurerEscrowWei: string;
  policySpentWei: Record<string, string>;
  nullifierUsed: Record<string, boolean>;
  nextRecordId: number;
  records: LocalRecordMeta[];
  grants: Record<string, LocalGrant>; // key: `${recordId}:${hospital.toLowerCase()}`
  auditLogs: LocalAuditEntry[];
  settledClaims: LocalSettledClaim[];
}

const STORAGE_KEY = "qlo-local-chain-mirror-v1";

function defaultState(): LocalChainMirror {
  return {
    hospitalPubKeys: {},
    insurerEscrowWei: "1000000000000000000", // 1.00 ETH seeded local escrow
    policySpentWei: {
      [canonicalFixtures.activePolicy.commitment]: "0",
    },
    nullifierUsed: {},
    nextRecordId: 1,
    records: [],
    grants: {},
    auditLogs: [],
    settledClaims: [],
  };
}

export function loadLocalChainMirror(): LocalChainMirror {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return { ...defaultState(), ...(JSON.parse(raw) as Partial<LocalChainMirror>) };
  } catch {
    return defaultState();
  }
}

export function saveLocalChainMirror(state: LocalChainMirror): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetLocalChainMirror(): LocalChainMirror {
  const fresh = defaultState();
  saveLocalChainMirror(fresh);
  return fresh;
}
