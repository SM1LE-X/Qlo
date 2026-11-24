"use client";

import { FileLock2 } from "lucide-react";
import { Badge } from "@/components/ui/card";
import { SlidingCountdown } from "@/components/ui/number-ticker";

interface PatientOverviewHeaderProps {
  isPatientRole: boolean;
  isChainDeployed: boolean;
  secondsRemaining: number;
  hasEncrypted?: boolean;
  hasRegistered?: boolean;
}

export function PatientOverviewHeader({
  isPatientRole,
  isChainDeployed,
  secondsRemaining,
}: PatientOverviewHeaderProps) {
  return (
    <section className="rounded-xl border border-[#E4E4E7] bg-[#FFFFFF] px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <FileLock2 className="h-4 w-4 text-[#059669]" />
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#09090B]">
              Records Vault
            </h1>
            <Badge variant={isPatientRole ? "emerald" : isChainDeployed ? "amber" : "neutral"}>
              {isPatientRole
                ? "Patient Wallet Connected"
                : isChainDeployed
                ? "Connect Wallet to Save On-Chain"
                : "Sandbox Mode"}
            </Badge>
          </div>
          <p className="text-xs text-[#52525B]">
            Browser-local CMS-1500 intake, AES-256-GCM encryption, and revocable ECDH P-256 hospital grants.
          </p>
        </div>

        {secondsRemaining > 0 ? (
          <div className="flex items-center gap-2.5 rounded-lg border border-[#059669]/25 bg-[#ECFDF5] px-3.5 py-1.5">
            <span className="text-xs font-medium text-[#059669]">Hospital Access Active</span>
            <SlidingCountdown secondsLeft={secondsRemaining} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
