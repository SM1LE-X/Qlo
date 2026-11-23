"use client";

import type { Abi, PublicClient } from "viem";
import type { AuditEventItem } from "@/components/ui/audit-timeline";
import canonicalFixtures from "./canonicalFixtures.json";
import { CONTRACTS, DEPLOYMENT, explorerTxUrl } from "./contracts";
import type { LocalSettledClaim } from "./localState";

const MAX_LOOKBACK_BLOCKS = 67_500n; // ~37.5 hours at Base Sepolia's 2s block cadence
const LOG_CHUNK_SIZE = 4_500n;

export function computeSafeFromBlock(latestBlock: bigint, deployBlock = 0): bigint {
  const minWindow = latestBlock > MAX_LOOKBACK_BLOCKS ? latestBlock - MAX_LOOKBACK_BLOCKS : 0n;
  const deployStart = BigInt(Math.max(0, deployBlock));
  return deployStart > minWindow ? deployStart : minWindow;
}

/**
 * Fetches contract events in reverse 4,500-block slices so free Base Sepolia RPCs
 * do not fail with eth_getLogs block-range limits and transient older errors never
 * discard newer blocks.
 */
async function getContractEventsChunked(params: {
  publicClient: PublicClient;
  address: `0x${string}`;
  abi: Abi;
  eventName: string;
  fromBlock: bigint;
  toBlock: bigint;
}) {
  const { publicClient, address, abi, eventName, fromBlock, toBlock } = params;
  const collected: Awaited<ReturnType<PublicClient["getContractEvents"]>> = [];

  let cursorEnd = toBlock;
  while (cursorEnd >= fromBlock) {
    const windowStart =
      cursorEnd >= LOG_CHUNK_SIZE ? cursorEnd - LOG_CHUNK_SIZE + 1n : 0n;
    const chunkStart = windowStart > fromBlock ? windowStart : fromBlock;

    try {
      const logs = await publicClient.getContractEvents({
        address,
        abi,
        eventName,
        fromBlock: chunkStart,
        toBlock: cursorEnd,
      });
      collected.push(...logs);
    } catch {
      // Non-fatal: skip transient rate-limited slice so newer blocks still render
    }

    if (chunkStart === 0n || chunkStart <= fromBlock) break;
    cursorEnd = chunkStart - 1n;
  }

  return collected;
}

export interface OnChainVaultSnapshot {
  insurerEscrowWei: bigint | null;
  totalClaimsSettled: number | null;
  totalPayoutWei: bigint | null;
  policySpentWei: bigint | null;
  paused: boolean | null;
  hospitalRoot: bigint | null;
}

export async function fetchOnChainVaultSnapshot(
  publicClient: PublicClient,
  targetInsurer: `0x${string}`
): Promise<OnChainVaultSnapshot> {
  const results = await Promise.allSettled([
    publicClient.readContract({
      address: CONTRACTS.ClaimsVault.address,
      abi: CONTRACTS.ClaimsVault.abi,
      functionName: "insurerEscrow",
      args: [targetInsurer],
    }),
    publicClient.readContract({
      address: CONTRACTS.ClaimsVault.address,
      abi: CONTRACTS.ClaimsVault.abi,
      functionName: "totalClaimsSettled",
    }),
    publicClient.readContract({
      address: CONTRACTS.ClaimsVault.address,
      abi: CONTRACTS.ClaimsVault.abi,
      functionName: "totalPayoutWei",
    }),
    publicClient.readContract({
      address: CONTRACTS.ClaimsVault.address,
      abi: CONTRACTS.ClaimsVault.abi,
      functionName: "policySpent",
      args: [BigInt(canonicalFixtures.activePolicy.commitment)],
    }),
    publicClient.readContract({
      address: CONTRACTS.ClaimsVault.address,
      abi: CONTRACTS.ClaimsVault.abi,
      functionName: "paused",
    }),
    publicClient.readContract({
      address: CONTRACTS.HospitalRegistry.address,
      abi: CONTRACTS.HospitalRegistry.abi,
      functionName: "hospitalRoot",
    }),
  ]);

  return {
    insurerEscrowWei:
      results[0].status === "fulfilled" ? (results[0].value as bigint) : null,
    totalClaimsSettled:
      results[1].status === "fulfilled" ? Number(results[1].value as bigint) : null,
    totalPayoutWei:
      results[2].status === "fulfilled" ? (results[2].value as bigint) : null,
    policySpentWei:
      results[3].status === "fulfilled" ? (results[3].value as bigint) : null,
    paused:
      results[4].status === "fulfilled" ? Boolean(results[4].value) : null,
    hospitalRoot:
      results[5].status === "fulfilled" ? (results[5].value as bigint) : null,
  };
}

export async function fetchPatientAuditEvents(
  publicClient: PublicClient
): Promise<AuditEventItem[]> {
  const latest = await publicClient.getBlockNumber();
  const deployBlock = (DEPLOYMENT as { deployBlock?: number }).deployBlock ?? 0;
  const fromBlock = computeSafeFromBlock(latest, deployBlock);

  const [registered, granted, revoked, accessed] = await Promise.all([
    getContractEventsChunked({
      publicClient,
      address: CONTRACTS.HealthRecords.address,
      abi: CONTRACTS.HealthRecords.abi as Abi,
      eventName: "RecordRegistered",
      fromBlock,
      toBlock: latest,
    }),
    getContractEventsChunked({
      publicClient,
      address: CONTRACTS.HealthRecords.address,
      abi: CONTRACTS.HealthRecords.abi as Abi,
      eventName: "AccessGranted",
      fromBlock,
      toBlock: latest,
    }),
    getContractEventsChunked({
      publicClient,
      address: CONTRACTS.HealthRecords.address,
      abi: CONTRACTS.HealthRecords.abi as Abi,
      eventName: "AccessRevoked",
      fromBlock,
      toBlock: latest,
    }),
    getContractEventsChunked({
      publicClient,
      address: CONTRACTS.HealthRecords.address,
      abi: CONTRACTS.HealthRecords.abi as Abi,
      eventName: "RecordAccessed",
      fromBlock,
      toBlock: latest,
    }),
  ]);

  const items: (AuditEventItem & { sortBlock: bigint; sortIdx: number })[] = [];

  for (const log of registered) {
    const args = (log as { args?: Record<string, unknown> }).args as {
      recordId?: bigint;
      cid?: string;
      recordCommitment?: string;
      createdAt?: bigint;
    };
    items.push({
      id: `${log.transactionHash}-${log.logIndex}`,
      kind: "registered",
      title: `Record #${args?.recordId?.toString() ?? "?"} Registered On-Chain`,
      detail: `CIDv1 ${args?.cid ?? ""} | Commit ${args?.recordCommitment ?? ""}`,
      timestamp: args?.createdAt
        ? new Date(Number(args.createdAt) * 1000).toLocaleTimeString()
        : `Block #${log.blockNumber}`,
      txHash: log.transactionHash ?? undefined,
      explorerUrl: log.transactionHash ? explorerTxUrl(log.transactionHash) : undefined,
      sortBlock: log.blockNumber ?? 0n,
      sortIdx: log.logIndex ?? 0,
    });
  }

  for (const log of granted) {
    const args = (log as { args?: Record<string, unknown> }).args as {
      recordId?: bigint;
      hospital?: string;
      expiresAt?: bigint;
    };
    items.push({
      id: `${log.transactionHash}-${log.logIndex}`,
      kind: "granted",
      title: `Access Granted — Record #${args?.recordId?.toString() ?? "?"}`,
      detail: `Hospital ${args?.hospital ?? ""} | Expires ${
        args?.expiresAt ? new Date(Number(args.expiresAt) * 1000).toLocaleTimeString() : ""
      }`,
      timestamp: `Block #${log.blockNumber}`,
      txHash: log.transactionHash ?? undefined,
      explorerUrl: log.transactionHash ? explorerTxUrl(log.transactionHash) : undefined,
      sortBlock: log.blockNumber ?? 0n,
      sortIdx: log.logIndex ?? 0,
    });
  }

  for (const log of revoked) {
    const args = (log as { args?: Record<string, unknown> }).args as {
      recordId?: bigint;
      hospital?: string;
      revokedAt?: bigint;
    };
    items.push({
      id: `${log.transactionHash}-${log.logIndex}`,
      kind: "revoked",
      title: `Access Revoked — Record #${args?.recordId?.toString() ?? "?"}`,
      detail: `Hospital ${args?.hospital ?? ""} blocked & DEK wiped`,
      timestamp: args?.revokedAt
        ? new Date(Number(args.revokedAt) * 1000).toLocaleTimeString()
        : `Block #${log.blockNumber}`,
      txHash: log.transactionHash ?? undefined,
      explorerUrl: log.transactionHash ? explorerTxUrl(log.transactionHash) : undefined,
      sortBlock: log.blockNumber ?? 0n,
      sortIdx: log.logIndex ?? 0,
    });
  }

  for (const log of accessed) {
    const args = (log as { args?: Record<string, unknown> }).args as {
      recordId?: bigint;
      hospital?: string;
      accessedAt?: bigint;
    };
    items.push({
      id: `${log.transactionHash}-${log.logIndex}`,
      kind: "accessed",
      title: `Record #${args?.recordId?.toString() ?? "?"} Accessed`,
      detail: `Hospital ${args?.hospital ?? ""} logged decryption`,
      timestamp: args?.accessedAt
        ? new Date(Number(args.accessedAt) * 1000).toLocaleTimeString()
        : `Block #${log.blockNumber}`,
      txHash: log.transactionHash ?? undefined,
      explorerUrl: log.transactionHash ? explorerTxUrl(log.transactionHash) : undefined,
      sortBlock: log.blockNumber ?? 0n,
      sortIdx: log.logIndex ?? 0,
    });
  }

  return items
    .sort((a, b) => {
      if (a.sortBlock !== b.sortBlock) return a.sortBlock > b.sortBlock ? -1 : 1;
      return b.sortIdx - a.sortIdx;
    })
    .map(({ sortBlock: _b, sortIdx: _i, ...rest }) => rest);
}

export async function fetchSettledClaimsEvents(
  publicClient: PublicClient
): Promise<LocalSettledClaim[]> {
  const latest = await publicClient.getBlockNumber();
  const deployBlock = (DEPLOYMENT as { deployBlock?: number }).deployBlock ?? 0;
  const fromBlock = computeSafeFromBlock(latest, deployBlock);

  const logs = await getContractEventsChunked({
    publicClient,
    address: CONTRACTS.ClaimsVault.address,
    abi: CONTRACTS.ClaimsVault.abi as Abi,
    eventName: "ClaimSettled",
    fromBlock,
    toBlock: latest,
  });

  const sorted = [...logs].sort((a, b) => {
    const ba = a.blockNumber ?? 0n;
    const bb = b.blockNumber ?? 0n;
    if (ba !== bb) return ba > bb ? -1 : 1;
    return (b.logIndex ?? 0) - (a.logIndex ?? 0);
  });

  return sorted.map((log) => {
    const args = (log as { args?: Record<string, unknown> }).args as {
      nullifier?: bigint;
      policyCommitment?: bigint;
      recordCommitment?: `0x${string}`;
      hospital?: string;
      amount?: bigint;
      settledAt?: bigint;
    };
    return {
      txHash: log.transactionHash ?? "0x",
      nullifier: args?.nullifier?.toString() ?? "0",
      policyCommitment: args?.policyCommitment?.toString() ?? "0",
      recordCommitmentHex: args?.recordCommitment ?? "0x0",
      hospital: args?.hospital ?? "0x0",
      amountWei: args?.amount?.toString() ?? "0",
      settledAt: Number(args?.settledAt ?? 0n),
      rawCalldataHex: "",
      pubSignals: [],
    };
  });
}
