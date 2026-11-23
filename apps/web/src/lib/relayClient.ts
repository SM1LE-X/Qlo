"use client";

import { computeRecordCommitment } from "./crypto";
import { saveLocalChainMirror, type LocalChainMirror } from "./localState";
import {
  computeDeterministicCidV1,
  type StoredVaultEntry,
} from "./storage";

interface RelayCiphertextResponse {
  entries?: Array<{
    cid: string;
    recordCommitmentHex: `0x${string}`;
    recordId?: string;
    envelope: StoredVaultEntry["envelope"];
    createdAt: string;
    patientAddress?: string;
    hospitalAddress?: string;
    displayLabel?: string;
  }>;
}

export async function fetchRelayState(): Promise<LocalChainMirror | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch("/api/relay/state", { cache: "no-store" });
    if (!res.ok) return null;
    const state = (await res.json()) as LocalChainMirror;
    saveLocalChainMirror(state);
    return state;
  } catch {
    return null;
  }
}

export async function postRelayAction(
  payload: Record<string, unknown>
): Promise<LocalChainMirror | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch("/api/relay/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errData = (await res.json().catch(() => ({}))) as { detail?: string };
      if (errData.detail) throw new Error(errData.detail);
      return null;
    }
    const updated = (await res.json()) as LocalChainMirror;
    saveLocalChainMirror(updated);
    return updated;
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("ClaimsVault.")) {
      throw err;
    }
    return null;
  }
}

/**
 * Publishes strictly ciphertext envelopes to the clearinghouse relay.
 * Strips `summaryHint` and any client-only plaintext fields before transmission.
 */
export async function pushCiphertextToRelay(
  entry: StoredVaultEntry
): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const sanitizedBody = {
      cid: entry.cid,
      recordCommitmentHex: entry.recordCommitmentHex,
      recordId: entry.recordId,
      envelope: entry.envelope,
      createdAt: entry.createdAt,
      patientAddress: entry.patientAddress,
      hospitalAddress: entry.hospitalAddress,
    };
    const res = await fetch("/api/relay/vault", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sanitizedBody),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Pulls relayed ciphertext envelopes addressed to a specific hospital and verifies
 * CIDv1 and 248-bit recordCommitment client-side before returning them.
 */
export async function fetchHospitalRelayVault(
  hospitalAddress: string
): Promise<StoredVaultEntry[]> {
  if (typeof window === "undefined" || !hospitalAddress) return [];
  try {
    const res = await fetch(
      `/api/relay/vault?hospital=${encodeURIComponent(hospitalAddress)}`,
      { cache: "no-store" }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as RelayCiphertextResponse;
    const rawEntries = data.entries ?? [];
    const verified: StoredVaultEntry[] = [];

    for (const item of rawEntries) {
      try {
        const envelopeBytes = new TextEncoder().encode(JSON.stringify(item.envelope));
        const [cid, commit] = await Promise.all([
          computeDeterministicCidV1(envelopeBytes),
          computeRecordCommitment(envelopeBytes),
        ]);
        if (
          cid !== item.cid ||
          commit.recordCommitmentHex.toLowerCase() !==
            item.recordCommitmentHex.toLowerCase()
        ) {
          continue;
        }
        verified.push({
          cid: item.cid,
          recordCommitmentHex: item.recordCommitmentHex,
          recordId: item.recordId,
          envelope: item.envelope,
          createdAt: item.createdAt,
          patientAddress: item.patientAddress,
          hospitalAddress: item.hospitalAddress,
          summaryHint:
            item.displayLabel ||
            (item.recordId
              ? `Authorized Record #${item.recordId}`
              : `Relayed Envelope (${item.cid.slice(0, 12)}...)`),
        });
      } catch {
        // Ignore malformed envelope
      }
    }

    return verified;
  } catch {
    return [];
  }
}

export async function deleteRelayCiphertext(
  recordCommitmentHex: string
): Promise<void> {
  if (typeof window === "undefined" || !recordCommitmentHex) return;
  try {
    await fetch(
      `/api/relay/vault?recordCommitmentHex=${encodeURIComponent(recordCommitmentHex)}`,
      { method: "DELETE" }
    );
  } catch {
    // Non-fatal
  }
}

export async function resetRelaySession(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await fetch("/api/relay/state", { method: "DELETE" });
  } catch {
    // Non-fatal
  }
}
