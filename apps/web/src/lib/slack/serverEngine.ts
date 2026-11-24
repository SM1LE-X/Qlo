import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  parseEther,
  toHex,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { ClaimsVaultAbi, HealthRecordsAbi } from "@/contracts/abis";
import canonicalFixtures from "@/lib/canonicalFixtures.json";
import { DEPLOYMENT, explorerTxUrl } from "@/lib/contracts";

export interface VisitPreset {
  readonly id: string;
  readonly label: string;
  readonly categoryLabel: string;
  readonly cptCode: number;
  readonly icd10Code: string;
  readonly amountEth: string;
  readonly excluded?: boolean;
}

export const VISIT_PRESETS: readonly VisitPreset[] = [
  {
    id: "cardiac_er",
    label: "Emergency Cardiac Care — 0.0020 ETH",
    categoryLabel: "Emergency Visit",
    cptCode: 99285,
    icd10Code: "I21.0",
    amountEth: "0.0020",
  },
  {
    id: "outpatient_followup",
    label: "Specialist Follow-Up — 0.0010 ETH",
    categoryLabel: "Outpatient Visit",
    cptCode: 99214,
    icd10Code: "I10",
    amountEth: "0.0010",
  },
  {
    id: "orthopedic_care",
    label: "Orthopedic Fracture Care — 0.0020 ETH",
    categoryLabel: "Surgical Care",
    cptCode: 27750,
    icd10Code: "S82.201A",
    amountEth: "0.0020",
  },
  {
    id: "diagnostic_ecg",
    label: "Cardiac ECG & Diagnostics — 0.0010 ETH",
    categoryLabel: "Diagnostics",
    cptCode: 93000,
    icd10Code: "R07.9",
    amountEth: "0.0010",
  },
  {
    id: "excluded_cosmetic",
    label: "Cosmetic Procedure (Excluded Policy Test) — 0.0020 ETH",
    categoryLabel: "Excluded Procedure",
    cptCode: 15777,
    icd10Code: "Z41.1",
    amountEth: "0.0020",
    excluded: true,
  },
];

export const PROVIDER_OPTIONS = [
  { id: "metro_cardiac", name: "Metro Cardiac Center", npi: "1234567890" },
  { id: "bay_surgical", name: "Bay General Surgical", npi: "1987654321" },
] as const;

export function findVisitPreset(id: string): VisitPreset {
  return VISIT_PRESETS.find((v) => v.id === id) ?? VISIT_PRESETS[0];
}

export function findProviderName(id: string): string {
  return PROVIDER_OPTIONS.find((p) => p.id === id)?.name ?? PROVIDER_OPTIONS[0].name;
}

const TREE_DEPTH = 6;
const TREE_SIZE = 1 << TREE_DEPTH;

type PoseidonFn = ((inputs: bigint[]) => unknown) & {
  F: { toObject: (el: unknown) => bigint };
};

let poseidonPromise: Promise<PoseidonFn> | null = null;

async function getPoseidon(): Promise<PoseidonFn> {
  if (!poseidonPromise) {
    poseidonPromise = (async () => {
      const mod = (await import("circomlibjs")) as { buildPoseidon: () => Promise<PoseidonFn> };
      return mod.buildPoseidon();
    })();
  }
  return poseidonPromise;
}

async function poseidonHash(inputs: (bigint | string | number)[]): Promise<bigint> {
  const poseidon = await getPoseidon();
  const out = poseidon(inputs.map((x) => BigInt(x)));
  return BigInt(poseidon.F.toObject(out));
}

async function buildMerkleTree(leaves: (bigint | string | number)[]) {
  const padded = new Array<bigint>(TREE_SIZE).fill(0n);
  for (let i = 0; i < Math.min(leaves.length, TREE_SIZE); i++) {
    padded[i] = BigInt(leaves[i]);
  }
  const layers: bigint[][] = [padded];
  let current = padded;
  for (let level = 0; level < TREE_DEPTH; level++) {
    const next: bigint[] = [];
    for (let i = 0; i < current.length; i += 2) {
      next.push(await poseidonHash([current[i], current[i + 1]]));
    }
    layers.push(next);
    current = next;
  }
  const root = layers[TREE_DEPTH][0];

  function getProof(index: number) {
    const pathElements: string[] = [];
    const pathIndices: number[] = [];
    let idx = index;
    for (let level = 0; level < TREE_DEPTH; level++) {
      const isRight = idx & 1;
      const siblingIdx = isRight ? idx - 1 : idx + 1;
      pathElements.push(layers[level][siblingIdx].toString());
      pathIndices.push(isRight);
      idx = idx >> 1;
    }
    return { pathElements, pathIndices, root };
  }

  return { root, getProof };
}

function getRpcUrl(): string {
  return (
    process.env.SEPOLIA_RPC_URL?.trim() ||
    process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL?.trim() ||
    "https://ethereum-sepolia-rpc.publicnode.com"
  );
}

function createSepoliaPublicClient() {
  return createPublicClient({
    chain: sepolia,
    transport: http(getRpcUrl(), { timeout: 12_000 }),
  });
}

function getRelayerAccount() {
  const raw = (process.env.SEPOLIA_RELAYER_PRIVATE_KEY ?? "").trim();
  if (!raw) return null;
  const normalized = (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
  try {
    return privateKeyToAccount(normalized);
  } catch {
    return null;
  }
}

export interface LiveChainSummary {
  escrowEth: string;
  settledCount: number;
  policySpentEth: string;
  policySpentWei: bigint;
  networkLive: boolean;
  relayerEnabled: boolean;
  relayerBalanceEth?: string;
  rpcLatencyMs?: number;
  readAt: number;
}

let lastGoodSummary: LiveChainSummary | null = null;

export async function readLiveChainSummary(): Promise<LiveChainSummary> {
  const relayer = getRelayerAccount();
  const relayerEnabled = Boolean(relayer);
  const t0 = Date.now();
  try {
    const client = createSepoliaPublicClient();
    const vault = DEPLOYMENT.contracts.ClaimsVault as Address;
    const insurer = DEPLOYMENT.seededInsurer as Address;
    const policyCommit = BigInt(canonicalFixtures.activePolicy.commitment);

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("RPC_TIMEOUT")), 6_000)
    );
    const [escrowWei, settledCount, policySpentWei, relayerWei] = await Promise.race([
      Promise.all([
        client.readContract({ address: vault, abi: ClaimsVaultAbi, functionName: "insurerEscrow", args: [insurer] }),
        client.readContract({ address: vault, abi: ClaimsVaultAbi, functionName: "totalClaimsSettled" }),
        client.readContract({ address: vault, abi: ClaimsVaultAbi, functionName: "policySpent", args: [policyCommit] }),
        relayer ? client.getBalance({ address: relayer.address }) : Promise.resolve(null),
      ]),
      timeout,
    ]);

    lastGoodSummary = {
      escrowEth: Number(formatEther(escrowWei)).toFixed(4),
      settledCount: Number(settledCount),
      policySpentEth: Number(formatEther(policySpentWei)).toFixed(4),
      policySpentWei,
      networkLive: true,
      relayerEnabled,
      relayerBalanceEth: relayerWei === null ? undefined : Number(formatEther(relayerWei)).toFixed(4),
      rpcLatencyMs: Date.now() - t0,
      readAt: Date.now(),
    };
    return lastGoodSummary;
  } catch {
    // Never invent numbers: serve the last verified on-chain read, flagged as cached.
    if (lastGoodSummary) return { ...lastGoodSummary, networkLive: false };
    return {
      escrowEth: "—",
      settledCount: 0,
      policySpentEth: "—",
      policySpentWei: 0n,
      networkLive: false,
      relayerEnabled,
      readAt: Date.now(),
    };
  }
}

export interface SealedRecordResult {
  recordId: number;
  recordCommitmentHex: Hex;
  recordCommitmentDec: string;
  cid: string;
  hospitalAddress: Address;
  expiresAtIso: string;
  onChain: boolean;
  txHash?: Hex;
  explorerUrl?: string;
}

/**
 * Encrypts clinical intake ephemerally with AES-256-GCM, computes the 248-bit commitment,
 * and anchors + grants access on Ethereum Sepolia when the relayer key is configured.
 */
export async function sealAndGrantBill(params: {
  visit: VisitPreset;
  providerName: string;
  durationSec: number;
  notes?: string;
}): Promise<SealedRecordResult> {
  const dek = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", dek, iv);
  const payload = JSON.stringify({
    cptCode: params.visit.cptCode,
    icd10Code: params.visit.icd10Code,
    amountEth: params.visit.amountEth,
    provider: params.providerName,
    notes: params.notes ?? "",
    nonce: crypto.randomBytes(12).toString("hex"),
  });
  const ciphertext = Buffer.concat([cipher.update(payload, "utf8"), cipher.final(), cipher.getAuthTag()]);

  // Truncate SHA-256 to 248 bits (top byte = 0x00) so it is strictly < BN254 scalar field.
  const digest = crypto.createHash("sha256").update(ciphertext).digest();
  digest[0] = 0;
  const recordCommitmentHex = `0x${digest.toString("hex")}` as Hex;
  const recordCommitmentDec = BigInt(recordCommitmentHex).toString();
  const cid = `bafkrei${digest.toString("hex").slice(0, 44)}`;
  const expiresAtIso = new Date(Date.now() + params.durationSec * 1000).toISOString();

  const relayer = getRelayerAccount();
  if (!relayer) {
    const localId = Math.floor(Date.now() / 1000) % 100_000;
    return {
      recordId: localId,
      recordCommitmentHex,
      recordCommitmentDec,
      cid,
      hospitalAddress: canonicalFixtures.hospitals[0].address as Address,
      expiresAtIso,
      onChain: false,
    };
  }

  const publicClient = createSepoliaPublicClient();
  const walletClient = createWalletClient({
    account: relayer,
    chain: sepolia,
    transport: http(getRpcUrl(), { timeout: 25_000 }),
  });

  const healthRecords = DEPLOYMENT.contracts.HealthRecords as Address;
  const regTx = await walletClient.writeContract({
    address: healthRecords,
    abi: HealthRecordsAbi,
    functionName: "registerRecord",
    args: [recordCommitmentHex, cid],
  });
  await publicClient.waitForTransactionReceipt({ hash: regTx, timeout: 45_000 });

  const recordIdBig = await publicClient.readContract({
    address: healthRecords,
    abi: HealthRecordsAbi,
    functionName: "commitmentToRecordId",
    args: [recordCommitmentHex],
  });

  const wrappedDekHex = toHex(crypto.randomBytes(48));
  const grantTx = await walletClient.writeContract({
    address: healthRecords,
    abi: HealthRecordsAbi,
    functionName: "grantAccess",
    args: [recordIdBig, relayer.address, BigInt(params.durationSec), wrappedDekHex],
  });
  await publicClient.waitForTransactionReceipt({ hash: grantTx, timeout: 45_000 });

  return {
    recordId: Number(recordIdBig),
    recordCommitmentHex,
    recordCommitmentDec,
    cid,
    hospitalAddress: relayer.address,
    expiresAtIso,
    onChain: true,
    txHash: grantTx,
    explorerUrl: explorerTxUrl(grantTx),
  };
}

export async function revokeRecordAccess(params: {
  recordId: number;
  onChain: boolean;
}): Promise<{ ok: boolean; onChain: boolean; txHash?: Hex; explorerUrl?: string }> {
  const relayer = getRelayerAccount();
  if (!relayer || !params.onChain || params.recordId <= 0) {
    return { ok: true, onChain: false };
  }

  const publicClient = createSepoliaPublicClient();
  const walletClient = createWalletClient({
    account: relayer,
    chain: sepolia,
    transport: http(getRpcUrl(), { timeout: 25_000 }),
  });

  const txHash = await walletClient.writeContract({
    address: DEPLOYMENT.contracts.HealthRecords as Address,
    abi: HealthRecordsAbi,
    functionName: "revokeAccess",
    args: [BigInt(params.recordId), relayer.address],
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 45_000 });

  return {
    ok: true,
    onChain: true,
    txHash,
    explorerUrl: explorerTxUrl(txHash),
  };
}

export interface SettlementResult {
  ok: boolean;
  code?: string;
  reason?: string;
  onChain: boolean;
  txHash?: Hex;
  explorerUrl?: string;
  nullifier?: string;
  policyCommitment?: string;
  proofElapsedMs?: number;
}

/**
 * Runs real Circom 2 Groth16 BN254 proving in Node.js and settles atomically on Ethereum Sepolia.
 */
export async function proveAndSettleClaim(params: {
  cptCode: number;
  amountEth: string;
  recordCommitmentHex: Hex;
  onChainRecord: boolean;
}): Promise<SettlementResult> {
  if (!canonicalFixtures.coveredCpts.includes(params.cptCode)) {
    return {
      ok: false,
      code: "POLICY_EXCLUDED",
      reason: "Procedure category is excluded under the active policy. 0 ETH released.",
      onChain: false,
    };
  }

  const relayer = getRelayerAccount();
  const hospitalEntry = relayer
    ? canonicalFixtures.hospitals.find(
        (h) => h.address.toLowerCase() === relayer.address.toLowerCase()
      ) ?? canonicalFixtures.hospitals[2]
    : canonicalFixtures.hospitals[0];

  const hospitalAddress = hospitalEntry.address as Address;
  const publicClient = createSepoliaPublicClient();

  if (relayer && params.onChainRecord) {
    const active = await publicClient.readContract({
      address: DEPLOYMENT.contracts.HealthRecords as Address,
      abi: HealthRecordsAbi,
      functionName: "hasActiveAccessByCommitment",
      args: [params.recordCommitmentHex, relayer.address],
    });
    if (!active) {
      return {
        ok: false,
        code: "ACCESS_REVOKED",
        reason: "Patient access grant was revoked or expired. Settlement blocked.",
        onChain: true,
      };
    }
  }

  const chainSummary = await readLiveChainSummary();
  if (relayer && !chainSummary.networkLive) {
    return {
      ok: false,
      code: "RPC_UNAVAILABLE",
      reason: "Sepolia RPC unreachable — settlement paused to avoid proving against stale policy state. Retry in a moment.",
      onChain: true,
    };
  }
  const claimAmountWei = parseEther(params.amountEth);
  const annualLimitWei = BigInt(canonicalFixtures.activePolicy.annualLimitWei);
  if (chainSummary.policySpentWei + claimAmountWei > annualLimitWei) {
    return {
      ok: false,
      code: "ANNUAL_CAP_EXCEEDED",
      reason: "Claim exceeds remaining annual policy benefit cap. 0 ETH released.",
      onChain: Boolean(relayer),
    };
  }

  const hospLeaves = await Promise.all(
    canonicalFixtures.hospitals.map((h) =>
      poseidonHash([BigInt(h.address.toLowerCase()), BigInt(h.licenseId)])
    )
  );
  const hospTree = await buildMerkleTree(hospLeaves);
  const hospIdx = canonicalFixtures.hospitals.findIndex(
    (h) => h.address.toLowerCase() === hospitalAddress.toLowerCase()
  );
  const hospProof = hospTree.getProof(hospIdx >= 0 ? hospIdx : 0);

  const cptTree = await buildMerkleTree(canonicalFixtures.coveredCpts);
  const cptIdx = canonicalFixtures.coveredCpts.indexOf(params.cptCode);
  const cptProof = cptTree.getProof(cptIdx >= 0 ? cptIdx : 0);

  const policy = canonicalFixtures.activePolicy;
  const recordCommitment = BigInt(params.recordCommitmentHex);
  const policyCommitment = await poseidonHash([
    policy.policyId,
    policy.patientCommit,
    policy.policyExpiry,
    policy.annualLimitWei,
    cptTree.root,
    policy.policySalt,
  ]);
  const nullifier = await poseidonHash([policy.policySalt, policy.policyId, recordCommitment]);
  const claimTs = BigInt(Math.floor(Date.now() / 1000));

  const circuitInput = {
    hospitalRoot: hospTree.root.toString(),
    policyCommitment: policyCommitment.toString(),
    nullifier: nullifier.toString(),
    claimAmount: claimAmountWei.toString(),
    claimTimestamp: claimTs.toString(),
    recordCommitment: recordCommitment.toString(),
    hospitalAddress: BigInt(hospitalAddress.toLowerCase()).toString(),
    priorPolicySpent: chainSummary.policySpentWei.toString(),
    hospitalLicenseId: hospitalEntry.licenseId,
    hospitalPathElements: hospProof.pathElements,
    hospitalPathIndices: hospProof.pathIndices,
    policyId: policy.policyId,
    patientCommit: policy.patientCommit,
    policyExpiry: policy.policyExpiry,
    annualLimit: policy.annualLimitWei,
    coveredCptRoot: cptTree.root.toString(),
    policySalt: policy.policySalt,
    cptCode: String(params.cptCode),
    cptPathElements: cptProof.pathElements,
    cptPathIndices: cptProof.pathIndices,
  };

  const zkDir = path.join(process.cwd(), "public", "zk");
  const wasmPath = path.join(zkDir, "ClaimValidity.wasm");
  const zkeyPath = path.join(zkDir, "ClaimValidity.zkey");
  const vkeyPath = path.join(zkDir, "verification_key.json");

  const snarkjs = await import("snarkjs");
  const t0 = Date.now();
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    circuitInput,
    wasmPath,
    zkeyPath
  );
  const vkey = JSON.parse(fs.readFileSync(vkeyPath, "utf8"));
  const verified = await snarkjs.groth16.verify(vkey, publicSignals, proof);
  const proofElapsedMs = Date.now() - t0;

  if (!verified) {
    return {
      ok: false,
      code: "INVALID_PROOF",
      reason: "Groth16 proof verification failed.",
      onChain: false,
    };
  }

  const pA: readonly [bigint, bigint] = [BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1])];
  const pB: readonly [readonly [bigint, bigint], readonly [bigint, bigint]] = [
    [BigInt(proof.pi_b[0][1]), BigInt(proof.pi_b[0][0])],
    [BigInt(proof.pi_b[1][1]), BigInt(proof.pi_b[1][0])],
  ];
  const pC: readonly [bigint, bigint] = [BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1])];
  const pubSignals = publicSignals.map((s: string) => BigInt(s)) as unknown as readonly [
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint
  ];

  if (!relayer || !params.onChainRecord) {
    return {
      ok: true,
      onChain: false,
      nullifier: nullifier.toString(),
      policyCommitment: policyCommitment.toString(),
      proofElapsedMs,
    };
  }

  const walletClient = createWalletClient({
    account: relayer,
    chain: sepolia,
    transport: http(getRpcUrl(), { timeout: 30_000 }),
  });

  const txHash = await walletClient.writeContract({
    address: DEPLOYMENT.contracts.ClaimsVault as Address,
    abi: ClaimsVaultAbi,
    functionName: "submitClaim",
    args: [pA, pB, pC, pubSignals],
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 50_000 });

  return {
    ok: true,
    onChain: true,
    txHash,
    explorerUrl: explorerTxUrl(txHash),
    nullifier: nullifier.toString(),
    policyCommitment: policyCommitment.toString(),
    proofElapsedMs,
  };
}
