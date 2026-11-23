"use client";

import { Cpu, KeyRound, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/card";
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
  onRefreshInbox,
  onRegisterHospitalPubKey,
}: HospitalOverviewHeaderProps) {
  const hospitalAuthorized = isChainDeployed ? isApprovedHospital : matchedProviderPresent;

  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-[#1E242D] bg-[#111419] px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <Cpu className="h-4 w-4 text-[#38BDF8]" />
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#F3F4F6]">
                Claims Prover
              </h1>
              <Badge variant={hospitalAuthorized ? "emerald" : "amber"}>
                {hospitalAuthorized
                  ? "Approved Hospital · In Poseidon hospitalRoot"
                  : isChainDeployed
                  ? "Connect Approved Hospital Wallet"
                  : "Select Approved Hospital"}
              </Badge>
            </div>
            <p className="text-xs text-[#94A3B8]">
              Unwrap patient-authorized CMS-1500 records locally, prove 8 Groth16 predicates, and settle ETH from ClaimsVault.
            </p>
          </div>

          <TactileButton
            size="sm"
            variant="secondary"
            onClick={onRefreshInbox}
            disabled={refreshingInbox}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 text-[#10B981] ${refreshingInbox ? "animate-spin" : ""}`}
            />
            Refresh Records
          </TactileButton>
        </div>
      </section>

      {isChainDeployed && isApprovedHospital && !onChainKeyRegistered ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#38BDF8]/25 bg-[#38BDF8]/10 px-5 py-3.5 text-xs">
          <div className="space-y-0.5">
            <div className="font-semibold text-[#F3F4F6]">
              Register Hospital Encryption Key
            </div>
            <p className="text-[#94A3B8]">
              Publish your browser&apos;s ECDH P-256 public key on Sepolia so patients can wrap record DEKs directly for your facility.
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
