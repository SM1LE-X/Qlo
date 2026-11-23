"use client";

import { useState } from "react";
import { FileCode2, ShieldAlert } from "lucide-react";
import { type Cms1500Claim } from "@/lib/intake";
import { type AttackId } from "@/lib/hospitalGuardrails";
import { FraudGuardrailsCard } from "./fraud-guardrails-card";
import { StandardsStagingCard } from "./standards-staging-card";

interface EnterpriseVerificationDockProps {
  activeAttack: AttackId;
  attackResult: { status: "idle" | "blocked"; detail: string };
  onRunScenario: (kind: AttackId) => void;
  standardsTab: "fhir" | "x12";
  onChangeStandardsTab: (tab: "fhir" | "x12") => void;
  decryptedClaim: Cms1500Claim | null;
  hospitalAddr: string;
}

export function EnterpriseVerificationDock({
  activeAttack,
  attackResult,
  onRunScenario,
  standardsTab,
  onChangeStandardsTab,
  decryptedClaim,
  hospitalAddr,
}: EnterpriseVerificationDockProps) {
  const [dockTab, setDockTab] = useState<"security" | "standards">("security");

  return (
    <section className="rounded-xl border border-[#1E242D] bg-[#111419] overflow-hidden">
      <div
        role="tablist"
        aria-label="Security guardrails and healthcare standards export"
        className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1E242D] bg-[#0D1014] px-4 py-2.5"
      >
        <div className="inline-flex items-center gap-1 rounded-lg border border-[#1E242D] bg-[#111419] p-0.5">
          {(
            [
              ["security", "Security Guardrails (5 Attacks)", ShieldAlert],
              ["standards", "HL7 FHIR R4 & X12 837P", FileCode2],
            ] as const
          ).map(([id, label, Icon]) => {
            const active = dockTab === id;
            return (
              <button
                key={id}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setDockTab(id)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  active
                    ? "bg-[#161B22] text-[#F3F4F6] border border-[#2B3340]"
                    : "text-[#94A3B8] hover:text-[#F3F4F6] border border-transparent"
                }`}
              >
                <Icon
                  className={`h-3.5 w-3.5 ${
                    active
                      ? id === "security"
                        ? "text-[#EF4444]"
                        : "text-[#38BDF8]"
                      : "text-[#64748B]"
                  }`}
                />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        <span className="font-mono-tabular text-[11px] text-[#64748B]">
          Fail-Closed Circuit &amp; Clearinghouse Interop
        </span>
      </div>

      <div className="p-5">
        {dockTab === "security" ? (
          <FraudGuardrailsCard
            activeAttack={activeAttack}
            attackResult={attackResult}
            onRunScenario={onRunScenario}
          />
        ) : (
          <StandardsStagingCard
            standardsTab={standardsTab}
            onChangeTab={onChangeStandardsTab}
            decryptedClaim={decryptedClaim}
            hospitalAddr={hospitalAddr}
          />
        )}
      </div>
    </section>
  );
}
