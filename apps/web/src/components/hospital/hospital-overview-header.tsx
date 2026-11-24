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
      <section className="rounded-xl border border-[#E4E4E7] bg-[#FFFFFF] px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <Cpu className="h-4 w-4 text-[#0284C7]" />
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#09090B]">
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
            <p className="text-xs text-[#52525B]">
              Local Groth16 proving and ClaimsVault escrow settlement.
            </p>
          </div>

          <TactileButton
            size="sm"
            variant="secondary"
            onClick={onRefreshInbox}
            disabled={refreshingInbox}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 text-[#059669] ${refreshingInbox ? "animate-spin" : ""}`}
            />
            Refresh Records
          </TactileButton>
        </div>
      </section>

      {isChainDeployed && isApprovedHospital && !onChainKeyRegistered ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#0284C7]/25 bg-[#F0F9FF] px-5 py-3.5 text-xs">
          <div className="space-y-0.5">
            <div className="font-semibold text-[#09090B]">
              One-time setup: enable this device to open patient records
            </div>
            <p className="text-[#52525B]">
              Do this before the patient shares. Records shared earlier to another device can&apos;t be opened here — ask the patient to share again.
            </p>
          </div>
          <TactileButton
            size="sm"
            variant="primary"
            onClick={onRegisterHospitalPubKey}
            disabled={txBusy || !isConnected || wrongChain}
          >
            <KeyRound className="h-3.5 w-3.5" />
            Enable this device
          </TactileButton>
        </div>
      ) : null}
    </div>
  );
}
