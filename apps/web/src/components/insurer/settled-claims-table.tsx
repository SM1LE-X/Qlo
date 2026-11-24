"use client";

import Link from "next/link";
import { ArrowUpDown, ChevronLeft, ChevronRight, Download, RefreshCw, Search } from "lucide-react";
import { Badge } from "@/components/ui/card";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { TactileButton } from "@/components/ui/tactile-button";
import canonicalFixtures from "@/lib/canonicalFixtures.json";
import { getProviderDisplayName } from "@/lib/clinicalCatalog";
import { generateX12835Era } from "@/lib/healthcareStandards";
import { type LocalSettledClaim } from "@/lib/localState";
import { formatWeiToEth, shortHex } from "@/lib/utils";

interface SettledClaimsTableProps {
  totalClaimsCount: number;
  sortedClaimsCount: number;
  ledgerSlice: LocalSettledClaim[];
  filterText: string;
  onChangeFilter: (text: string) => void;
  onRefresh: () => void;
  onToggleSort: (field: "hospital" | "amount") => void;
  onInspectClaim: (row: LocalSettledClaim) => void;
  onChainHospitalRoot: bigint | null;
  safePage: number;
  totalPages: number;
  onChangePage: (updater: (prev: number) => number) => void;
}

export function SettledClaimsTable({
  totalClaimsCount,
  sortedClaimsCount,
  ledgerSlice,
  filterText,
  onChangeFilter,
  onRefresh,
  onToggleSort,
  onInspectClaim,
  onChainHospitalRoot,
  safePage,
  totalPages,
  onChangePage,
}: SettledClaimsTableProps) {
  return (
    <SpotlightCard id="insurer-ledger" accent="neutral" className="overflow-hidden scroll-mt-20">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E4E4E7] px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-[#09090B]">Settled Claims Ledger</h2>
          <p className="text-xs text-[#52525B]">
            Verified zero-knowledge disbursements settled from ClaimsVault treasury.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <TactileButton size="sm" variant="secondary" onClick={onRefresh}>
            <RefreshCw className="h-3.5 w-3.5" />
            Sync Ledger
          </TactileButton>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#71717A]" />
            <input
              id="ledger-filter-input"
              type="search"
              value={filterText}
              onChange={(e) => onChangeFilter(e.target.value)}
              placeholder="Filter hospital or nullifier..."
              aria-label="Filter settled claims by hospital or nullifier"
              className="w-52 rounded-lg border border-[#E4E4E7] bg-[#F4F4F5] pl-8 pr-2.5 py-1.5 text-xs text-[#09090B] placeholder-[#64748B] focus:border-[#059669] focus:outline-none"
            />
          </div>
          <Badge variant="neutral">
            {sortedClaimsCount} / {totalClaimsCount} transactions
          </Badge>
        </div>
      </div>

      {sortedClaimsCount === 0 ? (
        <div className="px-6 py-8 text-center space-y-3">
          <div className="text-xs text-[#52525B]">
            {totalClaimsCount === 0
              ? "No claims settled in this session yet. Authorize a record in Records Vault, then submit a proof from Claims Prover to populate this ledger."
              : "No settled claims matched your filter query."}
          </div>
          {totalClaimsCount === 0 ? (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Link href="/hospital">
                <TactileButton size="sm" variant="primary">
                  Prove &amp; Settle First Claim
                </TactileButton>
              </Link>
              <Link href="/patient">
                <TactileButton size="sm" variant="secondary">
                  Open Records Vault
                </TactileButton>
              </Link>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#E4E4E7] bg-[#F4F4F5] text-[#71717A]">
                  <th className="px-5 py-2.5 font-medium">
                    <button
                      type="button"
                      onClick={() => onToggleSort("hospital")}
                      className="inline-flex items-center gap-1 font-medium text-[#52525B] hover:text-[#09090B] cursor-pointer"
                    >
                      Hospital Provider
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-4 py-2.5 font-medium">Public Inputs</th>
                  <th className="px-4 py-2.5 font-medium">Privacy Audit</th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    <button
                      type="button"
                      onClick={() => onToggleSort("amount")}
                      className="inline-flex items-center justify-end gap-1 font-medium text-[#52525B] hover:text-[#09090B] cursor-pointer"
                    >
                      Payout
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-5 py-2.5 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E4E7]">
                {ledgerSlice.map((row) => (
                  <tr key={row.txHash} className="hover:bg-[#F4F4F5]/60 transition-colors">
                    <td className="px-5 py-3">
                      <div className="font-semibold text-[#09090B]">
                        {getProviderDisplayName(row.hospital)}
                      </div>
                      <div className="font-mono-tabular text-[11px] text-[#71717A]">
                        {shortHex(row.hospital, 8, 6)}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono-tabular text-[11px] text-[#52525B] space-y-0.5">
                      <div>claimNullifier: {row.nullifier.slice(0, 12)}...</div>
                      <div className="text-[#71717A]">
                        policyCommit: {shortHex(row.policyCommitment || canonicalFixtures.activePolicy.commitment, 10, 4)}
                      </div>
                      <div className="text-[#71717A]">
                        hospitalRoot: {(row.pubSignals?.[0] ?? (onChainHospitalRoot?.toString() || canonicalFixtures.hospitalRoot)).slice(0, 12)}...
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="emerald">0 PHI Verified</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-mono-tabular font-semibold text-[#059669]">
                      +{formatWeiToEth(row.amountWei, 4)} ETH
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <TactileButton
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            const eraText = generateX12835Era(
                              row,
                              getProviderDisplayName(row.hospital)
                            );
                            const blob = new Blob([eraText], { type: "text/plain" });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `qlo-835-era-${row.nullifier.slice(0, 10)}.edi`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                        >
                          <Download className="h-3 w-3" />
                          835 ERA
                        </TactileButton>
                        <TactileButton
                          size="sm"
                          variant="secondary"
                          onClick={() => onInspectClaim(row)}
                        >
                          Inspect
                        </TactileButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 ? (
            <div className="flex items-center justify-between border-t border-[#E4E4E7] px-5 py-2.5 text-xs text-[#52525B]">
              <span>
                Page {safePage + 1} of {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Previous ledger page"
                  disabled={safePage === 0}
                  onClick={() => onChangePage((p) => Math.max(0, p - 1))}
                  className="rounded-lg border border-[#E4E4E7] bg-[#F4F4F5] p-1 text-[#09090B] hover:border-[#D4D4D8] disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Next ledger page"
                  disabled={safePage >= totalPages - 1}
                  onClick={() => onChangePage((p) => Math.min(totalPages - 1, p + 1))}
                  className="rounded-lg border border-[#E4E4E7] bg-[#F4F4F5] p-1 text-[#09090B] hover:border-[#D4D4D8] disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </SpotlightCard>
  );
}
