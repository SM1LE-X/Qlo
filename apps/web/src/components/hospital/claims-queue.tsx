"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  FileCode2,
  Inbox,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/card";
import { CopyHash } from "@/components/ui/copy-hash";
import { TactileButton } from "@/components/ui/tactile-button";
import { ACCREDITED_PROVIDERS, getCptLabel, getProviderDisplayName } from "@/lib/clinicalCatalog";
import { explorerTxUrl } from "@/lib/contracts";
import { cms1500ToFhirClaim, cms1500ToX12837P } from "@/lib/healthcareStandards";
import { validateCms1500Completeness, type Cms1500Claim } from "@/lib/intake";
import { type ProverOutput } from "@/lib/prover";
import { type StoredVaultEntry } from "@/lib/storage";
import { shortHex } from "@/lib/utils";

export type ClaimRowStatus =
  | "checking"
  | "unwrapping"
  | "proving"
  | "ready"
  | "settling"
  | "settled"
  | "revoked"
  | "excluded";

export interface ClaimRowState {
  entry: StoredVaultEntry;
  recordId: string;
  status: ClaimRowStatus;
  decryptedClaim: Cms1500Claim | null;
  proverOutput: ProverOutput | null;
  amountEth: string | null;
  proofMs: number | null;
  settledTxHash: string | null;
  isOnChainTx: boolean;
  reason?: string;
}

interface ClaimsQueueProps {
  rows: ClaimRowState[];
  hospitalAddr: string;
  walletConnected: boolean;
  onChangeHospitalAddr: (addr: string) => void;
  refreshing: boolean;
  txBusy: boolean;
  chainSettleBlocked: boolean;
  settledClaimsCount: number;
  providerRevenueEth: number;
  onRefresh: () => void;
  onSettle: (row: ClaimRowState) => void;
  onImportBundle: (file: File) => void;
  onLogAccessAudit: (row: ClaimRowState) => void;
}

function StatusPill({ row }: { row: ClaimRowState }) {
  if (row.status === "checking" || row.status === "unwrapping") {
    return (
      <Badge variant="neutral">
        <Loader2 className="h-3 w-3 animate-spin text-[#71717A]" aria-hidden="true" />
        Unwrapping…
      </Badge>
    );
  }
  if (row.status === "proving" || row.status === "settling") {
    return (
      <Badge variant="cobalt">
        <Loader2 className="h-3 w-3 animate-spin text-[#0284C7]" aria-hidden="true" />
        {row.status === "proving" ? "Proving…" : "Settling…"}
      </Badge>
    );
  }
  if (row.status === "ready") {
    return (
      <Badge variant="emerald">
        <ShieldCheck className="h-3 w-3" aria-hidden="true" />
        Ready · {row.amountEth ?? "0.0000"} ETH
      </Badge>
    );
  }
  if (row.status === "settled") {
    return (
      <div className="inline-flex items-center gap-2">
        <Badge variant="emerald">
          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
          Settled (+{row.amountEth ?? "0.0000"} ETH)
        </Badge>
        {row.settledTxHash && row.isOnChainTx ? (
          <a
            href={explorerTxUrl(row.settledTxHash)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-mono-tabular text-[11px] text-[#0284C7] hover:underline"
          >
            Etherscan <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        ) : null}
      </div>
    );
  }
  if (row.status === "revoked") {
    return (
      <Badge variant="neutral" className="text-[#71717A]">
        <Lock className="h-3 w-3" aria-hidden="true" />
        Not shared with you
      </Badge>
    );
  }
  return <Badge variant="amber">Excluded{row.reason ? ` · ${row.reason}` : ""}</Badge>;
}

export function ClaimsQueue({
  rows,
  hospitalAddr,
  walletConnected,
  onChangeHospitalAddr,
  refreshing,
  txBusy,
  chainSettleBlocked,
  settledClaimsCount,
  providerRevenueEth,
  onRefresh,
  onSettle,
  onImportBundle,
  onLogAccessAudit,
}: ClaimsQueueProps) {
  const [inspectedKey, setInspectedKey] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<"encounter" | "fhir" | "x12">("encounter");

  const inspectedRow =
    rows.find((r) => r.entry.recordCommitmentHex.toLowerCase() === inspectedKey?.toLowerCase()) ??
    null;

  useEffect(() => {
    if (inspectedKey && (!inspectedRow || inspectedRow.status === "revoked" || !inspectedRow.decryptedClaim)) {
      setInspectedKey(null);
    }
  }, [inspectedKey, inspectedRow]);

  useEffect(() => {
    if (!inspectedKey) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setInspectedKey(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [inspectedKey]);

  const providerName = getProviderDisplayName(hospitalAddr);

  const exportStandard = (claim: Cms1500Claim, tab: "fhir" | "x12") => {
    const content =
      tab === "fhir"
        ? JSON.stringify(cms1500ToFhirClaim(claim, providerName), null, 2)
        : cms1500ToX12837P(claim, providerName, hospitalAddr);
    const blob = new Blob([content], { type: tab === "fhir" ? "application/json" : "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      tab === "fhir" ? `qlo-fhir-claim-${claim.cptCode}.json` : `qlo-x12-837p-${claim.cptCode}.edi`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <section className="rounded-xl border border-[#E4E4E7] bg-[#FFFFFF] overflow-hidden shadow-[0_1px_2px_rgba(9,9,11,0.03)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E4E4E7] px-5 py-3.5">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-sm font-semibold text-[#09090B]">Incoming Claims</h2>
            <span className="rounded-md border border-[#E4E4E7] bg-[#F4F4F5] px-2 py-0.5 font-mono-tabular text-[11px] text-[#52525B]">
              {rows.length}
            </span>
            <span className="hidden sm:inline font-mono-tabular text-[11px] text-[#71717A]">
              Settled {settledClaimsCount} · {providerRevenueEth.toFixed(4)} ETH
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {!walletConnected ? (
              <div className="inline-flex items-center gap-2">
                <label htmlFor="hospital-facility-select" className="text-[11px] font-medium text-[#71717A]">
                  Facility
                </label>
                <select
                  id="hospital-facility-select"
                  value={hospitalAddr}
                  onChange={(e) => onChangeHospitalAddr(e.target.value)}
                  className="h-8 rounded-lg border border-[#E4E4E7] bg-[#F4F4F5] px-2.5 text-xs font-medium text-[#09090B] focus:border-[#09090B] focus:outline-none"
                >
                  {ACCREDITED_PROVIDERS.map((prov) => (
                    <option key={prov.address} value={prov.address}>
                      {prov.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <span className="font-mono-tabular text-[11px] text-[#71717A]">
                {providerName} · {shortHex(hospitalAddr, 6, 4)}
              </span>
            )}

            <label
              htmlFor="qlo-bundle-import"
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-[#E4E4E7] bg-[#FFFFFF] px-2.5 text-xs font-medium text-[#52525B] hover:bg-[#F4F4F5] hover:text-[#09090B] transition-colors"
            >
              <Upload className="h-3.5 w-3.5 text-[#71717A]" aria-hidden="true" />
              Import
              <input
                id="qlo-bundle-import"
                aria-label="Import encrypted .qlo.json bundle"
                type="file"
                accept=".json"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onImportBundle(file);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#E4E4E7] bg-[#F4F4F5] text-[#71717A]">
              <Inbox className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-[#09090B]">No incoming claims</p>
              <p className="text-xs text-[#71717A]">
                Records appear when a patient shares with this wallet ({hospitalAddr.slice(0, 6)}…{hospitalAddr.slice(-4)}).
              </p>
            </div>
            <TactileButton size="sm" variant="secondary" onClick={onRefresh} disabled={refreshing}>
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
              Refresh
            </TactileButton>
          </div>
        ) : (
          <div className="divide-y divide-[#E4E4E7]">
            {rows.map((row) => {
              const key = row.entry.recordCommitmentHex;
              const recordLabel = row.recordId ? `Record #${row.recordId}` : `Record ${shortHex(key, 6, 4)}`;
              const canInspect = Boolean(row.decryptedClaim && row.status !== "revoked");
              const canSettle = row.status === "ready" && !txBusy && !chainSettleBlocked;

              return (
                <div
                  key={key}
                  className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between hover:bg-[#FAFAFA] transition-colors"
                >
                  <div className="flex flex-wrap items-center gap-3 min-w-0">
                    <div className="min-w-[104px]">
                      <div className="text-xs font-semibold text-[#09090B]">{recordLabel}</div>
                      <div className="font-mono-tabular text-[11px] text-[#71717A] truncate">
                        {row.decryptedClaim && row.status !== "revoked"
                          ? `CPT ${row.decryptedClaim.cptCode} · ${row.decryptedClaim.icd10Code}`
                          : shortHex(row.entry.cid, 10, 6)}
                      </div>
                    </div>

                    <StatusPill row={row} />

                    {row.proofMs !== null && (row.status === "ready" || row.status === "settled") ? (
                      <span className="font-mono-tabular text-[11px] text-[#71717A]">{row.proofMs}ms</span>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <TactileButton
                      size="sm"
                      variant="secondary"
                      disabled={!canInspect}
                      onClick={() => {
                        setDrawerTab("encounter");
                        setInspectedKey(key);
                      }}
                    >
                      <Eye className="h-3.5 w-3.5 text-[#52525B]" aria-hidden="true" />
                      Inspect
                    </TactileButton>

                    <TactileButton
                      size="sm"
                      variant="primary"
                      disabled={!canSettle}
                      onClick={() => onSettle(row)}
                    >
                      {row.status === "settling" ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                          Settling
                        </>
                      ) : row.status === "settled" ? (
                        "Settled"
                      ) : (
                        "Settle"
                      )}
                    </TactileButton>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <AnimatePresence>
        {inspectedRow && inspectedRow.decryptedClaim ? (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              onClick={() => setInspectedKey(null)}
              className="fixed inset-0 bg-[#09090B]/25 backdrop-blur-[1px]"
            />

            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label="Decrypted Clinical Encounter"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 flex h-full w-full max-w-lg flex-col border-l border-[#E4E4E7] bg-[#FFFFFF] shadow-2xl"
            >
              <div className="flex items-center justify-between gap-3 border-b border-[#E4E4E7] px-5 py-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-[#09090B]">Decrypted Clinical Encounter</h3>
                    {validateCms1500Completeness(inspectedRow.decryptedClaim).valid ? (
                      <Badge variant="emerald">CMS-1500</Badge>
                    ) : null}
                  </div>
                  <p className="font-mono-tabular text-[11px] text-[#71717A]">
                    Record #{inspectedRow.recordId || shortHex(inspectedRow.entry.recordCommitmentHex, 6, 4)} · Local browser memory only
                  </p>
                </div>

                <button
                  type="button"
                  aria-label="Close encounter drawer"
                  onClick={() => setInspectedKey(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E4E4E7] text-[#52525B] hover:bg-[#F4F4F5] hover:text-[#09090B] cursor-pointer transition-colors"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <div role="tablist" aria-label="Encounter views" className="flex items-center gap-1 border-b border-[#E4E4E7] bg-[#FAFAFA] px-5 py-2">
                {(
                  [
                    ["encounter", "CMS-1500"],
                    ["fhir", "HL7 FHIR R4"],
                    ["x12", "ANSI X12 837P"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    role="tab"
                    type="button"
                    aria-selected={drawerTab === id}
                    onClick={() => setDrawerTab(id)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                      drawerTab === id
                        ? "bg-[#FFFFFF] text-[#09090B] border border-[#E4E4E7] shadow-[0_1px_2px_rgba(9,9,11,0.03)]"
                        : "text-[#52525B] hover:text-[#09090B] border border-transparent"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {drawerTab === "encounter" ? (
                  <>
                    <div className="rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] divide-y divide-[#E4E4E7] px-4 text-xs">
                      {[
                        ["Diagnosis (ICD-10)", inspectedRow.decryptedClaim.icd10Code, "font-mono-tabular font-semibold text-[#09090B]"],
                        ["Procedure (CPT)", `${inspectedRow.decryptedClaim.cptCode} · ${getCptLabel(inspectedRow.decryptedClaim.cptCode)}`, "text-right font-medium text-[#09090B]"],
                        ["Claim Amount", `${inspectedRow.decryptedClaim.claimAmountEth} ETH`, "font-mono-tabular font-semibold text-[#059669]"],
                        ["Policy ID", inspectedRow.decryptedClaim.insuredPolicyId, "font-mono-tabular text-[#09090B]"],
                        ["Service Date", inspectedRow.decryptedClaim.serviceDate, "font-mono-tabular text-[#09090B]"],
                        ["Rendering NPI", inspectedRow.decryptedClaim.renderingNpi, "font-mono-tabular text-[#09090B]"],
                      ].map(([label, val, cls]) => (
                        <div key={label} className="flex items-center justify-between gap-4 py-2.5">
                          <span className="text-[#71717A]">{label}</span>
                          <span className={cls}>{val}</span>
                        </div>
                      ))}
                      <div className="py-2.5 space-y-1">
                        <div className="text-[#71717A]">Prescription</div>
                        <div className="text-[#09090B]">{inspectedRow.decryptedClaim.prescription}</div>
                      </div>
                      {inspectedRow.decryptedClaim.clinicalNotes ? (
                        <div className="py-2.5 space-y-1">
                          <div className="text-[#71717A]">Clinical Notes</div>
                          <div className="text-[#52525B] leading-relaxed">{inspectedRow.decryptedClaim.clinicalNotes}</div>
                        </div>
                      ) : null}
                    </div>

                    {inspectedRow.proverOutput ? (
                      <div className="rounded-xl border border-[#E4E4E7] bg-[#F4F4F5] p-4 space-y-2.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-[#09090B]">Privacy proof</span>
                          <span className="font-mono-tabular text-[#059669]">
                            Verified · {inspectedRow.proverOutput.elapsedMs}ms
                          </span>
                        </div>
                        <CopyHash
                          label="Nullifier"
                          value={inspectedRow.proverOutput.publicSignals[2]}
                          className="w-full justify-between bg-[#FFFFFF]"
                        />
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => onLogAccessAudit(inspectedRow)}
                      className="text-xs font-medium text-[#0284C7] hover:underline cursor-pointer"
                    >
                      Log access audit on-chain →
                    </button>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#52525B]">
                        <FileCode2 className="h-3.5 w-3.5 text-[#0284C7]" aria-hidden="true" />
                        {drawerTab === "fhir" ? "HL7 FHIR R4 Claim JSON" : "ANSI X12 837P (005010X222A1)"}
                      </span>
                      <TactileButton
                        size="sm"
                        variant="secondary"
                        onClick={() => exportStandard(inspectedRow.decryptedClaim!, drawerTab)}
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                        Export
                      </TactileButton>
                    </div>
                    <pre className="max-h-[65vh] overflow-auto rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-4 font-mono-tabular text-[11px] leading-relaxed text-[#09090B]">
                      {drawerTab === "fhir"
                        ? JSON.stringify(cms1500ToFhirClaim(inspectedRow.decryptedClaim, providerName), null, 2)
                        : cms1500ToX12837P(inspectedRow.decryptedClaim, providerName, hospitalAddr)}
                    </pre>
                  </div>
                )}
              </div>
            </motion.aside>
          </div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
