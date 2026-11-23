"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { FileCode2, ShieldAlert } from "lucide-react";
import { type Cms1500Claim } from "@/lib/intake";
import { type AttackId } from "@/lib/hospitalGuardrails";
import { motionTransitions } from "@/lib/motion-tokens";
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

/**
 * Enterprise Verification & Healthcare Standards Interoperability Dock for `/hospital`.
 * Cleanly tabs between the 5-Attack Fail-Closed Security Lab and HL7 FHIR R4 / ANSI X12 837P staging.
 */
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
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E4E4E7] bg-white px-5 py-3.5 card-porcelain">
        <div className="space-y-0.5">
          <div className="text-[11px] font-mono-tabular uppercase tracking-[0.14em] text-[#0F4C81]">
            03 · Enterprise Compliance &amp; Interoperability Dock
          </div>
          <div className="text-sm font-bold text-[#09090B]">
            Fail-Closed Fraud Guardrails &amp; HL7 FHIR R4 / ANSI X12 837P Export
          </div>
        </div>

        <div className="inline-flex rounded-xl border border-[#E4E4E7] bg-[#F4F5F4] p-1">
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
                type="button"
                onClick={() => setDockTab(id)}
                className={`relative inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  active ? "text-[#09090B]" : "text-[#52525B] hover:text-[#09090B]"
                }`}
              >
                {active ? (
                  <motion.span
                    layoutId="hospital-dock-pill"
                    transition={motionTransitions.springMorph}
                    className="absolute inset-0 rounded-lg bg-white shadow-2xs border border-[#E4E4E7]/80"
                  />
                ) : null}
                <Icon
                  className={`relative z-10 h-3.5 w-3.5 ${
                    active
                      ? id === "security"
                        ? "text-[#B91C1C]"
                        : "text-[#0F4C81]"
                      : "text-[#71717A]"
                  }`}
                />
                <span className="relative z-10">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

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
    </section>
  );
}
