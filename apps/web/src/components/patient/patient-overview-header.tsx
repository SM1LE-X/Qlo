"use client";

import { CheckCircle2, FileLock2 } from "lucide-react";
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
  hasEncrypted = false,
  hasRegistered = false,
}: PatientOverviewHeaderProps) {
  const stages = [
    { label: "1. Enter Bill", done: true },
    { label: "2. Encrypt & Anchor", done: hasEncrypted && hasRegistered },
    { label: "3. Grant Hospital", done: secondsRemaining > 0 },
  ];

  return (
    <section className="relative overflow-hidden rounded-3xl border border-[#E4E4E7] bg-white p-6 sm:p-7 card-porcelain">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(ellipse_at_right,rgba(15,118,110,0.08),transparent_70%)]"
      />
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
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
            Enter or scan a medical bill, lock it with AES-256 encryption on your own device, and
            grant temporary hospital access that you can revoke instantly.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end gap-3 shrink-0">
          {secondsRemaining > 0 ? (
            <div className="flex items-center gap-2 rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-1.5 shadow-2xs">
              <span className="text-xs font-semibold text-[#047857]">Hospital Access Active</span>
              <SlidingCountdown secondsLeft={secondsRemaining} />
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#E4E4E7] bg-[#F7F8F7] p-1.5">
            {stages.map((s) => (
              <div
                key={s.label}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1 text-[11px] font-medium ${
                  s.done
                    ? "bg-white text-[#047857] shadow-2xs border border-[#A7F3D0]"
                    : "text-[#71717A]"
                }`}
              >
                <CheckCircle2
                  className={`h-3 w-3 ${s.done ? "text-[#047857]" : "text-[#A1A1AA]"}`}
                />
                {s.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
