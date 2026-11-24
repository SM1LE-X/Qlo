"use client";

import canonicalFixtures from "./canonicalFixtures.json";
import {
  buildPoseidonMerkleTree,
  computeHospitalLeaf,
  computeNullifier,
  computePolicyCommitment,
} from "./merkle";
import { parseEthToWei } from "./utils";
import type { Cms1500Claim } from "./intake";

export interface SnarkjsProof {
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
}

export interface SolidityProofPayload {
  pA: readonly [bigint, bigint];
  pB: readonly [readonly [bigint, bigint], readonly [bigint, bigint]];
  pC: readonly [bigint, bigint];
  pubSignals: readonly [
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint
  ];
  rawCalldataHex: string;
}

export interface ProverOutput {
  proof: SnarkjsProof;
  publicSignals: string[];
  solidity: SolidityProofPayload;
  localVerified: boolean;
  elapsedMs: number;
  circuitInput: Record<string, unknown>;
}

export type ProveStage =
  | "idle"
  | "building_witness"
  | "loading_artifacts"
  | "computing_witness"
  | "verifying_locally"
  | "done"
  | "failed";

export function formatSolidityProof(
  proof: SnarkjsProof,
  publicSignals: string[]
): SolidityProofPayload {
  const pA = [BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1])] as const;
  const pB = [
    [BigInt(proof.pi_b[0][1]), BigInt(proof.pi_b[0][0])],
    [BigInt(proof.pi_b[1][1]), BigInt(proof.pi_b[1][0])],
  ] as const;
  const pC = [BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1])] as const;
  const pubSignals = publicSignals.map((s) => BigInt(s)) as unknown as readonly [
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint
  ];

  const hex = (n: bigint) => n.toString(16).padStart(64, "0");
  const rawCalldataHex =
    "0x" +
    [
      pA[0],
      pA[1],
      pB[0][0],
      pB[0][1],
      pB[1][0],
      pB[1][1],
      pC[0],
      pC[1],
      ...pubSignals,
    ]
      .map(hex)
      .join("");

  return { pA, pB, pC, pubSignals, rawCalldataHex };
}

export async function buildCircuitInputFromClaim(params: {
  claim: Cms1500Claim;
  recordCommitment: bigint;
  hospitalAddress: string;
  priorPolicySpentWei: bigint;
  claimTimestampOverride?: bigint;
  /** Accredited hospital list (canonical + demo-accredited). Defaults to fixtures. */
  hospitals?: ReadonlyArray<{ address: string; licenseId: string }>;
  /** Active policy preimage (e.g. a policy created by a newly onboarded insurer). */
  policyOverride?: {
    policyId: string;
    patientCommit: string;
    policyExpiry: string;
    annualLimitWei: string;
    policySalt: string;
  };
}) {
  const { claim, recordCommitment, hospitalAddress, priorPolicySpentWei } = params;
  const hospitalList = params.hospitals ?? canonicalFixtures.hospitals;

  const hospLeaves = await Promise.all(
    hospitalList.map((h) => computeHospitalLeaf(h.address, h.licenseId))
  );
  const hospTree = await buildPoseidonMerkleTree(hospLeaves);

  const matchedIdx = hospitalList.findIndex(
    (h) => h.address.toLowerCase() === hospitalAddress.toLowerCase()
  );
  const hospIdx = matchedIdx >= 0 ? matchedIdx : 0;
  const hospProof = hospTree.getProof(hospIdx);

  const cptTree = await buildPoseidonMerkleTree(canonicalFixtures.coveredCpts);
  const cptNum = Number(claim.cptCode.trim());
  const cptIdx = canonicalFixtures.coveredCpts.indexOf(cptNum);
  const cptProof = cptTree.getProof(cptIdx >= 0 ? cptIdx : 0);

  const policy = claim.useExpiredPolicy
    ? canonicalFixtures.expiredPolicy
    : params.policyOverride ?? canonicalFixtures.activePolicy;

  const policyCommitment = await computePolicyCommitment({
    policyId: policy.policyId,
    patientCommit: policy.patientCommit,
    policyExpiry: policy.policyExpiry,
    annualLimit: policy.annualLimitWei,
    coveredCptRoot: cptTree.root,
    policySalt: policy.policySalt,
  });

  const nullifier = await computeNullifier({
    policySalt: policy.policySalt,
    policyId: policy.policyId,
    recordCommitment,
  });

  const claimAmountWei = parseEthToWei(claim.claimAmountEth || "0");
  const claimTs = params.claimTimestampOverride ?? BigInt(Math.floor(Date.now() / 1000));

  return {
    hospitalRoot: hospTree.root.toString(),
    policyCommitment: policyCommitment.toString(),
    nullifier: nullifier.toString(),
    claimAmount: claimAmountWei.toString(),
    claimTimestamp: claimTs.toString(),
    recordCommitment: recordCommitment.toString(),
    hospitalAddress: BigInt(hospitalAddress.toLowerCase()).toString(),
    priorPolicySpent: priorPolicySpentWei.toString(),
    hospitalLicenseId: claim.renderingNpi.trim(),
    hospitalPathElements: hospProof.pathElements,
    hospitalPathIndices: hospProof.pathIndices,
    policyId: policy.policyId,
    patientCommit: policy.patientCommit,
    policyExpiry: policy.policyExpiry,
    annualLimit: policy.annualLimitWei,
    coveredCptRoot: cptTree.root.toString(),
    policySalt: policy.policySalt,
    cptCode: claim.cptCode.trim(),
    cptPathElements: cptProof.pathElements,
    cptPathIndices: cptProof.pathIndices,
  };
}

export async function generateClaimProof(
  input: Record<string, unknown>,
  onStage?: (stage: ProveStage) => void
): Promise<ProverOutput> {
  onStage?.("loading_artifacts");

  if (typeof Worker !== "undefined") {
    try {
      const workerResult = await new Promise<Omit<ProverOutput, "solidity" | "circuitInput">>(
        (resolve, reject) => {
          const worker = new Worker(new URL("./prover.worker.ts", import.meta.url));
          const reqId = Math.random().toString(36).slice(2);

          worker.onmessage = (ev) => {
            const data = ev.data;
            if (data.id !== reqId) return;
            if (data.type === "stage") {
              onStage?.(data.stage as ProveStage);
            } else if (data.type === "result") {
              worker.terminate();
              resolve({
                proof: data.proof as SnarkjsProof,
                publicSignals: data.publicSignals as string[],
                localVerified: Boolean(data.localVerified),
                elapsedMs: Number(data.elapsedMs),
              });
            } else if (data.type === "error") {
              worker.terminate();
              reject(new Error(String(data.error)));
            }
          };

          worker.onerror = (err) => {
            worker.terminate();
            reject(new Error(err.message || "Worker crash"));
          };

          worker.postMessage({ id: reqId, input });
        }
      );

      onStage?.("done");
      return {
        ...workerResult,
        solidity: formatSolidityProof(workerResult.proof, workerResult.publicSignals),
        circuitInput: input,
      };
    } catch (workerErr) {
      // Fallback to direct async proving only if worker instantiation failed (never mask ZK constraint errors!)
      const msg = workerErr instanceof Error ? workerErr.message : String(workerErr);
      if (msg.includes("Assert Failed") || msg.includes("Error in template")) {
        onStage?.("failed");
        throw workerErr;
      }
    }
  }

  onStage?.("computing_witness");
  const snarkjs = await import("snarkjs");
  const t0 = performance.now();
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    "/zk/ClaimValidity.wasm",
    "/zk/ClaimValidity.zkey"
  );
  onStage?.("verifying_locally");
  const vkey = await (await fetch("/zk/verification_key.json")).json();
  const localVerified = await snarkjs.groth16.verify(vkey, publicSignals, proof);
  const elapsedMs = Math.round(performance.now() - t0);
  onStage?.("done");

  return {
    proof: proof as SnarkjsProof,
    publicSignals,
    solidity: formatSolidityProof(proof as SnarkjsProof, publicSignals),
    localVerified,
    elapsedMs,
    circuitInput: input,
  };
}
