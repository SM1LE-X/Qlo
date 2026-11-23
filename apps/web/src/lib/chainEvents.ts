"use client";

import type { PublicClient } from "viem";
import type { AuditEventItem } from "@/components/ui/audit-timeline";
import { CONTRACTS, DEPLOYMENT, explorerTxUrl } from "./contracts";
import type { LocalSettledClaim } from "./localState";

export function computeSafeFromBlock(latestBlock: bigint, deployBlock = 0): bigint {
  const minWindow = latestBlock > 8500n ? latestBlock - 8500n : 0n;
  const deployStart = BigInt(Math.max(0, deployBlock));
  return deployStart > minWindow ? deployStart : minWindow;
}

export async function fetchPatientAuditEvents(
  publicClient: PublicClient
): Promise<AuditEventItem[]> {
  const latest = await publicClient.getBlockNumber();
  const deployBlock = (DEPLOYMENT as { deployBlock?: number }).deployBlock ?? 0;
  const fromBlock = computeSafeFromBlock(latest, deployBlock);

  const [registered, granted, revoked, accessed] = await Promise.all([
    publicClient.getContractEvents({
      address: CONTRACTS.HealthRecords.address,
      abi: CONTRACTS.HealthRecords.abi,
      eventName: "RecordRegistered",
      fromBlock,
      toBlock: latest,
    }),
    publicClient.getContractEvents({
      address: CONTRACTS.HealthRecords.address,
      abi: CONTRACTS.HealthRecords.abi,
      eventName: "AccessGranted",
      fromBlock,
      toBlock: latest,
    }),
    publicClient.getContractEvents({
      address: CONTRACTS.HealthRecords.address,
      abi: CONTRACTS.HealthRecords.abi,
      eventName: "AccessRevoked",
      fromBlock,
      toBlock: latest,
    }),
    publicClient.getContractEvents({
      address: CONTRACTS.HealthRecords.address,
      abi: CONTRACTS.HealthRecords.abi,
      eventName: "RecordAccessed",
      fromBlock,
      toBlock: latest,
    }),
  ]);

  const items: (AuditEventItem & { sortBlock: bigint; sortIdx: number })[] = [];

  for (const log of registered) {
    const args = log.args as {
      recordId?: bigint;
      cid?: string;
      recordCommitment?: string;
      createdAt?: bigint;
    };
    items.push({
      id: `${log.transactionHash}-${log.logIndex}`,
      kind: "registered",
      title: `Record #${args.recordId?.toString() ?? "?"} Registered On-Chain`,
      detail: `CIDv1 ${args.cid ?? ""} | Commit ${args.recordCommitment ?? ""}`,
      timestamp: args.createdAt
        ? new Date(Number(args.createdAt) * 1000).toLocaleTimeString()
        : `Block #${log.blockNumber}`,
      txHash: log.transactionHash ?? undefined,
      explorerUrl: log.transactionHash ? explorerTxUrl(log.transactionHash) : undefined,
      sortBlock: log.blockNumber ?? 0n,
      sortIdx: log.logIndex ?? 0,
    });
  }

  for (const log of granted) {
    const args = log.args as {
      recordId?: bigint;
      hospital?: string;
      expiresAt?: bigint;
    };
    items.push({
      id: `${log.transactionHash}-${log.logIndex}`,
      kind: "granted",
      title: `Access Granted — Record #${args.recordId?.toString() ?? "?"}`,
      detail: `Hospital ${args.hospital ?? ""} | Expires ${
        args.expiresAt ? new Date(Number(args.expiresAt) * 1000).toLocaleTimeString() : ""
      }`,
      timestamp: `Block #${log.blockNumber}`,
      txHash: log.transactionHash ?? undefined,
      explorerUrl: log.transactionHash ? explorerTxUrl(log.transactionHash) : undefined,
      sortBlock: log.blockNumber ?? 0n,
      sortIdx: log.logIndex ?? 0,
    });
  }

  for (const log of revoked) {
    const args = log.args as {
      recordId?: bigint;
      hospital?: string;
      revokedAt?: bigint;
    };
    items.push({
      id: `${log.transactionHash}-${log.logIndex}`,
      kind: "revoked",
      title: `Access Revoked — Record #${args.recordId?.toString() ?? "?"}`,
      detail: `Hospital ${args.hospital ?? ""} blocked & DEK wiped`,
      timestamp: args.revokedAt
        ? new Date(Number(args.revokedAt) * 1000).toLocaleTimeString()
        : `Block #${log.blockNumber}`,
      txHash: log.transactionHash ?? undefined,
      explorerUrl: log.transactionHash ? explorerTxUrl(log.transactionHash) : undefined,
      sortBlock: log.blockNumber ?? 0n,
      sortIdx: log.logIndex ?? 0,
    });
  }

  for (const log of accessed) {
    const args = log.args as {
      recordId?: bigint;
      hospital?: string;
      accessedAt?: bigint;
    };
    items.push({
      id: `${log.transactionHash}-${log.logIndex}`,
      kind: "accessed",
      title: `Record #${args.recordId?.toString() ?? "?"} Accessed`,
      detail: `Hospital ${args.hospital ?? ""} logged decryption`,
      timestamp: args.accessedAt
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

  const logs = await publicClient.getContractEvents({
    address: CONTRACTS.ClaimsVault.address,
    abi: CONTRACTS.ClaimsVault.abi,
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
    const args = log.args as {
      nullifier?: bigint;
      policyCommitment?: bigint;
      recordCommitment?: `0x${string}`;
      hospital?: string;
      amount?: bigint;
      settledAt?: bigint;
    };
    return {
      txHash: log.transactionHash ?? "0x",
      nullifier: args.nullifier?.toString() ?? "0",
      policyCommitment: args.policyCommitment?.toString() ?? "0",
      recordCommitmentHex: args.recordCommitment ?? "0x0",
      hospital: args.hospital ?? "0x0",
      amountWei: args.amount?.toString() ?? "0",
      settledAt: Number(args.settledAt ?? 0n),
      rawCalldataHex: "",
      pubSignals: [],
    };
  });
}
