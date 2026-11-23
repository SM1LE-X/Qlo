"use client";

import Link from "next/link";
import { Eye, EyeOff, Search, ShieldCheck } from "lucide-react";
import { BrowserMockupCard } from "@/components/ui/browser-mockup-card";
import { Badge } from "@/components/ui/card";
import { CopyHash } from "@/components/ui/copy-hash";
import { TactileButton } from "@/components/ui/tactile-button";
import canonicalFixtures from "@/lib/canonicalFixtures.json";
import { IS_CHAIN_DEPLOYED, explorerTxUrl } from "@/lib/contracts";
import { type LocalSettledClaim } from "@/lib/localState";
import { formatWeiToEth } from "@/lib/utils";

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
    <div id="insurer-audit" className="scroll-mt-20">
      <BrowserMockupCard
        url={
          selectedClaim && IS_CHAIN_DEPLOYED
            ? explorerTxUrl(selectedClaim.txHash)
            : "base-sepolia://claimsvault/submitClaim#zero-phi-audit"
        }
        rightSlot={
          phiHits !== null ? (
            <Badge variant={phiHits.length === 0 ? "emerald" : "crimson"}>
              <ShieldCheck className="h-3.5 w-3.5" />
              {phiHits.length === 0 ? "0 PHI BYTES DETECTED IN CALLDATA" : `LEAK: ${phiHits.join(", ")}`}
            </Badge>
          ) : (
            <Badge variant="neutral">Awaiting Settlement Scan</Badge>
          )
        }
      >
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-[#09090B]">
              On-Chain Calldata &amp; Zero-PHI Privacy Audit
            </h2>
            <p className="text-xs text-[#52525B]">
              Inspect raw Groth16 settlement calldata and verify 0 bytes of clinical PHI exist on Base Sepolia.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              id="tx-hash-input"
              aria-label="Settled transaction hash"
              value={txHashInput}
              onChange={(e) => onChangeTxHashInput(e.target.value)}
              placeholder="Paste Base Sepolia settled txHash (0x...) or inspect latest claim below"
              className="flex-1 min-w-[240px] rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] px-3 py-2 text-xs font-mono-tabular text-[#09090B] focus:border-[#0F766E] focus:outline-none"
            />
            <TactileButton size="sm" variant="primary" onClick={onInspectTx}>
              <Search className="h-3.5 w-3.5" />
              Scan Calldata for PHI
            </TactileButton>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5]/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#047857] flex items-center gap-1.5">
                  <Eye className="h-4 w-4" />
                  Public Ledger Calldata
                </span>
                {selectedClaim && IS_CHAIN_DEPLOYED ? (
                  <CopyHash
                    label="Tx"
                    value={selectedClaim.txHash}
                    explorerUrl={explorerTxUrl(selectedClaim.txHash)}
                  />
                ) : null}
              </div>

              {selectedClaim ? (
                <div className="space-y-1.5 text-xs font-mono-tabular text-[#09090B]">
                  <div>hospital: {selectedClaim.hospital}</div>
                  <div>claimAmount: {formatWeiToEth(selectedClaim.amountWei)} ETH</div>
                  <div>policyCommitment: {selectedClaim.policyCommitment.slice(0, 22)}...</div>
                  <div>claimNullifier: {selectedClaim.nullifier.slice(0, 22)}...</div>
                  <div>
                    approvedHospitalRoot:{" "}
                    {(
                      selectedClaim.pubSignals?.[0] ??
                      onChainHospitalRoot?.toString() ??
                      canonicalFixtures.hospitalRoot
                    ).slice(0, 22)}
                    ...
                  </div>
                  <div>recordCommitment: {selectedClaim.recordCommitmentHex.slice(0, 22)}...</div>
                </div>
              ) : (
                <div className="text-xs text-[#52525B] space-y-1.5">
                  <p>No settled transactions available to inspect in this session.</p>
                  <Link
                    href="/hospital"
                    className="inline-flex items-center font-medium text-[#0F766E] hover:underline"
                  >
                    Open Provider Clearinghouse →
                  </Link>
                </div>
              )}

              {inspectedCalldata ? (
                <div className="rounded-lg border border-[#27272A] bg-[#111113] p-3 font-mono-tabular text-[11px] text-[#E4E4E7] break-all max-h-40 overflow-y-auto">
                  {inspectedCalldata}
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2]/55 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#B91C1C] flex items-center gap-1.5">
                  <EyeOff className="h-4 w-4 text-[#DC2626]" />
                  Protected Clinical Data (Off-Chain Only)
                </span>
                <Badge variant="crimson">Redacted</Badge>
              </div>

              <div className="space-y-1.5 text-xs font-mono-tabular">
                <div className="flex justify-between border-b border-[#FECACA]/60 py-1.5">
                  <span className="text-[#52525B]">Box 21 ICD-10 Diagnosis</span>
                  <span className="blur-[4px] hover:blur-none transition-all text-[#B91C1C] font-semibold">
                    I21.0 / I25.10
                  </span>
                </div>
                <div className="flex justify-between border-b border-[#FECACA]/60 py-1.5">
                  <span className="text-[#52525B]">Box 24D CPT Procedure</span>
                  <span className="blur-[4px] hover:blur-none transition-all text-[#B91C1C] font-semibold">
                    99285 / 99214
                  </span>
                </div>
                <div className="flex justify-between border-b border-[#FECACA]/60 py-1.5">
                  <span className="text-[#52525B]">Prescription / Rx</span>
                  <span className="blur-[4px] hover:blur-none transition-all text-[#B91C1C] font-semibold">
                    Aspirin 325mg + Ticagrelor
                  </span>
                </div>
                <div className="flex justify-between border-b border-[#FECACA]/60 py-1.5">
                  <span className="text-[#52525B]">Private Annual Policy Limit</span>
                  <span className="blur-[4px] hover:blur-none transition-all text-[#B91C1C] font-semibold">
                    0.0300 ETH
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-[#52525B]">AES-256-GCM Plaintext DEK</span>
                  <span className="text-[#B91C1C] font-semibold">Unreachable by Insurer</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </BrowserMockupCard>
    </div>
  );
}
