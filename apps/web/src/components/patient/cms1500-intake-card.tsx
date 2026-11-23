"use client";

import { CheckCircle2, Lock } from "lucide-react";
import { AnimatedFileUpload } from "@/components/ui/animated-file-upload";
import { Badge } from "@/components/ui/card";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import {
  SYNTHETIC_CMS1500_PRESETS,
  type Cms1500Claim,
  type CompletenessReport,
} from "@/lib/intake";

const INPUT_CLASS =
  "mt-1.5 w-full rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] px-3.5 py-2.5 text-sm text-[#09090B] placeholder-[#A1A1AA] focus:border-[#0F766E] focus:bg-white focus:ring-2 focus:ring-[#0F766E]/10 focus:outline-none transition-all";

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
      className="lg:col-span-7 p-6 sm:p-7 space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F4F4F5] pb-4">
        <div className="space-y-0.5">
          <div className="text-[11px] font-mono-tabular uppercase tracking-[0.14em] text-[#0F766E]">
            01 · Local Medical Intake &amp; CMS-1500 Parser
          </div>
          <h2 className="text-lg font-bold tracking-tight text-[#09090B]">
            1. Medical Record Details
          </h2>
          <p className="text-xs text-[#52525B]">
            Pick a synthetic clinical preset, drop a bill for browser-local WASM OCR, or edit fields.
          </p>
        </div>
        <Badge variant="emerald">
          <Lock className="h-3 w-3" />
          Stays Private on Device
        </Badge>
      </div>

      {/* Quick-Fill Clinical Case Selector */}
      <div>
        <label htmlFor="preset-select" className="text-xs font-semibold text-[#3F3F46]">
          Quick-Fill Clinical Encounter Preset
        </label>
        <select
          id="preset-select"
          value={claim.caseLabel}
          onChange={(e) => {
            const found = SYNTHETIC_CMS1500_PRESETS.find((p) => p.caseLabel === e.target.value);
            if (found) onChangeClaim(found);
          }}
          className="mt-1.5 w-full rounded-xl border border-[#E4E4E7] bg-white px-3.5 py-2.5 text-xs font-medium text-[#09090B] focus:border-[#0F766E] focus:outline-none shadow-2xs"
        >
          {SYNTHETIC_CMS1500_PRESETS.map((p) => (
            <option key={p.caseLabel} value={p.caseLabel}>
              {p.caseLabel}
            </option>
          ))}
        </select>
      </div>

      {/* Enterprise Drag-and-Drop Browser-Local OCR Zone */}
      <AnimatedFileUpload
        ocrRunning={ocrRunning}
        ocrStatus={ocrStatus}
        onRunSampleOcr={onRunSampleOcr}
        onFileSelected={onFileSelected}
      />

      {/* Main Plain-English Medical Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="box21" className="text-xs font-semibold text-[#3F3F46]">
            Diagnosis Code <span className="font-normal text-[#71717A]">(ICD-10)</span>
          </label>
          <input
            id="box21"
            value={claim.icd10Code}
            onChange={(e) => onChangeClaim({ ...claim, icd10Code: e.target.value })}
            className={`${INPUT_CLASS} font-mono-tabular`}
          />
        </div>
        <div>
          <label htmlFor="box24d" className="text-xs font-semibold text-[#3F3F46]">
            Procedure Code <span className="font-normal text-[#71717A]">(CPT)</span>
          </label>
          <input
            id="box24d"
            value={claim.cptCode}
            onChange={(e) => onChangeClaim({ ...claim, cptCode: e.target.value })}
            className={`${INPUT_CLASS} font-mono-tabular`}
          />
        </div>
        <div>
          <label htmlFor="box24f" className="text-xs font-semibold text-[#3F3F46]">
            Claim Amount <span className="font-normal text-[#71717A]">(ETH payout)</span>
          </label>
          <input
            id="box24f"
            value={claim.claimAmountEth}
            onChange={(e) => onChangeClaim({ ...claim, claimAmountEth: e.target.value })}
            className={`${INPUT_CLASS} font-mono-tabular`}
          />
        </div>
        <div>
          <label htmlFor="box1a" className="text-xs font-semibold text-[#3F3F46]">
            Insurance Policy ID
          </label>
          <input
            id="box1a"
            value={claim.insuredPolicyId}
            onChange={(e) => onChangeClaim({ ...claim, insuredPolicyId: e.target.value })}
            className={`${INPUT_CLASS} font-mono-tabular`}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="rx" className="text-xs font-semibold text-[#3F3F46]">
            Prescription / Medications
          </label>
          <input
            id="rx"
            value={claim.prescription}
            onChange={(e) => onChangeClaim({ ...claim, prescription: e.target.value })}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label htmlFor="notes" className="text-xs font-semibold text-[#3F3F46]">
            Doctor Summary
          </label>
          <textarea
            id="notes"
            rows={2}
            value={claim.clinicalNotes}
            onChange={(e) => onChangeClaim({ ...claim, clinicalNotes: e.target.value })}
            className={INPUT_CLASS}
          />
        </div>
      </div>

      {/* Collapsible Advanced Fields & Completeness Meter */}
      <details className="rounded-2xl border border-[#E4E4E7] bg-[#F7F8F7] px-4 py-3 text-xs">
        <summary className="flex items-center justify-between cursor-pointer font-medium text-[#3F3F46] select-none">
          <span>Additional Claim Details (Patient ID &amp; Provider NPI)</span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-semibold ${
              completeness.valid
                ? "bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]"
                : "bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]"
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {completeness.score}/{completeness.total} Ready
          </span>
        </summary>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-[#E4E4E7]">
          <div>
            <label htmlFor="box2" className="text-[#52525B] font-medium">
              Patient Alias
            </label>
            <input
              id="box2"
              value={claim.patientAlias}
              onChange={(e) => onChangeClaim({ ...claim, patientAlias: e.target.value })}
              className="mt-1 w-full rounded-xl border border-[#E4E4E7] bg-white px-3 py-2 font-mono-tabular text-xs text-[#09090B]"
            />
          </div>
          <div>
            <label htmlFor="box24j" className="text-[#52525B] font-medium">
              Provider NPI Number
            </label>
            <input
              id="box24j"
              value={claim.renderingNpi}
              onChange={(e) => onChangeClaim({ ...claim, renderingNpi: e.target.value })}
              className="mt-1 w-full rounded-xl border border-[#E4E4E7] bg-white px-3 py-2 font-mono-tabular text-xs text-[#09090B]"
            />
          </div>
        </div>
      </details>
    </SpotlightCard>
  );
}
