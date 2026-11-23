"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Cpu, ExternalLink, Landmark, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/card";
import { TactileButton } from "@/components/ui/tactile-button";
import { Terminal } from "@/components/ui/terminal";
import { IS_CHAIN_DEPLOYED, explorerTxUrl } from "@/lib/contracts";
import { type Cms1500Claim } from "@/lib/intake";
import { type ProveStage, type ProverOutput } from "@/lib/prover";

const PLAIN_ZK_CHECKS = [
  {
    title: "Approved Hospital",
    detail: "Proves your hospital wallet is in the approved registry.",
  },
  {
    title: "Active Insurance Policy",
    detail: "Proves the patient's policy exists and has not expired.",
  },
  {
    title: "Covered Procedure",
    detail: "Proves the procedure code is covered without revealing it.",
  },
  {
    title: "Within Limit & Not Replayed",
    detail: "Proves the amount fits the annual cap and wasn't paid before.",
  },
];

interface HospitalProverCardProps {
  proveStage: ProveStage;
  proverOutput: ProverOutput | null;
  decryptedClaim: Cms1500Claim | null;
  txBusy: boolean;
  chainSettleBlocked: boolean;
  onProve: () => void;
  onSettle: () => void;
  settledTx: string;
  settledAmountEth: string;
  terminalLines: { text: string; tone?: "info" | "ok" | "warn" | "err" }[];
}

export function HospitalProverCard({
  proveStage,
  proverOutput,
  decryptedClaim,
  txBusy,
  chainSettleBlocked,
  onProve,
  onSettle,
  settledTx,
  settledAmountEth,
  terminalLines,
}: HospitalProverCardProps) {
  const isProving =
    proveStage === "loading_artifacts" ||
    proveStage === "computing_witness" ||
    proveStage === "verifying_locally";

  return (
    <div
      id="hospital-prover"
      className="lg:col-span-7 rounded-2xl border border-[#E4E4E7] bg-white p-6 space-y-5 shadow-2xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F4F4F5] pb-3">
        <div>
          <h2 className="text-base font-semibold text-[#09090B]">
            2. Generate ZK Proof &amp; Collect Payout
          </h2>
          <p className="text-xs text-[#52525B]">
            Runs privately in your browser—only the cryptographic proof goes on-chain.
          </p>
        </div>
        {proverOutput ? (
          <Badge variant="emerald">Proof Ready ({proverOutput.elapsedMs}ms)</Badge>
        ) : null}
      </div>

      {/* 4 Plain-English Checks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PLAIN_ZK_CHECKS.map((item) => (
          <div
            key={item.title}
            className={`rounded-xl border p-3.5 transition-colors ${
              proveStage === "done"
                ? "border-[#A7F3D0] bg-[#ECFDF5]/70"
                : proveStage === "failed"
                ? "border-[#FECACA] bg-[#FEF2F2]/70"
                : "border-[#E4E4E7] bg-[#FAFAFA]"
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-[#09090B]">
              <CheckCircle2
                className={`h-4 w-4 shrink-0 ${
                  proveStage === "done"
                    ? "text-[#047857]"
                    : proveStage === "failed"
                    ? "text-[#DC2626]"
                    : "text-[#A1A1AA]"
                }`}
              />
              <span>{item.title}</span>
            </div>
            <p className="mt-1 text-[11px] text-[#52525B] leading-relaxed">{item.detail}</p>
          </div>
        ))}
      </div>

      {/* Primary Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <TactileButton
          variant={proverOutput ? "secondary" : "primary"}
          onClick={onProve}
          disabled={!decryptedClaim || isProving}
        >
          {isProving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating Proof...
            </>
          ) : (
            <>
              <Cpu className="h-4 w-4" />
              {proverOutput ? "Regenerate ZK Proof" : "Generate ZK Proof"}
            </>
          )}
        </TactileButton>

        <TactileButton
          variant="emerald"
          onClick={onSettle}
          disabled={!proverOutput || txBusy || chainSettleBlocked}
        >
          <Landmark className="h-4 w-4" />
          {txBusy ? "Settling On-Chain..." : "Submit Claim & Receive ETH"}
        </TactileButton>
      </div>

      {!decryptedClaim ? (
        <p className="text-xs text-[#71717A]">
          Unlock a patient record on the left first to enable proof generation.
        </p>
      ) : null}

      {/* Payout Confirmation Banner */}
      {settledTx && proverOutput ? (
        <div className="rounded-2xl border border-[#A7F3D0] bg-[#ECFDF5] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-bold text-[#047857]">
                ✓ Payout Confirmed: +{settledAmountEth} ETH
              </div>
              <div className="text-xs text-[#047857]/85">
                Verified on-chain and transferred from ClaimsVault escrow with 0 medical data exposed.
              </div>
            </div>
            {IS_CHAIN_DEPLOYED ? (
              <a
                href={explorerTxUrl(settledTx)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-[#A7F3D0] bg-white px-2.5 py-1 text-xs font-semibold text-[#047857] hover:bg-[#F0FDFA]"
              >
                Etherscan <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>

          <Link href="/insurer" className="block">
            <TactileButton variant="primary" size="sm" className="w-full">
              Continue to Step 3: Verify Privacy on Insurer View
              <ArrowRight className="h-3.5 w-3.5" />
            </TactileButton>
          </Link>
        </div>
      ) : null}

      {/* Collapsible Technical Prover Console */}
      <details className="rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] px-3.5 py-2.5 text-xs">
        <summary className="cursor-pointer font-medium text-[#52525B] select-none">
          Technical Proof Log ({terminalLines.length} entries)
        </summary>
        <div className="mt-3">
          <Terminal lines={terminalLines} />
        </div>
      </details>
    </div>
  );
}
