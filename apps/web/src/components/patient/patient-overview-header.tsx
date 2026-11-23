"use client";

import { FileLock2 } from "lucide-react";
import { Badge } from "@/components/ui/card";
import { SlidingCountdown } from "@/components/ui/number-ticker";
import { Stepper } from "@/components/ui/stepper";

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
  hasEncrypted = false,
  hasRegistered = false,
}: PatientOverviewHeaderProps) {
  const currentStep =
    secondsRemaining > 0 ? 3 : hasEncrypted && hasRegistered ? 2 : hasEncrypted ? 1 : 0;

  return (
    <section className="relative overflow-hidden rounded-3xl border border-[#E4E4E7] bg-white p-6 sm:p-7 card-porcelain space-y-5">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(ellipse_at_right,rgba(15,118,110,0.08),transparent_70%)]"
      />
      <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F0FDFA] border border-[#99F6E4] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0F766E]">
              <FileLock2 className="h-3 w-3" />
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
          <h1 className="text-2xl sm:text-4xl font-bold tracking-[-0.025em] text-[#09090B]">
            Patient{" "}
            <span className="font-editorial italic font-normal text-[#0F766E]">Sovereign</span>{" "}
            Dashboard
          </h1>
          <p className="text-sm text-[#52525B] leading-relaxed">
            Enter or scan a medical bill locally with WASM OCR, seal it with AES-256-GCM on your
            device, and grant revocable time-bound access to your hospital.
          </p>
        </div>

        {secondsRemaining > 0 ? (
          <div className="flex items-center gap-2 rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-1.5 shadow-2xs">
            <span className="text-xs font-semibold text-[#047857]">Hospital Access Active</span>
            <SlidingCountdown secondsLeft={secondsRemaining} />
          </div>
        ) : null}
      </div>

      <Stepper
        current={currentStep}
        steps={[
          {
            title: "Bill Intake & Local OCR",
            description: "Select a preset or scan a bill image via browser WASM",
          },
          {
            title: "AES-256-GCM & On-Chain Hash",
            description: "Encrypt on-device and anchor 248-bit commitment",
          },
          {
            title: "Time-Bounded Hospital Grant",
            description: "Wrap DEK via ECDH P-256 with instant revoke control",
          },
        ]}
      />
    </section>
  );
}
