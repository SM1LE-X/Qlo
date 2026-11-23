"use client";

import Link from "next/link";
import { ExternalLink, Eye, Lock, Search, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/card";
import { TactileButton } from "@/components/ui/tactile-button";
import canonicalFixtures from "@/lib/canonicalFixtures.json";
import { IS_CHAIN_DEPLOYED, explorerTxUrl } from "@/lib/contracts";
import { type LocalSettledClaim } from "@/lib/localState";
import { formatWeiToEth, shortHex } from "@/lib/utils";

const PHI_CANARIES = ["I21.0", "I25.10", "99285", "99214", "Aspirin", "Ticagrelor", "SYNTH-CASE"];

export function scanHexForPhi(hexStr: string): string[] {
  const clean = hexStr.startsWith("0x") ? hexStr.slice(2) : hexStr;
  let ascii = "";
  for (let i = 0; i < clean.length; i += 2) {
    const code = parseInt(clean.slice(i, i + 2), 16);
    if (code >= 32 && code <= 126) ascii += String.fromCharCode(code);
  }
  const lowerHex = clean.toLowerCase();
  const hits: string[] = [];
  for (const term of PHI_CANARIES) {
    const termHex = Array.from(new TextEncoder().encode(term))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toLowerCase();
    if (ascii.includes(term) || lowerHex.includes(termHex)) {
      hits.push(term);
    }
  }
  return hits;
}

interface CalldataAuditPanelProps {
  selectedClaim: LocalSettledClaim | null;
  phiHits: string[] | null;
  txHashInput: string;
  onChangeTxHashInput: (val: string) => void;
  onInspectTx: () => void;
  inspectedCalldata: string;
  onChainHospitalRoot: bigint | null;
}

export function CalldataAuditPanel({
  selectedClaim,
  phiHits,
  txHashInput,
  onChangeTxHashInput,
  onInspectTx,
  inspectedCalldata,
  onChainHospitalRoot,
}: CalldataAuditPanelProps) {
  return (
    <div
      id="insurer-audit"
      className="rounded-2xl border border-[#E4E4E7] bg-white p-6 space-y-5 shadow-2xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F4F4F5] pb-4">
        <div>
          <h2 className="text-base font-semibold text-[#09090B]">
            Privacy Verification: What the Blockchain Sees vs. What Stays Hidden
          </h2>
          <p className="text-xs text-[#52525B]">
            Inspect any settled claim transaction to verify zero medical information reached Ethereum Sepolia.
          </p>
        </div>

        {phiHits !== null ? (
          <Badge variant={phiHits.length === 0 ? "emerald" : "crimson"}>
            <ShieldCheck className="h-3.5 w-3.5" />
            {phiHits.length === 0 ? "0 Medical Bytes Found" : `Leak: ${phiHits.join(", ")}`}
          </Badge>
        ) : (
          <Badge variant="neutral">Ready to Inspect</Badge>
        )}
      </div>

      {/* Optional tx hash scanner */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          id="tx-hash-input"
          aria-label="Settled transaction hash"
          value={txHashInput}
          onChange={(e) => onChangeTxHashInput(e.target.value)}
          placeholder="Paste a Sepolia settlement tx hash (0x...) or click Inspect on a claim above"
          className="flex-1 min-w-[240px] rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] px-3 py-2 text-xs font-mono-tabular text-[#09090B] focus:border-[#0F766E] focus:bg-white focus:outline-none"
        />
        <TactileButton size="sm" variant="primary" onClick={onInspectTx}>
          <Search className="h-3.5 w-3.5" />
          Scan Transaction
        </TactileButton>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Public On-Chain Data */}
        <div className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5]/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#047857] flex items-center gap-1.5">
              <Eye className="h-4 w-4" />
              Public On-Chain Proof Inputs
            </span>
            {selectedClaim && IS_CHAIN_DEPLOYED ? (
              <a
                href={explorerTxUrl(selectedClaim.txHash)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#047857] hover:underline"
              >
                Etherscan <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>

          {selectedClaim ? (
            <div className="space-y-2 text-xs font-mono-tabular text-[#09090B]">
              <div className="flex justify-between gap-2 border-b border-[#A7F3D0]/50 py-1">
                <span className="text-[#52525B] font-sans">Hospital Paid</span>
                <span>{shortHex(selectedClaim.hospital, 8, 6)}</span>
              </div>
              <div className="flex justify-between gap-2 border-b border-[#A7F3D0]/50 py-1">
                <span className="text-[#52525B] font-sans">claimAmount</span>
                <span className="font-semibold text-[#047857]">
                  {formatWeiToEth(selectedClaim.amountWei)} ETH
                </span>
              </div>
              <div className="flex justify-between gap-2 border-b border-[#A7F3D0]/50 py-1">
                <span className="text-[#52525B] font-sans">policyCommitment</span>
                <span>{shortHex(selectedClaim.policyCommitment, 10, 6)}</span>
              </div>
              <div className="flex justify-between gap-2 border-b border-[#A7F3D0]/50 py-1">
                <span className="text-[#52525B] font-sans">claimNullifier</span>
                <span>{shortHex(selectedClaim.nullifier, 10, 6)}</span>
              </div>
              <div className="flex justify-between gap-2 py-1">
                <span className="text-[#52525B] font-sans">approvedHospitalRoot</span>
                <span>
                  {shortHex(
                    selectedClaim.pubSignals?.[0] ??
                      onChainHospitalRoot?.toString() ??
                      canonicalFixtures.hospitalRoot,
                    10,
                    6
                  )}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-[#52525B] space-y-2 py-2">
              <p>No settled claim selected yet. Submit a claim in Step 2 (Hospital) to inspect its live blockchain proof here.</p>
              <Link
                href="/hospital"
                className="inline-flex items-center font-semibold text-[#0F766E] hover:underline"
              >
                Go to 2. Hospital Portal →
              </Link>
            </div>
          )}

          {inspectedCalldata ? (
            <details className="text-[11px]">
              <summary className="cursor-pointer font-medium text-[#047857] select-none">
                View raw transaction calldata ({Math.floor(inspectedCalldata.length / 2)} bytes)
              </summary>
              <div className="mt-2 rounded-lg border border-[#27272A] bg-[#111113] p-3 font-mono-tabular text-[10px] text-[#E4E4E7] break-all max-h-36 overflow-y-auto">
                {inspectedCalldata}
              </div>
            </details>
          ) : null}
        </div>

        {/* Right: Locked Private Medical Details */}
        <div className="rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#09090B] flex items-center gap-1.5">
              <Lock className="h-4 w-4 text-[#0F766E]" />
              Patient Medical Details (Hidden)
            </span>
            <Badge variant="neutral">Never Exposed</Badge>
          </div>

          <div className="space-y-2 text-xs">
            {[
              "Diagnosis Code (ICD-10)",
              "Procedure Code (CPT)",
              "Prescriptions & Clinical Notes",
              "Patient Identity & Annual Cap",
              "Record Encryption Key",
            ].map((field) => (
              <div
                key={field}
                className="flex items-center justify-between border-b border-[#E4E4E7] py-1.5 last:border-0"
              >
                <span className="text-[#52525B]">{field}</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-[#E4E4E7] bg-white px-2.5 py-0.5 text-[11px] font-medium text-[#71717A]">
                  <Lock className="h-3 w-3" />
                  Hidden
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
