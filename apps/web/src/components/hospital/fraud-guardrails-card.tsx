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
          <ShieldAlert className="h-4 w-4 text-[#EF4444]" />
          <h3 className="text-sm font-semibold text-[#F3F4F6]">
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
                  ? "border-[#EF4444]/40 bg-[#EF4444]/10 text-[#EF4444]"
                  : "border-[#1E242D] bg-[#0D1014] text-[#94A3B8] hover:border-[#2B3340] hover:text-[#F3F4F6]"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <TransitionPanel activeKey={activeAttack + attackResult.status}>
        <div className="rounded-lg border border-[#1E242D] bg-[#0D1014] p-4 text-xs space-y-1.5">
          <div className="font-medium text-[#94A3B8]">
            Selected Case:{" "}
            <span className="font-mono-tabular uppercase font-semibold text-[#EF4444]">
              {activeAttack}
            </span>
          </div>
          <div className="font-mono-tabular text-[#EF4444] break-all">
            {attackResult.detail ||
              "Select any guardrail vector above to confirm fail-closed proof or contract rejection."}
          </div>
        </div>
      </TransitionPanel>
    </div>
  );
}
