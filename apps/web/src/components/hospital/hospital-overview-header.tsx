"use client";

import { Cpu, KeyRound, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/card";
import { Stepper } from "@/components/ui/stepper";
import { TactileButton } from "@/components/ui/tactile-button";

interface HospitalOverviewHeaderProps {
  isChainDeployed: boolean;
  isApprovedHospital: boolean;
  matchedProviderPresent: boolean;
  isConnected: boolean;
  wrongChain: boolean;
  onChainKeyRegistered: boolean;
  refreshingInbox: boolean;
  txBusy: boolean;
  hasDecrypted?: boolean;
  hasProved?: boolean;
  hasSettled?: boolean;
  onRefreshInbox: () => void;
  onRegisterHospitalPubKey: () => void;
}

export function HospitalOverviewHeader({
  isChainDeployed,
  isApprovedHospital,
  matchedProviderPresent,
  isConnected,
  wrongChain,
  onChainKeyRegistered,
  refreshingInbox,
  txBusy,
  hasDecrypted = false,
  hasProved = false,
  hasSettled = false,
  onRefreshInbox,
  onRegisterHospitalPubKey,
}: HospitalOverviewHeaderProps) {
  const hospitalAuthorized = isChainDeployed ? isApprovedHospital : matchedProviderPresent;
  const currentStep = hasSettled ? 3 : hasProved ? 2 : hasDecrypted ? 1 : 0;

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-3xl border border-[#E4E4E7] bg-white p-6 sm:p-7 card-porcelain space-y-5">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(ellipse_at_right,rgba(15,76,129,0.08),transparent_70%)]"
        />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F0F9FF] border border-[#BAE6FD] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0F4C81]">
                <Cpu className="h-3 w-3" />
                Step 2 of 3
              </span>
              <Badge variant={hospitalAuthorized ? "emerald" : "amber"}>
                {hospitalAuthorized
                  ? "Approved Hospital · In Poseidon hospitalRoot"
                  : isChainDeployed
                  ? "Connect Approved Hospital Wallet"
                  : "Select Approved Hospital"}
              </Badge>
            </div>
            <h1 className="text-2xl sm:text-4xl font-bold tracking-[-0.025em] text-[#09090B]">
              Hospital{" "}
              <span className="font-editorial italic font-normal text-[#0F4C81]">Prover</span>{" "}
              Workbench
            </h1>
            <p className="text-sm text-[#52525B] leading-relaxed">
              Decrypt a patient-authorized record locally, generate a Groth16 zero-knowledge proof
              in your browser, and settle ETH automatically without exposing medical details.
            </p>
          </div>

          <TactileButton
            size="sm"
            variant="secondary"
            onClick={onRefreshInbox}
            disabled={refreshingInbox}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 text-[#0F766E] ${refreshingInbox ? "animate-spin" : ""}`}
            />
            Refresh Records
          </TactileButton>
        </div>

        <Stepper
          current={currentStep}
          steps={[
            {
              title: "Verify Consent & Unwrap DEK",
              description: "Check active patient grant and decrypt CMS-1500 locally",
            },
            {
              title: "8-Predicate Groth16 Proof",
              description: "Prove hospital, policy, CPT & cap in Web Worker (<3s)",
            },
            {
              title: "Atomic Escrow Settlement",
              description: "Submit BN254 proof to ClaimsVault for instant ETH payout",
            },
          ]}
        />
      </section>

      {isChainDeployed && isApprovedHospital && !onChainKeyRegistered ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#BAE6FD] bg-[#F0F9FF] px-6 py-4 text-xs text-[#0F4C81] shadow-2xs">
          <div className="space-y-0.5">
            <div className="font-bold text-sm text-[#09090B]">
              One-time setup: Register your hospital encryption key
            </div>
            <p className="text-[#52525B]">
              Save your browser&apos;s ECDH P-256 public key on Ethereum Sepolia so patients can
              wrap encrypted medical records directly for your facility.
            </p>
          </div>
          <TactileButton
            size="sm"
            variant="primary"
            onClick={onRegisterHospitalPubKey}
            disabled={txBusy || !isConnected || wrongChain}
          >
            <KeyRound className="h-3.5 w-3.5" />
            Register Hospital Key
          </TactileButton>
        </div>
      ) : null}
    </div>
  );
}
