import canonicalFixtures from "@/lib/canonicalFixtures.json";

export interface ClinicalCptInfo {
  code: number;
  title: string;
  category: "Emergency" | "Outpatient" | "Orthopedic" | "Cardiology" | "Radiology" | "Pathology";
  copayTier: string;
  typicalTurnaround: string;
  summary: string;
}

export interface AccreditedProviderInfo {
  address: string;
  licenseId: string;
  name: string;
  specialty: string;
  city: string;
  npiVerified: boolean;
}

/**
 * Plain-English clinical benefit metadata mapped directly to the 8 covered CPT
 * codes pinned in `canonicalFixtures.coveredCptRoot`.
 */
export const CLINICAL_CPT_CATALOG: Record<number, ClinicalCptInfo> = {
  99285: {
    code: 99285,
    title: "Emergency Dept Visit — High Severity",
    category: "Emergency",
    copayTier: "Tier 1 · Covered up to Annual Cap",
    typicalTurnaround: "< 1.5s ZK Settlement",
    summary: "Acute cardiac, trauma, or life-threatening emergency evaluation and critical management.",
  },
  99284: {
    code: 99284,
    title: "Emergency Dept Visit — Moderate-High",
    category: "Emergency",
    copayTier: "Tier 1 · Covered up to Annual Cap",
    typicalTurnaround: "< 1.5s ZK Settlement",
    summary: "Urgent diagnostic workup and stabilization requiring urgent physician decision-making.",
  },
  99214: {
    code: 99214,
    title: "Established Outpatient Consultation",
    category: "Outpatient",
    copayTier: "Tier 1 · Covered up to Annual Cap",
    typicalTurnaround: "< 1.2s ZK Settlement",
    summary: "Structured follow-up clinic visit (30–39 min) for chronic or multi-system care.",
  },
  27750: {
    code: 27750,
    title: "Closed Tibial Shaft Fracture Care",
    category: "Orthopedic",
    copayTier: "Tier 2 · Surgical Benefit",
    typicalTurnaround: "< 1.5s ZK Settlement",
    summary: "Non-operative orthopedic stabilization, reduction, and casting for lower-leg fracture.",
  },
  93000: {
    code: 93000,
    title: "12-Lead Electrocardiogram (ECG) + Report",
    category: "Cardiology",
    copayTier: "Diagnostic · Covered",
    typicalTurnaround: "< 1.0s ZK Settlement",
    summary: "Full cardiac rhythm tracing, waveform capture, and cardiologist interpretation.",
  },
  71046: {
    code: 71046,
    title: "Chest Radiograph — 2 Views",
    category: "Radiology",
    copayTier: "Diagnostic · Covered",
    typicalTurnaround: "< 1.0s ZK Settlement",
    summary: "Standard frontal and lateral thoracic X-ray imaging with radiologist sign-off.",
  },
  80053: {
    code: 80053,
    title: "Comprehensive Metabolic Panel (14 Tests)",
    category: "Pathology",
    copayTier: "Preventive / Lab · Covered",
    typicalTurnaround: "< 1.0s ZK Settlement",
    summary: "Electrolytes, hepatic enzymes, renal function, and serum glucose assay.",
  },
  36415: {
    code: 36415,
    title: "Routine Venipuncture Specimen Draw",
    category: "Pathology",
    copayTier: "Preventive / Lab · Covered",
    typicalTurnaround: "< 1.0s ZK Settlement",
    summary: "Clinical phlebotomy specimen collection paired with diagnostic laboratory panels.",
  },
};

export const COVERED_CLINICAL_SCHEDULE: ClinicalCptInfo[] =
  canonicalFixtures.coveredCpts.map((code) => {
    const known = CLINICAL_CPT_CATALOG[code];
    if (known) return known;
    return {
      code,
      title: `Covered Procedure CPT ${code}`,
      category: "Outpatient",
      copayTier: "Covered Benefit",
      typicalTurnaround: "< 1.5s ZK Settlement",
      summary: "Approved under the active Poseidon benefit Merkle schedule.",
    };
  });

const PROVIDER_METADATA_BY_ADDR: Record<
  string,
  { specialty: string; city: string }
> = {
  [canonicalFixtures.accounts.hospital1.toLowerCase()]: {
    specialty: "Level I Cardiac & Emergency",
    city: "Boston, MA",
  },
  [canonicalFixtures.accounts.hospital2.toLowerCase()]: {
    specialty: "Orthopedic & General Surgery",
    city: "San Francisco, CA",
  },
};

/**
 * Accredited on-chain provider directory hydrated from canonical Poseidon leaves.
 */
export const ACCREDITED_PROVIDERS: AccreditedProviderInfo[] =
  canonicalFixtures.hospitals.map((h) => {
    const extra = PROVIDER_METADATA_BY_ADDR[h.address.toLowerCase()];
    return {
      address: h.address,
      licenseId: h.licenseId,
      name: h.name,
      specialty: extra?.specialty ?? "Accredited Network Facility",
      city: extra?.city ?? "Ethereum Sepolia Registry",
      npiVerified: true,
    };
  });

export function getCptLabel(code: number | string): string {
  const num = Number(code);
  return CLINICAL_CPT_CATALOG[num]?.title ?? `Procedure CPT ${code}`;
}

export function getProviderDisplayName(address: string): string {
  const found = ACCREDITED_PROVIDERS.find(
    (p) => p.address.toLowerCase() === address.toLowerCase()
  );
  return found ? found.name : `${address.slice(0, 8)}...${address.slice(-6)}`;
}
