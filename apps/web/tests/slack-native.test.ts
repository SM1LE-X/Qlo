import { describe, expect, it } from "vitest";
import { openActionPayload, sealActionPayload } from "@/lib/slack/api";
import { proveAndSettleClaim, VISIT_PRESETS } from "@/lib/slack/serverEngine";
import {
  buildAppHomeView,
  buildAuditProofModal,
  buildHospitalClaimCard,
  buildInsurerDisbursementCard,
  buildPatientReceiptCard,
  buildSubmitBillModal,
} from "@/lib/slack/views";

describe("Slack-native encrypted action payloads", () => {
  const secret = "test-slack-signing-secret-0123456789";

  it("encrypts action state with AES-256-GCM so zero clinical codes appear on the wire", () => {
    const token = sealActionPayload(
      { recordId: 42, cptCode: 99285, icd10: "I21.0", amountEth: "0.0020" },
      secret
    );
    expect(token).not.toContain("99285");
    expect(token).not.toContain("I21.0");
    expect(token.length).toBeLessThan(1800);

    const decoded = openActionPayload<{ recordId: number; cptCode: number }>(token, secret);
    expect(decoded?.recordId).toBe(42);
    expect(decoded?.cptCode).toBe(99285);
  });

  it("rejects tampered or wrong-secret action tokens", () => {
    const token = sealActionPayload({ recordId: 7 }, secret);
    expect(openActionPayload(token, "wrong-secret")).toBeNull();
    expect(openActionPayload(`${token}x`, secret)).toBeNull();
  });
});

describe("Slack-native Block Kit views (Zero-PHI)", () => {
  it("renders App Home, Submit Modal, and channel cards with zero clinical PHI", () => {
    const summary = {
      escrowEth: "0.0160",
      settledCount: 2,
      policySpentEth: "0.0090",
      policySpentWei: 9_000_000_000_000_000n,
      networkLive: true,
      relayerEnabled: true,
    };

    const views = [
      buildAppHomeView({ role: "patient", summary }),
      buildAppHomeView({ role: "hospital", summary }),
      buildAppHomeView({ role: "insurer", summary }),
      buildSubmitBillModal("C12345"),
      buildPatientReceiptCard({
        recordLabel: "Record #12",
        providerName: "Metro Cardiac Center",
        categoryLabel: "Emergency Visit",
        amountEth: "0.0020",
        status: "active",
        revokeToken: "opaque",
      }),
      buildHospitalClaimCard({
        recordLabel: "Record #12",
        providerName: "Metro Cardiac Center",
        categoryLabel: "Emergency Visit",
        amountEth: "0.0020",
        status: "ready",
        settleToken: "opaque",
        inspectToken: "opaque",
      }),
      buildInsurerDisbursementCard({
        recordLabel: "Record #12",
        providerName: "Metro Cardiac Center",
        amountEth: "0.0020",
        inspectToken: "opaque",
      }),
      buildAuditProofModal({
        recordLabel: "Record #12",
        providerName: "Metro Cardiac Center",
        amountEth: "0.0020",
        recordCommitmentHex: "0x00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
        status: "Settled",
      }),
    ];

    const serialized = JSON.stringify(views);
    expect(serialized).not.toMatch(/I21\.0|99285|Aspirin|SYNTH-CASE/i);
    expect(serialized).toContain("0 Medical Bytes Found");
    expect(VISIT_PRESETS.length).toBeGreaterThanOrEqual(4);
  });
});

describe("Server-side Groth16 & Policy Engine", () => {
  it("blocks excluded CPT procedures fail-closed with 0 ETH released", async () => {
    const res = await proveAndSettleClaim({
      cptCode: 15777,
      amountEth: "0.0020",
      recordCommitmentHex:
        "0x00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
      onChainRecord: false,
    });
    expect(res.ok).toBe(false);
    expect(res.code).toBe("POLICY_EXCLUDED");
  });

  it("generates and locally verifies a real Groth16 BN254 proof on Node.js", async () => {
    const res = await proveAndSettleClaim({
      cptCode: 99285,
      amountEth: "0.0020",
      recordCommitmentHex:
        "0x002233445566778899aabbccddeeff00112233445566778899aabbccddeeff11",
      onChainRecord: false,
    });
    expect(res.ok).toBe(true);
    expect(res.nullifier).toBeTruthy();
    expect(res.proofElapsedMs).toBeGreaterThan(0);
  }, 30_000);
});
