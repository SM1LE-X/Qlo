import type { Cms1500Claim } from "@/lib/intake";
import type { LocalSettledClaim } from "@/lib/localState";
import { formatWeiToEth } from "@/lib/utils";

/**
 * Converts a local CMS-1500 claim into an HL7 FHIR R4 `Claim` resource (JSON).
 * Generated purely client-side inside authorized Provider/Patient workspaces.
 */
export function cms1500ToFhirClaim(
  claim: Cms1500Claim,
  hospitalName: string
): Record<string, unknown> {
  const cleanDate = claim.serviceDate || "2026-11-22";
  const amountNum = Number(claim.claimAmountEth || "0");

  return {
    resourceType: "Claim",
    id: `qlo-claim-${claim.insuredPolicyId}-${claim.cptCode}`,
    meta: {
      profile: ["http://hl7.org/fhir/us/carin-bb/StructureDefinition/C4BB-Claim-Professional"],
    },
    status: "active",
    type: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/claim-type",
          code: "professional",
          display: "Professional",
        },
      ],
    },
    use: "claim",
    patient: {
      display: claim.patientAlias,
    },
    billablePeriod: {
      start: cleanDate,
      end: cleanDate,
    },
    created: cleanDate,
    insurer: {
      display: "Qlo Health Plan (Payer ID QLO-84532)",
    },
    provider: {
      display: hospitalName,
      identifier: {
        system: "http://hl7.org/fhir/sid/us-npi",
        value: claim.renderingNpi,
      },
    },
    priority: {
      coding: [{ code: "normal" }],
    },
    insurance: [
      {
        sequence: 1,
        focal: true,
        coverage: {
          display: `Policy #${claim.insuredPolicyId}`,
        },
      },
    ],
    diagnosis: [
      {
        sequence: 1,
        diagnosisCodeableConcept: {
          coding: [
            {
              system: "http://hl7.org/fhir/sid/icd-10-cm",
              code: claim.icd10Code,
            },
          ],
        },
      },
    ],
    item: [
      {
        sequence: 1,
        productOrService: {
          coding: [
            {
              system: "http://www.ama-assn.org/go/cpt",
              code: claim.cptCode,
            },
          ],
          text: claim.clinicalNotes,
        },
        servicedDate: cleanDate,
        net: {
          value: Number.isFinite(amountNum) ? amountNum : 0,
          currency: "ETH",
        },
      },
    ],
    total: {
      value: Number.isFinite(amountNum) ? amountNum : 0,
      currency: "ETH",
    },
  };
}

/**
 * Generates an ANSI X12 837P (005010X222A1) Professional Claim EDI interchange
 * strictly inside the authorized Provider workstation before ZK proving.
 */
export function cms1500ToX12837P(
  claim: Cms1500Claim,
  hospitalName: string,
  hospitalAddress: string
): string {
  const dateCompact = (claim.serviceDate || "2026-11-22").replace(/-/g, "");
  const shortDate = dateCompact.slice(2, 8);
  const charge = claim.claimAmountEth || "0.01";
  const icdClean = claim.icd10Code.replace(/\./g, "");
  const cleanHospital = hospitalName.toUpperCase().replace(/[*~]/g, " ");
  const controlNum = "000000837";

  const segments = [
    `ISA*00*          *00*          *ZZ*${hospitalAddress.slice(0, 15).padEnd(15, " ")}*ZZ*QLOCLEAR       *${shortDate}*1030*^*00501*${controlNum}*0*T*:`,
    `GS*HC*${hospitalAddress.slice(0, 15)}*QLOCLEAR*${dateCompact}*1030*837*X*005010X222A1`,
    `ST*837*0001*005010X222A1`,
    `BHT*0019*00*QLO${claim.insuredPolicyId}*${dateCompact}*1030*CH`,
    `NM1*41*2*${cleanHospital}*****46*${claim.renderingNpi}`,
    `NM1*85*2*${cleanHospital}*****XX*${claim.renderingNpi}`,
    `NM1*IL*1*${claim.patientAlias}*SYNTH****MI*${claim.insuredPolicyId}`,
    `NM1*PR*2*QLO HEALTH PLAN*****PI*QLO84532`,
    `CLM*${claim.insuredPolicyId}-${claim.cptCode}*${charge}***11:B:1*Y*A*Y*Y`,
    `DTP*472*D8*${dateCompact}`,
    `HI*ABK:${icdClean}`,
    `LX*1`,
    `SV1*HC:${claim.cptCode}*${charge}*UN*1***1`,
    `NTE*ADD*RX:${claim.prescription.replace(/[*~]/g, " ")}`,
    `SE*15*0001`,
    `GE*1*837`,
    `IEA*1*${controlNum}`,
  ];

  return segments.join("~\n") + "~";
}

/**
 * Generates a Zero-PHI ANSI X12 835 (005010X221A1) Electronic Remittance Advice.
 * Uses only public on-chain commitments, deterministic nullifier traces, and payout amounts.
 */
export function generateX12835Era(
  settled: LocalSettledClaim,
  hospitalName: string
): string {
  const d = new Date((settled.settledAt || Math.floor(Date.now() / 1000)) * 1000);
  const yyyymmdd = d.toISOString().slice(0, 10).replace(/-/g, "");
  const yymmdd = yyyymmdd.slice(2, 8);
  const payoutEth = formatWeiToEth(settled.amountWei, 4);
  const cleanHospital = hospitalName.toUpperCase().replace(/[*~]/g, " ");
  const shortNullifier = settled.nullifier.slice(0, 18);
  const shortCommit = settled.recordCommitmentHex.slice(0, 14);
  const controlNum = "000000835";

  const segments = [
    `ISA*00*          *00*          *ZZ*QLO84532       *ZZ*${settled.hospital.slice(0, 15).padEnd(15, " ")}*${yymmdd}*1035*^*00501*${controlNum}*0*T*:`,
    `GS*HP*QLO84532*${settled.hospital.slice(0, 15)}*${yyyymmdd}*1035*835*X*005010X221A1`,
    `ST*835*0001*005010X221A1`,
    `BPR*I*${payoutEth}*C*ACH*CCP*01*845320000*DA*CLAIMSVAULT**01*000000000*DA*${settled.hospital}*${yyyymmdd}`,
    `TRN*1*${shortNullifier}*1QLOCLEAR`,
    `DTM*405*${yyyymmdd}`,
    `N1*PR*QLO HEALTH PLAN*XV*QLO84532`,
    `N1*PE*${cleanHospital}*XX*${settled.hospital}`,
    `CLP*${shortCommit}*1*${payoutEth}*${payoutEth}*0*12*${settled.txHash.slice(0, 18)}`,
    `AMT*AU*${payoutEth}`,
    `NTE*ZKP*0 PHI BYTES ON-CHAIN · GROTH16 BN254 VERIFIED`,
    `SE*11*0001`,
    `GE*1*835`,
    `IEA*1*${controlNum}`,
  ];

  return segments.join("~\n") + "~";
}
