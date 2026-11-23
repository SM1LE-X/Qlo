import { describe, expect, it } from "vitest";
import {
  cms1500ToFhirClaim,
  cms1500ToX12837P,
  generateX12835Era,
} from "@/lib/healthcareStandards";
import {
  SYNTHETIC_CMS1500_PRESETS,
  validateCms1500Completeness,
} from "@/lib/intake";
import { formatWeiToEth, parseEthToWei } from "@/lib/utils";

describe("Healthcare Standards, CMS-1500 Intake & Wei Formatting", () => {
  const validClaim = SYNTHETIC_CMS1500_PRESETS[0];

  it("maps CMS-1500 claim into HL7 FHIR R4 Claim resource", () => {
    const fhir = cms1500ToFhirClaim(validClaim, "Metro Cardiac Center") as {
      resourceType: string;
      status: string;
      diagnosis: unknown[];
      item: unknown[];
    };

    expect(fhir.resourceType).toBe("Claim");
    expect(fhir.status).toBe("active");
    expect(fhir.diagnosis).toHaveLength(1);
    expect(fhir.item).toHaveLength(1);
  });

  it("generates ANSI X12 837P (005010X222A1) with required envelope segments", () => {
    const edi = cms1500ToX12837P(
      validClaim,
      "Metro Cardiac Center",
      "0x90F79bf6EB2c4f870365E785982E1f101E93b906"
    );

    expect(edi).toContain("005010X222A1");
    expect(edi).toContain("ST*837*");
    expect(edi).toContain("SE*");
    expect(edi).toContain("GE*");
    expect(edi).toContain("IEA*");
  });

  it("generates Zero-PHI ANSI X12 835 ERA (005010X221A1) without leaking clinical data", () => {
    const era = generateX12835Era(
      {
        txHash: "0x" + "cd".repeat(32),
        nullifier: "12345678901234567890",
        policyCommitment: "987654321",
        recordCommitmentHex: "0x" + "ab".repeat(32),
        hospital: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
        amountWei: "10000000000000000",
        settledAt: 1795300000,
        rawCalldataHex: "0x",
        pubSignals: [],
      },
      "Metro Cardiac Center"
    );

    expect(era).toContain("005010X221A1");
    expect(era).toContain("ST*835*");
    expect(era).toContain("0.0100");
    expect(era).not.toContain("I21.0");
    expect(era).not.toContain("99285");
    expect(era).not.toContain("Aspirin");
    expect(era).not.toContain("Ticagrelor");
  });

  it("validates CMS-1500 completeness and ETH <-> wei conversions accurately", () => {
    const ok = validateCms1500Completeness(validClaim);
    expect(ok.valid).toBe(true);
    expect(ok.score).toBe(7);

    const bad = validateCms1500Completeness({
      ...validClaim,
      icd10Code: "INVALID",
      claimAmountEth: "0",
    });
    expect(bad.valid).toBe(false);
    expect(bad.score).toBe(5);

    expect(parseEthToWei("0.025")).toBe(25_000_000_000_000_000n);
    expect(formatWeiToEth(25_000_000_000_000_000n, 4)).toBe("0.0250");
  });
});
