import { describe, expect, it } from "vitest";
import { assertZeroPhiPayload } from "@/lib/relayStore";
import {
  accessCard,
  digestCard,
  intakeCard,
  proofReadyCard,
  rejectCard,
  settledCard,
} from "@/lib/slack/blocks";
import { parseCommand, runCommand, weiToEth } from "@/lib/slack/commands";
import { signSlackBody, verifySlackSignature } from "@/lib/slack/verifySignature";

const SECRET = "test-signing-secret";
const BODY = "command=%2Fqlo&text=status";

describe("verifySlackSignature", () => {
  const ts = "1700000000";
  const sig = signSlackBody(SECRET, ts, BODY);

  it("accepts a valid signature inside the replay window", () => {
    expect(
      verifySlackSignature({ signingSecret: SECRET, timestamp: ts, signature: sig, rawBody: BODY, nowSec: 1700000100 })
    ).toBe(true);
  });

  it("rejects a tampered body", () => {
    expect(
      verifySlackSignature({ signingSecret: SECRET, timestamp: ts, signature: sig, rawBody: BODY + "x", nowSec: 1700000100 })
    ).toBe(false);
  });

  it("rejects a stale timestamp", () => {
    expect(
      verifySlackSignature({ signingSecret: SECRET, timestamp: ts, signature: sig, rawBody: BODY, nowSec: 1700001000 })
    ).toBe(false);
  });

  it("fails closed on missing inputs", () => {
    expect(
      verifySlackSignature({ signingSecret: "", timestamp: ts, signature: sig, rawBody: BODY, nowSec: 1700000100 })
    ).toBe(false);
    expect(
      verifySlackSignature({ signingSecret: SECRET, timestamp: null, signature: sig, rawBody: BODY })
    ).toBe(false);
  });
});

describe("block builders are Zero-PHI", () => {
  const cards = [
    intakeCard({ commitmentHex: "0x" + "ab".repeat(32), categoryLabel: "Emergency visit", amountEth: "0.0100" }),
    proofReadyCard({ claimLabel: "Claim 1", amountEth: "0.0100", hospitalAddress: "0x" + "12".repeat(20), settleUrl: "https://x/h", inspectUrl: "https://x/i" }),
    settledCard({ txHash: "0x" + "cd".repeat(32), amountEth: "0.0100", nullifier: "0x" + "ef".repeat(32), explorerUrl: "https://sepolia.etherscan.io/tx/0x1" }),
    rejectCard({ reason: "Procedure category excluded by policy", code: "POLICY_EXCLUDED" }),
    accessCard({ recordLabel: "Record 1", hospitalAddress: "0x" + "12".repeat(20), expiresAtIso: "2026-12-01T00:00:00Z", revokeUrl: "https://x/p" }),
    digestCard({ ready: 3, rejected: 1, pendingEth: "0.0300" }),
  ];

  it.each(cards.map((c, i) => [i, c] as const))("card %i passes assertZeroPhiPayload", (_i, card) => {
    expect(assertZeroPhiPayload(card)).toBeNull();
  });
});

describe("commands", () => {
  it("parses known and unknown commands", () => {
    expect(parseCommand("status").name).toBe("status");
    expect(parseCommand("/qlo status").name).toBe("status");
    expect(parseCommand("/qlo audit 0xabcdef12").arg).toBe("0xabcdef12");
    expect(parseCommand("audit 0xabcdef12").arg).toBe("0xabcdef12");
    expect(parseCommand("drop tables").name).toBe("unknown");
  });

  it("formats wei as ETH", () => {
    expect(weiToEth("10000000000000000")).toBe("0.0100");
    expect(weiToEth("garbage")).toBe("0.0000");
  });

  it("status reports escrow", () => {
    const chain = {
      hospitalPubKeys: {},
      insurerEscrowWei: "20000000000000000",
      policySpentWei: {},
      nullifierUsed: {},
      nextRecordId: 1,
      records: [],
      grants: {},
      auditLogs: [],
      settledClaims: [],
    };
    expect(runCommand("status", chain).text).toContain("0.0200 ETH");
  });
});
