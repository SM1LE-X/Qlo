"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Cpu, Landmark, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/card";
import { OrbitalProver } from "@/components/ui/orbital-prover";
import { PaymentReceiptPrinter } from "@/components/ui/payment-receipt-printer";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { TactileButton } from "@/components/ui/tactile-button";
import { Terminal } from "@/components/ui/terminal";
import { IS_CHAIN_DEPLOYED, explorerTxUrl } from "@/lib/contracts";
import { type Cms1500Claim } from "@/lib/intake";
import { type ProveStage, type ProverOutput } from "@/lib/prover";

const PLAIN_ZK_CHECKS = [
  {
    code: "01",
    title: "Approved Hospital",
    detail: "Proves your hospital wallet & NPI sit inside the Poseidon hospitalRoot.",
  },
  {
    code: "02",
    title: "Active Insurance Policy",
    detail: "Proves the patient's policy exists on-chain and has not expired.",
  },
  {
    code: "03",
    title: "Covered Procedure",
    detail: "Proves the CPT procedure code is covered without exposing it.",
  },
  {
    code: "04",
    title: "Within Limit & Not Replayed",
    detail: "Proves cumulative spend fits the private annual cap with a fresh nullifier.",
  },
];

interface HospitalProverCardProps {
  proveStage: ProveStage;
  proverOutput: ProverOutput | null;
  decryptedClaim: Cms1500Claim | null;
  hospitalAddr?: string;
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
  hospitalAddr = "0x9c1cDD59AA337bc9d3B48A109f532cE45e1fc718",
  txBusy,
  chainSettleBlocked,
  onProve,
  onSettle,
  settledTx,
  settledAmountEth,
  terminalLines,
}: HospitalProverCardProps) {
  const isProving =
    proveStage === "building_witness" ||
    proveStage === "loading_artifacts" ||
    proveStage === "computing_witness" ||
    proveStage === "verifying_locally";

  return (
    <SpotlightCard
      id="hospital-prover"
      accent={proveStage === "done" ? "emerald" : proveStage === "failed" ? "crimson" : "neutral"}
      className="lg:col-span-7 p-6 sm:p-7 space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F4F4F5] pb-4">
        <div className="space-y-0.5">
          <div className="text-[11px] font-mono-tabular uppercase tracking-[0.14em] text-[#0F766E]">
            02 · Groth16 Web Worker Prover
          </div>
          <h2 className="text-lg font-bold tracking-tight text-[#09090B]">
            2. Generate ZK Proof &amp; Collect Payout
          </h2>
          <p className="text-xs text-[#52525B]">
            Witness arithmetic runs strictly inside your browser—only the proof goes on-chain.
          </p>
        </div>
        {proverOutput ? (
          <Badge variant="emerald">Proof Ready ({proverOutput.elapsedMs}ms)</Badge>
        ) : null}
      </div>

      {/* Live Orbital Cryptographic Ring */}
      <OrbitalProver stage={proveStage} elapsedMs={proverOutput?.elapsedMs} />

      {/* 4 Plain-English Checks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {PLAIN_ZK_CHECKS.map((item) => (
          <div
            key={item.title}
            className={`rounded-2xl border p-4 transition-colors ${
              proveStage === "done"
                ? "border-[#A7F3D0] bg-[#ECFDF5]/70"
                : proveStage === "failed"
                ? "border-[#FECACA] bg-[#FEF2F2]/70"
                : "border-[#E4E4E7] bg-[#F7F8F7]"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#09090B]">
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
              <span className="font-mono-tabular text-[10px] text-[#A1A1AA]">{item.code}</span>
            </div>
            <p className="mt-1.5 text-[11px] text-[#52525B] leading-relaxed">{item.detail}</p>
          </div>
        ))}
      </div>

      {/* Primary Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <TactileButton
          size="lg"
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
          size="lg"
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

      {/* Perforated Enterprise Settlement Voucher */}
      {settledTx && proverOutput ? (
        <div className="space-y-3">
          <PaymentReceiptPrinter
            txHash={settledTx}
            explorerUrl={IS_CHAIN_DEPLOYED ? explorerTxUrl(settledTx) : undefined}
            amountEth={settledAmountEth}
            hospitalAddress={hospitalAddr}
            nullifier={proverOutput.publicSignals[2] ?? "1314794180..."}
          />

          <Link href="/insurer" className="block">
            <TactileButton variant="primary" size="md" className="w-full">
              Continue to Step 3: Verify Privacy on Insurer Audit
              <ArrowRight className="h-3.5 w-3.5" />
            </TactileButton>
          </Link>
        </div>
      ) : null}

      {/* Collapsible Technical Prover Console */}
      <details className="rounded-2xl border border-[#E4E4E7] bg-[#F7F8F7] px-4 py-3 text-xs">
        <summary className="cursor-pointer font-medium text-[#3F3F46] select-none">
          Technical Proof Log ({terminalLines.length} entries)
        </summary>
        <div className="mt-3">
          <Terminal lines={terminalLines} />
        </div>
      </details>
    </SpotlightCard>
  );
}
