import { NextRequest, NextResponse } from "next/server";
import {
  assertZeroPhiPayload,
  getRelayStore,
  upsertVaultRecord,
} from "@/lib/relayStore";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { vaultBundles, chainState } = getRelayStore();
  const hospital = request.nextUrl.searchParams.get("hospital")?.trim().toLowerCase();
  const patient = request.nextUrl.searchParams.get("patient")?.trim().toLowerCase();

  let entries = Array.from(vaultBundles.values());

  if (hospital) {
    entries = entries.filter((entry) => {
      if (entry.hospitalAddress?.toLowerCase() === hospital) return true;
      if (entry.recordId && chainState.grants[`${entry.recordId}:${hospital}`]) {
        return true;
      }
      return false;
    });
  } else if (patient) {
    entries = entries.filter((entry) => entry.patientAddress?.toLowerCase() === patient);
  }

  entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return NextResponse.json(
    { entries },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as unknown;
    const phiViolation = assertZeroPhiPayload(body);
    if (phiViolation) {
      return NextResponse.json(
        { error: "ZERO_PHI_POLICY_VIOLATION", detail: phiViolation },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const saved = upsertVaultRecord(body);
    return NextResponse.json(
      { ok: true, entry: saved },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: "INVALID_CIPHERTEXT_BUNDLE",
        detail: err instanceof Error ? err.message : "Invalid request",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const { vaultBundles } = getRelayStore();
  const resetAll = request.nextUrl.searchParams.get("reset") === "1";
  const commit = request.nextUrl.searchParams
    .get("recordCommitmentHex")
    ?.trim()
    .toLowerCase();

  if (resetAll) {
    vaultBundles.clear();
    return NextResponse.json({ ok: true, cleared: true });
  }

  if (commit) {
    vaultBundles.delete(commit);
  }

  return NextResponse.json(
    { ok: true },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
