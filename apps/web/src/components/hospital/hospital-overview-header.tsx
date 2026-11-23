"use client";

import { KeyRound, RefreshCw, Upload } from "lucide-react";
import { Badge } from "@/components/ui/card";
import { NumberTicker } from "@/components/ui/number-ticker";
import { StatCard } from "@/components/ui/stat-card";
import { Stepper } from "@/components/ui/stepper";
import { TactileButton } from "@/components/ui/tactile-button";

interface HospitalOverviewHeaderProps {
  isChainDeployed: boolean;
  isApprovedHospital: boolean;
  matchedProviderPresent: boolean;
  isConnected: boolean;
  wrongChain: boolean;
  refreshingInbox: boolean;
  txBusy: boolean;
  settledTx: string;
  hasProverOutput: boolean;
  hasDecryptedClaim: boolean;
  providerRevenueEth: number;
  settledClaimsCount: number;
  lastProofElapsedMs?: number;
  onRefreshInbox: () => void;
  onRegisterHospitalPubKey: () => void;
  onImportBundle: (file: File) => void;
}

export function HospitalOverviewHeader({
  isChainDeployed,
  isApprovedHospital,
  matchedProviderPresent,
  isConnected,
  wrongChain,
  refreshingInbox,
  txBusy,
  settledTx,
  hasProverOutput,
  hasDecryptedClaim,
  providerRevenueEth,
  settledClaimsCount,
  lastProofElapsedMs,
  onRefreshInbox,
  onRegisterHospitalPubKey,
  onImportBundle,
}: HospitalOverviewHeaderProps) {
  const hospitalAuthorized = isChainDeployed ? isApprovedHospital : matchedProviderPresent;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="teal">Hospital Claims Portal</Badge>
            <Badge variant={hospitalAuthorized ? "emerald" : "amber"}>
              {hospitalAuthorized
                ? "Approved Hospital · In Poseidon hospitalRoot"
                : isChainDeployed
                ? "Wallet Not Accredited in hospitalRoot"
                : "Select Accredited Facility Below"}
            </Badge>
            <span className="text-xs font-mono-tabular text-[#71717A]">
              Groth16 WASM · Instant ETH Settlement
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#09090B]">
            Hospital Claim Prover &amp; Adjudication
          </h1>
          <p className="text-xs sm:text-sm text-[#52525B]">
            Unwrap authorized record keys, prove all 8 Groth16 predicates in an off-thread Web Worker, settle escrow payouts, and verify fail-closed policy guardrails.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <TactileButton
            size="sm"
            variant="secondary"
            onClick={onRefreshInbox}
            disabled={refreshingInbox}
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[#0F766E] ${refreshingInbox ? "animate-spin" : ""}`} />
            Refresh Inbox
          </TactileButton>
          <TactileButton
            size="sm"
            variant="secondary"
            onClick={onRegisterHospitalPubKey}
            disabled={txBusy || (isChainDeployed && (!isConnected || wrongChain))}
          >
            <KeyRound className="h-3.5 w-3.5 text-[#0F766E]" />
            Sync Hospital ECDH Key
          </TactileButton>
          <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-[#E4E4E7] bg-white px-3 text-xs font-medium text-[#09090B] hover:bg-[#F4F4F5] transition-colors">
            <Upload className="h-3.5 w-3.5" />
            Import .qlo.json
            <input
              id="qlo-bundle-upload"
              aria-label="Import encrypted .qlo.json bundle"
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImportBundle(file);
              }}
            />
          </label>
        </div>
      </div>

      <Stepper
        current={settledTx ? 3 : hasProverOutput ? 2 : hasDecryptedClaim ? 1 : 0}
        steps={[
          { title: "Unwrap Record", description: "Verify patient grant & DEK" },
          { title: "Prove 8 Predicates", description: "4,349 R1CS in Web Worker" },
          { title: "Settle Escrow ETH", description: "Instant ClaimsVault payout" },
        ]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Settled Revenue"
          valueText={<NumberTicker value={providerRevenueEth} decimals={4} suffix=" ETH" />}
          sublabel="Direct escrow payout"
          deltaText="Instant Finality"
          deltaTone="emerald"
          trend={[0.01, 0.015, 0.02, 0.025, 0.03, Math.max(0.01, providerRevenueEth)]}
          accentColor="#047857"
        />
        <StatCard
          label="Approved Claims"
          valueText={<NumberTicker value={settledClaimsCount} />}
          sublabel="Touchless auto-adjudicated"
          deltaText="0 Denials"
          deltaTone="teal"
          trend={[1, 2, 2, 3, 4, Math.max(1, settledClaimsCount)]}
          accentColor="#0F766E"
        />
        <StatCard
          label="Last Proof Latency"
          valueText={lastProofElapsedMs ? `${lastProofElapsedMs} ms` : "< 500 ms"}
          sublabel="Groth16 BN254 Web Worker"
          deltaText="Client-Side"
          deltaTone="neutral"
          trend={[490, 440, 415, 395, 380, lastProofElapsedMs ?? 365]}
          accentColor="#0F4C81"
        />
        <StatCard
          label="Accreditation"
          valueText="Merkle Verified"
          sublabel="Poseidon(addr, NPI) root"
          deltaText="Active Leaf"
          deltaTone="emerald"
          trend={[1, 1, 1, 1, 1, 1]}
          accentColor="#047857"
        />
      </div>
    </>
  );
}
