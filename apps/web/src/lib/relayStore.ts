import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import canonicalFixtures from "@/lib/canonicalFixtures.json";

export interface RelayEncryptedEnvelope {
  version: 1;
  alg: "AES-256-GCM";
  ivBase64: string;
  ciphertextBase64: string;
}

export interface RelayCiphertextRecord {
  cid: string;
  recordCommitmentHex: `0x${string}`;
  recordId?: string;
  envelope: RelayEncryptedEnvelope;
  createdAt: string;
  patientAddress?: string;
  hospitalAddress?: string;
  displayLabel: string;
}

export interface RelayRecordMeta {
  recordId: string;
  patient: string;
  recordCommitmentHex: `0x${string}`;
  cid: string;
  createdAt: number;
}

export interface RelayGrant {
  expiresAt: number;
  encryptedDekHex: `0x${string}`;
}

export interface RelayAuditEntry {
  id: string;
  kind: "registered" | "granted" | "revoked" | "accessed" | "settled";
  title: string;
  detail: string;
  timestamp: string;
  txHash?: string;
}

export interface RelaySettledClaim {
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

export interface RelayChainMirror {
  hospitalPubKeys: Record<string, string>;
  insurerEscrowWei: string;
  policySpentWei: Record<string, string>;
  nullifierUsed: Record<string, boolean>;
  nextRecordId: number;
  records: RelayRecordMeta[];
  grants: Record<string, RelayGrant>;
  auditLogs: RelayAuditEntry[];
  settledClaims: RelaySettledClaim[];
}

interface RelayStoreSingleton {
  vaultBundles: Map<string, RelayCiphertextRecord>;
  chainState: RelayChainMirror;
}

const MAX_VAULT_BUNDLES = 2000;
const MAX_AUDIT_LOGS = 1000;

function prependAudit(state: RelayChainMirror, entry: RelayAuditEntry): void {
  state.auditLogs = [entry, ...state.auditLogs].slice(0, MAX_AUDIT_LOGS);
}
const MAX_CIPHERTEXT_B64_LEN = 96_000;
const VAULT_DISK_CACHE = path.join(os.tmpdir(), "qlo-zero-phi-vault.json");

const FORBIDDEN_PHI_KEYS = new Set([
  "icd10code",
  "cptcode",
  "prescription",
  "clinicalnotes",
  "patientalias",
  "dekrawbytes",
  "dekbase64",
  "plaintext",
  "diagnosis",
  "renderingnpi",
  "summaryhint",
  "icd10",
  "cpt",
  "rx",
]);

const PHI_VALUE_CANARIES = [
  "i21.0",
  "i25.10",
  "z41.1",
  "aspirin",
  "ticagrelor",
  "synth-case",
  "botox",
  "cpt 99285",
  "cpt 99214",
  "cpt 15777",
];

const GENERIC_ICD10_REGEX = /\b[A-TV-Z][0-9]{2}\.[0-9A-Z]{1,4}\b/i;
const SSN_REGEX = /\b\d{3}-\d{2}-\d{4}\b/;

function createDefaultChainState(): RelayChainMirror {
  return {
    hospitalPubKeys: {},
    insurerEscrowWei: "1000000000000000000", // 1.00 ETH seeded escrow
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

function loadVaultDiskCache(targetMap: Map<string, RelayCiphertextRecord>): void {
  try {
    if (!fs.existsSync(VAULT_DISK_CACHE)) return;
    const raw = fs.readFileSync(VAULT_DISK_CACHE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return;
    for (const entry of parsed.slice(0, MAX_VAULT_BUNDLES)) {
      if (
        Array.isArray(entry) &&
        typeof entry[0] === "string" &&
        entry[1] &&
        typeof entry[1] === "object"
      ) {
        targetMap.set(entry[0], entry[1] as RelayCiphertextRecord);
      }
    }
  } catch {
    // Non-fatal on read-only or fresh environments
  }
}

function persistVaultCache(map: Map<string, RelayCiphertextRecord>): void {
  try {
    const entries = Array.from(map.entries()).slice(0, MAX_VAULT_BUNDLES);
    fs.writeFileSync(VAULT_DISK_CACHE, JSON.stringify(entries));
  } catch {
    // Non-fatal in read-only serverless containers
  }
}

const PERSIST_ENABLED = process.env.NODE_ENV !== "test";
const CHAIN_DISK_CACHE = path.join(
  process.env.QLO_DATA_DIR || os.tmpdir(),
  "qlo-relay-chain.json"
);

function loadChainDiskCache(): RelayChainMirror | null {
  if (!PERSIST_ENABLED) return null;
  try {
    if (!fs.existsSync(CHAIN_DISK_CACHE)) return null;
    const parsed = JSON.parse(fs.readFileSync(CHAIN_DISK_CACHE, "utf8")) as Partial<RelayChainMirror>;
    if (
      !parsed ||
      typeof parsed.insurerEscrowWei !== "string" ||
      !Array.isArray(parsed.records) ||
      !Array.isArray(parsed.settledClaims) ||
      !Array.isArray(parsed.auditLogs)
    ) {
      return null;
    }
    return { ...createDefaultChainState(), ...parsed } as RelayChainMirror;
  } catch {
    return null;
  }
}

function persistChainState(state: RelayChainMirror): void {
  if (!PERSIST_ENABLED) return;
  try {
    fs.writeFileSync(CHAIN_DISK_CACHE, JSON.stringify(state));
  } catch {
    // Non-fatal in read-only serverless containers
  }
}

declare global {
  var __qloRelayStore: RelayStoreSingleton | undefined;
}

export function getRelayStore(): RelayStoreSingleton {
  if (!globalThis.__qloRelayStore) {
    const vaultBundles = new Map<string, RelayCiphertextRecord>();
    loadVaultDiskCache(vaultBundles);
    globalThis.__qloRelayStore = {
      vaultBundles,
      chainState: loadChainDiskCache() ?? createDefaultChainState(),
    };
  }
  return globalThis.__qloRelayStore;
}

/**
 * Enforces strict server-side Zero-PHI guarantees: rejects any payload
 * carrying plaintext clinical field names, ICD-10 patterns, SSNs, or canary values outside ciphertext.
 */
export function assertZeroPhiPayload(payload: unknown): string | null {
  const visit = (node: unknown, keyPath: string): string | null => {
    if (node === null || node === undefined) return null;
    if (typeof node === "string") {
      if (
        keyPath.endsWith("envelope.ciphertextBase64") ||
        keyPath.endsWith("envelope.ivBase64") ||
        keyPath.endsWith(".createdAt") ||
        keyPath.endsWith(".timestamp") ||
        keyPath.endsWith(".cid")
      ) {
        return null;
      }
      if (/^0x[0-9a-f]+$/i.test(node) || /^baf[a-z0-9]+$/i.test(node)) {
        return null;
      }
      const lower = node.toLowerCase();
      for (const canary of PHI_VALUE_CANARIES) {
        if (lower.includes(canary)) {
          return `Forbidden clinical token "${canary}" detected at ${keyPath}`;
        }
      }
      if (GENERIC_ICD10_REGEX.test(node)) {
        return `Unencrypted ICD-10 diagnosis code pattern rejected at ${keyPath}`;
      }
      if (SSN_REGEX.test(node)) {
        return `Unencrypted identifier pattern rejected at ${keyPath}`;
      }
      return null;
    }
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        const hit = visit(node[i], `${keyPath}[${i}]`);
        if (hit) return hit;
      }
      return null;
    }
    if (typeof node === "object") {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (FORBIDDEN_PHI_KEYS.has(k.toLowerCase())) {
          return `Forbidden plaintext PHI key "${k}" rejected at ${keyPath}`;
        }
        const hit = visit(v, keyPath ? `${keyPath}.${k}` : k);
        if (hit) return hit;
      }
    }
    return null;
  };

  return visit(payload, "payload");
}

export function clearVaultRecords(): void {
  const store = getRelayStore();
  store.vaultBundles.clear();
  persistVaultCache(store.vaultBundles);
}

export function deleteVaultRecord(recordCommitmentHex: string): void {
  const store = getRelayStore();
  store.vaultBundles.delete(recordCommitmentHex.trim().toLowerCase());
  persistVaultCache(store.vaultBundles);
}

export function resetRelayStore(): RelayChainMirror {
  const store = getRelayStore();
  store.vaultBundles.clear();
  persistVaultCache(store.vaultBundles);
  store.chainState = createDefaultChainState();
  persistChainState(store.chainState);
  return store.chainState;
}

export function upsertVaultRecord(raw: unknown): RelayCiphertextRecord {
  const body = raw as Record<string, unknown>;
  const cid = String(body.cid ?? "").trim();
  const commit = String(body.recordCommitmentHex ?? "").trim().toLowerCase();
  const env = body.envelope as RelayEncryptedEnvelope | undefined;

  if (!cid || !/^baf[a-z0-9]{10,}$/i.test(cid)) {
    throw new Error("Invalid CIDv1 identifier");
  }
  if (!/^0x[0-9a-f]{64}$/i.test(commit)) {
    throw new Error("Invalid 248-bit recordCommitmentHex");
  }
  if (
    !env ||
    env.version !== 1 ||
    env.alg !== "AES-256-GCM" ||
    typeof env.ivBase64 !== "string" ||
    typeof env.ciphertextBase64 !== "string" ||
    env.ciphertextBase64.length > MAX_CIPHERTEXT_B64_LEN
  ) {
    throw new Error("Invalid AES-256-GCM encrypted envelope");
  }

  const ivBuf = Buffer.from(env.ivBase64, "base64");
  const cipherBuf = Buffer.from(env.ciphertextBase64, "base64");
  if (ivBuf.length !== 12 || cipherBuf.length < 24) {
    throw new Error("Invalid AES-256-GCM IV or ciphertext byte length");
  }

  const canonicalEnvelope: RelayEncryptedEnvelope = {
    version: 1,
    alg: "AES-256-GCM",
    ivBase64: env.ivBase64,
    ciphertextBase64: env.ciphertextBase64,
  };
  const digestHex = crypto
    .createHash("sha256")
    .update(Buffer.from(JSON.stringify(canonicalEnvelope), "utf8"))
    .digest("hex");
  const expectedCommit = (
    "0x" + (BigInt("0x" + digestHex) >> 8n).toString(16).padStart(64, "0")
  ).toLowerCase();
  if (expectedCommit !== commit) {
    throw new Error("Ciphertext does not match declared 248-bit recordCommitmentHex");
  }

  const store = getRelayStore();
  const existing = store.vaultBundles.get(commit);
  if (!existing && store.vaultBundles.size >= MAX_VAULT_BUNDLES) {
    let oldestKey: string | null = null;
    let oldestTime = "\uffff";
    for (const [k, v] of store.vaultBundles.entries()) {
      if (v.createdAt < oldestTime) {
        oldestTime = v.createdAt;
        oldestKey = k;
      }
    }
    if (oldestKey) store.vaultBundles.delete(oldestKey);
  }

  const recordId =
    typeof body.recordId === "string" && body.recordId.trim()
      ? body.recordId.trim()
      : existing?.recordId;
  const label =
    recordId && /^\d+$/.test(recordId)
      ? `Encrypted Record #${recordId}`
      : `Encrypted Envelope (${cid.slice(0, 12)}...)`;

  const entry: RelayCiphertextRecord = {
    cid,
    recordCommitmentHex: commit as `0x${string}`,
    recordId,
    envelope: canonicalEnvelope,
    createdAt:
      typeof body.createdAt === "string" && body.createdAt
        ? body.createdAt
        : existing?.createdAt ?? new Date().toISOString(),
    patientAddress:
      typeof body.patientAddress === "string"
        ? body.patientAddress
        : existing?.patientAddress,
    hospitalAddress:
      typeof body.hospitalAddress === "string"
        ? body.hospitalAddress
        : existing?.hospitalAddress,
    displayLabel: label,
  };

  store.vaultBundles.set(commit, entry);
  persistVaultCache(store.vaultBundles);
  return entry;
}

export function applyRelayAction(body: Record<string, unknown>): RelayChainMirror {
  const next = applyRelayActionUnpersisted(body);
  persistChainState(next);
  return next;
}

function applyRelayActionUnpersisted(body: Record<string, unknown>): RelayChainMirror {
  const store = getRelayStore();
  const state = store.chainState;
  const action = String(body.action ?? "");
  const timestamp = new Date().toLocaleTimeString();

  if (action === "reset") {
    return resetRelayStore();
  }

  if (action === "publishPubKey") {
    const hospitalAddress = String(body.hospitalAddress ?? "").trim().toLowerCase();
    const publicKeyHex = String(body.publicKeyHex ?? "").trim();
    const force = Boolean(body.force);
    if (!/^0x[0-9a-f]{40}$/i.test(hospitalAddress)) {
      throw new Error("Invalid hospital address");
    }
    if (!/^0x04[0-9a-f]{128}$/i.test(publicKeyHex)) {
      throw new Error("Invalid uncompressed P-256 public key");
    }
    if (force || !state.hospitalPubKeys[hospitalAddress]) {
      state.hospitalPubKeys[hospitalAddress] = publicKeyHex;
    }
    return state;
  }

  if (action === "registerRecord") {
    const commit = String(body.recordCommitmentHex ?? "").trim().toLowerCase();
    const cid = String(body.cid ?? "").trim();
    const patient = String(body.patient ?? canonicalFixtures.accounts.patient).trim();
    if (!/^0x[0-9a-f]{64}$/i.test(commit) || !cid) {
      throw new Error("Invalid record registration payload");
    }
    const existing = state.records.find(
      (r) => r.recordCommitmentHex.toLowerCase() === commit
    );
    const recId = existing ? existing.recordId : String(state.nextRecordId);
    if (!existing) {
      state.nextRecordId += 1;
      state.records.push({
        recordId: recId,
        patient,
        recordCommitmentHex: commit as `0x${string}`,
        cid,
        createdAt: Math.floor(Date.now() / 1000),
      });
    }
    const bundle = store.vaultBundles.get(commit);
    if (bundle) {
      bundle.recordId = recId;
      bundle.displayLabel = `Encrypted Record #${recId}`;
      persistVaultCache(store.vaultBundles);
    }
    prependAudit(state, {
      id: `reg-${Date.now()}-${recId}`,
      kind: "registered",
      title: `Record #${recId} Registered (Clearinghouse Relay)`,
      detail: `CIDv1 ${cid} | 248-bit Commit ${commit}`,
      timestamp,
    });
    return state;
  }

  if (action === "grant") {
    const recordId = String(body.recordId ?? "").trim();
    const hospitalAddress = String(body.hospitalAddress ?? "").trim().toLowerCase();
    const expiresAt = Number(body.expiresAt ?? 0);
    const grantMinutes = Number(body.grantMinutes ?? 10);
    const encryptedDekHex = String(body.encryptedDekHex ?? "").trim() as `0x${string}`;
    const recordCommitmentHex = String(body.recordCommitmentHex ?? "")
      .trim()
      .toLowerCase();
    const hospitalPubKeyHex = String(body.hospitalPubKeyHex ?? "").trim();

    if (!recordId || !/^0x[0-9a-f]{40}$/i.test(hospitalAddress) || !expiresAt) {
      throw new Error("Invalid grant payload");
    }
    if (!/^0x[0-9a-f]{64,}$/i.test(encryptedDekHex)) {
      throw new Error("Invalid ECDH-wrapped DEK payload");
    }
    if (/^0x04[0-9a-f]{128}$/i.test(hospitalPubKeyHex)) {
      state.hospitalPubKeys[hospitalAddress] = hospitalPubKeyHex;
    }
    state.grants[`${recordId}:${hospitalAddress}`] = {
      expiresAt,
      encryptedDekHex,
    };
    const bundle = store.vaultBundles.get(recordCommitmentHex);
    if (bundle) {
      bundle.hospitalAddress = hospitalAddress;
      bundle.recordId = recordId;
      bundle.displayLabel = `Encrypted Record #${recordId}`;
      persistVaultCache(store.vaultBundles);
    }
    prependAudit(state, {
      id: `grant-${Date.now()}-${recordId}`,
      kind: "granted",
      title: `Access Granted (${grantMinutes}m) — Record #${recordId}`,
      detail: `Hospital ${hospitalAddress} | ECDH P-256 Wrapped DEK (${(encryptedDekHex.length - 2) / 2} bytes)`,
      timestamp,
    });
    return state;
  }

  if (action === "revoke") {
    const recordId = String(body.recordId ?? "").trim();
    const hospitalAddress = String(body.hospitalAddress ?? "").trim().toLowerCase();
    if (!recordId || !/^0x[0-9a-f]{40}$/i.test(hospitalAddress)) {
      throw new Error("Invalid revoke payload");
    }
    // Keep ciphertext content-addressed like IPFS; delete only the wrapped DEK grant.
    delete state.grants[`${recordId}:${hospitalAddress}`];
    prependAudit(state, {
      id: `rev-${Date.now()}-${recordId}`,
      kind: "revoked",
      title: `Access Revoked — Record #${recordId}`,
      detail: `Hospital ${hospitalAddress} blocked; wrapped DEK deleted`,
      timestamp,
    });
    return state;
  }

  if (action === "logAccess") {
    const recordId = String(body.recordId ?? "?").trim();
    const hospitalAddress = String(body.hospitalAddress ?? "").trim();
    prependAudit(state, {
      id: `log-acc-${Date.now()}-${recordId}`,
      kind: "accessed",
      title: `Explicit Access Audit Logged — Record #${recordId}`,
      detail: `HealthRecords.logAccess(${recordId}) verified for ${hospitalAddress}`,
      timestamp,
    });
    return state;
  }

  if (action === "settle") {
    const recordCommitmentHex = String(body.recordCommitmentHex ?? "").trim();
    const hospitalAddress = String(body.hospitalAddress ?? "").trim();
    const policyCommitment = String(body.policyCommitment ?? "").trim();
    const nullifier = String(body.nullifier ?? "").trim();
    const amountWeiStr = String(body.amountWei ?? "0").trim();
    const rawCalldataHex = String(body.rawCalldataHex ?? "").trim();
    const pubSignals = Array.isArray(body.pubSignals)
      ? body.pubSignals.map((x) => String(x))
      : [];
    const txHash = String(body.txHash ?? "").trim();
    const amount = BigInt(amountWeiStr);

    const rec = state.records.find(
      (r) => r.recordCommitmentHex.toLowerCase() === recordCommitmentHex.toLowerCase()
    );
    if (!rec) {
      throw new Error("ClaimsVault.PatientAccessNotActive()");
    }
    const grant = state.grants[`${rec.recordId}:${hospitalAddress.toLowerCase()}`];
    if (!grant || grant.expiresAt <= Math.floor(Date.now() / 1000)) {
      throw new Error("ClaimsVault.PatientAccessNotActive()");
    }
    if (state.nullifierUsed[nullifier]) {
      throw new Error("ClaimsVault.NullifierAlreadyUsed()");
    }
    if (BigInt(state.insurerEscrowWei) < amount) {
      throw new Error("ClaimsVault.InsufficientEscrow()");
    }

    state.nullifierUsed[nullifier] = true;
    state.policySpentWei[policyCommitment] = (
      BigInt(state.policySpentWei[policyCommitment] ?? "0") + amount
    ).toString();
    state.insurerEscrowWei = (BigInt(state.insurerEscrowWei) - amount).toString();

    state.settledClaims = [
      {
        txHash,
        nullifier,
        policyCommitment,
        recordCommitmentHex,
        hospital: hospitalAddress,
        amountWei: amountWeiStr,
        settledAt: Math.floor(Date.now() / 1000),
        rawCalldataHex,
        pubSignals,
      },
      ...state.settledClaims,
    ];

    const ethStr = (Number(amount) / 1e18).toFixed(4);
    prependAudit(state, {
      id: `settle-${Date.now()}-${nullifier.slice(0, 8)}`,
      kind: "settled",
      title: `Claim Settled (+${ethStr} ETH)`,
      detail: `Nullifier ${nullifier.slice(0, 16)}... | Zero PHI emitted`,
      timestamp,
      txHash,
    });
    return state;
  }

  if (action === "deposit") {
    const amount = BigInt(String(body.amountWei ?? "0"));
    if (amount <= 0n) throw new Error("Deposit amount must be positive");
    state.insurerEscrowWei = (BigInt(state.insurerEscrowWei) + amount).toString();
    return state;
  }

  if (action === "withdraw") {
    const amount = BigInt(String(body.amountWei ?? "0"));
    const bal = BigInt(state.insurerEscrowWei);
    if (amount <= 0n || bal < amount) {
      throw new Error("Insufficient escrow balance to withdraw");
    }
    state.insurerEscrowWei = (bal - amount).toString();
    return state;
  }

  throw new Error(`Unsupported relay action: ${action}`);
}
