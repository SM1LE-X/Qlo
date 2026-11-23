"use client";

import { Badge } from "@/components/ui/card";
import { SlidingCountdown } from "@/components/ui/number-ticker";

interface PatientOverviewHeaderProps {
  isPatientRole: boolean;
  isChainDeployed: boolean;
  secondsRemaining: number;
}

export function PatientOverviewHeader({
  isPatientRole,
  isChainDeployed,
  secondsRemaining,
}: PatientOverviewHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#0F766E]">
            Step 1 of 3
          </span>
          <Badge variant={isPatientRole ? "emerald" : isChainDeployed ? "amber" : "neutral"}>
            {isPatientRole
              ? "Patient Wallet Connected"
              : isChainDeployed
              ? "Connect Wallet to Save On-Chain"
              : "Sandbox Mode"}
          </Badge>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#09090B]">
          Patient Dashboard
        </h1>
        <p className="text-sm text-[#52525B] max-w-2xl">
          Enter or scan a medical bill, encrypt it on your device, and grant temporary access to your hospital. You can revoke access anytime.
        </p>
      </div>

      {secondsRemaining > 0 ? (
        <div className="flex items-center gap-2 rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-1.5">
          <span className="text-xs font-semibold text-[#047857]">Hospital Access Active</span>
          <SlidingCountdown secondsLeft={secondsRemaining} />
        </div>
      ) : null}
    </div>
  );
}
