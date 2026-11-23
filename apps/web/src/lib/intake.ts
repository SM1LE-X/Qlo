"use client";

export interface Cms1500Claim {
  caseLabel: string;
  insuredPolicyId: string;
  patientAlias: string;
  icd10Code: string;
  serviceDate: string;
  cptCode: string;
  claimAmountEth: string;
  renderingNpi: string;
  prescription: string;
  clinicalNotes: string;
  useExpiredPolicy?: boolean;
  priorSpentEthOverride?: string;
}

export interface CompletenessCheck {
  field: string;
  box: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface CompletenessReport {
  valid: boolean;
  score: number;
  total: number;
  checks: CompletenessCheck[];
}

export const SYNTHETIC_CMS1500_PRESETS: Cms1500Claim[] = [
  {
    caseLabel: "Case A — Valid Cardiac STEMI ER (Claim #1)",
    insuredPolicyId: "2026001",
    patientAlias: "SYNTH-CASE-042",
    icd10Code: "I21.0",
    serviceDate: "2026-11-22",
    cptCode: "99285",
    claimAmountEth: "0.01",
    renderingNpi: "1234567890",
    prescription: "Aspirin 325mg + Ticagrelor 180mg",
    clinicalNotes: "Acute anterior STEMI emergency stabilization; troponin elevated; inpatient cath transfer.",
  },
  {
    caseLabel: "Case B — Valid Cardiology Follow-up (Cumulative Claim #2)",
    insuredPolicyId: "2026001",
    patientAlias: "SYNTH-CASE-042",
    icd10Code: "I25.10",
    serviceDate: "2026-11-22",
    cptCode: "99214",
    claimAmountEth: "0.015",
    renderingNpi: "1234567890",
    prescription: "Atorvastatin 80mg + Metoprolol 50mg",
    clinicalNotes: "Post-MI 14-day outpatient cardiology evaluation and medication titration.",
  },
  {
    caseLabel: "Case C — Attack: Uncovered Cosmetic CPT (15777)",
    insuredPolicyId: "2026001",
    patientAlias: "SYNTH-CASE-108",
    icd10Code: "Z41.1",
    serviceDate: "2026-11-22",
    cptCode: "15777",
    claimAmountEth: "0.01",
    renderingNpi: "1234567890",
    prescription: "Cephalexin 500mg prophylaxis",
    clinicalNotes: "Elective cosmetic biologic implant excluded under covered CPT policy schedule.",
  },
  {
    caseLabel: "Case D — Attack: Expired Policy (2025099)",
    insuredPolicyId: "2025099",
    patientAlias: "SYNTH-CASE-219",
    icd10Code: "J18.9",
    serviceDate: "2026-11-22",
    cptCode: "99284",
    claimAmountEth: "0.008",
    renderingNpi: "1234567890",
    prescription: "Azithromycin 500mg",
    clinicalNotes: "Community-acquired pneumonia ER visit billed against an expired policy period.",
    useExpiredPolicy: true,
  },
  {
    caseLabel: "Case E — Attack: Over Annual Cap (0.04 ETH > 0.03 ETH)",
    insuredPolicyId: "2026001",
    patientAlias: "SYNTH-CASE-307",
    icd10Code: "I21.0",
    serviceDate: "2026-11-22",
    cptCode: "99285",
    claimAmountEth: "0.04",
    renderingNpi: "1234567890",
    prescription: "Heparin IV bolus",
    clinicalNotes: "Billed payout exceeds the private 0.03 ETH cumulative annual policy ceiling.",
  },
];

export function validateCms1500Completeness(claim: Cms1500Claim): CompletenessReport {
  const amountNum = Number(claim.claimAmountEth);
  const checks: CompletenessCheck[] = [
    {
      field: "insuredPolicyId",
      box: "Box 1a",
      label: "Insured Policy ID",
      passed: /^\d{4,18}$/.test(claim.insuredPolicyId.trim()),
      detail: claim.insuredPolicyId.trim() || "Missing numeric policy ID",
    },
    {
      field: "patientAlias",
      box: "Box 2",
      label: "Synthetic Patient Pseudonym",
      passed: claim.patientAlias.trim().length >= 3,
      detail: claim.patientAlias.trim() || "Missing patient identifier",
    },
    {
      field: "icd10Code",
      box: "Box 21 (Ind 0)",
      label: "ICD-10-CM Diagnosis Code",
      passed: /^[A-TV-Z][0-9][0-9AB](?:\.[0-9A-TV-Z]{1,4})?$/i.test(claim.icd10Code.trim()),
      detail: claim.icd10Code.trim() || "Invalid ICD-10-CM format",
    },
    {
      field: "serviceDate",
      box: "Box 24A",
      label: "Encounter Service Date",
      passed: /^\d{4}-\d{2}-\d{2}$/.test(claim.serviceDate.trim()),
      detail: claim.serviceDate.trim() || "YYYY-MM-DD required",
    },
    {
      field: "cptCode",
      box: "Box 24D",
      label: "5-Digit CPT / HCPCS Code",
      passed: /^\d{5}$/.test(claim.cptCode.trim()),
      detail: claim.cptCode.trim() || "5-digit CPT required",
    },
    {
      field: "claimAmountEth",
      box: "Box 24F",
      label: "Positive Claim Charge (ETH)",
      passed: Number.isFinite(amountNum) && amountNum > 0 && amountNum <= 10,
      detail: Number.isFinite(amountNum) && amountNum > 0 ? `${amountNum} ETH` : "Must be > 0 and <= 10 ETH",
    },
    {
      field: "renderingNpi",
      box: "Box 24J",
      label: "10-Digit Rendering Provider NPI",
      passed: /^\d{10}$/.test(claim.renderingNpi.trim()),
      detail: claim.renderingNpi.trim() || "10-digit NPI required",
    },
  ];

  const score = checks.filter((c) => c.passed).length;
  return {
    valid: score === checks.length,
    score,
    total: checks.length,
    checks,
  };
}

export function parseClaimFromTextOrJson(raw: string): Partial<Cms1500Claim> {
  try {
    const parsed = JSON.parse(raw) as Partial<Cms1500Claim>;
    if (parsed && typeof parsed === "object" && (parsed.cptCode || parsed.icd10Code)) {
      return parsed;
    }
  } catch {
    // Fall back to structured CMS-1500 / OCR regex extraction
  }

  const out: Partial<Cms1500Claim> = { caseLabel: "Client-Parsed Medical Bill" };
  const policyMatch = raw.match(/(?:(?:BOX\s*1A\s+)?POLICY(?:\s*ID)?|BOX\s*1A)\s*[:#-]?\s*(\d{5,12})/i);
  const patientMatch = raw.match(
    /(?:(?:BOX\s*2\s+)?PATIENT(?:\s*ALIAS)?|ALIAS|BOX\s*2\s*[:#-])\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{2,31})/i
  );
  const icdMatch = raw.match(
    /(?:(?:BOX\s*21\s+)?ICD(?:\s*-?\s*10)?(?:\s*CODE)?|DIAG(?:NOSIS)?|BOX\s*21)\s*[:#-]?\s*([A-TV-Z1l|][0-9][0-9AB](?:\.[0-9A-TV-Z]{1,4})?)/i
  );
  const cptMatch = raw.match(
    /(?:(?:BOX\s*24D\s+)?CPT(?:\s*CODE)?|PROC(?:EDURE)?|BOX\s*24D)\s*[:#-]?\s*(\d{5})/i
  );
  const npiMatch = raw.match(
    /(?:(?:BOX\s*24J\s+)?NPI|BOX\s*24J)\s*[:#-]?\s*(\d{10})/i
  );
  const amtMatch = raw.match(
    /(?:(?:BOX\s*24F\s+)?(?:CHARGE|AMOUNT|TOTAL)|BOX\s*24F)\s*[:#\-$]*\s*(\d+(?:\.\d+)?)\s*(?:ETH)?/i
  );
  const dateMatch = raw.match(/(\d{4}-\d{2}-\d{2})/);
  const rxMatch = raw.match(/(?:RX|PRESCRIPTION)\s*[:#-]?\s*([^\n\r]+)/i);

  if (policyMatch) out.insuredPolicyId = policyMatch[1];
  if (patientMatch) out.patientAlias = patientMatch[1];
  if (icdMatch) out.icd10Code = icdMatch[1].replace(/^[1l|](?=\d)/, "I").toUpperCase();
  if (cptMatch) out.cptCode = cptMatch[1];
  if (npiMatch) out.renderingNpi = npiMatch[1];
  if (amtMatch) out.claimAmountEth = amtMatch[1];
  if (dateMatch) out.serviceDate = dateMatch[1];
  if (rxMatch) out.prescription = rxMatch[1].trim();
  return out;
}

/**
 * Generates a crisp synthetic CMS-1500 medical bill PNG Blob entirely in-browser
 * so judges can test live client-side Tesseract WASM OCR with one click.
 */
export async function generateSampleCms1500BillPng(): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 720;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 3;
  ctx.strokeRect(28, 28, 1144, 664);

  ctx.fillStyle = "#000000";
  ctx.font = 'bold 34px "Courier New", Courier, monospace';
  ctx.fillText("CMS-1500 SYNTHETIC HEALTH INSURANCE CLAIM", 56, 86);

  ctx.font = 'bold 30px "Courier New", Courier, monospace';
  const lines = [
    "POLICY: 2026001",
    "PATIENT: SYNTH-CASE-042",
    "ICD-10: I21.0",
    "DATE: 2026-11-22",
    "CPT: 99285",
    "AMOUNT: 0.01 ETH",
    "NPI: 1234567890",
    "RX: Aspirin 325mg + Ticagrelor 180mg",
  ];
  lines.forEach((line, idx) => {
    ctx.fillText(line, 56, 162 + idx * 58);
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to render sample bill PNG"));
    }, "image/png");
  });
}

export async function runLocalOcrOnBill(
  file: Blob,
  onProgress?: (status: string, pct: number) => void
): Promise<{ rawText: string; parsed: Partial<Cms1500Claim> }> {
  const { createWorker } = await import("tesseract.js");
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const worker = await createWorker("eng", 1, {
    workerPath: `${origin}/ocr/worker.min.js`,
    corePath: `${origin}/ocr`,
    langPath: `${origin}/ocr`,
    workerBlobURL: false,
    gzip: true,
    legacyCore: false,
    legacyLang: false,
    logger: (m: { status?: string; progress?: number }) => {
      if (onProgress && m.status) {
        onProgress(m.status, Math.round((m.progress ?? 0) * 100));
      }
    },
  });

  try {
    const result = await worker.recognize(file);
    const rawText = result.data.text || "";
    const parsed = parseClaimFromTextOrJson(rawText);
    return { rawText, parsed };
  } finally {
    await worker.terminate();
  }
}
