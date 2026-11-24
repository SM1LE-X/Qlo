"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Cpu,
  Landmark,
  Loader2,
  Terminal as TerminalIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/card";
import { CopyHash } from "@/components/ui/copy-hash";
import { OrbitalProver } from "@/components/ui/orbital-prover";
import { TactileButton } from "@/components/ui/tactile-button";
import { Terminal } from "@/components/ui/terminal";
import { IS_CHAIN_DEPLOYED, explorerTxUrl } from "@/lib/contracts";
import { type Cms1500Claim } from "@/lib/intake";
import { type ProveStage, type ProverOutput } from "@/lib/prover";
import { shortHex } from "@/lib/utils";

const CIRCUIT_CHECKS = [
  {
    code: "01",
    title: "Approved Hospital",
    detail: "Wallet & NPI verified inside Poseidon hospitalRoot.",
  },
  {
    code: "02",
    title: "Active Policy",
    detail: "Policy commitment active on-chain and unexpired.",
  },
  {
    code: "03",
    title: "Covered Procedure",
    detail: "CPT code verified in private Depth-6 benefit tree.",
  },
  {
    code: "04",
    title: "Within Cap & Unique",
    detail: "Cumulative spend within cap with fresh nullifier.",
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
  const [logOpen, setLogOpen] = useState(false);

  const isProving =
    proveStage === "building_witness" ||
    proveStage === "loading_artifacts" ||
    proveStage === "computing_witness" ||
    proveStage === "verifying_locally";

  return (
    <section
      id="hospital-prover"
      className="lg:col-span-7 rounded-xl border border-[#E4E4E7] bg-[#FFFFFF] p-5 sm:p-6 space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E4E4E7] pb-3.5">
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold text-[#09090B]">
            Groth16 Prover &amp; Escrow Settlement
          </h2>
          <p className="text-xs text-[#52525B]">
            Witness arithmetic runs in a local Web Worker — only the BN254 proof and 8 public signals go on-chain.
          </p>
        </div>
        {proverOutput ? (
          <Badge variant="emerald">Proof Ready ({proverOutput.elapsedMs}ms)</Badge>
        ) : null}
      </div>

      <OrbitalProver stage={proveStage} elapsedMs={proverOutput?.elapsedMs} />

      {/* 4 Compact Circuit Constraint Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {CIRCUIT_CHECKS.map((item) => (
          <div
            key={item.title}
            className={`rounded-lg border p-3.5 transition-colors ${
              proveStage === "done"
                ? "border-[#059669]/25 bg-[#059669]/5"
                : proveStage === "failed"
                ? "border-[#DC2626]/25 bg-[#EF4444]/5"
                : "border-[#E4E4E7] bg-[#F4F4F5]"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#09090B]">
                <CheckCircle2
                  className={`h-3.5 w-3.5 shrink-0 ${
                    proveStage === "done"
                      ? "text-[#059669]"
                      : proveStage === "failed"
                      ? "text-[#DC2626]"
                      : "text-[#71717A]"
                  }`}
                />
                <span>{item.title}</span>
              </div>
              <span className="font-mono-tabular text-[10px] text-[#71717A]">{item.code}</span>
            </div>
            <p className="mt-1 text-[11px] text-[#52525B] leading-relaxed">{item.detail}</p>
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          Unlock an authorized patient record on the left to enable witness generation.
        </p>
      ) : null}

      {/* Clean Monospace Settlement Confirmation Bar */}
      {settledTx && proverOutput ? (
        <div className="rounded-xl border border-[#059669]/30 bg-[#F4F4F5] overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E4E4E7] bg-[#ECFDF5] px-4 py-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#059669]">
              <CheckCircle2 className="h-4 w-4" />
              Settlement Confirmation
            </div>
            <span className="font-mono-tabular text-sm font-bold text-[#059669]">
              +{settledAmountEth} ETH
            </span>
          </div>

          <div className="p-4 space-y-2.5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono-tabular text-[11px]">
              <div className="flex items-center justify-between rounded-lg border border-[#E4E4E7] bg-[#FFFFFF] px-3 py-2">
                <span className="text-[#71717A] font-sans">Recipient</span>
                <span className="text-[#09090B]">{shortHex(hospitalAddr, 8, 6)}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[#E4E4E7] bg-[#FFFFFF] px-3 py-2">
                <span className="text-[#71717A] font-sans">Nullifier</span>
                <span className="text-[#52525B]">
                  {shortHex(proverOutput.publicSignals[2] ?? "", 10, 6)}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <CopyHash
                label="Tx"
                value={settledTx}
                explorerUrl={IS_CHAIN_DEPLOYED ? explorerTxUrl(settledTx) : undefined}
              />
              <Link
                href="/insurer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0284C7] hover:underline"
              >
                Inspect Calldata in Escrow Treasury
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {/* Collapsible Prover Console */}
      <div className="rounded-lg border border-[#E4E4E7] bg-[#F4F4F5] overflow-hidden text-xs">
        <button
          type="button"
          onClick={() => setLogOpen((prev) => !prev)}
          aria-expanded={logOpen}
          className="flex w-full items-center justify-between px-3.5 py-2.5 text-left font-mono-tabular text-[11px] text-[#52525B] hover:text-[#09090B] hover:bg-[#F4F4F5] cursor-pointer transition-colors"
        >
          <span className="inline-flex items-center gap-2">
            <TerminalIcon className="h-3.5 w-3.5 text-[#059669]" />
            Prover Console Log ({terminalLines.length} entries)
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${logOpen ? "rotate-180" : ""}`}
          />
        </button>
        {logOpen ? (
          <div className="border-t border-[#E4E4E7] p-3">
            <Terminal lines={terminalLines} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
