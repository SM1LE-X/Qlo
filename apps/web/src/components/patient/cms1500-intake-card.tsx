"use client";

import { CheckCircle2, Download, FileText, Loader2, Lock, ScanLine, Upload } from "lucide-react";
import { Badge } from "@/components/ui/card";
import { TactileButton } from "@/components/ui/tactile-button";
import {
  SYNTHETIC_CMS1500_PRESETS,
  type Cms1500Claim,
  type CompletenessReport,
} from "@/lib/intake";
import { SAMPLE_MEDICAL_BILLS, type SampleMedicalBill } from "@/lib/sampleBills";

const INPUT_CLASS =
  "mt-1.5 w-full rounded-lg border border-[#1E242D] bg-[#0D1014] px-3 py-2 text-xs text-[#F3F4F6] placeholder-[#64748B] focus:border-[#10B981] focus:outline-none transition-colors";

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
    <section
      id="patient-intake"
      className="lg:col-span-7 rounded-xl border border-[#1E242D] bg-[#111419] p-5 sm:p-6 space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1E242D] pb-4">
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold text-[#F3F4F6]">CMS-1500 Clinical Claim Intake</h2>
          <p className="text-xs text-[#94A3B8]">
            Client-side WASM OCR and structured bill fields — zero plaintext leaves your device.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono-tabular text-[11px] font-medium ${
              completeness.valid
                ? "border-[#10B981]/25 bg-[#10B981]/10 text-[#10B981]"
                : "border-[#EF4444]/25 bg-[#EF4444]/10 text-[#EF4444]"
            }`}
          >
            <CheckCircle2 className="h-3 w-3" />
            {completeness.score}/{completeness.total} Ready
          </span>
          <Badge variant="emerald">
            <Lock className="h-3 w-3" />
            Local Only
          </Badge>
        </div>
      </div>

      {/* Inline Action Toolbar: Preset + Sample OCR + File Upload */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-2.5 rounded-lg border border-[#1E242D] bg-[#0D1014] p-3">
        <div className="flex-1 min-w-0">
          <label
            htmlFor="preset-select"
            className="block text-[11px] font-medium text-[#94A3B8]"
          >
            Clinical Preset
          </label>
          <select
            id="preset-select"
            value={claim.caseLabel}
            onChange={(e) => {
              const found = SYNTHETIC_CMS1500_PRESETS.find((p) => p.caseLabel === e.target.value);
              if (found) onChangeClaim(found);
            }}
            className="mt-1 w-full rounded-lg border border-[#1E242D] bg-[#161B22] px-2.5 py-1.5 text-xs font-medium text-[#F3F4F6] focus:border-[#10B981] focus:outline-none"
          >
            {SYNTHETIC_CMS1500_PRESETS.map((p) => (
              <option key={p.caseLabel} value={p.caseLabel} className="bg-[#111419] text-[#F3F4F6]">
                {p.caseLabel}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <TactileButton
            type="button"
            size="sm"
            variant="secondary"
            onClick={onRunSampleOcr}
            disabled={ocrRunning}
          >
            {ocrRunning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ScanLine className="h-3.5 w-3.5 text-[#10B981]" />
            )}
            Run Sample Bill OCR
          </TactileButton>

          <label
            htmlFor="cms1500-file-upload"
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-[#1E242D] bg-[#161B22] px-3 text-xs font-medium text-[#F3F4F6] hover:border-[#2B3340] transition-colors"
          >
            <Upload className="h-3.5 w-3.5 text-[#38BDF8]" />
            <span>Upload</span>
            <input
              id="cms1500-file-upload"
              aria-label="Upload medical bill image or JSON file"
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.txt,.json,.edi"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onFileSelected(file);
                e.currentTarget.value = "";
              }}
            />
          </label>
        </div>
      </div>

      {ocrStatus ? (
        <div className="rounded-lg border border-[#38BDF8]/25 bg-[#38BDF8]/10 px-3 py-2 font-mono-tabular text-[11px] text-[#38BDF8]">
          {ocrStatus}
        </div>
      ) : null}

      {/* Sample Medical Bills Pack: 1-Click OCR Scan, Instant Load, or PNG/JSON Download */}
      <div className="rounded-lg border border-[#1E242D] bg-[#0D1014] p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-[#F3F4F6]">
            <FileText className="h-3.5 w-3.5 text-[#10B981]" />
            <span>Sample Medical Bills &amp; Invoices</span>
          </div>
          <span className="font-mono-tabular text-[11px] text-[#64748B]">
            5 synthetic CMS-1500 invoices · OCR-ready PNG + JSON
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SAMPLE_MEDICAL_BILLS.map((bill: SampleMedicalBill) => {
            const isActive =
              claim.cptCode === bill.claim.cptCode &&
              claim.claimAmountEth === bill.claim.claimAmountEth;
            return (
              <div
                key={bill.id}
                className={`flex flex-col justify-between gap-2 rounded-lg border p-2.5 text-xs transition-colors ${
                  isActive
                    ? "border-[#10B981]/50 bg-[#161B22]"
                    : "border-[#1E242D] bg-[#111419] hover:border-[#2B3340]"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="font-semibold text-[#F3F4F6] truncate">{bill.title}</span>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 font-mono-tabular text-[10px] font-medium ${
                        bill.expectedOutcome === "settle"
                          ? "bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/25"
                          : "bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/25"
                      }`}
                    >
                      {bill.claim.claimAmountEth} ETH
                    </span>
                  </div>
                  <div className="font-mono-tabular text-[11px] text-[#94A3B8] truncate">
                    {bill.facility} · CPT {bill.claim.cptCode} · ICD {bill.claim.icd10Code}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-[#1E242D]">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={ocrRunning}
                      onClick={async () => {
                        const res = await fetch(bill.pngPath);
                        const blob = await res.blob();
                        const file = new File([blob], `${bill.id}.png`, { type: "image/png" });
                        onFileSelected(file);
                      }}
                      className="inline-flex items-center gap-1 rounded border border-[#10B981]/30 bg-[#10B981]/10 px-2 py-0.5 text-[11px] font-medium text-[#10B981] hover:bg-[#10B981]/20 disabled:opacity-50 cursor-pointer"
                    >
                      <ScanLine className="h-3 w-3" />
                      OCR Scan
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeClaim(bill.claim)}
                      className="inline-flex items-center rounded border border-[#1E242D] bg-[#0D1014] px-2 py-0.5 text-[11px] font-medium text-[#F3F4F6] hover:border-[#2B3340] cursor-pointer"
                    >
                      Load
                    </button>
                  </div>

                  <div className="flex items-center gap-1 font-mono-tabular text-[10px]">
                    <a
                      href={bill.pngPath}
                      download={`${bill.id}.png`}
                      className="inline-flex items-center gap-0.5 rounded border border-[#1E242D] bg-[#0D1014] px-1.5 py-0.5 text-[#94A3B8] hover:text-[#F3F4F6]"
                      title={`Download ${bill.id}.png`}
                    >
                      <Download className="h-2.5 w-2.5" />
                      PNG
                    </a>
                    <a
                      href={bill.jsonPath}
                      download={`${bill.id}.json`}
                      className="inline-flex items-center gap-0.5 rounded border border-[#1E242D] bg-[#0D1014] px-1.5 py-0.5 text-[#94A3B8] hover:text-[#F3F4F6]"
                      title={`Download ${bill.id}.json`}
                    >
                      JSON
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Core CMS-1500 Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="box21" className="text-xs font-medium text-[#94A3B8]">
            Diagnosis Code <span className="text-[#64748B] font-mono-tabular">(Box 21 · ICD-10)</span>
          </label>
          <input
            id="box21"
            value={claim.icd10Code}
            onChange={(e) => onChangeClaim({ ...claim, icd10Code: e.target.value })}
            className={`${INPUT_CLASS} font-mono-tabular`}
          />
        </div>
        <div>
          <label htmlFor="box24d" className="text-xs font-medium text-[#94A3B8]">
            Procedure Code <span className="text-[#64748B] font-mono-tabular">(Box 24D · CPT)</span>
          </label>
          <input
            id="box24d"
            value={claim.cptCode}
            onChange={(e) => onChangeClaim({ ...claim, cptCode: e.target.value })}
            className={`${INPUT_CLASS} font-mono-tabular`}
          />
        </div>
        <div>
          <label htmlFor="box24f" className="text-xs font-medium text-[#94A3B8]">
            Claim Amount <span className="text-[#64748B] font-mono-tabular">(Box 24F · ETH)</span>
          </label>
          <input
            id="box24f"
            value={claim.claimAmountEth}
            onChange={(e) => onChangeClaim({ ...claim, claimAmountEth: e.target.value })}
            className={`${INPUT_CLASS} font-mono-tabular`}
          />
        </div>
        <div>
          <label htmlFor="box1a" className="text-xs font-medium text-[#94A3B8]">
            Insurance Policy ID <span className="text-[#64748B] font-mono-tabular">(Box 1A)</span>
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
          <label htmlFor="rx" className="text-xs font-medium text-[#94A3B8]">
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
          <label htmlFor="notes" className="text-xs font-medium text-[#94A3B8]">
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

      {/* Patient Alias & Provider NPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg border border-[#1E242D] bg-[#0D1014] p-3.5">
        <div>
          <label htmlFor="box2" className="text-xs font-medium text-[#94A3B8]">
            Patient Alias <span className="text-[#64748B] font-mono-tabular">(Box 2)</span>
          </label>
          <input
            id="box2"
            value={claim.patientAlias}
            onChange={(e) => onChangeClaim({ ...claim, patientAlias: e.target.value })}
            className="mt-1.5 w-full rounded-lg border border-[#1E242D] bg-[#161B22] px-3 py-1.5 font-mono-tabular text-xs text-[#F3F4F6] focus:border-[#10B981] focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="box24j" className="text-xs font-medium text-[#94A3B8]">
            Provider NPI Number <span className="text-[#64748B] font-mono-tabular">(Box 24J)</span>
          </label>
          <input
            id="box24j"
            value={claim.renderingNpi}
            onChange={(e) => onChangeClaim({ ...claim, renderingNpi: e.target.value })}
            className="mt-1.5 w-full rounded-lg border border-[#1E242D] bg-[#161B22] px-3 py-1.5 font-mono-tabular text-xs text-[#F3F4F6] focus:border-[#10B981] focus:outline-none"
          />
        </div>
      </div>
    </section>
  );
}
