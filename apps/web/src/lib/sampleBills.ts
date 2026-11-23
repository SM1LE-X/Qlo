import type { Cms1500Claim } from "./intake";

export interface SampleBillLineItem {
  code: string;
  description: string;
  qty: number;
  feeEth: string;
}

export interface SampleMedicalBill {
  id: string;
  invoiceNo: string;
  title: string;
  facility: string;
  facilityCity: string;
  badge: string;
  expectedOutcome: "settle" | "reject";
  pngPath: string;
  jsonPath: string;
  lineItems: SampleBillLineItem[];
  claim: Cms1500Claim;
}

/**
 * Five realistic synthetic CMS-1500 hospital invoices aligned to canonicalFixtures.json.
 * Zero real PHI: all patient aliases, encounter notes, and NPIs are synthetic test fixtures.
 */
export const SAMPLE_MEDICAL_BILLS: SampleMedicalBill[] = [
  {
    id: "bill-cardiac-er-99285",
    invoiceNo: "INV-MCC-2026-0042",
    title: "Cardiac STEMI Emergency Stabilization",
    facility: "Metro Cardiac Center",
    facilityCity: "Boston, MA",
    badge: "Covered · Claim #1",
    expectedOutcome: "settle",
    pngPath: "/samples/bill-cardiac-er-99285.png",
    jsonPath: "/samples/bill-cardiac-er-99285.json",
    lineItems: [
      {
        code: "99285",
        description: "Emergency Department Visit — High Severity (STEMI Protocol)",
        qty: 1,
        feeEth: "0.0070",
      },
      {
        code: "93000",
        description: "12-Lead Electrocardiogram & Rhythm Telemetry Monitoring",
        qty: 1,
        feeEth: "0.0018",
      },
      {
        code: "PHARM",
        description: "Loading Antithrombotic Therapy (Aspirin 325mg + Ticagrelor 180mg)",
        qty: 1,
        feeEth: "0.0012",
      },
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
      clinicalNotes:
        "Acute anterior STEMI emergency stabilization; troponin elevated; inpatient cath transfer.",
    },
  },
  {
    id: "bill-cardiology-followup-99214",
    invoiceNo: "INV-MCC-2026-0058",
    title: "Post-MI 14-Day Cardiology Follow-Up",
    facility: "Metro Cardiac Center",
    facilityCity: "Boston, MA",
    badge: "Covered · Claim #2",
    expectedOutcome: "settle",
    pngPath: "/samples/bill-cardiology-followup-99214.png",
    jsonPath: "/samples/bill-cardiology-followup-99214.json",
    lineItems: [
      {
        code: "99214",
        description: "Established Outpatient Cardiology Consultation (35 min)",
        qty: 1,
        feeEth: "0.0110",
      },
      {
        code: "80053",
        description: "Lipid & Comprehensive Metabolic Panel Surveillance",
        qty: 1,
        feeEth: "0.0025",
      },
      {
        code: "PHARM",
        description: "Secondary Prevention Titration (Atorvastatin 80mg + Metoprolol 50mg)",
        qty: 1,
        feeEth: "0.0015",
      },
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
      clinicalNotes:
        "Post-MI 14-day outpatient cardiology evaluation and medication titration.",
    },
  },
  {
    id: "bill-ecg-diagnostic-93000",
    invoiceNo: "INV-MCC-2026-0071",
    title: "12-Lead Diagnostic ECG & Cardiologist Report",
    facility: "Metro Cardiac Center",
    facilityCity: "Boston, MA",
    badge: "Covered · Diagnostic",
    expectedOutcome: "settle",
    pngPath: "/samples/bill-ecg-diagnostic-93000.png",
    jsonPath: "/samples/bill-ecg-diagnostic-93000.json",
    lineItems: [
      {
        code: "93000",
        description: "12-Lead Electrocardiogram With Quantitative Interpretation",
        qty: 1,
        feeEth: "0.0032",
      },
      {
        code: "36415",
        description: "Routine Venipuncture Troponin Draw & Specimen Prep",
        qty: 1,
        feeEth: "0.0008",
      },
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
      clinicalNotes:
        "Precisely timed 12-lead ECG tracing with attending cardiologist sign-off.",
    },
  },
  {
    id: "bill-chest-xray-71046",
    invoiceNo: "INV-BGS-2026-0114",
    title: "Chest Radiograph 2-View Thoracic Imaging",
    facility: "Bay General Surgical",
    facilityCity: "San Francisco, CA",
    badge: "Covered · Radiology",
    expectedOutcome: "settle",
    pngPath: "/samples/bill-chest-xray-71046.png",
    jsonPath: "/samples/bill-chest-xray-71046.json",
    lineItems: [
      {
        code: "71046",
        description: "Radiologic Examination, Chest; 2 Views (PA & Lateral)",
        qty: 1,
        feeEth: "0.0038",
      },
      {
        code: "RAD-PRO",
        description: "Board-Certified Thoracic Radiologist Interpretation",
        qty: 1,
        feeEth: "0.0012",
      },
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
      clinicalNotes:
        "PA and lateral thoracic radiograph evaluation for lower respiratory infiltrate.",
    },
  },
  {
    id: "bill-cosmetic-excluded-15777",
    invoiceNo: "INV-EAC-2026-0903",
    title: "Uncovered Cosmetic Biologic Implant",
    facility: "Elective Aesthetics Clinic",
    facilityCity: "Synthetic Test Exclusion",
    badge: "Uncovered · ZK Reject Test",
    expectedOutcome: "reject",
    pngPath: "/samples/bill-cosmetic-excluded-15777.png",
    jsonPath: "/samples/bill-cosmetic-excluded-15777.json",
    lineItems: [
      {
        code: "15777",
        description: "Implantation of Biologic Implant (Elective Soft Tissue)",
        qty: 1,
        feeEth: "0.0088",
      },
      {
        code: "PHARM",
        description: "Post-Procedure Prophylaxis (Cephalexin 500mg)",
        qty: 1,
        feeEth: "0.0012",
      },
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
      clinicalNotes:
        "Elective cosmetic biologic implant excluded under covered CPT policy schedule.",
    },
  },
];
