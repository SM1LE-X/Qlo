import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as snarkjs from "snarkjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addressToField,
  buildPoseidonMerkleTree,
  computeHospitalLeaf,
  computeNullifier,
  computePolicyCommitment,
} from "../scripts/merkle.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const buildDir = path.resolve(__dirname, "../build");
const wasmPath = path.join(buildDir, "ClaimValidity_js", "ClaimValidity.wasm");
const zkeyPath = path.join(buildDir, "ClaimValidity.zkey");
const vkeyPath = path.join(buildDir, "verification_key.json");

describe("ClaimValidity Groth16 Circuit — Soundness & 11-Case Security Suite", () => {
  const hospital1 = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";
  const hospital2 = "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc";
  const attacker = "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65";
  const license1 = "1234567890";
  const coveredCpts = [99285, 99214, 27750, 93000, 71046, 80053, 36415, 99284];

  let vKey: unknown;
  let baseInput: Record<string, unknown>;
  let claim2Input: Record<string, unknown>;

  beforeAll(async () => {
    vKey = JSON.parse(fs.readFileSync(vkeyPath, "utf8"));

    const hospLeaves = await Promise.all([
      computeHospitalLeaf(hospital1, license1),
      computeHospitalLeaf(hospital2, "1987654321"),
    ]);
    const hospTree = await buildPoseidonMerkleTree(hospLeaves);
    const hospProof = hospTree.getProof(0);

    const cptTree = await buildPoseidonMerkleTree(coveredCpts);
    const cptProof0 = cptTree.getProof(0);
    const cptProof1 = cptTree.getProof(1);

    const policyId = "2026001";
    const patientCommit = "884422119900776655";
    const claimTimestamp = 1795300000n;
    const policyExpiry = claimTimestamp + 365n * 86400n;
    const annualLimit = 30000000000000000n; // 0.03 ETH
    const policySalt = "9182736455463728191029384756";

    const policyCommitment = await computePolicyCommitment({
      policyId,
      patientCommit,
      policyExpiry,
      annualLimit,
      coveredCptRoot: cptTree.root,
      policySalt,
    });

    const recordCommit1 = 0x123456789abcdef0123456789abcdef0123456789abcdef0123456789abcden;
    const nullifier1 = await computeNullifier({
      policySalt,
      policyId,
      recordCommitment: recordCommit1,
    });

    baseInput = {
      hospitalRoot: hospTree.root.toString(),
      policyCommitment: policyCommitment.toString(),
      nullifier: nullifier1.toString(),
      claimAmount: "10000000000000000", // 0.01 ETH
      claimTimestamp: claimTimestamp.toString(),
      recordCommitment: recordCommit1.toString(),
      hospitalAddress: addressToField(hospital1).toString(),
      priorPolicySpent: "0",
      hospitalLicenseId: license1,
      hospitalPathElements: hospProof.pathElements,
      hospitalPathIndices: hospProof.pathIndices,
      policyId,
      patientCommit,
      policyExpiry: policyExpiry.toString(),
      annualLimit: annualLimit.toString(),
      coveredCptRoot: cptTree.root.toString(),
      policySalt,
      cptCode: coveredCpts[0].toString(),
      cptPathElements: cptProof0.pathElements,
      cptPathIndices: cptProof0.pathIndices,
    };

    const recordCommit2 = 0x0fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543n;
    const nullifier2 = await computeNullifier({
      policySalt,
      policyId,
      recordCommitment: recordCommit2,
    });

    claim2Input = {
      ...baseInput,
      nullifier: nullifier2.toString(),
      claimAmount: "15000000000000000", // 0.015 ETH
      priorPolicySpent: "10000000000000000", // 0.01 ETH (total 0.025 <= 0.03 ETH)
      recordCommitment: recordCommit2.toString(),
      cptCode: coveredCpts[1].toString(),
      cptPathElements: cptProof1.pathElements,
      cptPathIndices: cptProof1.pathIndices,
    };
  });

  afterAll(async () => {
    const curve = (globalThis as { curve_bn128?: { terminate?: () => Promise<void> } }).curve_bn128;
    if (curve?.terminate) {
      await curve.terminate();
    }
  });

  it("1. Proves and verifies valid primary Claim #1 in < 5s with 8 public signals", async () => {
    const t0 = performance.now();
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      baseInput,
      wasmPath,
      zkeyPath
    );
    const elapsedMs = performance.now() - t0;

    expect(publicSignals).toHaveLength(8);
    expect(elapsedMs).toBeLessThan(5000);
    const verified = await snarkjs.groth16.verify(vKey, publicSignals, proof);
    expect(verified).toBe(true);
  });

  it("2. Proves cumulative Claim #2 (priorPolicySpent + claimAmount <= annualLimit)", async () => {
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      claim2Input,
      wasmPath,
      zkeyPath
    );
    const verified = await snarkjs.groth16.verify(vKey, publicSignals, proof);
    expect(verified).toBe(true);
  });

  it("3. Rejects unregistered hospital license ID", async () => {
    await expect(
      snarkjs.groth16.fullProve({ ...baseInput, hospitalLicenseId: "9999999999" }, wasmPath, zkeyPath)
    ).rejects.toThrow();
  });

  it("4. Rejects front-running attacker substituting hospitalAddress", async () => {
    await expect(
      snarkjs.groth16.fullProve(
        { ...baseInput, hospitalAddress: addressToField(attacker).toString() },
        wasmPath,
        zkeyPath
      )
    ).rejects.toThrow();
  });

  it("5. Rejects tampered policyCommitment", async () => {
    const tampered = (BigInt(baseInput.policyCommitment as string) + 1n).toString();
    await expect(
      snarkjs.groth16.fullProve({ ...baseInput, policyCommitment: tampered }, wasmPath, zkeyPath)
    ).rejects.toThrow();
  });

  it("6. Rejects expired policy (claimTimestamp >= policyExpiry)", async () => {
    const expiredTs = (BigInt(baseInput.policyExpiry as string) + 10n).toString();
    await expect(
      snarkjs.groth16.fullProve({ ...baseInput, claimTimestamp: expiredTs }, wasmPath, zkeyPath)
    ).rejects.toThrow();
  });

  it("7. Rejects uncovered CPT procedure code (15777)", async () => {
    await expect(
      snarkjs.groth16.fullProve({ ...baseInput, cptCode: "15777" }, wasmPath, zkeyPath)
    ).rejects.toThrow();
  });

  it("8. Rejects claim exceeding cumulative annual policy cap", async () => {
    await expect(
      snarkjs.groth16.fullProve(
        {
          ...claim2Input,
          claimAmount: "25000000000000000", // 0.01 + 0.025 = 0.035 > 0.03 ETH cap
        },
        wasmPath,
        zkeyPath
      )
    ).rejects.toThrow();
  });

  it("9. Rejects zero claimAmount", async () => {
    await expect(
      snarkjs.groth16.fullProve({ ...baseInput, claimAmount: "0" }, wasmPath, zkeyPath)
    ).rejects.toThrow();
  });

  it("10. Rejects tampered deterministic nullifier", async () => {
    const badNullifier = (BigInt(baseInput.nullifier as string) + 1n).toString();
    await expect(
      snarkjs.groth16.fullProve({ ...baseInput, nullifier: badNullifier }, wasmPath, zkeyPath)
    ).rejects.toThrow();
  });

  it("11. Rejects tampered recordCommitment", async () => {
    const badRecord = (BigInt(baseInput.recordCommitment as string) + 1n).toString();
    await expect(
      snarkjs.groth16.fullProve({ ...baseInput, recordCommitment: badRecord }, wasmPath, zkeyPath)
    ).rejects.toThrow();
  });
});
