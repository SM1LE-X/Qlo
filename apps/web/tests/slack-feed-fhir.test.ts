import { describe, expect, it } from "vitest";
import { buildClaimResponse } from "@/lib/fhir";
import { assertZeroPhiPayload, type RelayChainMirror } from "@/lib/relayStore";
import { GENESIS_CHANNEL_FEED, buildFeed, cardsForLatestEvent } from "@/lib/slack/feed";

const COMMIT = "0x" + "ab".repeat(32);
const TX = "0x" + "cd".repeat(32);
const NULL = "0x" + "ef".repeat(32);
const HOSP = "0x" + "12".repeat(20);

const chain: RelayChainMirror = {
  hospitalPubKeys: {},
  insurerEscrowWei: "10000000000000000",
  policySpentWei: {},
  nullifierUsed: { [NULL]: true },
  nextRecordId: 2,
  records: [],
  grants: {},
  settledClaims: [
    {
      txHash: TX,
      nullifier: NULL,
      policyCommitment: "1",
      recordCommitmentHex: COMMIT,
      hospital: HOSP,
      amountWei: "10000000000000000",
      settledAt: 1700000000,
      rawCalldataHex: "0x",
      pubSignals: [],
    },
  ],
  auditLogs: [
    { id: "s1", kind: "settled", title: "Claim Settled (+0.0100 ETH)", detail: "x", timestamp: "t3", txHash: TX },
    { id: "g1", kind: "granted", title: "Access Granted (10m) - Record #1", detail: `Hospital ${HOSP}`, timestamp: "t2" },
    { id: "r1", kind: "registered", title: "Record #1 Registered", detail: `CIDv1 bafyx | 248-bit Commit ${COMMIT}`, timestamp: "t1" },
  ],
};

describe("buildFeed", () => {
  const feed = buildFeed(chain);

  it("emits patient, hospital and insurer cards", () => {
    expect(new Set(feed.map((f) => f.channel))).toEqual(new Set(["patient", "hospital", "insurer"]));
  });

  it("is Zero-PHI", () => {
    for (const item of feed) expect(assertZeroPhiPayload(item.message)).toBeNull();
    for (const item of GENESIS_CHANNEL_FEED) expect(assertZeroPhiPayload(item.message)).toBeNull();
  });

  it("cardsForLatestEvent returns only the newest event cards", () => {
    const cards = cardsForLatestEvent(chain);
    expect(cards.map((c) => c.role).sort()).toEqual(["hospital", "insurer"]);
  });
});

describe("buildClaimResponse", () => {
  const fhir = buildClaimResponse(chain.settledClaims[0]!);

  it("is a pseudonymous FHIR ClaimResponse", () => {
    expect(fhir.resourceType).toBe("ClaimResponse");
    expect(fhir.outcome).toBe("complete");
    expect(JSON.stringify(fhir)).toContain(COMMIT);
  });

  it("is Zero-PHI", () => {
    expect(assertZeroPhiPayload(fhir)).toBeNull();
  });
});
