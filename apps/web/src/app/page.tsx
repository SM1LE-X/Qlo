"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, ExternalLink, FileSearch, Hash, RefreshCw, ShieldCheck } from "lucide-react";
import { usePublicClient } from "wagmi";
import { useActiveRole } from "@/components/role-context";
import { useAmbientStatus } from "@/components/ui/ambient-pill";
import { ProofDrawer } from "@/components/ui/proof-drawer";
import canonicalFixtures from "@/lib/canonicalFixtures.json";
import {
  fetchOnChainVaultSnapshot,
  fetchSettledClaimsEvents,
  type OnChainVaultSnapshot,
} from "@/lib/chainEvents";
import { getProviderDisplayName } from "@/lib/clinicalCatalog";
import { DEPLOYMENT, IS_CHAIN_DEPLOYED, explorerTxUrl } from "@/lib/contracts";
import { loadLocalChainMirror, type LocalSettledClaim } from "@/lib/localState";
import { fetchRelayState } from "@/lib/relayClient";
import type { AppRole } from "@/lib/roles";
import { cn, formatWeiToEth, shortHex } from "@/lib/utils";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const ROLE_PRIMARY_CTA: Record<AppRole, { label: string; href: string }> = {
  patient: { label: "Drop a bill", href: "/patient" },
  hospital: { label: "Open claims queue", href: "/hospital" },
  insurer: { label: "Manage treasury", href: "/insurer" },
};

function getSeededInsurer(): `0x${string}` {
  const seeded = (DEPLOYMENT as { seededInsurer?: string }).seededInsurer;
  if (seeded && seeded !== ZERO_ADDRESS) return seeded as `0x${string}`;
  return canonicalFixtures.accounts.insurer as `0x${string}`;
}

function mergeClaims(onChain: LocalSettledClaim[], relay: LocalSettledClaim[]): LocalSettledClaim[] {
  const seen = new Set(onChain.map((c) => `${c.txHash.toLowerCase()}:${c.nullifier}`));
  const merged = [...onChain];
  for (const item of relay) {
    const key = `${item.txHash.toLowerCase()}:${item.nullifier}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
  }
  return merged;
}

export default function ClearinghouseOverviewPage() {
  const publicClient = usePublicClient();
  const { activeRole, activeMeta, mode } = useActiveRole();
  const { showStatus } = useAmbientStatus();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [snapshot, setSnapshot] = useState<OnChainVaultSnapshot | null>(null);
  const [settledClaims, setSettledClaims] = useState<LocalSettledClaim[]>([]);
  const [fallbackEscrowWei, setFallbackEscrowWei] = useState<bigint>(0n);
  const [selectedClaim, setSelectedClaim] = useState<LocalSettledClaim | null>(null);

  const loadProtocolState = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) {
        setRefreshing(true);
        showStatus("Syncing Sepolia", "working");
      } else {
        setLoading(true);
      }
      try {
        const relayPromise = fetchRelayState().catch(() => null);
        if (IS_CHAIN_DEPLOYED && publicClient) {
          const [snapRes, claimsRes, relayMirror] = await Promise.all([
            fetchOnChainVaultSnapshot(publicClient, getSeededInsurer()).catch(() => null),
            fetchSettledClaimsEvents(publicClient).catch(() => [] as LocalSettledClaim[]),
            relayPromise,
          ]);
          setSnapshot(snapRes);
          setSettledClaims(mergeClaims(claimsRes, relayMirror?.settledClaims ?? []));
          if (relayMirror) setFallbackEscrowWei(BigInt(relayMirror.insurerEscrowWei || "0"));
        } else {
          const mirror = (await relayPromise) ?? loadLocalChainMirror();
          setSnapshot(null);
          setFallbackEscrowWei(BigInt(mirror.insurerEscrowWei || "0"));
          setSettledClaims(mirror.settledClaims);
        }
        if (isManualRefresh) showStatus("Sepolia synced", "done");
      } catch {
        if (isManualRefresh) showStatus("Sync unavailable", "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [publicClient, showStatus]
  );

  useEffect(() => {
    loadProtocolState(false).catch(() => undefined);
  }, [loadProtocolState]);

  const handleOpenProof = async (claim: LocalSettledClaim) => {
    setSelectedClaim(claim);
    if (
      IS_CHAIN_DEPLOYED &&
      publicClient &&
      (!claim.rawCalldataHex || claim.rawCalldataHex.length <= 10) &&
      claim.txHash.startsWith("0x") &&
      claim.txHash.length === 66
    ) {
      try {
        const tx = await publicClient.getTransaction({ hash: claim.txHash as `0x${string}` });
        setSelectedClaim((prev) =>
          prev && prev.txHash === claim.txHash ? { ...prev, rawCalldataHex: tx.input } : prev
        );
      } catch {
        // Non-fatal if RPC lookup is delayed
      }
    }
  };

  const escrowWei =
    IS_CHAIN_DEPLOYED && snapshot?.insurerEscrowWei != null
      ? snapshot.insurerEscrowWei
      : fallbackEscrowWei;

  const claimsCount =
    IS_CHAIN_DEPLOYED && snapshot?.totalClaimsSettled != null
      ? Math.max(snapshot.totalClaimsSettled, settledClaims.length)
      : settledClaims.length;

  const fallbackDisbursedWei = settledClaims.reduce(
    (acc, item) => acc + BigInt(item.amountWei || "0"),
    0n
  );

  const totalDisbursedWei =
    IS_CHAIN_DEPLOYED && snapshot?.totalPayoutWei != null
      ? snapshot.totalPayoutWei
      : fallbackDisbursedWei;

  const primaryCta = ROLE_PRIMARY_CTA[activeRole];
  const visibleClaims = settledClaims.slice(0, 10);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E4E4E7] pb-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-[#09090B]">Qlo</h1>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E4E4E7] bg-[#FFFFFF] px-2.5 py-0.5 font-mono-tabular text-[11px] text-[#52525B]">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                IS_CHAIN_DEPLOYED ? "bg-[#059669]" : "bg-[#D97706]"
              )}
              aria-hidden="true"
            />
            {IS_CHAIN_DEPLOYED ? "Sepolia" : "Sandbox"}
          </span>
          {snapshot?.paused ? (
            <span className="rounded-full border border-[#DC2626]/30 bg-[#FEF2F2] px-2.5 py-0.5 font-mono-tabular text-[11px] font-medium text-[#DC2626]">
              Paused
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadProtocolState(true)}
            disabled={refreshing}
            aria-label="Refresh clearinghouse state"
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[#E4E4E7] bg-[#FFFFFF] text-[#52525B] transition-colors hover:border-[#D4D4D8] hover:text-[#09090B] disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          </button>
          <Link
            href={primaryCta.href}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#09090B] px-4 text-xs font-medium text-white transition-colors hover:bg-[#27272A]"
          >
            <span>{primaryCta.label}</span>
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-[#E4E4E7] bg-[#FFFFFF] p-5">
          <div className="text-[11px] font-medium uppercase tracking-wider text-[#71717A]">
            Escrow
          </div>
          <div className="mt-2 font-mono-tabular text-2xl font-semibold tracking-tight text-[#09090B]">
            {loading ? "—" : `${formatWeiToEth(escrowWei, 4)} ETH`}
          </div>
          <div className="mt-1.5 text-xs text-[#52525B]">
            {IS_CHAIN_DEPLOYED ? "Live on Sepolia" : "Clearinghouse reserve"}
          </div>
        </div>

        <div className="rounded-xl border border-[#E4E4E7] bg-[#FFFFFF] p-5">
          <div className="text-[11px] font-medium uppercase tracking-wider text-[#71717A]">
            Settled
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono-tabular text-2xl font-semibold tracking-tight text-[#09090B]">
              {loading ? "—" : claimsCount.toLocaleString()}
            </span>
            <span className="text-xs text-[#71717A]">{claimsCount === 1 ? "claim" : "claims"}</span>
          </div>
          <div className="mt-1.5 font-mono-tabular text-xs text-[#52525B]">
            {loading ? "Syncing..." : `${formatWeiToEth(totalDisbursedWei, 4)} ETH disbursed`}
          </div>
        </div>

        <div className="rounded-xl border border-[#E4E4E7] bg-[#FFFFFF] p-5">
          <div className="text-[11px] font-medium uppercase tracking-wider text-[#71717A]">
            Privacy
          </div>
          <div className="mt-2 flex items-center gap-2 font-mono-tabular text-2xl font-semibold tracking-tight text-[#059669]">
            <ShieldCheck className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>0 PHI</span>
          </div>
          <div className="mt-1.5 text-xs text-[#52525B]">Client-encrypted · Groth16 verified</div>
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E4E4E7] bg-[#FFFFFF] px-4 py-3 text-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: activeMeta.accentHex }}
            aria-hidden="true"
          />
          <span className="font-medium text-[#09090B]">{activeMeta.accountName}</span>
          <span className="text-[#71717A]">·</span>
          <span className="text-[#52525B]">
            {activeMeta.label} {mode === "wallet" ? "signer" : "session"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Link
            href={`/slack?channel=${activeRole}`}
            className="inline-flex items-center gap-1 font-mono-tabular text-[#52525B] transition-colors hover:text-[#09090B]"
          >
            <Hash className="h-3 w-3 text-[#71717A]" aria-hidden="true" />
            <span>{activeMeta.channelName.replace(/^#/, "")}</span>
          </Link>
          <Link
            href="/story"
            className="inline-flex items-center gap-1 font-medium text-[#52525B] transition-colors hover:text-[#09090B]"
          >
            <span>Protocol &amp; contracts</span>
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-[#E4E4E7] bg-[#FFFFFF]">
        <div className="flex items-center justify-between gap-3 border-b border-[#E4E4E7] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[#09090B]">Recent Settlements</h2>
            <span className="rounded-md border border-[#E4E4E7] bg-[#F4F4F5] px-2 py-0.5 font-mono-tabular text-[11px] text-[#52525B]">
              {settledClaims.length}
            </span>
          </div>
          <Link
            href="/insurer"
            className="inline-flex items-center gap-1 text-xs font-medium text-[#52525B] transition-colors hover:text-[#09090B]"
          >
            <span>Treasury</span>
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        {loading ? (
          <div className="divide-y divide-[#E4E4E7]">
            {[0, 1, 2].map((idx) => (
              <div key={idx} className="flex items-center justify-between gap-4 px-5 py-3.5 animate-pulse">
                <div className="h-3.5 w-36 rounded bg-[#F4F4F5]" />
                <div className="h-3.5 w-24 rounded bg-[#F4F4F5]" />
                <div className="h-3.5 w-20 rounded bg-[#F4F4F5]" />
              </div>
            ))}
          </div>
        ) : visibleClaims.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-xs text-[#52525B]">No settled claims yet.</p>
            <Link
              href={primaryCta.href}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#09090B] hover:underline"
            >
              <span>{primaryCta.label}</span>
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[#E4E4E7] bg-[#F4F4F5] text-[11px] font-medium uppercase tracking-wider text-[#71717A]">
                  <th className="py-2.5 pl-5 pr-3">Provider</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3">Privacy</th>
                  <th className="py-2.5 px-3">Tx</th>
                  <th className="py-2.5 pl-3 pr-5 text-right">Proof</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E4E7] text-xs">
                {visibleClaims.map((claim) => {
                  const providerName = getProviderDisplayName(claim.hospital);
                  const isLiveTx =
                    IS_CHAIN_DEPLOYED && claim.txHash.startsWith("0x") && claim.txHash.length === 66;
                  return (
                    <tr key={`${claim.txHash}-${claim.nullifier}`} className="transition-colors hover:bg-[#FAFAFA]">
                      <td className="whitespace-nowrap py-3 pl-5 pr-3">
                        <div className="font-medium text-[#09090B]">{providerName}</div>
                        <div className="font-mono-tabular text-[11px] text-[#71717A]">
                          {shortHex(claim.hospital, 6, 4)}
                        </div>
                      </td>
                      <td className="whitespace-nowrap py-3 px-3 text-right font-mono-tabular font-semibold text-[#059669]">
                        +{formatWeiToEth(claim.amountWei, 4)} ETH
                      </td>
                      <td className="whitespace-nowrap py-3 px-3">
                        <span className="inline-flex items-center rounded-full border border-[#059669]/25 bg-[#ECFDF5] px-2 py-0.5 font-mono-tabular text-[11px] font-medium text-[#059669]">
                          0 PHI
                        </span>
                      </td>
                      <td className="whitespace-nowrap py-3 px-3">
                        {isLiveTx ? (
                          <a
                            href={explorerTxUrl(claim.txHash)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-mono-tabular text-[11px] text-[#0284C7] hover:underline"
                          >
                            <span>{shortHex(claim.txHash, 6, 4)}</span>
                            <ExternalLink className="h-3 w-3" aria-hidden="true" />
                          </a>
                        ) : (
                          <span className="font-mono-tabular text-[11px] text-[#71717A]">
                            {shortHex(claim.txHash, 6, 4)}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap py-3 pl-3 pr-5 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenProof(claim)}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#E4E4E7] bg-[#FFFFFF] px-2.5 py-1 text-[11px] font-medium text-[#09090B] transition-colors hover:border-[#D4D4D8] hover:bg-[#F4F4F5]"
                        >
                          <FileSearch className="h-3 w-3 text-[#52525B]" aria-hidden="true" />
                          <span>Proof</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ProofDrawer
        claim={selectedClaim}
        providerLabel={selectedClaim ? getProviderDisplayName(selectedClaim.hospital) : undefined}
        onClose={() => setSelectedClaim(null)}
      />
    </div>
  );
}
