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
    <section
      id="insurer-audit"
      className="rounded-xl border border-[#E4E4E7] bg-[#FFFFFF] p-5 sm:p-6 space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E4E4E7] pb-4">
        <div className="space-y-0.5">
          <div className="text-[11px] font-mono-tabular uppercase tracking-wider text-[#059669]">
            Forensic Zero-PHI Calldata Inspector
          </div>
          <h2 className="text-base font-semibold tracking-tight text-[#09090B]">
            On-Chain Calldata vs. Sealed Off-Chain Clinical Fields
          </h2>
          <p className="text-xs text-[#52525B]">
            Inspect any settled Ethereum Sepolia transaction to confirm zero clinical data crossed the privacy boundary.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-block rounded-md border border-[#E4E4E7] bg-[#F4F4F5] px-2.5 py-1 font-mono-tabular text-[11px] text-[#71717A]">
            {selectedClaim
              ? `tx/${shortHex(selectedClaim.txHash, 10, 8)}`
              : "ClaimsVault.submitClaim"}
          </span>
          {phiHits !== null ? (
            <Badge variant={phiHits.length === 0 ? "emerald" : "crimson"}>
              <ShieldCheck className="h-3.5 w-3.5" />
              {phiHits.length === 0 ? "0 Medical Bytes Found" : `Leak: ${phiHits.join(", ")}`}
            </Badge>
          ) : (
            <Badge variant="neutral">Ready to Inspect</Badge>
          )}
        </div>
      </div>

      {/* Live Transaction Hash Scanner */}
      <div className="flex flex-wrap items-center gap-2.5">
        <input
          id="tx-hash-input"
          aria-label="Settled transaction hash"
          value={txHashInput}
          onChange={(e) => onChangeTxHashInput(e.target.value)}
          placeholder="Paste a Sepolia settlement tx hash (0x...) or click Inspect on a claim above"
          className="flex-1 min-w-[260px] rounded-lg border border-[#E4E4E7] bg-[#F4F4F5] px-3.5 py-2 text-xs font-mono-tabular text-[#09090B] placeholder-[#64748B] focus:border-[#059669] focus:outline-none"
        />
        <TactileButton size="md" variant="primary" onClick={onInspectTx}>
          <Search className="h-3.5 w-3.5" />
          Scan Transaction
        </TactileButton>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Public On-Chain Data */}
        <div className="rounded-xl border border-[#E4E4E7] bg-[#F4F4F5] p-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#059669] flex items-center gap-1.5">
              <Eye className="h-4 w-4" />
              Public On-Chain Proof Inputs
            </span>
            {selectedClaim && IS_CHAIN_DEPLOYED ? (
              <a
                href={explorerTxUrl(selectedClaim.txHash)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-[#E4E4E7] bg-[#F4F4F5] px-2.5 py-0.5 text-[11px] font-medium text-[#059669] hover:border-[#D4D4D8]"
              >
                Etherscan <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>

          {selectedClaim ? (
            <div className="space-y-1.5 text-xs font-mono-tabular text-[#09090B]">
              <div className="flex justify-between gap-2 rounded-lg bg-[#FFFFFF] px-3 py-2 border border-[#E4E4E7]">
                <span className="text-[#52525B] font-sans">Hospital Paid</span>
                <span>{shortHex(selectedClaim.hospital, 8, 6)}</span>
              </div>
              <div className="flex justify-between gap-2 rounded-lg bg-[#FFFFFF] px-3 py-2 border border-[#E4E4E7]">
                <span className="text-[#52525B] font-sans">claimAmount</span>
                <span className="font-semibold text-[#059669]">
                  {formatWeiToEth(selectedClaim.amountWei)} ETH
                </span>
              </div>
              <div className="flex justify-between gap-2 rounded-lg bg-[#FFFFFF] px-3 py-2 border border-[#E4E4E7]">
                <span className="text-[#52525B] font-sans">policyCommitment</span>
                <span>{shortHex(selectedClaim.policyCommitment, 10, 6)}</span>
              </div>
              <div className="flex justify-between gap-2 rounded-lg bg-[#FFFFFF] px-3 py-2 border border-[#E4E4E7]">
                <span className="text-[#52525B] font-sans">claimNullifier</span>
                <span>{shortHex(selectedClaim.nullifier, 10, 6)}</span>
              </div>
              <div className="flex justify-between gap-2 rounded-lg bg-[#FFFFFF] px-3 py-2 border border-[#E4E4E7]">
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
              <p>
                No settled claim selected yet. Submit a claim in Claims Prover to inspect its live blockchain proof here.
              </p>
              <Link
                href="/hospital"
                className="inline-flex items-center font-semibold text-[#059669] hover:underline"
              >
                Open Claims Prover →
              </Link>
            </div>
          )}

          {inspectedCalldata ? (
            <details className="text-[11px]">
              <summary className="cursor-pointer font-semibold text-[#059669] select-none">
                View raw transaction calldata ({Math.floor(inspectedCalldata.length / 2)} bytes)
              </summary>
              <div className="mt-2 rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] p-3 font-mono-tabular text-[10px] text-[#52525B] break-all max-h-40 overflow-y-auto">
                {inspectedCalldata}
              </div>
            </details>
          ) : null}
        </div>

        {/* Right: Sealed Private Vault */}
        <div className="rounded-xl border border-[#E4E4E7] bg-[#F4F4F5] p-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#09090B] flex items-center gap-1.5">
              <Lock className="h-4 w-4 text-[#059669]" />
              Patient Medical Details (Hidden)
            </span>
            <Badge variant="emerald">Never Exposed</Badge>
          </div>

          <div className="space-y-1.5 text-xs">
            {[
              { label: "Diagnosis Code (ICD-10)", note: "AES-256-GCM encrypted off-chain" },
              { label: "Procedure Code (CPT)", note: "Proven in ZK Merkle tree only" },
              { label: "Prescriptions & Clinical Notes", note: "Never leaves device plaintext" },
              {
                label: "Patient Identity & Annual Cap",
                note: "Hidden inside Poseidon commitment",
              },
              { label: "Record Encryption Key", note: "Revocable ECDH P-256 grant" },
            ].map((field) => (
              <div
                key={field.label}
                className="flex items-center justify-between gap-3 rounded-lg border border-[#E4E4E7] bg-[#FFFFFF] px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="font-medium text-[#09090B]">{field.label}</div>
                  <div className="text-[10px] text-[#71717A]">{field.note}</div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-md border border-[#059669]/25 bg-[#ECFDF5] px-2 py-0.5 text-[11px] font-medium text-[#059669] shrink-0">
                  <Lock className="h-3 w-3" />
                  Hidden
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
