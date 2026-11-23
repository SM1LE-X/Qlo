import { NextRequest, NextResponse } from "next/server";
import {
  applyRelayAction,
  assertZeroPhiPayload,
  getRelayStore,
  resetRelayStore,
} from "@/lib/relayStore";

export const dynamic = "force-dynamic";

export async function GET() {
  const { chainState } = getRelayStore();
  return NextResponse.json(chainState, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
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
      headers: { "Cache-Control": "no-store" },
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

export async function DELETE() {
  const fresh = resetRelayStore();
  return NextResponse.json(fresh, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
