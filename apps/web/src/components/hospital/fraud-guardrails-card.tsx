"use client";

import { ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/card";
import { TransitionPanel } from "@/components/ui/transition-panel";
import { type AttackId } from "@/lib/hospitalGuardrails";

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
    <div id="hospital-guardrails" className="space-y-4 scroll-mt-20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-[#DC2626]" />
          <h3 className="text-sm font-semibold text-[#09090B]">
            Automated Policy &amp; Fraud Verification Suite
          </h3>
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
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                active
                  ? "border-[#DC2626]/40 bg-[#FEF2F2] text-[#DC2626]"
                  : "border-[#E4E4E7] bg-[#F4F4F5] text-[#52525B] hover:border-[#D4D4D8] hover:text-[#09090B]"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <TransitionPanel activeKey={activeAttack + attackResult.status}>
        <div className="rounded-lg border border-[#E4E4E7] bg-[#F4F4F5] p-4 text-xs space-y-1.5">
          <div className="font-medium text-[#52525B]">
            Selected Case:{" "}
            <span className="font-mono-tabular uppercase font-semibold text-[#DC2626]">
              {activeAttack}
            </span>
          </div>
          <div className="font-mono-tabular text-[#DC2626] break-all">
            {attackResult.detail ||
              "Select any guardrail vector above to confirm fail-closed proof or contract rejection."}
          </div>
        </div>
      </TransitionPanel>
    </div>
  );
}
