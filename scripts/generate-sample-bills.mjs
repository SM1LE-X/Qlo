import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const outDir = path.join(rootDir, "apps", "web", "public", "samples");
const require = createRequire(path.join(rootDir, "apps", "web", "package.json"));
const { chromium } = require("playwright-core");

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const BILLS = [
  {
    id: "bill-cardiac-er-99285",
    invoiceNo: "INV-MCC-2026-0042",
    title: "Cardiac STEMI Emergency Stabilization",
    facility: "Metro Cardiac Center",
    facilityAddress: "55 Fruit Street, Boston, MA 02114",
    badge: "COVERED EMERGENCY BENEFIT",
    lineItems: [
      { code: "99285", description: "Emergency Department Visit — High Severity (STEMI Protocol)", qty: 1, feeEth: "0.0070" },
      { code: "93000", description: "12-Lead Electrocardiogram & Rhythm Telemetry Monitoring", qty: 1, feeEth: "0.0018" },
      { code: "PHARM", description: "Loading Antithrombotic Therapy (Aspirin 325mg + Ticagrelor 180mg)", qty: 1, feeEth: "0.0012" },
    ],
    claim: {
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
  },
  {
    id: "bill-cardiology-followup-99214",
    invoiceNo: "INV-MCC-2026-0058",
    title: "Post-MI 14-Day Cardiology Follow-Up",
    facility: "Metro Cardiac Center",
    facilityAddress: "55 Fruit Street, Boston, MA 02114",
    badge: "COVERED OUTPATIENT VISIT",
    lineItems: [
      { code: "99214", description: "Established Outpatient Cardiology Consultation (35 min)", qty: 1, feeEth: "0.0110" },
      { code: "80053", description: "Lipid & Comprehensive Metabolic Panel Surveillance", qty: 1, feeEth: "0.0025" },
      { code: "PHARM", description: "Secondary Prevention Titration (Atorvastatin 80mg + Metoprolol 50mg)", qty: 1, feeEth: "0.0015" },
    ],
    claim: {
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
  },
  {
    id: "bill-ecg-diagnostic-93000",
    invoiceNo: "INV-MCC-2026-0071",
    title: "12-Lead Diagnostic ECG & Cardiologist Report",
    facility: "Metro Cardiac Center",
    facilityAddress: "55 Fruit Street, Boston, MA 02114",
    badge: "COVERED DIAGNOSTIC CARDIOLOGY",
    lineItems: [
      { code: "93000", description: "12-Lead Electrocardiogram With Quantitative Interpretation", qty: 1, feeEth: "0.0032" },
      { code: "36415", description: "Routine Venipuncture Troponin Draw & Specimen Prep", qty: 1, feeEth: "0.0008" },
    ],
    claim: {
      caseLabel: "Diagnostic 12-Lead ECG & Troponin Screen",
      insuredPolicyId: "2026001",
      patientAlias: "SYNTH-CASE-042",
      icd10Code: "R07.9",
      serviceDate: "2026-11-22",
      cptCode: "93000",
      claimAmountEth: "0.004",
      renderingNpi: "1234567890",
      prescription: "Nitroglycerin 0.4mg SL PRN",
      clinicalNotes: "Precisely timed 12-lead ECG tracing with attending cardiologist sign-off.",
    },
  },
  {
    id: "bill-chest-xray-71046",
    invoiceNo: "INV-BGS-2026-0114",
    title: "Chest Radiograph 2-View Thoracic Imaging",
    facility: "Bay General Surgical",
    facilityAddress: "1001 Potrero Avenue, San Francisco, CA 94110",
    badge: "COVERED RADIOLOGY IMAGING",
    lineItems: [
      { code: "71046", description: "Radiologic Examination, Chest; 2 Views (PA & Lateral)", qty: 1, feeEth: "0.0038" },
      { code: "RAD-PRO", description: "Board-Certified Thoracic Radiologist Interpretation", qty: 1, feeEth: "0.0012" },
    ],
    claim: {
      caseLabel: "Thoracic 2-View Chest Radiograph",
      insuredPolicyId: "2026001",
      patientAlias: "SYNTH-CASE-042",
      icd10Code: "J18.9",
      serviceDate: "2026-11-22",
      cptCode: "71046",
      claimAmountEth: "0.005",
      renderingNpi: "1234567890",
      prescription: "Amoxicillin-Clavulanate 875mg",
      clinicalNotes: "PA and lateral thoracic radiograph evaluation for lower respiratory infiltrate.",
    },
  },
  {
    id: "bill-cosmetic-excluded-15777",
    invoiceNo: "INV-EAC-2026-0903",
    title: "Elective Cosmetic Biologic Implant (Excluded)",
    facility: "Elective Aesthetics Clinic",
    facilityAddress: "Synthetic Uncovered Benefit Fixture",
    badge: "EXCLUDED SCHEDULE — ZK REJECT TEST",
    lineItems: [
      { code: "15777", description: "Implantation of Biologic Implant (Elective Soft Tissue)", qty: 1, feeEth: "0.0088" },
      { code: "PHARM", description: "Post-Procedure Prophylaxis (Cephalexin 500mg)", qty: 1, feeEth: "0.0012" },
    ],
    claim: {
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
  },
];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildBillHtml(bill) {
  const rows = bill.lineItems
    .map(
      (item) => `
      <tr>
        <td class="mono">${escapeHtml(item.code)}</td>
        <td>${escapeHtml(item.description)}</td>
        <td class="num">${item.qty}</td>
        <td class="num mono">${escapeHtml(item.feeEth)} ETH</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 36px;
    width: 1240px;
    height: 860px;
    background: #ffffff;
    color: #090d14;
    font-family: "Segoe UI", Arial, sans-serif;
  }
  .sheet {
    border: 2px solid #0f172a;
    padding: 28px 34px;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid #0f172a;
    padding-bottom: 16px;
  }
  .facility {
    font-size: 28px;
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  .sub {
    font-size: 14px;
    color: #334155;
    margin-top: 4px;
  }
  .meta-right {
    text-align: right;
    font-size: 14px;
    line-height: 1.5;
  }
  .badge {
    display: inline-block;
    padding: 4px 10px;
    border: 1.5px solid #0f172a;
    font-weight: 700;
    font-size: 12px;
    letter-spacing: 0.06em;
    margin-bottom: 6px;
  }
  .ocr-box {
    border: 2.5px solid #0f172a;
    background: #ffffff;
    padding: 18px 22px;
    margin-top: 18px;
  }
  .ocr-title {
    font-family: "Courier New", Courier, monospace;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 0.04em;
    margin-bottom: 10px;
    border-bottom: 1.5px solid #cbd5e1;
    padding-bottom: 6px;
  }
  .ocr-lines {
    font-family: "Courier New", Courier, monospace;
    font-size: 24px;
    font-weight: 700;
    line-height: 1.48;
    color: #000000;
    white-space: pre;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 18px;
    font-size: 15px;
  }
  th {
    text-align: left;
    border-bottom: 2px solid #0f172a;
    padding: 8px 10px;
    font-size: 12px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  td {
    border-bottom: 1px solid #cbd5e1;
    padding: 9px 10px;
  }
  .num { text-align: right; }
  .mono { font-family: "Courier New", Courier, monospace; font-weight: 700; }
  .footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1.5px solid #0f172a;
    padding-top: 12px;
    font-size: 13px;
    color: #334155;
  }
  .due {
    font-size: 20px;
    font-weight: 800;
    color: #000000;
    font-family: "Courier New", Courier, monospace;
  }
</style>
</head>
<body>
  <div class="sheet">
    <div>
      <div class="top">
        <div>
          <div class="facility">${escapeHtml(bill.facility)}</div>
          <div class="sub">${escapeHtml(bill.facilityAddress)} · Synthetic Qlo Claim Fixture</div>
        </div>
        <div class="meta-right">
          <div class="badge">${escapeHtml(bill.badge)}</div>
          <div>STATEMENT REF: <strong>${escapeHtml(bill.invoiceNo)}</strong></div>
          <div>FORM STANDARD: <strong>CMS-1500 / X12-837P</strong></div>
        </div>
      </div>

      <div class="ocr-box">
        <div class="ocr-title">CMS-1500 MACHINE-READABLE CLAIM BLOCK</div>
        <div class="ocr-lines">POLICY: ${escapeHtml(bill.claim.insuredPolicyId)}
PATIENT: ${escapeHtml(bill.claim.patientAlias)}
ICD-10: ${escapeHtml(bill.claim.icd10Code)}
DATE: ${escapeHtml(bill.claim.serviceDate)}
CPT: ${escapeHtml(bill.claim.cptCode)}
AMOUNT: ${escapeHtml(bill.claim.claimAmountEth)} ETH
NPI: ${escapeHtml(bill.claim.renderingNpi)}
RX: ${escapeHtml(bill.claim.prescription)}</div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 110px;">Code</th>
            <th>Clinical Procedure / Encounter Summary</th>
            <th class="num" style="width: 70px;">Qty</th>
            <th class="num" style="width: 150px;">Line Fee</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>

    <div class="footer">
      <div>SYNTHETIC TEST DOCUMENT · ZERO REAL PATIENT HEALTH INFORMATION (PHI)</div>
      <div class="due">BALANCE DUE: ${escapeHtml(bill.claim.claimAmountEth)} ETH</div>
    </div>
  </div>
</body>
</html>`;
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({
    executablePath: fs.existsSync(EDGE_PATH) ? EDGE_PATH : undefined,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"],
  });

  try {
    const context = await browser.newContext({ viewport: { width: 1240, height: 860 } });
    const page = await context.newPage();

    for (const bill of BILLS) {
      const jsonPath = path.join(outDir, `${bill.id}.json`);
      const pngPath = path.join(outDir, `${bill.id}.png`);
      fs.writeFileSync(jsonPath, JSON.stringify(bill.claim, null, 2) + "\n", "utf8");

      await page.setContent(buildBillHtml(bill), { waitUntil: "load" });
      await page.screenshot({ path: pngPath, type: "png" });
      const size = fs.statSync(pngPath).size;
      console.log(`[samples] Generated ${bill.id}.png (${size} bytes) + ${bill.id}.json`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("[samples] FAILED:", err);
  process.exit(1);
});
