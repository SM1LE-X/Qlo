"use client";

import { useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, ExternalLink, ShieldCheck, X } from "lucide-react";
import { explorerTxUrl } from "@/lib/contracts";
import { generateX12835Era } from "@/lib/healthcareStandards";
import type { LocalSettledClaim } from "@/lib/localState";
import { formatWeiToEth, shortHex } from "@/lib/utils";

const PHI_CANARIES = ["I21.0", "I25.10", "99285", "99214", "15777", "Aspirin", "Ticagrelor", "SYNTH-CASE"] as const;

function scanCalldataForPhi(hex: string): string[] {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (!clean || clean.length % 2 !== 0) return [];
  let ascii = "";
  for (let i = 0; i < clean.length; i += 2) {
    const code = Number.parseInt(clean.slice(i, i + 2), 16);
    if (code >= 32 && code <= 126) ascii += String.fromCharCode(code);
  }
  const lower = ascii.toLowerCase();
  return PHI_CANARIES.filter((term) => lower.includes(term.toLowerCase()));
}

const SIGNAL_NAMES = [
  "approvedHospitalRoot",
  "policyCommitment",
  "nullifier",
  "claimAmountWei",
  "claimTimestamp",
  "recordCommitment",
  "hospitalAddress",
  "priorPolicySpentWei",
] as const;

interface ProofDrawerProps {
  claim: LocalSettledClaim | null;
  providerLabel?: string;
  onClose: () => void;
}

export function ProofDrawer({ claim, providerLabel, onClose }: ProofDrawerProps) {
  useEffect(() => {
    if (!claim) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [claim, onClose]);

  const phiHits = useMemo(
    () => (claim?.rawCalldataHex ? scanCalldataForPhi(claim.rawCalldataHex) : []),
    [claim]
  );

  const downloadEra = () => {
    if (!claim) return;
    const era = generateX12835Era(claim, providerLabel ?? claim.hospital);
    const blob = new Blob([era], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qlo-835-${claim.txHash.slice(2, 10)}.edi`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const amountEth = claim ? formatWeiToEth(BigInt(claim.amountWei || "0"), 4) : "0.0000";

  return (
    <AnimatePresence>
      {claim ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
            aria-hidden="true"
            className="fixed inset-0 bg-[#09090B]/25 backdrop-blur-[2px]"
          />

          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Settlement proof inspector"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 flex h-full w-full max-w-lg flex-col border-l border-[#E4E4E7] bg-[#FFFFFF] text-[#09090B] shadow-[0_0_40px_rgba(9,9,11,0.12)]"
          >
            <header className="flex items-start justify-between gap-3 border-b border-[#E4E4E7] px-5 py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[15px] font-semibold tracking-tight text-[#09090B]">
                    Settlement proof
                  </h2>
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#059669]/30 bg-[#ECFDF5] px-2 py-0.5 font-mono-tabular text-[11px] font-medium text-[#059669]">
                    <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                    {phiHits.length === 0 ? "0 Medical Bytes Found" : `${phiHits.length} hits`}
                  </span>
                </div>
                <p className="mt-1 font-mono-tabular text-[11px] text-[#71717A]">
                  {providerLabel ?? shortHex(claim.hospital, 8, 6)} · +{amountEth} ETH
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close proof inspector"
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] text-[#52525B] hover:border-[#D4D4D8] hover:text-[#09090B]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>

            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-3">
                  <div className="text-[10px] font-mono-tabular uppercase tracking-wider text-[#71717A]">
                    Disbursed
                  </div>
                  <div className="mt-1 font-mono-tabular text-base font-semibold text-[#059669]">
                    +{amountEth} ETH
                  </div>
                </div>
                <div className="rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-3">
                  <div className="text-[10px] font-mono-tabular uppercase tracking-wider text-[#71717A]">
                    Transaction
                  </div>
                  <a
                    href={explorerTxUrl(claim.txHash)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 font-mono-tabular text-xs font-medium text-[#0284C7] hover:underline"
                  >
                    {shortHex(claim.txHash, 8, 6)}
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                </div>
              </div>

              {/* Export buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`/api/fhir/claim-response?tx=${encodeURIComponent(claim.txHash)}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4E4E7] bg-[#FFFFFF] px-3 py-1.5 text-xs font-medium text-[#09090B] hover:bg-[#F4F4F5]"
                >
                  <Download className="h-3.5 w-3.5 text-[#059669]" aria-hidden="true" />
                  FHIR R4 JSON
                </a>
                <button
                  type="button"
                  onClick={downloadEra}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#E4E4E7] bg-[#FFFFFF] px-3 py-1.5 text-xs font-medium text-[#09090B] hover:bg-[#F4F4F5]"
                >
                  <Download className="h-3.5 w-3.5 text-[#0284C7]" aria-hidden="true" />
                  835 ERA
                </button>
              </div>

              {/* 8 Public Signals */}
              <section className="space-y-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#52525B]">
                  Groth16 public signals
                </h3>
                <div className="divide-y divide-[#E4E4E7] rounded-xl border border-[#E4E4E7] bg-[#FAFAFA]">
                  {SIGNAL_NAMES.map((name, idx) => (
                    <div
                      key={name}
                      className="flex items-center justify-between gap-3 px-3 py-2 text-[11px] font-mono-tabular"
                    >
                      <span className="text-[#52525B]">
                        [{idx}] {name}
                      </span>
                      <span className="max-w-[200px] truncate text-[#09090B]" title={claim.pubSignals?.[idx] ?? "—"}>
                        {claim.pubSignals?.[idx] ? shortHex(claim.pubSignals[idx], 10, 6) : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Raw Calldata */}
              <section className="space-y-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#52525B]">
                  Sepolia calldata
                </h3>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-3 font-mono-tabular text-[10.5px] leading-relaxed text-[#52525B]">
                  {claim.rawCalldataHex || "0x"}
                </pre>
              </section>
            </div>
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
