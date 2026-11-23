"use client";

import Link from "next/link";
import { ExternalLink, Eye, Lock, Search, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/card";
import { SpotlightCard } from "@/components/ui/spotlight-card";
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
    <SpotlightCard id="insurer-audit" accent="emerald" className="p-6 sm:p-7 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F4F4F5] pb-4">
        <div className="space-y-0.5">
          <div className="text-[11px] font-mono-tabular uppercase tracking-[0.14em] text-[#047857]">
            Forensic Zero-PHI Calldata Inspector
          </div>
          <h2 className="text-lg font-bold tracking-tight text-[#09090B]">
            Privacy Verification: What the Blockchain Sees vs. What Stays Hidden
          </h2>
          <p className="text-xs text-[#52525B]">
            Inspect any settled Ethereum Sepolia transaction to confirm zero clinical data crossed
            the privacy firewall.
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

      {/* Live Transaction Hash Scanner */}
      <div className="flex flex-wrap items-center gap-2.5">
        <input
          id="tx-hash-input"
          aria-label="Settled transaction hash"
          value={txHashInput}
          onChange={(e) => onChangeTxHashInput(e.target.value)}
          placeholder="Paste a Sepolia settlement tx hash (0x...) or click Inspect on a claim above"
          className="flex-1 min-w-[260px] rounded-xl border border-[#E4E4E7] bg-[#F7F8F7] px-3.5 py-2.5 text-xs font-mono-tabular text-[#09090B] focus:border-[#0F766E] focus:bg-white focus:outline-none"
        />
        <TactileButton size="md" variant="primary" onClick={onInspectTx}>
          <Search className="h-3.5 w-3.5" />
          Scan Transaction
        </TactileButton>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Public On-Chain Data (Crisp Emerald Porcelain) */}
        <div className="rounded-2xl border border-[#A7F3D0] bg-[#ECFDF5]/45 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#047857] flex items-center gap-1.5">
              <Eye className="h-4 w-4" />
              Public On-Chain Proof Inputs
            </span>
            {selectedClaim && IS_CHAIN_DEPLOYED ? (
              <a
                href={explorerTxUrl(selectedClaim.txHash)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-[#A7F3D0] bg-white px-2.5 py-0.5 text-[11px] font-semibold text-[#047857] hover:bg-[#F0FDFA]"
              >
                Etherscan <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>

          {selectedClaim ? (
            <div className="space-y-2 text-xs font-mono-tabular text-[#09090B]">
              <div className="flex justify-between gap-2 rounded-xl bg-white/80 px-3.5 py-2 border border-[#A7F3D0]/50">
                <span className="text-[#52525B] font-sans">Hospital Paid</span>
                <span>{shortHex(selectedClaim.hospital, 8, 6)}</span>
              </div>
              <div className="flex justify-between gap-2 rounded-xl bg-white/80 px-3.5 py-2 border border-[#A7F3D0]/50">
                <span className="text-[#52525B] font-sans">claimAmount</span>
                <span className="font-bold text-[#047857]">
                  {formatWeiToEth(selectedClaim.amountWei)} ETH
                </span>
              </div>
              <div className="flex justify-between gap-2 rounded-xl bg-white/80 px-3.5 py-2 border border-[#A7F3D0]/50">
                <span className="text-[#52525B] font-sans">policyCommitment</span>
                <span>{shortHex(selectedClaim.policyCommitment, 10, 6)}</span>
              </div>
              <div className="flex justify-between gap-2 rounded-xl bg-white/80 px-3.5 py-2 border border-[#A7F3D0]/50">
                <span className="text-[#52525B] font-sans">claimNullifier</span>
                <span>{shortHex(selectedClaim.nullifier, 10, 6)}</span>
              </div>
              <div className="flex justify-between gap-2 rounded-xl bg-white/80 px-3.5 py-2 border border-[#A7F3D0]/50">
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
                No settled claim selected yet. Submit a claim in Step 2 (Hospital) to inspect its
                live blockchain proof here.
              </p>
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
              <summary className="cursor-pointer font-semibold text-[#047857] select-none">
                View raw transaction calldata ({Math.floor(inspectedCalldata.length / 2)} bytes)
              </summary>
              <div className="mt-2.5 rounded-xl border border-white/10 bg-[#090C0E] p-3.5 font-mono-tabular text-[10px] text-zinc-300 break-all max-h-40 overflow-y-auto">
                {inspectedCalldata}
              </div>
            </details>
          ) : null}
        </div>

        {/* Right: Sealed Obsidian Private Vault */}
        <div className="rounded-2xl border border-white/10 bg-obsidian-grid p-5 text-white space-y-4 card-obsidian">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Lock className="h-4 w-4 text-[#34D399]" />
              Patient Medical Details (Hidden)
            </span>
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300">
              Never Exposed
            </span>
          </div>

          <div className="space-y-2 text-xs">
            {[
              { label: "Diagnosis Code (ICD-10)", note: "AES-256 encrypted off-chain" },
              { label: "Procedure Code (CPT)", note: "Proven in ZK Merkle tree only" },
              { label: "Prescriptions & Clinical Notes", note: "Never leaves device plaintext" },
              { label: "Patient Identity & Annual Cap", note: "Hidden inside Poseidon commitment" },
              { label: "Record Encryption Key", note: "Revocable ECDH P-256 grant" },
            ].map((field) => (
              <div
                key={field.label}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <div className="font-medium text-zinc-100">{field.label}</div>
                  <div className="text-[10px] text-zinc-400">{field.note}</div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/40 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300 shrink-0">
                  <Lock className="h-3 w-3" />
                  Hidden
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SpotlightCard>
  );
}
