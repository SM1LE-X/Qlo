"use client";

import { CheckCircle2, Lock, ScanLine, Upload } from "lucide-react";
import { Badge } from "@/components/ui/card";
import { TactileButton } from "@/components/ui/tactile-button";
import {
  SYNTHETIC_CMS1500_PRESETS,
  type Cms1500Claim,
  type CompletenessReport,
} from "@/lib/intake";

const INPUT_CLASS =
  "mt-1 w-full rounded-xl border border-[#E4E4E7] bg-white px-3 py-2 text-sm text-[#09090B] placeholder-[#A1A1AA] focus:border-[#0F766E] focus:outline-none transition-colors";

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
    <div
      id="patient-intake"
      className="lg:col-span-7 rounded-2xl border border-[#E4E4E7] bg-white p-6 space-y-5 shadow-2xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F4F4F5] pb-4">
        <div>
          <h2 className="text-base font-semibold text-[#09090B]">
            1. Medical Record Details
          </h2>
          <p className="text-xs text-[#52525B]">
            Pick a sample medical bill or edit the fields below.
          </p>
        </div>
        <Badge variant="emerald">
          <Lock className="h-3 w-3" />
          Stays Private on Device
        </Badge>
      </div>

      {/* Quick-Fill Preset + Optional Scan/Upload */}
      <div className="rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-3.5 space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="preset-select" className="text-xs font-medium text-[#52525B]">
              Quick-Fill Sample Claim
            </label>
            <select
              id="preset-select"
              value={claim.caseLabel}
              onChange={(e) => {
                const found = SYNTHETIC_CMS1500_PRESETS.find((p) => p.caseLabel === e.target.value);
                if (found) onChangeClaim(found);
              }}
              className="mt-1 w-full rounded-lg border border-[#E4E4E7] bg-white px-3 py-1.5 text-xs font-medium text-[#09090B] focus:border-[#0F766E] focus:outline-none"
            >
              {SYNTHETIC_CMS1500_PRESETS.map((p) => (
                <option key={p.caseLabel} value={p.caseLabel}>
                  {p.caseLabel}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <TactileButton
              size="sm"
              variant="secondary"
              onClick={onRunSampleOcr}
              disabled={ocrRunning}
            >
              <ScanLine className="h-3.5 w-3.5 text-[#0F766E]" />
              {ocrRunning ? "Scanning..." : "Scan Sample Bill"}
            </TactileButton>
            <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-[#E4E4E7] bg-white px-2.5 text-xs font-medium text-[#09090B] hover:bg-[#F4F4F5] transition-colors">
              <Upload className="h-3.5 w-3.5" />
              Upload
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.txt,.json,.edi"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onFileSelected(file);
                }}
              />
            </label>
          </div>
        </div>

        {ocrStatus ? (
          <div className="text-[11px] font-mono-tabular text-[#0F766E]">{ocrStatus}</div>
        ) : null}
      </div>

      {/* Main Plain-English Medical Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="box21" className="text-xs font-medium text-[#52525B]">
            Diagnosis Code <span className="text-[#A1A1AA]">(ICD-10)</span>
          </label>
          <input
            id="box21"
            value={claim.icd10Code}
            onChange={(e) => onChangeClaim({ ...claim, icd10Code: e.target.value })}
            className={`${INPUT_CLASS} font-mono-tabular`}
          />
        </div>
        <div>
          <label htmlFor="box24d" className="text-xs font-medium text-[#52525B]">
            Procedure Code <span className="text-[#A1A1AA]">(CPT)</span>
          </label>
          <input
            id="box24d"
            value={claim.cptCode}
            onChange={(e) => onChangeClaim({ ...claim, cptCode: e.target.value })}
            className={`${INPUT_CLASS} font-mono-tabular`}
          />
        </div>
        <div>
          <label htmlFor="box24f" className="text-xs font-medium text-[#52525B]">
            Claim Amount <span className="text-[#A1A1AA]">(ETH payout)</span>
          </label>
          <input
            id="box24f"
            value={claim.claimAmountEth}
            onChange={(e) => onChangeClaim({ ...claim, claimAmountEth: e.target.value })}
            className={`${INPUT_CLASS} font-mono-tabular`}
          />
        </div>
        <div>
          <label htmlFor="box1a" className="text-xs font-medium text-[#52525B]">
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

      <div className="space-y-3">
        <div>
          <label htmlFor="rx" className="text-xs font-medium text-[#52525B]">
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
          <label htmlFor="notes" className="text-xs font-medium text-[#52525B]">
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

      {/* Collapsible Advanced Fields & Validation */}
      <details className="rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] px-4 py-3 text-xs">
        <summary className="flex items-center justify-between cursor-pointer font-medium text-[#52525B] select-none">
          <span>Additional Claim Details (Patient ID &amp; Provider NPI)</span>
          <span
            className={`inline-flex items-center gap-1 font-semibold ${
              completeness.valid ? "text-[#047857]" : "text-[#B91C1C]"
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
              className="mt-1 w-full rounded-lg border border-[#E4E4E7] bg-white px-2.5 py-1.5 font-mono-tabular text-xs text-[#09090B]"
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
              className="mt-1 w-full rounded-lg border border-[#E4E4E7] bg-white px-2.5 py-1.5 font-mono-tabular text-xs text-[#09090B]"
            />
          </div>
        </div>
      </details>
    </div>
  );
}
