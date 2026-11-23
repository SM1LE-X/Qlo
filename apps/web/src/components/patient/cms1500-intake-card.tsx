"use client";

import { AlertCircle, CheckCircle2, FileText } from "lucide-react";
import { AnimatedFileUpload } from "@/components/ui/animated-file-upload";
import { Badge } from "@/components/ui/card";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import {
  SYNTHETIC_CMS1500_PRESETS,
  type Cms1500Claim,
  type CompletenessReport,
} from "@/lib/intake";

const INPUT_CLASS =
  "mt-1 w-full rounded-xl border border-[#E4E4E7] bg-white px-3 py-2 font-mono-tabular text-xs text-[#09090B] placeholder-[#A1A1AA] focus:border-[#0F766E] focus:outline-none transition-colors";

interface Cms1500IntakeCardProps {
  claim: Cms1500Claim;
  onChangeClaim: (next: Cms1500Claim) => void;
  completeness: CompletenessReport;
  ocrRunning: boolean;
  ocrStatus: string;
  onRunSampleOcr: () => void;
  onFileSelected: (file: File) => void;
}

export function Cms1500IntakeCard({
  claim,
  onChangeClaim,
  completeness,
  ocrRunning,
  ocrStatus,
  onRunSampleOcr,
  onFileSelected,
}: Cms1500IntakeCardProps) {
  return (
    <SpotlightCard
      id="patient-intake"
      accent="emerald"
      className="lg:col-span-7 p-6 space-y-5 scroll-mt-20"
    >
      <div className="border-b border-[#F4F4F5] pb-4">
        <h2 className="text-sm font-semibold text-[#09090B]">
          1. CMS-1500 Claim Intake &amp; Local OCR
        </h2>
        <p className="text-xs text-[#52525B]">
          All diagnosis, CPT, and prescription fields remain strictly private on your device.
        </p>
      </div>

      <AnimatedFileUpload
        ocrRunning={ocrRunning}
        ocrStatus={ocrStatus}
        onRunSampleOcr={onRunSampleOcr}
        onFileSelected={onFileSelected}
      />

      <div className="space-y-1">
        <label htmlFor="preset-select" className="text-xs font-medium text-[#52525B]">
          Sample Clinical Cases
        </label>
        <select
          id="preset-select"
          value={claim.caseLabel}
          onChange={(e) => {
            const found = SYNTHETIC_CMS1500_PRESETS.find((p) => p.caseLabel === e.target.value);
            if (found) onChangeClaim(found);
          }}
          className={INPUT_CLASS}
        >
          {SYNTHETIC_CMS1500_PRESETS.map((p) => (
            <option key={p.caseLabel} value={p.caseLabel}>
              {p.caseLabel}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div>
          <label htmlFor="box1a" className="text-[#52525B] font-medium">
            Box 1a — Policy ID (Private)
          </label>
          <input
            id="box1a"
            value={claim.insuredPolicyId}
            onChange={(e) => onChangeClaim({ ...claim, insuredPolicyId: e.target.value })}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label htmlFor="box2" className="text-[#52525B] font-medium">
            Box 2 — Patient Alias (Private)
          </label>
          <input
            id="box2"
            value={claim.patientAlias}
            onChange={(e) => onChangeClaim({ ...claim, patientAlias: e.target.value })}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label htmlFor="box21" className="text-[#52525B] font-medium">
            Box 21 — ICD-10-CM (Private)
          </label>
          <input
            id="box21"
            value={claim.icd10Code}
            onChange={(e) => onChangeClaim({ ...claim, icd10Code: e.target.value })}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label htmlFor="box24d" className="text-[#52525B] font-medium">
            Box 24D — CPT Code (Private)
          </label>
          <input
            id="box24d"
            value={claim.cptCode}
            onChange={(e) => onChangeClaim({ ...claim, cptCode: e.target.value })}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label htmlFor="box24f" className="text-[#52525B] font-medium">
            Box 24F — Charge ETH (Public Signal)
          </label>
          <input
            id="box24f"
            value={claim.claimAmountEth}
            onChange={(e) => onChangeClaim({ ...claim, claimAmountEth: e.target.value })}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label htmlFor="box24j" className="text-[#52525B] font-medium">
            Box 24J — Rendering NPI (Private)
          </label>
          <input
            id="box24j"
            value={claim.renderingNpi}
            onChange={(e) => onChangeClaim({ ...claim, renderingNpi: e.target.value })}
            className={INPUT_CLASS}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 text-xs">
        <div>
          <label htmlFor="rx" className="text-[#52525B] font-medium">
            Prescription / Rx (Private)
          </label>
          <input
            id="rx"
            value={claim.prescription}
            onChange={(e) => onChangeClaim({ ...claim, prescription: e.target.value })}
            className="mt-1 w-full rounded-xl border border-[#E4E4E7] bg-white px-3 py-2 text-xs text-[#09090B] focus:border-[#0F766E] focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="notes" className="text-[#52525B] font-medium">
            Clinical Summary (Private)
          </label>
          <textarea
            id="notes"
            rows={2}
            value={claim.clinicalNotes}
            onChange={(e) => onChangeClaim({ ...claim, clinicalNotes: e.target.value })}
            className="mt-1 w-full rounded-xl border border-[#E4E4E7] bg-white px-3 py-2 text-xs text-[#09090B] focus:border-[#0F766E] focus:outline-none"
          />
        </div>
      </div>

      <div className="rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-4 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-[#09090B] flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-[#0F766E]" />
            CMS-1500 Completeness Validator
          </span>
          <Badge variant={completeness.valid ? "emerald" : "crimson"}>
            {completeness.score}/{completeness.total} Checks Valid
          </Badge>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {completeness.checks.map((c) => (
            <div
              key={c.field}
              className={`rounded-lg border px-2.5 py-1 text-[11px] flex items-center gap-1.5 ${
                c.passed
                  ? "border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]"
                  : "border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]"
              }`}
            >
              {c.passed ? (
                <CheckCircle2 className="h-3 w-3 shrink-0" />
              ) : (
                <AlertCircle className="h-3 w-3 shrink-0" />
              )}
              <span className="truncate">
                {c.box}: {c.detail}
              </span>
            </div>
          ))}
        </div>
      </div>
    </SpotlightCard>
  );
}
