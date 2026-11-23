"use client";

import {
  keccak256,
  toBytes,
  type Abi,
  type PublicClient,
  type TransactionReceipt,
} from "viem";
import { baseSepolia } from "wagmi/chains";
import { parseEthToWei } from "./utils";

interface CustomErrorDef {
  sig: string;
  name: string;
  explanation: string;
}

const QLO_CUSTOM_ERRORS: CustomErrorDef[] = [
  {
    sig: "NullifierAlreadyUsed()",
    name: "NullifierAlreadyUsed",
    explanation:
      "ClaimsVault.NullifierAlreadyUsed(): This claim was already settled; duplicate payouts are blocked on-chain.",
  },
  {
    sig: "PatientAccessNotActive()",
    name: "PatientAccessNotActive",
    explanation:
      "ClaimsVault.PatientAccessNotActive(): Patient consent is missing, expired, or revoked on-chain.",
  },
  {
    sig: "InsufficientEscrow()",
    name: "InsufficientEscrow",
    explanation:
      "ClaimsVault.InsufficientEscrow(): Insurer escrow balance on Base Sepolia is too low for this claim or withdrawal.",
  },
  {
    sig: "InvalidHospitalRoot()",
    name: "InvalidHospitalRoot",
    explanation:
      "ClaimsVault.InvalidHospitalRoot(): Proof hospital Merkle root does not match on-chain HospitalRegistry.",
  },
  {
    sig: "PolicyNotActive()",
    name: "PolicyNotActive",
    explanation:
      "ClaimsVault.PolicyNotActive(): Policy commitment is inactive or not registered in PolicyRegistry.",
  },
  {
    sig: "ClaimTimestampOutOfWindow()",
    name: "ClaimTimestampOutOfWindow",
    explanation:
      "ClaimsVault.ClaimTimestampOutOfWindow(): Proof timestamp fell outside Base Sepolia's freshness window; re-prove to sync block clock.",
  },
  {
    sig: "HospitalSenderMismatch()",
    name: "HospitalSenderMismatch",
    explanation:
      "ClaimsVault.HospitalSenderMismatch(): Connected MetaMask wallet must match the hospitalAddress bound inside the proof.",
  },
  {
    sig: "PriorSpentMismatch()",
    name: "PriorSpentMismatch",
    explanation:
      "ClaimsVault.PriorSpentMismatch(): On-chain cumulative policySpent changed since proof generation; re-prove to refresh.",
  },
  {
    sig: "InvalidProof()",
    name: "InvalidProof",
    explanation:
      "ClaimsVault.InvalidProof(): On-chain Groth16 BN254 pairing check rejected this proof.",
  },
  {
    sig: "DuplicateRecordCommitment()",
    name: "DuplicateRecordCommitment",
    explanation:
      "HealthRecords.DuplicateRecordCommitment(): This encrypted ciphertext commitment is already registered on-chain.",
  },
  {
    sig: "AccessDeniedOrExpired()",
    name: "AccessDeniedOrExpired",
    explanation:
      "HealthRecords.AccessDeniedOrExpired(): Hospital grant is missing, expired, or revoked.",
  },
  {
    sig: "NotRecordOwner()",
    name: "NotRecordOwner",
    explanation:
      "HealthRecords.NotRecordOwner(): Only the patient wallet that registered this record can modify or revoke grants.",
  },
  {
    sig: "InvalidDuration()",
    name: "InvalidDuration",
    explanation:
      "HealthRecords.InvalidDuration(): Grant duration must be between 60 seconds and 30 days.",
  },
  {
    sig: "InvalidPubKeyLength()",
    name: "InvalidPubKeyLength",
    explanation:
      "HospitalRegistry.InvalidPubKeyLength(): Encryption key must be a 65-byte uncompressed ECDH P-256 key (0x04...).",
  },
  {
    sig: "EnforcedPause()",
    name: "EnforcedPause",
    explanation:
      "ClaimsVault.EnforcedPause(): ClaimsVault treasury settlement is currently paused by governance.",
  },
  {
    sig: "PolicyAlreadyExists()",
    name: "PolicyAlreadyExists",
    explanation:
      "PolicyRegistry.PolicyAlreadyExists(): This policy commitment is already registered on-chain.",
  },
];

const ERROR_SELECTORS: Array<CustomErrorDef & { selector: string }> =
  QLO_CUSTOM_ERRORS.map((item) => ({
    ...item,
    selector: keccak256(toBytes(item.sig)).slice(0, 10).toLowerCase(),
  }));

export async function ensureBaseSepoliaChain(
  chainId: number | undefined,
  switchChainAsync?: (vars: { chainId: number }) => Promise<unknown>
): Promise<void> {
  if (chainId === baseSepolia.id) return;
  if (!switchChainAsync) {
    throw new Error("Switch MetaMask network to Base Sepolia (Chain ID 84532) before submitting.");
  }
  try {
    await switchChainAsync({ chainId: baseSepolia.id });
  } catch (err) {
    throw new Error(decodeContractError(err));
  }
}

export function validatePositiveEthInput(raw: string, label = "ETH amount"): bigint {
  const trimmed = raw.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`${label} must be a valid decimal ETH number.`);
  }
  const wei = parseEthToWei(trimmed);
  if (wei <= 0n) {
    throw new Error(`${label} must be a positive ETH amount.`);
  }
  return wei;
}

function collectErrorText(err: unknown): string {
  const parts: string[] = [];
  let cursor: unknown = err;
  for (let depth = 0; depth < 6 && cursor; depth++) {
    if (typeof cursor === "string") {
      parts.push(cursor);
      break;
    }
    if (typeof cursor === "object") {
      const obj = cursor as {
        name?: unknown;
        shortMessage?: unknown;
        details?: unknown;
        message?: unknown;
        data?: unknown;
        cause?: unknown;
      };
      if (typeof obj.name === "string") parts.push(obj.name);
      if (typeof obj.shortMessage === "string") parts.push(obj.shortMessage);
      if (typeof obj.details === "string") parts.push(obj.details);
      if (typeof obj.message === "string") parts.push(obj.message);
      if (typeof obj.data === "string") parts.push(obj.data);
      cursor = obj.cause;
    } else {
      break;
    }
  }
  return parts.join(" | ");
}

export function decodeContractError(err: unknown): string {
  const raw = collectErrorText(err);
  const lower = raw.toLowerCase();

  if (
    lower.includes("userrejectedrequesterror") ||
    lower.includes("user rejected") ||
    lower.includes("user denied") ||
    lower.includes("4001")
  ) {
    return "Transaction cancelled in wallet.";
  }

  if (
    lower.includes("insufficient funds") ||
    lower.includes("exceeds the balance") ||
    lower.includes("exceeds balance")
  ) {
    return "Insufficient Base Sepolia ETH for gas/value. Fund wallet via a free Base Sepolia faucet.";
  }

  for (const item of ERROR_SELECTORS) {
    if (
      raw.includes(item.name) ||
      lower.includes(item.selector)
    ) {
      return item.explanation;
    }
  }

  if (err && typeof err === "object" && "shortMessage" in err) {
    const shortMsg = (err as { shortMessage?: unknown }).shortMessage;
    if (typeof shortMsg === "string" && shortMsg.trim()) {
      return shortMsg.trim().slice(0, 180);
    }
  }

  if (err instanceof Error && err.message.trim()) {
    return err.message.trim().slice(0, 180);
  }
  return "Transaction failed on Base Sepolia.";
}

export async function preflightSimulateAndWrite(params: {
  publicClient: PublicClient;
  account: `0x${string}`;
  address: `0x${string}`;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
  writeContractAsync: (variables: {
    address: `0x${string}`;
    abi: Abi;
    functionName: string;
    args?: readonly unknown[];
    value?: bigint;
  }) => Promise<`0x${string}`>;
}): Promise<{ hash: `0x${string}`; receipt: TransactionReceipt }> {
  const {
    publicClient,
    account,
    address,
    abi,
    functionName,
    args,
    value,
    writeContractAsync,
  } = params;

  await publicClient.simulateContract({
    account,
    address,
    abi,
    functionName,
    args,
    value,
  });

  const hash = await writeContractAsync({
    address,
    abi,
    functionName,
    args,
    value,
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    timeout: 90_000,
  });

  return { hash, receipt };
}
