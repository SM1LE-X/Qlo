import { NextRequest, NextResponse } from "next/server";
import { IS_CHAIN_DEPLOYED } from "@/lib/contracts";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  assertZeroPhiPayload,
  clearVaultRecords,
  deleteVaultRecord,
  getRelayStore,
  upsertVaultRecord,
} from "@/lib/relayStore";

export const dynamic = "force-dynamic";

function rateLimitResponse(retryAfterSec: number) {
  return NextResponse.json(
    {
      error: "RATE_LIMIT_EXCEEDED",
      detail: "Too many clearinghouse vault requests. Retry shortly.",
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSec),
        "Cache-Control": "no-store",
      },
    }
  );
}

export async function GET(request: NextRequest) {
  const rl = checkRateLimit(request, "relay-read", 180, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSec);

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
      headers: {
        "Cache-Control": "no-store",
        "X-RateLimit-Remaining": String(rl.remaining),
      },
    }
  );
}

export async function POST(request: NextRequest) {
  const rl = checkRateLimit(request, "relay-write", 60, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSec);

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
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
          "X-RateLimit-Remaining": String(rl.remaining),
        },
      }
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
  const rl = checkRateLimit(request, "relay-write", 60, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSec);

  const resetAll = request.nextUrl.searchParams.get("reset") === "1";
  const commit = request.nextUrl.searchParams
    .get("recordCommitmentHex")
    ?.trim()
    .toLowerCase();

  if (resetAll) {
    if (IS_CHAIN_DEPLOYED) {
      return NextResponse.json(
        {
          error: "RELAY_RESET_DISABLED_IN_LIVE_MODE",
          detail:
            "Bulk vault resets are disabled while live Ethereum Sepolia contracts are active.",
        },
        {
          status: 403,
          headers: {
            "Cache-Control": "no-store",
            "X-RateLimit-Remaining": String(rl.remaining),
          },
        }
      );
    }
    clearVaultRecords();
    return NextResponse.json(
      { ok: true, cleared: true },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          "X-RateLimit-Remaining": String(rl.remaining),
        },
      }
    );
  }

  if (commit) {
    deleteVaultRecord(commit);
  }

  return NextResponse.json(
    { ok: true },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "X-RateLimit-Remaining": String(rl.remaining),
      },
    }
  );
}
