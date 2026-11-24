"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowUpRight,
  Check,
  Copy,
  Cpu,
  ExternalLink,
  FileCode2,
  FileLock2,
  Landmark,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { usePublicClient } from "wagmi";
import type { AuditEventItem } from "@/components/ui/audit-timeline";
import { Badge } from "@/components/ui/card";
import { TactileButton } from "@/components/ui/tactile-button";
import canonicalFixtures from "@/lib/canonicalFixtures.json";
import {
  fetchOnChainVaultSnapshot,
  fetchPatientAuditEvents,
  fetchSettledClaimsEvents,
  type OnChainVaultSnapshot,
} from "@/lib/chainEvents";
import {
  DEPLOYMENT,
  IS_CHAIN_DEPLOYED,
  explorerAddressUrl,
  explorerTxUrl,
  sourcifyContractUrl,
} from "@/lib/contracts";
import { loadLocalChainMirror, type LocalSettledClaim } from "@/lib/localState";
import { fetchRelayState } from "@/lib/relayClient";
import { cn, formatWeiToEth, shortHex } from "@/lib/utils";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const DEPLOYED_CONTRACTS = [
  { name: "ClaimsVault", address: DEPLOYMENT.contracts.ClaimsVault },
  { name: "Groth16Verifier", address: DEPLOYMENT.contracts.Groth16Verifier },
  { name: "HealthRecords", address: DEPLOYMENT.contracts.HealthRecords },
  { name: "HospitalRegistry", address: DEPLOYMENT.contracts.HospitalRegistry },
  { name: "PolicyRegistry", address: DEPLOYMENT.contracts.PolicyRegistry },
] as const;

const PROTOCOL_MODULES = [
  {
    name: "Records Vault",
    href: "/patient",
    meta: "AES-256-GCM · ECDH consent grants",
    icon: FileLock2,
  },
  {
    name: "Claims Prover",
    href: "/hospital",
    meta: "Groth16 BN254 · 8 claim predicates",
    icon: Cpu,
  },
  {
    name: "Escrow Treasury",
    href: "/insurer",
    meta: "ETH pool · zero-PHI calldata audit",
    icon: Landmark,
  },
  {
    name: "Circuit & ABI",
    href: "/story",
    meta: ".zkey SHA-256 · Sourcify contracts",
    icon: FileCode2,
  },
] as const;

const EVENT_TONE: Record<
  AuditEventItem["kind"],
  { label: string; variant: "cobalt" | "emerald" | "crimson" | "amber" }
> = {
  registered: { label: "Registered", variant: "cobalt" },
  granted: { label: "Granted", variant: "emerald" },
  revoked: { label: "Revoked", variant: "crimson" },
  accessed: { label: "Accessed", variant: "amber" },
  settled: { label: "Settled", variant: "emerald" },
};

function getSeededInsurer(): `0x${string}` {
  const seeded = (DEPLOYMENT as { seededInsurer?: string }).seededInsurer;
  if (seeded && seeded !== ZERO_ADDRESS) {
    return seeded as `0x${string}`;
  }
  return canonicalFixtures.accounts.insurer as `0x${string}`;
}

function formatFieldAsHex(raw: string): string {
  if (!raw) return "0x0";
  if (raw.startsWith("0x")) return raw;
  try {
    return `0x${BigInt(raw).toString(16).padStart(64, "0")}`;
  } catch {
    return raw;
  }
}

function resolveHospitalName(address: string): string | null {
  const match = canonicalFixtures.hospitals.find(
    (h) => h.address.toLowerCase() === address.toLowerCase()
  );
  return match ? match.name : null;
}

function mergeClaims(
  onChain: LocalSettledClaim[],
  sandbox: LocalSettledClaim[]
): LocalSettledClaim[] {
  const seen = new Set(onChain.map((c) => `${c.txHash}:${c.nullifier}`));
  const merged = [...onChain];
  for (const item of sandbox) {
    const key = `${item.txHash}:${item.nullifier}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
  }
  return merged;
}

function mergeAuditEvents(
  onChain: AuditEventItem[],
  sandbox: AuditEventItem[]
): AuditEventItem[] {
  const seen = new Set(onChain.map((e) => e.id));
  const merged = [...onChain];
  for (const item of sandbox) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      merged.push(item);
    }
  }
  return merged;
}

export default function ProtocolOverviewPage() {
  const publicClient = usePublicClient();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [snapshot, setSnapshot] = useState<OnChainVaultSnapshot | null>(null);
  const [settledClaims, setSettledClaims] = useState<LocalSettledClaim[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEventItem[]>([]);
  const [sandboxEscrowWei, setSandboxEscrowWei] = useState<bigint>(0n);
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);

  const loadProtocolState = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const relayPromise = fetchRelayState().catch(() => null);

        if (IS_CHAIN_DEPLOYED && publicClient) {
          const [snapRes, claimsRes, auditRes, relayMirror] = await Promise.all([
            fetchOnChainVaultSnapshot(publicClient, getSeededInsurer()).catch(
              () => null
            ),
            fetchSettledClaimsEvents(publicClient).catch(() => [] as LocalSettledClaim[]),
            fetchPatientAuditEvents(publicClient).catch(() => [] as AuditEventItem[]),
            relayPromise,
          ]);

          setSnapshot(snapRes);

          const relayClaims = relayMirror?.settledClaims ?? [];
          const relayAudit: AuditEventItem[] = (relayMirror?.auditLogs ?? []).map(
            (entry) => ({
              ...entry,
              explorerUrl: entry.txHash?.startsWith("0x")
                ? explorerTxUrl(entry.txHash)
                : undefined,
            })
          );

          setSettledClaims(mergeClaims(claimsRes, relayClaims));
          setAuditEvents(mergeAuditEvents(auditRes, relayAudit));
          if (relayMirror) {
            setSandboxEscrowWei(BigInt(relayMirror.insurerEscrowWei || "0"));
          }
        } else {
          const mirror = (await relayPromise) ?? loadLocalChainMirror();
          setSnapshot(null);
          setSandboxEscrowWei(BigInt(mirror.insurerEscrowWei || "0"));
          setSettledClaims(mirror.settledClaims);
          setAuditEvents(
            mirror.auditLogs.map((entry) => ({
              ...entry,
              explorerUrl: undefined,
            }))
          );
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [publicClient]
  );

  useEffect(() => {
    loadProtocolState(false).catch(() => undefined);
  }, [loadProtocolState]);

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address).catch(() => undefined);
    setCopiedAddr(address);
    setTimeout(() => {
      setCopiedAddr((prev) => (prev === address ? null : prev));
    }, 1500);
  };

  const escrowWei =
    IS_CHAIN_DEPLOYED && snapshot?.insurerEscrowWei !== null && snapshot?.insurerEscrowWei !== undefined
      ? snapshot.insurerEscrowWei
      : sandboxEscrowWei;

  const claimsCount =
    IS_CHAIN_DEPLOYED && snapshot?.totalClaimsSettled !== null && snapshot?.totalClaimsSettled !== undefined
      ? Math.max(snapshot.totalClaimsSettled, settledClaims.length)
      : settledClaims.length;

  const fallbackDisbursedWei = settledClaims.reduce(
    (acc, item) => acc + BigInt(item.amountWei || "0"),
    0n
  );

  const totalDisbursedWei =
    IS_CHAIN_DEPLOYED && snapshot?.totalPayoutWei !== null && snapshot?.totalPayoutWei !== undefined
      ? snapshot.totalPayoutWei
      : fallbackDisbursedWei;

  const hospitalRootHex =
    snapshot?.hospitalRoot !== null && snapshot?.hospitalRoot !== undefined
      ? `0x${snapshot.hospitalRoot.toString(16).padStart(64, "0")}`
      : canonicalFixtures.hospitalRootHex;

  const visibleClaims = settledClaims.slice(0, 8);
  const visibleAudit = auditEvents.slice(0, 8);

  return (
    <div className="space-y-6">
      {/* COMPACT PROTOCOL HEADER BAR */}
      <section className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E4E4E7] pb-5">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#09090B]">
              Qlo Protocol
            </h1>
            <Badge variant="neutral" className="font-mono-tabular">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  IS_CHAIN_DEPLOYED ? "bg-[#059669]" : "bg-[#F59E0B]"
                )}
              />
              {IS_CHAIN_DEPLOYED
                ? `Ethereum Sepolia · ${DEPLOYMENT.chainId}`
                : "Sandbox Mode"}
            </Badge>
            <Badge variant="emerald" className="font-mono-tabular">
              <ShieldCheck className="h-3 w-3" />
              5/5 Verified
            </Badge>
            {snapshot?.paused ? (
              <Badge variant="crimson" className="font-mono-tabular">
                Vault Paused
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-[#52525B]">
            Zero-knowledge health claims settlement on Ethereum Sepolia.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => loadProtocolState(true)}
            disabled={refreshing}
            aria-label="Refresh on-chain protocol state"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E4E4E7] bg-[#FFFFFF] text-[#52525B] hover:border-[#D4D4D8] hover:text-[#09090B] transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          </button>
          <Link href="/patient">
            <TactileButton variant="secondary" size="md">
              Encrypt Record
            </TactileButton>
          </Link>
          <Link href="/hospital">
            <TactileButton variant="emerald" size="md">
              Prove Claim
              <ArrowUpRight className="h-3.5 w-3.5" />
            </TactileButton>
          </Link>
        </div>
      </section>

      {/* 4 FLAT INSTITUTIONAL METRIC CARDS */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-[#E4E4E7] bg-[#FFFFFF] p-4 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-[#71717A]">
            <span>ClaimsVault Escrow</span>
            <span className="font-mono-tabular text-[#059669]">LIVE</span>
          </div>
          <div className="font-mono-tabular text-2xl font-semibold tracking-tight text-[#09090B]">
            {loading ? "—" : `${formatWeiToEth(escrowWei, 4)} ETH`}
          </div>
          <div className="font-mono-tabular text-[11px] text-[#52525B] truncate">
            {IS_CHAIN_DEPLOYED
              ? `Contract ${shortHex(DEPLOYMENT.contracts.ClaimsVault, 6, 4)}`
              : "Local sandbox pool"}
          </div>
        </div>

        <div className="rounded-xl border border-[#E4E4E7] bg-[#FFFFFF] p-4 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-[#71717A]">
            <span>Claims Settled</span>
            <span className="font-mono-tabular text-[#0284C7]">BN254</span>
          </div>
          <div className="font-mono-tabular text-2xl font-semibold tracking-tight text-[#09090B]">
            {loading ? "—" : claimsCount.toLocaleString()}
          </div>
          <div className="font-mono-tabular text-[11px] text-[#52525B]">
            {loading
              ? "Syncing payout ledger..."
              : `${formatWeiToEth(totalDisbursedWei, 4)} ETH disbursed`}
          </div>
        </div>

        <div className="rounded-xl border border-[#E4E4E7] bg-[#FFFFFF] p-4 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-[#71717A]">
            <span>Accredited Hospital Root</span>
            <span className="font-mono-tabular text-[#71717A]">DEPTH 6</span>
          </div>
          <div
            className="font-mono-tabular text-lg font-semibold tracking-tight text-[#09090B] pt-1"
            title={hospitalRootHex}
          >
            {loading ? "—" : shortHex(hospitalRootHex, 8, 6)}
          </div>
          <div className="font-mono-tabular text-[11px] text-[#52525B] truncate">
            Poseidon Merkle · HospitalRegistry
          </div>
        </div>

        <div className="rounded-xl border border-[#E4E4E7] bg-[#FFFFFF] p-4 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-[#71717A]">
            <span>Zero-Knowledge Circuit</span>
            <span className="font-mono-tabular text-[#059669]">GROTH16</span>
          </div>
          <div className="font-mono-tabular text-lg font-semibold tracking-tight text-[#059669] pt-1">
            4,349 R1CS · 0 bytes PHI
          </div>
          <div className="font-mono-tabular text-[11px] text-[#52525B]">
            8 claim predicates · 8 public signals
          </div>
        </div>
      </section>

      {/* MAIN 12-COLUMN LIVE WORKSPACE */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT 8 COLS: LIVE SETTLEMENTS + CONSENT & REGISTRY EVENTS */}
        <div className="lg:col-span-8 space-y-5">
          {/* LIVE ON-CHAIN SETTLEMENTS TABLE */}
          <div className="overflow-hidden rounded-xl border border-[#E4E4E7] bg-[#FFFFFF]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E4E4E7] px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <h2 className="text-sm font-semibold text-[#09090B]">
                  Live On-Chain Settlements
                </h2>
                <span className="rounded-md border border-[#E4E4E7] bg-[#F4F4F5] px-2 py-0.5 font-mono-tabular text-[11px] text-[#52525B]">
                  {settledClaims.length}
                </span>
              </div>
              <Link
                href="/insurer"
                className="inline-flex items-center gap-1 text-xs font-medium text-[#52525B] hover:text-[#09090B] transition-colors"
              >
                Open Treasury
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="divide-y divide-[#E4E4E7]">
                {[0, 1, 2].map((idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 animate-pulse"
                  >
                    <div className="h-3.5 w-32 rounded bg-[#F4F4F5]" />
                    <div className="h-3.5 w-24 rounded bg-[#F4F4F5]" />
                    <div className="h-3.5 w-20 rounded bg-[#F4F4F5]" />
                  </div>
                ))}
              </div>
            ) : visibleClaims.length === 0 ? (
              <div className="px-5 py-10 text-center space-y-2.5">
                <p className="text-xs text-[#52525B]">
                  No <span className="font-mono-tabular text-[#09090B]">ClaimSettled</span> events in the
                  active RPC lookback window.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <Link
                    href="/hospital"
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#059669] hover:underline"
                  >
                    Generate &amp; settle a Groth16 claim <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#E4E4E7] bg-[#F4F4F5] text-[11px] font-medium uppercase tracking-wider text-[#71717A]">
                      <th className="py-2.5 pl-5 pr-3">Hospital</th>
                      <th className="py-2.5 px-3">Nullifier</th>
                      <th className="py-2.5 px-3">Policy Commit</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 px-3">Privacy</th>
                      <th className="py-2.5 pl-3 pr-5 text-right">Tx</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E4E7] text-xs">
                    {visibleClaims.map((claim) => {
                      const facility = resolveHospitalName(claim.hospital);
                      const nullifierHex = formatFieldAsHex(claim.nullifier);
                      const policyHex = formatFieldAsHex(claim.policyCommitment);
                      const isLiveTx =
                        IS_CHAIN_DEPLOYED &&
                        claim.txHash.startsWith("0x") &&
                        claim.txHash.length === 66;

                      return (
                        <tr
                          key={`${claim.txHash}-${claim.nullifier}`}
                          className="hover:bg-[#F4F4F5]/60 transition-colors"
                        >
                          <td className="py-3 pl-5 pr-3 whitespace-nowrap">
                            <div className="font-medium text-[#09090B]">
                              {facility ?? shortHex(claim.hospital, 6, 4)}
                            </div>
                            {facility ? (
                              <div className="font-mono-tabular text-[11px] text-[#71717A]">
                                {shortHex(claim.hospital, 6, 4)}
                              </div>
                            ) : null}
                          </td>
                          <td
                            className="py-3 px-3 font-mono-tabular text-[#52525B] whitespace-nowrap"
                            title={nullifierHex}
                          >
                            {shortHex(nullifierHex, 8, 4)}
                          </td>
                          <td
                            className="py-3 px-3 font-mono-tabular text-[#52525B] whitespace-nowrap"
                            title={policyHex}
                          >
                            {shortHex(policyHex, 8, 4)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono-tabular font-semibold text-[#059669] whitespace-nowrap">
                            +{formatWeiToEth(claim.amountWei, 4)} ETH
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <Badge variant="emerald" className="font-mono-tabular">
                              0 PHI
                            </Badge>
                          </td>
                          <td className="py-3 pl-3 pr-5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-2.5">
                              {isLiveTx ? (
                                <a
                                  href={explorerTxUrl(claim.txHash)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 font-mono-tabular text-[11px] text-[#52525B] hover:text-[#09090B] transition-colors"
                                >
                                  {shortHex(claim.txHash, 6, 4)}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : (
                                <span className="font-mono-tabular text-[11px] text-[#71717A]">
                                  {shortHex(claim.txHash, 6, 4)}
                                </span>
                              )}
                              <Link
                                href="/insurer"
                                className="rounded-md border border-[#D4D4D8] bg-[#F4F4F5] px-2 py-1 text-[11px] font-medium text-[#09090B] hover:border-[#374151] hover:bg-[#E4E4E7] transition-colors"
                              >
                                Inspect
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* RECENT CONSENT & REGISTRY EVENTS TABLE */}
          <div className="overflow-hidden rounded-xl border border-[#E4E4E7] bg-[#FFFFFF]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E4E4E7] px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <h2 className="text-sm font-semibold text-[#09090B]">
                  Recent Consent &amp; Registry Events
                </h2>
                <span className="rounded-md border border-[#E4E4E7] bg-[#F4F4F5] px-2 py-0.5 font-mono-tabular text-[11px] text-[#52525B]">
                  {auditEvents.length}
                </span>
              </div>
              <Link
                href="/patient"
                className="inline-flex items-center gap-1 text-xs font-medium text-[#52525B] hover:text-[#09090B] transition-colors"
              >
                Open Vault
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="divide-y divide-[#E4E4E7]">
                {[0, 1, 2].map((idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 animate-pulse"
                  >
                    <div className="h-3.5 w-44 rounded bg-[#F4F4F5]" />
                    <div className="h-3.5 w-24 rounded bg-[#F4F4F5]" />
                  </div>
                ))}
              </div>
            ) : visibleAudit.length === 0 ? (
              <div className="px-5 py-10 text-center space-y-2">
                <p className="text-xs text-[#52525B]">
                  No <span className="font-mono-tabular text-[#09090B]">HealthRecords</span> registry or
                  consent events in the active lookback window.
                </p>
                <Link
                  href="/patient"
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#0284C7] hover:underline"
                >
                  Encrypt &amp; register a record in Vault <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#E4E4E7] bg-[#F4F4F5] text-[11px] font-medium uppercase tracking-wider text-[#71717A]">
                      <th className="py-2.5 pl-5 pr-3">Event</th>
                      <th className="py-2.5 px-3">Details</th>
                      <th className="py-2.5 px-3">Time / Block</th>
                      <th className="py-2.5 pl-3 pr-5 text-right">Tx</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E4E7] text-xs">
                    {visibleAudit.map((evt) => {
                      const tone = EVENT_TONE[evt.kind];
                      return (
                        <tr
                          key={evt.id}
                          className="hover:bg-[#F4F4F5]/60 transition-colors"
                        >
                          <td className="py-3 pl-5 pr-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Badge variant={tone.variant}>{tone.label}</Badge>
                              <span className="font-medium text-[#09090B]">
                                {evt.title}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3 max-w-[280px]">
                            <div
                              className="font-mono-tabular text-[11px] text-[#52525B] truncate"
                              title={evt.detail}
                            >
                              {evt.detail}
                            </div>
                          </td>
                          <td className="py-3 px-3 font-mono-tabular text-[11px] text-[#71717A] whitespace-nowrap">
                            {evt.timestamp}
                          </td>
                          <td className="py-3 pl-3 pr-5 text-right whitespace-nowrap">
                            {evt.txHash && evt.explorerUrl ? (
                              <a
                                href={evt.explorerUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 font-mono-tabular text-[11px] text-[#52525B] hover:text-[#09090B] transition-colors"
                              >
                                {shortHex(evt.txHash, 6, 4)}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : evt.txHash ? (
                              <span className="font-mono-tabular text-[11px] text-[#71717A]">
                                {shortHex(evt.txHash, 6, 4)}
                              </span>
                            ) : (
                              <span className="font-mono-tabular text-[11px] text-[#71717A]">
                                —
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT 4 COLS: DEPLOYED CONTRACTS + PROTOCOL MODULES */}
        <div className="lg:col-span-4 space-y-5">
          {/* DEPLOYED CONTRACTS */}
          <div className="overflow-hidden rounded-xl border border-[#E4E4E7] bg-[#FFFFFF]">
            <div className="flex items-center justify-between gap-2 border-b border-[#E4E4E7] px-5 py-3.5">
              <h2 className="text-sm font-semibold text-[#09090B]">
                Deployed Contracts
              </h2>
              <span className="font-mono-tabular text-[11px] text-[#71717A]">
                Sepolia {DEPLOYMENT.chainId}
              </span>
            </div>

            <div className="divide-y divide-[#E4E4E7]">
              {DEPLOYED_CONTRACTS.map((contract) => (
                <div
                  key={contract.name}
                  className="flex items-center justify-between gap-2 px-5 py-3 hover:bg-[#F4F4F5]/50 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-[#09090B]">
                      {contract.name}
                    </div>
                    <div className="font-mono-tabular text-[11px] text-[#71717A]">
                      {shortHex(contract.address, 6, 4)}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopyAddress(contract.address)}
                      aria-label={`Copy ${contract.name} address`}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#E4E4E7] bg-[#F4F4F5] text-[#71717A] hover:border-[#D4D4D8] hover:text-[#09090B] transition-colors cursor-pointer"
                    >
                      {copiedAddr === contract.address ? (
                        <Check className="h-3 w-3 text-[#059669]" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                    <a
                      href={explorerAddressUrl(contract.address)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-7 items-center gap-1 rounded-md border border-[#E4E4E7] bg-[#F4F4F5] px-2 font-mono-tabular text-[10px] text-[#52525B] hover:border-[#D4D4D8] hover:text-[#09090B] transition-colors"
                    >
                      Etherscan
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                    <a
                      href={sourcifyContractUrl(contract.address)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-7 items-center gap-1 rounded-md border border-[#059669]/25 bg-[#059669]/8 px-2 font-mono-tabular text-[10px] text-[#059669] hover:bg-[#ECFDF5] transition-colors"
                    >
                      Sourcify
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-[#E4E4E7] bg-[#F4F4F5] px-5 py-2.5 font-mono-tabular text-[10px] text-[#71717A]">
              <span>Deploy Block #{DEPLOYMENT.deployBlock.toLocaleString()}</span>
              <span title={DEPLOYMENT.zkeySha256}>
                zkey {DEPLOYMENT.zkeySha256.slice(0, 8)}...
              </span>
            </div>
          </div>

          {/* PROTOCOL MODULES */}
          <div className="overflow-hidden rounded-xl border border-[#E4E4E7] bg-[#FFFFFF]">
            <div className="border-b border-[#E4E4E7] px-5 py-3.5">
              <h2 className="text-sm font-semibold text-[#09090B]">
                Protocol Modules
              </h2>
            </div>

            <div className="divide-y divide-[#E4E4E7]">
              {PROTOCOL_MODULES.map((mod) => {
                const Icon = mod.icon;
                return (
                  <Link
                    key={mod.href}
                    href={mod.href}
                    className="group flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-[#F4F4F5]/60 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#E4E4E7] bg-[#F4F4F5] text-[#52525B] group-hover:border-[#D4D4D8] group-hover:text-[#059669] transition-colors">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-[#09090B]">
                          {mod.name}
                        </div>
                        <div className="font-mono-tabular text-[11px] text-[#71717A] truncate">
                          {mod.meta}
                        </div>
                      </div>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-[#71717A] group-hover:text-[#09090B] shrink-0 transition-colors" />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
