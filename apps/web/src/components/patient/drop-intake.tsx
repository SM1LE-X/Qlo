"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { ChevronDown, FileUp, Loader2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import canonicalFixtures from "@/lib/canonicalFixtures.json";
import {
  SYNTHETIC_CMS1500_PRESETS,
  parseClaimFromTextOrJson,
  type Cms1500Claim,
} from "@/lib/intake";
import { SAMPLE_MEDICAL_BILLS, type SampleMedicalBill } from "@/lib/sampleBills";

export interface DropBillOptions {
  runOcr: boolean;
  pngUrl?: string;
  fileBlob?: Blob;
  displayTitle?: string;
  fromRecentVisit?: boolean;
}

interface DropIntakeProps {
  targetHospital: string;
  onChangeTargetHospital: (address: string) => void;
  grantMinutes: number;
  onChangeGrantMinutes: (minutes: number) => void;
  busy: boolean;
  stage: string | null;
  stageDetail?: string;
  onDropBill: (claim: Cms1500Claim, options: DropBillOptions) => Promise<void>;
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".txt", ".json", ".edi"];
const ALLOWED_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "application/json",
  "application/edi-x12",
  "",
]);

const ACCESS_WINDOWS = [10, 30] as const;

export function sanitizeLabel(raw?: string): string {
  if (!raw) return "Clinical Record";
  return (
    raw
      .replace(/^Case\s+[A-Z]\s*[—-]\s*/i, "")
      .replace(/\b(Attack|Synthetic|Sample|Demo|Sandbox)\b:?\s*/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim() || "Clinical Record"
  );
}

export function getFacilityName(hospitalAddress?: string): string {
  if (!hospitalAddress) return canonicalFixtures.hospitals[0].name;
  const match = canonicalFixtures.hospitals.find(
    (h) => h.address.toLowerCase() === hospitalAddress.toLowerCase()
  );
  return match ? match.name : `${hospitalAddress.slice(0, 6)}...${hospitalAddress.slice(-4)}`;
}

export function formatClinicalSummary(claim: Cms1500Claim, title?: string): string {
  return [sanitizeLabel(title || claim.caseLabel), `CPT ${claim.cptCode}`, `ICD-10 ${claim.icd10Code}`, `${claim.claimAmountEth} ETH`, claim.serviceDate].join(" · ");
}

export function mergeOcrClaim(
  base: Cms1500Claim,
  parsed: Partial<Cms1500Claim>,
  fromRecentVisit?: boolean,
  displayTitle?: string
): Cms1500Claim {
  if (!fromRecentVisit) {
    return { ...base, ...parsed, caseLabel: sanitizeLabel(displayTitle || parsed.caseLabel || base.caseLabel) };
  }
  const pick = (re: RegExp, val: string | undefined, fallback: string) =>
    val && re.test(val.trim()) ? val.trim() : fallback;
  return {
    ...base,
    insuredPolicyId: pick(/^\d{4,18}$/, parsed.insuredPolicyId, base.insuredPolicyId),
    icd10Code: pick(/^[A-TV-Z][0-9][0-9AB](?:\.[0-9A-TV-Z]{1,4})?$/i, parsed.icd10Code, base.icd10Code),
    cptCode: pick(/^\d{5}$/, parsed.cptCode, base.cptCode),
    serviceDate: pick(/^\d{4}-\d{2}-\d{2}$/, parsed.serviceDate, base.serviceDate),
    renderingNpi: pick(/^\d{10}$/, parsed.renderingNpi, base.renderingNpi),
    caseLabel: sanitizeLabel(displayTitle || base.caseLabel),
  };
}

function stripFileExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "Medical Bill";
}

export function DropIntake({
  targetHospital,
  onChangeTargetHospital,
  grantMinutes,
  onChangeGrantMinutes,
  busy,
  stage,
  stageDetail,
  onDropBill,
}: DropIntakeProps) {
  const [dragging, setDragging] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const processFile = useCallback(
    async (file: File) => {
      if (busy) return;
      if (file.size > MAX_UPLOAD_BYTES) {
        toast.error("File exceeds 5 MB upload limit.");
        return;
      }
      const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        toast.error("Upload a PNG, JPG, WEBP, JSON, TXT, or EDI bill.");
        return;
      }
      if (!ALLOWED_MIMES.has(file.type.toLowerCase())) {
        toast.error(`Unsupported file type: ${file.type}`);
        return;
      }

      const displayTitle = stripFileExtension(file.name);
      const isImage =
        file.type.startsWith("image/") ||
        [".png", ".jpg", ".jpeg", ".webp"].includes(ext);

      if (isImage) {
        const baseClaim: Cms1500Claim = {
          ...SYNTHETIC_CMS1500_PRESETS[0],
          caseLabel: displayTitle,
        };
        await onDropBill(baseClaim, {
          runOcr: true,
          fileBlob: file,
          displayTitle,
        });
        return;
      }

      const text = await file.text();
      const parsed = parseClaimFromTextOrJson(text);
      const merged: Cms1500Claim = {
        ...SYNTHETIC_CMS1500_PRESETS[0],
        ...parsed,
        caseLabel: displayTitle,
      };
      await onDropBill(merged, {
        runOcr: false,
        displayTitle,
      });
    },
    [busy, onDropBill]
  );

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (file) await processFile(file);
    },
    [processFile]
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragging(false);
      const file = event.dataTransfer.files?.[0];
      if (file) await processFile(file);
    },
    [processFile]
  );

  const handleSelectVisit = useCallback(
    async (bill: SampleMedicalBill) => {
      setMenuOpen(false);
      if (busy) return;
      const cleanClaim: Cms1500Claim = {
        ...bill.claim,
        caseLabel: bill.title,
      };
      await onDropBill(cleanClaim, {
        runOcr: true,
        pngUrl: bill.pngPath,
        displayTitle: bill.title,
        fromRecentVisit: true,
      });
    },
    [busy, onDropBill]
  );

  return (
    <section className="rounded-2xl border border-[#E4E4E7] bg-[#FFFFFF] p-5 shadow-[0_1px_2px_rgba(9,9,11,0.03)] sm:p-6">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative flex min-h-[188px] flex-col items-center justify-center rounded-xl border border-dashed px-6 py-8 text-center transition-colors ${
          dragging
            ? "border-[#09090B] bg-[#F4F4F5]"
            : "border-[#D4D4D8] bg-[#FAFAFA] hover:border-[#A1A1AA]"
        }`}
      >
        <input
          ref={fileInputRef}
          id="bill-file-upload"
          type="file"
          aria-label="Upload bill"
          accept=".png,.jpg,.jpeg,.webp,.json,.txt,.edi"
          disabled={busy}
          onChange={handleFileChange}
          className="sr-only"
        />

        {busy && stage ? (
          <div className="flex flex-col items-center gap-2.5" aria-live="polite">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#E4E4E7] bg-[#FFFFFF]">
              <Loader2
                className="h-4 w-4 animate-spin text-[#059669]"
                aria-hidden="true"
              />
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-[#09090B]">{stage}</p>
              {stageDetail ? (
                <p className="font-mono-tabular text-xs text-[#71717A]">
                  {stageDetail}
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#E4E4E7] bg-[#FFFFFF] text-[#09090B]">
              <FileUp className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-[#09090B]">Drop Bill</h2>
              <p className="text-xs text-[#52525B]">
                PNG, JPG, or JSON. Encrypted locally and shared with your provider.
              </p>
            </div>
            <label
              htmlFor="bill-file-upload"
              className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-[#09090B] px-3.5 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90 cursor-pointer"
            >
              Upload bill
            </label>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#E4E4E7] pt-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label
              htmlFor="hospital-select"
              className="text-xs font-medium text-[#71717A]"
            >
              Provider
            </label>
            <select
              id="hospital-select"
              aria-label="Provider"
              value={targetHospital}
              disabled={busy}
              onChange={(e) => onChangeTargetHospital(e.target.value)}
              className="rounded-lg border border-[#E4E4E7] bg-[#FFFFFF] px-2.5 py-1.5 text-xs font-medium text-[#09090B] transition-colors hover:border-[#D4D4D8] focus:border-[#09090B] focus:outline-none disabled:opacity-50"
            >
              {canonicalFixtures.hospitals.map((hospital) => (
                <option key={hospital.address} value={hospital.address}>
                  {hospital.name}
                </option>
              ))}
            </select>
          </div>

          <div
            role="group"
            aria-label="Access window"
            className="inline-flex items-center rounded-lg border border-[#E4E4E7] bg-[#F4F4F5] p-0.5"
          >
            {ACCESS_WINDOWS.map((mins) => {
              const selected = grantMinutes === mins;
              return (
                <button
                  key={mins}
                  type="button"
                  disabled={busy}
                  aria-pressed={selected}
                  onClick={() => onChangeGrantMinutes(mins)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 ${
                    selected
                      ? "bg-[#FFFFFF] text-[#09090B] shadow-xs"
                      : "text-[#52525B] hover:text-[#09090B]"
                  }`}
                >
                  {mins} min
                </button>
              );
            })}
          </div>
        </div>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            disabled={busy}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4E4E7] bg-[#FFFFFF] px-3 py-1.5 text-xs font-medium text-[#09090B] transition-colors hover:bg-[#F4F4F5] disabled:opacity-50 cursor-pointer"
          >
            <Paperclip className="h-3.5 w-3.5 text-[#52525B]" aria-hidden="true" />
            <span>Attach recent visit</span>
            <ChevronDown
              className={`h-3.5 w-3.5 text-[#71717A] transition-transform duration-150 ${
                menuOpen ? "rotate-180" : ""
              }`}
              aria-hidden="true"
            />
          </button>

          {menuOpen ? (
            <div
              role="menu"
              aria-label="Recent visits"
              className="absolute right-0 top-full z-30 mt-2 w-80 rounded-xl border border-[#E4E4E7] bg-[#FFFFFF] p-1.5 shadow-[0_8px_24px_rgba(9,9,11,0.08)] sm:w-96"
            >
              {SAMPLE_MEDICAL_BILLS.map((bill) => (
                <button
                  key={bill.id}
                  type="button"
                  role="menuitem"
                  onClick={() => void handleSelectVisit(bill)}
                  className="flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[#F4F4F5] cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium text-[#09090B]">
                      {bill.title}
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-[#52525B]">
                      {bill.facility} · CPT {bill.claim.cptCode}
                    </div>
                  </div>
                  <div className="shrink-0 text-right font-mono-tabular">
                    <div className="text-xs font-medium text-[#09090B]">
                      {bill.claim.claimAmountEth} ETH
                    </div>
                    {bill.expectedOutcome === "reject" ? (
                      <div className="text-[10px] text-[#D97706]">Out of plan</div>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
