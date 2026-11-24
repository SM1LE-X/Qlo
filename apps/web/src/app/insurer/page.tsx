"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSearch,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import type { Abi } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { useActiveRole } from "@/components/role-context";
import { useAmbientStatus } from "@/components/ui/ambient-pill";
import { ProofDrawer } from "@/components/ui/proof-drawer";
import canonicalFixtures from "@/lib/canonicalFixtures.json";
import { fetchOnChainVaultSnapshot, fetchSettledClaimsEvents } from "@/lib/chainEvents";
import { getProviderDisplayName } from "@/lib/clinicalCatalog";
import { CONTRACTS, DEPLOYMENT, IS_CHAIN_DEPLOYED } from "@/lib/contracts";
import { generateX12835Era } from "@/lib/healthcareStandards";
import { loadLocalChainMirror, saveLocalChainMirror, type LocalSettledClaim } from "@/lib/localState";
import { fetchRelayState, postRelayAction } from "@/lib/relayClient";
import {
  decodeContractError,
  ensureSepoliaChain,
  preflightSimulateAndWrite,
  validatePositiveEthInput,
} from "@/lib/txHelpers";
import { useWalletRoles } from "@/lib/useWalletRoles";
import { cn, formatWeiToEth, shortHex } from "@/lib/utils";

const ANNUAL_CAP_ETH = 0.03;
const PAGE_SIZE = 8;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function formatNullifierPrefix(raw: string): string {
  if (!raw) return "0x0";
  if (raw.startsWith("0x")) return shortHex(raw, 8, 4);
  try {
    return shortHex(`0x${BigInt(raw).toString(16).padStart(64, "0")}`, 8, 4);
  } catch {
    return `${raw.slice(0, 10)}...`;
  }
}

export default function InsurerTreasuryPage() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const roles = useWalletRoles();
  const { activeMeta } = useActiveRole();
  const { showStatus } = useAmbientStatus();

  const [escrowWei, setEscrowWei] = useState<bigint>(0n);
  const [policySpentWei, setPolicySpentWei] = useState<bigint>(0n);
  const [vaultPaused, setVaultPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [txBusy, setTxBusy] = useState(false);
  const [depositEth, setDepositEth] = useState("0.05");
  const [withdrawEth, setWithdrawEth] = useState("0.025");
  const [settledList, setSettledList] = useState<LocalSettledClaim[]>([]);
  const [filterText, setFilterText] = useState("");
  const [sortField, setSortField] = useState<"hospital" | "amount">("amount");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [drawerClaim, setDrawerClaim] = useState<LocalSettledClaim | null>(null);

  const refreshStats = useCallback(
    async (announce = false) => {
      if (announce) showStatus("Syncing treasury", "working");
      try {
        if (IS_CHAIN_DEPLOYED && publicClient) {
          const seededVal = (DEPLOYMENT as { seededInsurer?: string }).seededInsurer;
          const seeded = seededVal && seededVal !== ZERO_ADDRESS ? seededVal : canonicalFixtures.accounts.insurer;
          const [snapshot, onChainClaims, remoteRelay] = await Promise.all([
            fetchOnChainVaultSnapshot(publicClient, (address || seeded) as `0x${string}`),
            fetchSettledClaimsEvents(publicClient),
            fetchRelayState().catch(() => null),
          ]);
          const seen = new Set(onChainClaims.map((c) => c.txHash.toLowerCase()));
          const mergedClaims = [
            ...(remoteRelay?.settledClaims ?? []).filter((c) => !seen.has(c.txHash.toLowerCase())),
            ...onChainClaims,
          ];
          const relaySpentWei = BigInt(remoteRelay?.policySpentWei?.[canonicalFixtures.activePolicy.commitment] ?? "0");
          if (snapshot.insurerEscrowWei !== null) {
            setEscrowWei(snapshot.insurerEscrowWei > relaySpentWei ? snapshot.insurerEscrowWei - relaySpentWei : snapshot.insurerEscrowWei);
          }
          if (snapshot.policySpentWei !== null) setPolicySpentWei(snapshot.policySpentWei + relaySpentWei);
          if (snapshot.paused !== null) setVaultPaused(snapshot.paused);
          setSettledList(mergedClaims);
        } else {
          const mirror = (await fetchRelayState().catch(() => null)) ?? loadLocalChainMirror();
          setSettledList(mirror.settledClaims);
          setEscrowWei(BigInt(mirror.insurerEscrowWei));
          setPolicySpentWei(BigInt(mirror.policySpentWei[canonicalFixtures.activePolicy.commitment] ?? "0"));
        }
        if (announce) showStatus("Treasury synced", "done");
      } catch {
        if (announce) showStatus("Sync failed", "error");
      } finally {
        setLoading(false);
      }
    },
    [address, publicClient, showStatus]
  );

  useEffect(() => {
    refreshStats(false).catch(() => undefined);
  }, [refreshStats]);

  const runEscrowMutation = async (action: "deposit" | "withdraw", rawEth: string) => {
    if (txBusy) return;
    setTxBusy(true);
    const isDeposit = action === "deposit";
    showStatus(isDeposit ? "Depositing escrow" : "Withdrawing escrow", "working", `${rawEth} ETH`);
    try {
      const val = validatePositiveEthInput(rawEth, isDeposit ? "Deposit ETH amount" : "Withdraw ETH amount");
      if (IS_CHAIN_DEPLOYED && address && publicClient && !roles.wrongChain) {
        await ensureSepoliaChain(roles.chainId, switchChainAsync);
        await preflightSimulateAndWrite({
          publicClient,
          account: address,
          address: CONTRACTS.ClaimsVault.address,
          abi: CONTRACTS.ClaimsVault.abi as Abi,
          functionName: isDeposit ? "depositEscrow" : "withdrawEscrow",
          ...(isDeposit ? { value: val } : { args: [val] }),
          writeContractAsync,
        });
      } else {
        const updated = await postRelayAction({ action, amountWei: val.toString() });
        if (!updated) {
          const mirror = loadLocalChainMirror();
          const bal = BigInt(mirror.insurerEscrowWei);
          if (!isDeposit && bal < val) throw new Error("Insufficient escrow balance");
          mirror.insurerEscrowWei = (isDeposit ? bal + val : bal - val).toString();
          saveLocalChainMirror(mirror);
        }
        window.dispatchEvent(new Event("storage"));
      }
      await Promise.all([refreshStats(false), roles.refetch()]);
      showStatus(isDeposit ? "Escrow funded" : "Escrow withdrawn", "done", `${isDeposit ? "+" : "-"}${rawEth} ETH`);
    } catch (err) {
      showStatus(decodeContractError(err), "error");
    } finally {
      setTxBusy(false);
    }
  };

  const handleOpenProof = async (row: LocalSettledClaim) => {
    setDrawerClaim(row);
    if (
      IS_CHAIN_DEPLOYED &&
      publicClient &&
      (!row.rawCalldataHex || row.rawCalldataHex.length <= 10) &&
      row.txHash.startsWith("0x") &&
      row.txHash.length === 66
    ) {
      try {
        const tx = await publicClient.getTransaction({ hash: row.txHash as `0x${string}` });
        setDrawerClaim((prev) => (prev && prev.txHash === row.txHash ? { ...prev, rawCalldataHex: tx.input } : prev));
      } catch {
        // Non-fatal if RPC tx lookup is delayed
      }
    }
  };

  const handleDownloadEra = (row: LocalSettledClaim) => {
    const blob = new Blob([generateX12835Era(row, getProviderDisplayName(row.hospital))], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qlo-835-era-${row.nullifier.slice(0, 10)}.edi`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const q = filterText.trim().toLowerCase();
  const filteredClaims = q
    ? settledList.filter(
        (r) =>
          getProviderDisplayName(r.hospital).toLowerCase().includes(q) ||
          r.hospital.toLowerCase().includes(q) ||
          r.nullifier.toLowerCase().includes(q)
      )
    : settledList;

  const sortedClaims = [...filteredClaims].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortField === "hospital") {
      return getProviderDisplayName(a.hospital).localeCompare(getProviderDisplayName(b.hospital)) * dir;
    }
    const diff = BigInt(a.amountWei || "0") - BigInt(b.amountWei || "0");
    return diff === 0n ? 0 : (diff > 0n ? 1 : -1) * dir;
  });

  const toggleSort = (field: "hospital" | "amount") => {
    if (sortField === field) setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
    setPage(0);
  };

  const totalPages = Math.max(1, Math.ceil(sortedClaims.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageSlice = sortedClaims.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const totalPaidWei = settledList.reduce((acc, item) => acc + BigInt(item.amountWei || "0"), 0n);
  const utilPct = Math.min(100, Math.round((Number(formatWeiToEth(policySpentWei, 4)) / ANNUAL_CAP_ETH) * 100));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E4E4E7] pb-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl font-semibold tracking-tight text-[#09090B]">Treasury</h1>
          <span className="rounded-full border border-[#E4E4E7] bg-[#FFFFFF] px-2.5 py-0.5 text-[11px] font-medium text-[#52525B]">
            {roles.isInsurer ? "Insurer signer" : activeMeta.accountName}
          </span>
          {vaultPaused ? (
            <span className="rounded-full border border-[#DC2626]/30 bg-[#FEF2F2] px-2.5 py-0.5 font-mono-tabular text-[11px] font-medium text-[#DC2626]">
              Paused
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#059669]/25 bg-[#ECFDF5] px-2.5 py-1 font-mono-tabular text-[11px] font-medium text-[#059669]">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>0 PHI enforced</span>
          </span>
          <button type="button" onClick={() => refreshStats(true)} aria-label="Refresh treasury balances" className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#E4E4E7] bg-[#FFFFFF] text-[#52525B] transition-colors hover:border-[#D4D4D8] hover:text-[#09090B]">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col justify-between gap-4 rounded-xl border border-[#E4E4E7] bg-[#FFFFFF] p-5">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-[#71717A]">Escrow balance</div>
            <div className="mt-1.5 font-mono-tabular text-2xl font-semibold tracking-tight text-[#09090B]">
              {loading ? "—" : `${formatWeiToEth(escrowWei, 4)} ETH`}
            </div>
          </div>
          <div className="space-y-2 border-t border-[#E4E4E7] pt-3">
            <div className="flex items-center gap-2">
              <label htmlFor="deposit-eth-input" className="sr-only">Deposit ETH amount</label>
              <input id="deposit-eth-input" type="text" inputMode="decimal" value={depositEth} onChange={(e) => setDepositEth(e.target.value)} aria-label="Deposit ETH amount" className="h-8 w-24 rounded-lg border border-[#E4E4E7] bg-[#F4F4F5] px-2.5 font-mono-tabular text-xs text-[#09090B] focus:border-[#09090B] focus:bg-[#FFFFFF] focus:outline-none" />
              <button type="button" onClick={() => runEscrowMutation("deposit", depositEth)} disabled={txBusy || roles.wrongChain} className="inline-flex h-8 flex-1 cursor-pointer items-center justify-center rounded-lg bg-[#09090B] px-3 text-xs font-medium text-white transition-colors hover:bg-[#27272A] disabled:cursor-not-allowed disabled:opacity-45">
                Deposit
              </button>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="withdraw-eth-input" className="sr-only">Withdraw ETH amount</label>
              <input id="withdraw-eth-input" type="text" inputMode="decimal" value={withdrawEth} onChange={(e) => setWithdrawEth(e.target.value)} aria-label="Withdraw ETH amount" className="h-8 w-24 rounded-lg border border-[#E4E4E7] bg-[#F4F4F5] px-2.5 font-mono-tabular text-xs text-[#09090B] focus:border-[#09090B] focus:bg-[#FFFFFF] focus:outline-none" />
              <button type="button" onClick={() => runEscrowMutation("withdraw", withdrawEth)} disabled={txBusy || roles.wrongChain} className="inline-flex h-8 flex-1 cursor-pointer items-center justify-center rounded-lg border border-[#E4E4E7] bg-[#FFFFFF] px-3 text-xs font-medium text-[#09090B] transition-colors hover:border-[#D4D4D8] hover:bg-[#F4F4F5] disabled:cursor-not-allowed disabled:opacity-45">
                Withdraw
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-4 rounded-xl border border-[#E4E4E7] bg-[#FFFFFF] p-5">
          <div>
            <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-[#71717A]">
              <span>Policy utilization</span>
              <span className="font-mono-tabular text-[#09090B]">{utilPct}%</span>
            </div>
            <div className="mt-1.5 font-mono-tabular text-2xl font-semibold tracking-tight text-[#09090B]">
              {loading ? "—" : `${formatWeiToEth(policySpentWei, 4)} ETH`}
            </div>
            <div className="mt-1 font-mono-tabular text-xs text-[#71717A]">of {ANNUAL_CAP_ETH.toFixed(4)} ETH annual cap</div>
          </div>
          <div className="space-y-2">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F4F4F5]">
              <div className={cn("h-full rounded-full transition-all duration-300", utilPct >= 85 ? "bg-[#D97706]" : "bg-[#059669]")} style={{ width: `${Math.max(utilPct > 0 ? 4 : 0, utilPct)}%` }} />
            </div>
            <p className="text-[11px] text-[#71717A]">Cap enforced privately in Groth16.</p>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-4 rounded-xl border border-[#E4E4E7] bg-[#FFFFFF] p-5">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-[#71717A]">Disbursements</div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="font-mono-tabular text-2xl font-semibold tracking-tight text-[#09090B]">{loading ? "—" : settledList.length}</span>
              <span className="text-xs text-[#71717A]">{settledList.length === 1 ? "claim" : "claims"}</span>
            </div>
            <div className="mt-1 font-mono-tabular text-xs font-medium text-[#059669]">
              {loading ? "Syncing..." : `${formatWeiToEth(totalPaidWei, 4)} ETH paid`}
            </div>
          </div>
          <p className="text-[11px] text-[#71717A]">Settled directly to verified providers.</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-[#E4E4E7] bg-[#FFFFFF]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E4E4E7] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[#09090B]">Disbursements</h2>
            <span className="rounded-md border border-[#E4E4E7] bg-[#F4F4F5] px-2 py-0.5 font-mono-tabular text-[11px] text-[#52525B]">{sortedClaims.length}</span>
          </div>
          <div className="relative">
            <label htmlFor="claims-filter" className="sr-only">Filter disbursements by provider or nullifier</label>
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[#71717A]" aria-hidden="true" />
            <input id="claims-filter" type="search" value={filterText} onChange={(e) => { setFilterText(e.target.value); setPage(0); }} placeholder="Filter provider or nullifier" aria-label="Filter disbursements by provider or nullifier" className="h-8 w-56 rounded-lg border border-[#E4E4E7] bg-[#F4F4F5] pr-3 pl-8 text-xs text-[#09090B] placeholder:text-[#71717A] focus:border-[#09090B] focus:bg-[#FFFFFF] focus:outline-none" />
          </div>
        </div>

        {sortedClaims.length === 0 ? (
          <div className="px-5 py-10 text-center text-xs text-[#52525B]">
            {settledList.length === 0 ? "No disbursements recorded yet." : "No matching disbursements."}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E4E4E7] bg-[#F4F4F5] text-[11px] font-medium uppercase tracking-wider text-[#71717A]">
                    <th className="py-2.5 pl-5 pr-3">
                      <button type="button" onClick={() => toggleSort("hospital")} className="inline-flex cursor-pointer items-center gap-1 uppercase tracking-wider text-[#71717A] hover:text-[#09090B]">
                        <span>Provider</span><ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </th>
                    <th className="py-2.5 px-3">Nullifier</th>
                    <th className="py-2.5 px-3 text-right">
                      <button type="button" onClick={() => toggleSort("amount")} className="inline-flex cursor-pointer items-center justify-end gap-1 uppercase tracking-wider text-[#71717A] hover:text-[#09090B]">
                        <span>Amount</span><ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </th>
                    <th className="py-2.5 px-3">Privacy</th>
                    <th className="py-2.5 pl-3 pr-5 text-right">Receipts &amp; Proof</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E4E7]">
                  {pageSlice.map((row) => (
                    <tr key={`${row.txHash}-${row.nullifier}`} className="transition-colors hover:bg-[#FAFAFA]">
                      <td className="whitespace-nowrap py-3 pl-5 pr-3">
                        <div className="font-medium text-[#09090B]">{getProviderDisplayName(row.hospital)}</div>
                        <div className="font-mono-tabular text-[11px] text-[#71717A]">{shortHex(row.hospital, 6, 4)}</div>
                      </td>
                      <td className="whitespace-nowrap py-3 px-3 font-mono-tabular text-[#52525B]">{formatNullifierPrefix(row.nullifier)}</td>
                      <td className="whitespace-nowrap py-3 px-3 text-right font-mono-tabular font-semibold text-[#059669]">+{formatWeiToEth(row.amountWei, 4)} ETH</td>
                      <td className="whitespace-nowrap py-3 px-3">
                        <span className="inline-flex items-center rounded-full border border-[#059669]/25 bg-[#ECFDF5] px-2 py-0.5 font-mono-tabular text-[11px] font-medium text-[#059669]">0 PHI</span>
                      </td>
                      <td className="whitespace-nowrap py-3 pl-3 pr-5 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <a href={`/api/fhir/claim-response?tx=${encodeURIComponent(row.txHash)}`} className="inline-flex items-center gap-1 rounded-lg border border-[#E4E4E7] bg-[#FFFFFF] px-2.5 py-1 text-[11px] font-medium text-[#52525B] transition-colors hover:border-[#D4D4D8] hover:text-[#09090B]">
                            <Download className="h-3 w-3" aria-hidden="true" /><span>FHIR</span>
                          </a>
                          <button type="button" onClick={() => handleDownloadEra(row)} className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#E4E4E7] bg-[#FFFFFF] px-2.5 py-1 text-[11px] font-medium text-[#52525B] transition-colors hover:border-[#D4D4D8] hover:text-[#09090B]">
                            <Download className="h-3 w-3" aria-hidden="true" /><span>835 ERA</span>
                          </button>
                          <button type="button" onClick={() => handleOpenProof(row)} className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-[#09090B] px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-[#27272A]">
                            <FileSearch className="h-3 w-3" aria-hidden="true" /><span>Proof</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 ? (
              <div className="flex items-center justify-between border-t border-[#E4E4E7] px-5 py-2.5 text-xs text-[#52525B]">
                <span>Page {safePage + 1} of {totalPages}</span>
                <div className="flex items-center gap-1">
                  <button type="button" aria-label="Previous page" disabled={safePage === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-[#E4E4E7] bg-[#FFFFFF] text-[#09090B] hover:bg-[#F4F4F5] disabled:opacity-40">
                    <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button type="button" aria-label="Next page" disabled={safePage >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-[#E4E4E7] bg-[#FFFFFF] text-[#09090B] hover:bg-[#F4F4F5] disabled:opacity-40">
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>

      <ProofDrawer
        claim={drawerClaim}
        providerLabel={drawerClaim ? getProviderDisplayName(drawerClaim.hospital) : undefined}
        onClose={() => setDrawerClaim(null)}
      />
    </div>
  );
}
