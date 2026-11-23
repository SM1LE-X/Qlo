"use client";

import { CheckCircle2, Cpu, Download, Landmark } from "lucide-react";
import { Badge } from "@/components/ui/card";
import { OrbitalProver } from "@/components/ui/orbital-prover";
import { PaymentNotificationBanner } from "@/components/ui/payment-notification-banner";
import { PaymentReceiptPrinter } from "@/components/ui/payment-receipt-printer";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { TactileButton } from "@/components/ui/tactile-button";
import { BorderBeam, Terminal } from "@/components/ui/terminal";
import { getProviderDisplayName } from "@/lib/clinicalCatalog";
import { IS_CHAIN_DEPLOYED, explorerTxUrl } from "@/lib/contracts";
import { generateX12835Era } from "@/lib/healthcareStandards";
import { type Cms1500Claim } from "@/lib/intake";
import { type ProveStage, type ProverOutput } from "@/lib/prover";

const PREDICATE_LABELS = [
  "1. Hospital Merkle Membership (Poseidon(address, licenseId))",
  "2. Policy Commitment Preimage (Poseidon(6))",
  "3. Policy Unexpired vs. Live Clock (Num2Bits(64) + LessThan)",
  "4. Procedure Code in Covered CPT Tree (MerkleProof(6))",
  "5. Positive Claim Amount (IsZero == 0)",
  "6. Cumulative Annual Cap (priorSpent + claim <= annualLimit)",
  "7. Deterministic Non-Replayable Nullifier (Poseidon(3))",
  "8. Anti-Front-Run Sender Binding (hospitalAddress == msg.sender)",
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
  hospitalAddr: string;
  selectedRecordCommitmentHex?: string;
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
  hospitalAddr,
  selectedRecordCommitmentHex,
  terminalLines,
}: HospitalProverCardProps) {
  return (
    <SpotlightCard
      id="hospital-prover"
      accent="emerald"
      className="lg:col-span-7 relative p-6 space-y-4 scroll-mt-20"
    >
      <BorderBeam
        active={proveStage !== "idle"}
        color={proveStage === "failed" ? "crimson" : proveStage === "done" ? "emerald" : "amber"}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F4F4F5] pb-3">
        <div>
          <h2 className="text-sm font-semibold text-[#09090B]">
            2. 8-Predicate Groth16 Web Worker Prover
          </h2>
          <p className="text-xs text-[#52525B]">
            Runs zero-knowledge proof generation off the UI thread.
          </p>
        </div>
        {proverOutput ? (
          <Badge variant="emerald">Proved &amp; Verified in {proverOutput.elapsedMs}ms</Badge>
        ) : null}
      </div>

      <OrbitalProver stage={proveStage} elapsedMs={proverOutput?.elapsedMs} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {PREDICATE_LABELS.map((label) => (
          <div
            key={label}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] transition-colors ${
              proveStage === "done"
                ? "border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]"
                : proveStage === "failed"
                ? "border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]"
                : "border-[#E4E4E7] bg-[#FAFAFA] text-[#52525B]"
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <TactileButton
          variant="primary"
          onClick={onProve}
          disabled={!decryptedClaim || proveStage === "computing_witness"}
        >
          <Cpu className="h-4 w-4" />
          {proveStage === "computing_witness" ? "Proving in WASM..." : "Generate Groth16 Proof"}
        </TactileButton>

        <TactileButton
          variant="emerald"
          onClick={onSettle}
          disabled={!proverOutput || txBusy || chainSettleBlocked}
        >
          <Landmark className="h-4 w-4" />
          Submit &amp; Auto-Settle ETH
        </TactileButton>
      </div>

      {settledTx && proverOutput ? (
        <div className="space-y-3">
          <PaymentNotificationBanner
            appName="ClaimsVault Instant Payout"
            amount={`${settledAmountEth} ETH`}
            from={`Payer Escrow → ${getProviderDisplayName(hospitalAddr)}`}
            time="Settled via Groth16"
            showTriggerLabel="Show payout alert"
          />
          <PaymentReceiptPrinter
            txHash={settledTx}
            explorerUrl={IS_CHAIN_DEPLOYED ? explorerTxUrl(settledTx) : undefined}
            amountEth={settledAmountEth}
            hospitalAddress={hospitalAddr}
            nullifier={proverOutput.publicSignals[2]}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#A7F3D0] bg-[#ECFDF5]/50 px-4 py-2.5 text-xs">
            <span className="text-[#047857] font-medium">
              Zero-PHI Electronic Remittance Advice ready for practice ledger reconciliation
            </span>
            <TactileButton
              size="sm"
              variant="secondary"
              onClick={() => {
                const eraText = generateX12835Era(
                  {
                    txHash: settledTx,
                    nullifier: proverOutput.publicSignals[2],
                    policyCommitment: proverOutput.publicSignals[1],
                    recordCommitmentHex: selectedRecordCommitmentHex ?? "0x0",
                    hospital: hospitalAddr,
                    amountWei: proverOutput.solidity.pubSignals[3].toString(),
                    settledAt: Math.floor(Date.now() / 1000),
                    rawCalldataHex: proverOutput.solidity.rawCalldataHex,
                    pubSignals: proverOutput.publicSignals,
                  },
                  getProviderDisplayName(hospitalAddr)
                );
                const blob = new Blob([eraText], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `qlo-835-era-${proverOutput.publicSignals[2].slice(0, 10)}.edi`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="h-3.5 w-3.5" />
              Download X12 835 ERA
            </TactileButton>
          </div>
        </div>
      ) : null}

      <Terminal lines={terminalLines} />
    </SpotlightCard>
  );
}
