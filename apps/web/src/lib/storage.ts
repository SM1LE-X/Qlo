"use client";

import { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";
import {
  computeRecordCommitment,
  type EncryptedEnvelope,
} from "./crypto";

export interface StoredVaultEntry {
  cid: string;
  recordCommitmentHex: `0x${string}`;
  recordId?: string;
  envelope: EncryptedEnvelope;
  createdAt: string;
  patientAddress?: string;
  hospitalAddress?: string;
  summaryHint?: string;
}

export interface QloEncryptedBundle {
  schema: "qlo.encrypted-record.v1";
  recordId?: string;
  cid: string;
  recordCommitmentHex: `0x${string}`;
  patientAddress?: string;
  hospitalAddress?: string;
  createdAt: string;
  envelope: EncryptedEnvelope;
}

const VAULT_DB = "qlo-vault-v1";
const VAULT_STORE = "encrypted-records";

export async function computeDeterministicCidV1(bytes: Uint8Array): Promise<string> {
  const digest = await sha256.digest(bytes);
  // 0x55 = raw multicodec
  return CID.createV1(0x55, digest).toString();
}

function openVaultDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(VAULT_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(VAULT_STORE)) {
        const store = db.createObjectStore(VAULT_STORE, { keyPath: "recordCommitmentHex" });
        store.createIndex("cid", "cid", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveEncryptedRecordToVault(
  entry: StoredVaultEntry
): Promise<void> {
  const db = await openVaultDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(VAULT_STORE, "readwrite");
    tx.objectStore(VAULT_STORE).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getEncryptedRecordByCommitment(
  recordCommitmentHex: string
): Promise<StoredVaultEntry | null> {
  const normalized = recordCommitmentHex.toLowerCase();
  const db = await openVaultDb();
  const res = await new Promise<StoredVaultEntry | undefined>((resolve, reject) => {
    const tx = db.transaction(VAULT_STORE, "readonly");
    const req = tx.objectStore(VAULT_STORE).get(normalized);
    req.onsuccess = () => resolve(req.result as StoredVaultEntry | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return res ?? null;
}

export async function getEncryptedRecordByCid(
  cid: string
): Promise<StoredVaultEntry | null> {
  const db = await openVaultDb();
  const res = await new Promise<StoredVaultEntry | undefined>((resolve, reject) => {
    const tx = db.transaction(VAULT_STORE, "readonly");
    const idx = tx.objectStore(VAULT_STORE).index("cid");
    const req = idx.get(cid.trim());
    req.onsuccess = () => resolve(req.result as StoredVaultEntry | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return res ?? null;
}

export async function listVaultEntries(): Promise<StoredVaultEntry[]> {
  const db = await openVaultDb();
  const all = await new Promise<StoredVaultEntry[]>((resolve, reject) => {
    const tx = db.transaction(VAULT_STORE, "readonly");
    const req = tx.objectStore(VAULT_STORE).getAll();
    req.onsuccess = () => resolve((req.result as StoredVaultEntry[]) || []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function serializeQloBundle(entry: StoredVaultEntry): string {
  const bundle: QloEncryptedBundle = {
    schema: "qlo.encrypted-record.v1",
    recordId: entry.recordId,
    cid: entry.cid,
    recordCommitmentHex: entry.recordCommitmentHex,
    patientAddress: entry.patientAddress,
    hospitalAddress: entry.hospitalAddress,
    createdAt: entry.createdAt,
    envelope: entry.envelope,
  };
  return JSON.stringify(bundle, null, 2);
}

/**
 * Imports and cryptographically verifies a `.qlo.json` encrypted bundle:
 * re-computes CIDv1 and 248-bit recordCommitment from ciphertext envelope bytes.
 */
export async function importAndVerifyQloBundle(rawJson: string): Promise<StoredVaultEntry> {
  const bundle = JSON.parse(rawJson) as QloEncryptedBundle;
  if (bundle.schema !== "qlo.encrypted-record.v1" || !bundle.envelope?.ciphertextBase64) {
    throw new Error("Invalid .qlo.json bundle format");
  }

  const envelopeBytes = new TextEncoder().encode(JSON.stringify(bundle.envelope));
  const [computedCid, { recordCommitmentHex }] = await Promise.all([
    computeDeterministicCidV1(envelopeBytes),
    computeRecordCommitment(envelopeBytes),
  ]);

  if (computedCid !== bundle.cid) {
    throw new Error(`CIDv1 integrity mismatch: expected ${bundle.cid}, computed ${computedCid}`);
  }
  if (recordCommitmentHex.toLowerCase() !== bundle.recordCommitmentHex.toLowerCase()) {
    throw new Error("248-bit recordCommitment mismatch against ciphertext envelope");
  }

  const entry: StoredVaultEntry = {
    cid: computedCid,
    recordCommitmentHex,
    recordId: bundle.recordId,
    envelope: bundle.envelope,
    createdAt: bundle.createdAt || new Date().toISOString(),
    patientAddress: bundle.patientAddress,
    hospitalAddress: bundle.hospitalAddress,
  };
  await saveEncryptedRecordToVault(entry);
  return entry;
}

export async function clearVaultEntries(): Promise<void> {
  if (typeof window === "undefined") return;
  const db = await openVaultDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(VAULT_STORE, "readwrite");
    tx.objectStore(VAULT_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
