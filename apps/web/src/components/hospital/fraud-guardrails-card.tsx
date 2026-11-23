"use client";

import { motion } from "framer-motion";
import { ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/card";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { TransitionPanel } from "@/components/ui/transition-panel";
import { type AttackId } from "@/lib/hospitalGuardrails";
import { motionTransitions } from "@/lib/motion-tokens";

interface FraudGuardrailsCardProps {
  activeAttack: AttackId;
  attackResult: { status: "idle" | "blocked"; detail: string };
  onRunScenario: (kind: AttackId) => void;
}

export function FraudGuardrailsCard({
  activeAttack,
  attackResult,
  onRunScenario,
}: FraudGuardrailsCardProps) {
  return (
    <SpotlightCard id="hospital-guardrails" accent="crimson" className="p-6 space-y-4 scroll-mt-20">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F4F4F5] pb-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-[#B91C1C]" />
          <h2 className="text-sm font-semibold text-[#09090B]">
            3. Automated Policy &amp; Fraud Verification Suite
          </h2>
        </div>
        <Badge variant="crimson">Fail-Closed Guardrails</Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["replay", "Attack 1: Replay Nullifier"],
            ["cpt", "Attack 2: Uncovered CPT (15777)"],
            ["expired", "Attack 3: Expired Policy"],
            ["cap", "Attack 4: Over Annual Cap"],
            ["revoked", "Attack 5: Post-Revoke Claim"],
          ] as const
        ).map(([id, label]) => {
          const active = activeAttack === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onRunScenario(id)}
              className={`relative rounded-xl border px-3.5 py-2 text-xs font-medium transition-colors cursor-pointer ${
                active
                  ? "border-[#FECACA] text-[#B91C1C]"
                  : "border-[#E4E4E7] bg-[#FAFAFA] text-[#52525B] hover:border-[#D4D4D8] hover:text-[#09090B]"
              }`}
            >
              {active ? (
                <motion.span
                  layoutId="attack-tab"
                  transition={motionTransitions.springMorph}
                  className="absolute inset-0 rounded-xl bg-[#FEF2F2]"
                />
              ) : null}
              <span className="relative z-10">{label}</span>
            </button>
          );
        })}
      </div>

      <TransitionPanel activeKey={activeAttack + attackResult.status}>
        <div className="rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-4 text-xs space-y-1.5">
          <div className="font-semibold text-[#09090B]">
            Selected Verification Case:{" "}
            <span className="uppercase text-[#B91C1C]">{activeAttack}</span>
          </div>
          <div className="font-mono-tabular text-[#B91C1C] break-all">
            {attackResult.detail ||
              "Select any guardrail case above to confirm fail-closed proof or smart-contract rejection."}
          </div>
        </div>
      </TransitionPanel>
    </SpotlightCard>
  );
}
