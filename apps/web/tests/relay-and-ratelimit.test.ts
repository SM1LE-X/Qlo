import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  DELETE as deleteRelayState,
  POST as postRelayState,
} from "@/app/api/relay/state/route";
import { DELETE as deleteRelayVault } from "@/app/api/relay/vault/route";
import { IS_CHAIN_DEPLOYED } from "@/lib/contracts";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  applyRelayAction,
  assertZeroPhiPayload,
  resetRelayStore,
  upsertVaultRecord,
} from "@/lib/relayStore";

function mockRequestWithIp(ip: string): NextRequest {
  return {
    headers: new Headers({ "x-forwarded-for": ip }),
  } as unknown as NextRequest;
}

function buildValidCiphertextFixture() {
  const envelope = {
    version: 1 as const,
    alg: "AES-256-GCM" as const,
    ivBase64: Buffer.alloc(12, 7).toString("base64"),
    ciphertextBase64: Buffer.alloc(32, 9).toString("base64"),
  };
  const digestHex = crypto
    .createHash("sha256")
    .update(Buffer.from(JSON.stringify(envelope), "utf8"))
    .digest("hex");
  const commitHex = (
    "0x" + (BigInt("0x" + digestHex) >> 8n).toString(16).padStart(64, "0")
  ) as `0x${string}`;

  return {
    cid: "bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku",
    recordCommitmentHex: commitHex,
    envelope,
  };
}

describe("Zero-PHI Relay Store & Sliding-Window Rate Limiter", () => {
  beforeEach(() => {
    resetRelayStore();
  });

  afterAll(() => {
    resetRelayStore();
  });

  it("enforces per-IP sliding-window rate limits cleanly", () => {
    const reqA = mockRequestWithIp("198.51.100.10");
    const reqB = mockRequestWithIp("198.51.100.11");

    const r1 = checkRateLimit(reqA, "unit-bucket", 2, 60_000);
    const r2 = checkRateLimit(reqA, "unit-bucket", 2, 60_000);
    const r3 = checkRateLimit(reqA, "unit-bucket", 2, 60_000);
    const rOtherIp = checkRateLimit(reqB, "unit-bucket", 2, 60_000);

    expect(r1).toMatchObject({ allowed: true, remaining: 1 });
    expect(r2).toMatchObject({ allowed: true, remaining: 0 });
    expect(r3.allowed).toBe(false);
    expect(r3.retryAfterSec).toBeGreaterThanOrEqual(1);
    expect(rOtherIp).toMatchObject({ allowed: true, remaining: 1 });
  });

  it("rejects forbidden PHI keys, canaries, ICD-10 patterns, and SSNs while permitting ciphertext & hashes", () => {
    expect(assertZeroPhiPayload({ icd10Code: "I21.0" })).toContain("Forbidden plaintext PHI key");
    expect(assertZeroPhiPayload({ summaryHint: "Cardiac claim" })).toContain("Forbidden plaintext PHI key");
    expect(assertZeroPhiPayload({ memo: "Patient took Aspirin 325mg" })).toContain("Forbidden clinical token");
    expect(assertZeroPhiPayload({ note: "Patient diagnosed with E11.9" })).toContain("ICD-10");
    expect(assertZeroPhiPayload({ note: "Member 123-45-6789" })).toContain("identifier pattern");

    const clean = buildValidCiphertextFixture();
    expect(
      assertZeroPhiPayload({
        ...clean,
        createdAt: "2026-11-23T12:00:00.000Z",
        patientAddress: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        rawCalldataHex: "0x" + "ab".repeat(64),
      })
    ).toBeNull();
  });

  it("verifies ciphertext SHA-256 248-bit commitments and rejects forged or malformed envelopes", () => {
    const clean = buildValidCiphertextFixture();
    const saved = upsertVaultRecord(clean);
    expect(saved.recordCommitmentHex).toBe(clean.recordCommitmentHex.toLowerCase());

    expect(() =>
      upsertVaultRecord({
        ...clean,
        recordCommitmentHex: ("0x" + "11".repeat(32)) as `0x${string}`,
      })
    ).toThrow(/recordCommitmentHex/);

    expect(() =>
      upsertVaultRecord({
        ...clean,
        envelope: {
          ...clean.envelope,
          ivBase64: Buffer.alloc(11, 1).toString("base64"),
        },
      })
    ).toThrow(/IV or ciphertext/);

    expect(() =>
      upsertVaultRecord({
        ...clean,
        envelope: {
          ...clean.envelope,
          ciphertextBase64: "A".repeat(96_001),
        },
      })
    ).toThrow(/Invalid AES-256-GCM/);
  });

  it("enforces register -> grant -> settle -> replay block -> revoke block invariants", () => {
    const clean = buildValidCiphertextFixture();
    upsertVaultRecord(clean);

    const hosp = "0x90f79bf6eb2c4f870365e785982e1f101e93b906";
    const pubKeyHex = "0x04" + "aa".repeat(64);
    const wrappedDekHex = "0x" + "bb".repeat(125);
    const expiresAt = Math.floor(Date.now() / 1000) + 600;

    applyRelayAction({
      action: "publishPubKey",
      hospitalAddress: hosp,
      publicKeyHex: pubKeyHex,
    });
    const regState = applyRelayAction({
      action: "registerRecord",
      recordCommitmentHex: clean.recordCommitmentHex,
      cid: clean.cid,
    });
    expect(regState.records).toHaveLength(1);

    applyRelayAction({
      action: "grant",
      recordId: "1",
      hospitalAddress: hosp,
      expiresAt,
      grantMinutes: 10,
      encryptedDekHex: wrappedDekHex,
      recordCommitmentHex: clean.recordCommitmentHex,
      hospitalPubKeyHex: pubKeyHex,
    });

    const settled = applyRelayAction({
      action: "settle",
      recordCommitmentHex: clean.recordCommitmentHex,
      hospitalAddress: hosp,
      policyCommitment: "123456789",
      nullifier: "999999999",
      amountWei: "10000000000000000",
      rawCalldataHex: "0x1234",
      pubSignals: ["1", "2", "999999999", "10000000000000000", "3", "4", "5", "0"],
      txHash: "0x" + "cc".repeat(32),
    });
    expect(settled.settledClaims).toHaveLength(1);

    expect(() =>
      applyRelayAction({
        action: "settle",
        recordCommitmentHex: clean.recordCommitmentHex,
        hospitalAddress: hosp,
        policyCommitment: "123456789",
        nullifier: "999999999",
        amountWei: "10000000000000000",
        rawCalldataHex: "0x1234",
        pubSignals: [],
        txHash: "0x" + "dd".repeat(32),
      })
    ).toThrow("ClaimsVault.NullifierAlreadyUsed()");

    applyRelayAction({
      action: "revoke",
      recordId: "1",
      hospitalAddress: hosp,
    });

    expect(() =>
      applyRelayAction({
        action: "settle",
        recordCommitmentHex: clean.recordCommitmentHex,
        hospitalAddress: hosp,
        policyCommitment: "123456789",
        nullifier: "888888888",
        amountWei: "10000000000000000",
        rawCalldataHex: "0x1234",
        pubSignals: [],
        txHash: "0x" + "ee".repeat(32),
      })
    ).toThrow("ClaimsVault.PatientAccessNotActive()");
  });

  it("blocks unauthenticated destructive relay resets when live chain deployment is active", async () => {
    expect(IS_CHAIN_DEPLOYED).toBe(true);

    const delStateReq = new NextRequest("http://localhost:3000/api/relay/state", {
      method: "DELETE",
      headers: { "x-forwarded-for": "198.51.100.77" },
    });
    const delStateRes = await deleteRelayState(delStateReq);
    expect(delStateRes.status).toBe(403);
    expect(await delStateRes.json()).toMatchObject({
      error: "RELAY_RESET_DISABLED_IN_LIVE_MODE",
    });

    const postResetReq = new NextRequest("http://localhost:3000/api/relay/state", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "198.51.100.78",
      },
      body: JSON.stringify({ action: "reset" }),
    });
    const postResetRes = await postRelayState(postResetReq);
    expect(postResetRes.status).toBe(403);
    expect(await postResetRes.json()).toMatchObject({
      error: "RELAY_RESET_DISABLED_IN_LIVE_MODE",
    });

    const delVaultResetReq = new NextRequest(
      "http://localhost:3000/api/relay/vault?reset=1",
      {
        method: "DELETE",
        headers: { "x-forwarded-for": "198.51.100.79" },
      }
    );
    const delVaultResetRes = await deleteRelayVault(delVaultResetReq);
    expect(delVaultResetRes.status).toBe(403);
    expect(await delVaultResetRes.json()).toMatchObject({
      error: "RELAY_RESET_DISABLED_IN_LIVE_MODE",
    });
  });
});
