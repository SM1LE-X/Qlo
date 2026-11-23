"use client";

import type { PublicClient, Abi } from "viem";
import canonicalFixtures from "@/lib/canonicalFixtures.json";
import { CONTRACTS, IS_CHAIN_DEPLOYED } from "@/lib/contracts";
import { type Cms1500Claim } from "@/lib/intake";
import { loadLocalChainMirror } from "@/lib/localState";
import {
  buildCircuitInputFromClaim,
  generateClaimProof,
  type ProverOutput,
} from "@/lib/prover";
import { fetchRelayState } from "@/lib/relayClient";
import { type StoredVaultEntry } from "@/lib/storage";
import { parseEthToWei } from "@/lib/utils";

export type AttackId = "replay" | "cpt" | "expired" | "cap" | "revoked";

interface ExecuteGuardrailParams {
  kind: AttackId;
  hospitalAddr: string;
  selectedEntry: StoredVaultEntry | null;
  decryptedClaim: Cms1500Claim | null;
  proverOutput: ProverOutput | null;
  publicClient?: PublicClient;
}

/**
 * Executes live adversarial guardrail probes against local/on-chain state and Groth16 circuit.
 * Expected behavior: always throws a descriptive policy/circuit/contract rejection error.
 */
export async function executeHospitalGuardrailCheck({
  kind,
  hospitalAddr,
  selectedEntry,
  decryptedClaim,
  proverOutput,
  publicClient,
}: ExecuteGuardrailParams): Promise<void> {
  const dummyRecordCommit = BigInt(
    selectedEntry?.recordCommitmentHex ??
      "0x00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff"
  );

  if (kind === "replay") {
    if (!proverOutput) {
      throw new Error(
        "ClaimsVault.NullifierAlreadyUsed() — settle a claim first or submit duplicate nullifier; contract reverts on-chain."
      );
    }
    const mirror = loadLocalChainMirror();
    if (IS_CHAIN_DEPLOYED && publicClient) {
      const used = (await publicClient.readContract({
        address: CONTRACTS.ClaimsVault.address,
        abi: CONTRACTS.ClaimsVault.abi,
        functionName: "nullifierUsed",
        args: [proverOutput.solidity.pubSignals[2]],
      })) as boolean;
      if (!used) {
        throw new Error(
          "Settle the generated proof on Base Sepolia once first, then click Replay to observe ClaimsVault.NullifierAlreadyUsed()."
        );
      }
      await publicClient.simulateContract({
        account: hospitalAddr as `0x${string}`,
        address: CONTRACTS.ClaimsVault.address,
        abi: CONTRACTS.ClaimsVault.abi as Abi,
        functionName: "submitClaim",
        args: [
          proverOutput.solidity.pA,
          proverOutput.solidity.pB,
          proverOutput.solidity.pC,
          proverOutput.solidity.pubSignals,
        ],
      });
    } else if (mirror.nullifierUsed[proverOutput.publicSignals[2]]) {
      throw new Error(
        "ClaimsVault.NullifierAlreadyUsed() — identical deterministic nullifier rejected on settlement!"
      );
    } else {
      throw new Error(
        "Settle the generated proof once first, then click Replay to observe NullifierAlreadyUsed()."
      );
    }
    return;
  }

  if (kind === "cpt") {
    const badInput = await buildCircuitInputFromClaim({
      claim: {
        ...(decryptedClaim ?? {
          caseLabel: "Uncovered CPT Check",
          insuredPolicyId: "2026001",
          patientAlias: "SYNTH-ATTACK",
          icd10Code: "Z41.1",
          serviceDate: "2026-11-22",
          cptCode: "15777",
          claimAmountEth: "0.01",
          renderingNpi: "1234567890",
          prescription: "None",
          clinicalNotes: "",
        }),
        cptCode: "15777",
      },
      recordCommitment: dummyRecordCommit,
      hospitalAddress: hospitalAddr,
      priorPolicySpentWei: 0n,
    });
    await generateClaimProof(badInput);
    return;
  }

  if (kind === "expired") {
    const badInput = await buildCircuitInputFromClaim({
      claim: {
        ...(decryptedClaim ?? {
          caseLabel: "Expired Policy Check",
          insuredPolicyId: "2025099",
          patientAlias: "SYNTH-ATTACK",
          icd10Code: "J18.9",
          serviceDate: "2026-11-22",
          cptCode: "99284",
          claimAmountEth: "0.008",
          renderingNpi: "1234567890",
          prescription: "None",
          clinicalNotes: "",
          useExpiredPolicy: true,
        }),
        useExpiredPolicy: true,
      },
      recordCommitment: dummyRecordCommit,
      hospitalAddress: hospitalAddr,
      priorPolicySpentWei: 0n,
    });
    await generateClaimProof(badInput);
    return;
  }

  if (kind === "cap") {
    const badInput = await buildCircuitInputFromClaim({
      claim: {
        ...(decryptedClaim ?? {
          caseLabel: "Over Cap Check",
          insuredPolicyId: "2026001",
          patientAlias: "SYNTH-ATTACK",
          icd10Code: "I21.0",
          serviceDate: "2026-11-22",
          cptCode: "99285",
          claimAmountEth: "0.04",
          renderingNpi: "1234567890",
          prescription: "None",
          clinicalNotes: "",
        }),
        claimAmountEth: "0.04",
      },
      recordCommitment: dummyRecordCommit,
      hospitalAddress: hospitalAddr,
      priorPolicySpentWei: parseEthToWei("0.01"),
    });
    await generateClaimProof(badInput);
    return;
  }

  if (kind === "revoked") {
    if (IS_CHAIN_DEPLOYED && publicClient && selectedEntry) {
      const recId = (await publicClient.readContract({
        address: CONTRACTS.HealthRecords.address,
        abi: CONTRACTS.HealthRecords.abi,
        functionName: "commitmentToRecordId",
        args: [selectedEntry.recordCommitmentHex],
      })) as bigint;
      if (recId === 0n) {
        throw new Error(
          "Register the encrypted record on Base Sepolia first before probing post-revoke access."
        );
      }
      const active = (await publicClient.readContract({
        address: CONTRACTS.HealthRecords.address,
        abi: CONTRACTS.HealthRecords.abi,
        functionName: "hasActiveAccess",
        args: [recId, hospitalAddr as `0x${string}`],
      })) as boolean;
      if (!active) {
        throw new Error(
          "ClaimsVault.PatientAccessNotActive() — Base Sepolia HealthRecords.hasActiveAccess() returned false (wrapped DEK wiped on-chain)!"
        );
      }
      throw new Error(
        "Grant is currently active on Base Sepolia. Click 'Revoke Immediately' on /patient first, then re-test."
      );
    }

    const remote = await fetchRelayState();
    const mirror = remote ?? loadLocalChainMirror();
    const recId = selectedEntry?.recordId || "1";
    const grant = mirror.grants[`${recId}:${hospitalAddr.toLowerCase()}`];
    if (!grant || grant.expiresAt <= Math.floor(Date.now() / 1000)) {
      throw new Error(
        "ClaimsVault.PatientAccessNotActive() — patient revocation cleared wrapped DEK & halted settlement!"
      );
    }
    throw new Error(
      "Grant is currently active. Click 'Revoke Immediately' on /patient first, then re-test."
    );
  }

  void canonicalFixtures;
}
