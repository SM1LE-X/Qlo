"use client";

import { KeyRound, RefreshCw } from "lucide-react";
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#0F4C81]">
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
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#09090B]">
            Hospital Claims Portal
          </h1>
          <p className="text-sm text-[#52525B] max-w-2xl">
            Open a patient&apos;s shared record, generate a zero-knowledge proof in your browser, and settle the ETH payout automatically without exposing medical details.
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

      {isChainDeployed && isApprovedHospital && !onChainKeyRegistered ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#BAE6FD] bg-[#F0F9FF] px-5 py-4 text-xs text-[#0F4C81]">
          <div className="space-y-0.5">
            <div className="font-semibold text-sm text-[#09090B]">
              One-time setup: Register your hospital encryption key
            </div>
            <p className="text-[#52525B]">
              Click once to save your hospital&apos;s public encryption key on Ethereum Sepolia so patients can securely share records with you.
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
