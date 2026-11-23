import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  applyRelayAction,
  assertZeroPhiPayload,
  getRelayStore,
  resetRelayStore,
} from "@/lib/relayStore";

export const dynamic = "force-dynamic";

function rateLimitResponse(retryAfterSec: number) {
  return NextResponse.json(
    {
      error: "RATE_LIMIT_EXCEEDED",
      detail: "Too many clearinghouse state requests. Retry shortly.",
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

  const { chainState } = getRelayStore();
  return NextResponse.json(chainState, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "X-RateLimit-Remaining": String(rl.remaining),
    },
  });
}

export async function POST(request: NextRequest) {
  const rl = checkRateLimit(request, "relay-write", 60, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSec);

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const phiViolation = assertZeroPhiPayload(body);
    if (phiViolation) {
      return NextResponse.json(
        { error: "ZERO_PHI_POLICY_VIOLATION", detail: phiViolation },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const updated = applyRelayAction(body);
    return NextResponse.json(updated, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "X-RateLimit-Remaining": String(rl.remaining),
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "RELAY_ACTION_REJECTED",
        detail: err instanceof Error ? err.message : "Failed to apply relay action",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const rl = checkRateLimit(request, "relay-write", 60, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSec);

  const fresh = resetRelayStore();
  return NextResponse.json(fresh, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "X-RateLimit-Remaining": String(rl.remaining),
    },
  });
}
