import { NextRequest, NextResponse } from "next/server";
import { buildClaimResponse } from "@/lib/fhir";
import { checkRateLimit } from "@/lib/rateLimit";
import { getRelayStore } from "@/lib/relayStore";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rl = checkRateLimit(request, "fhir-read", 60, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "RATE_LIMIT_EXCEEDED" }, { status: 429 });
  }

  const tx = request.nextUrl.searchParams.get("tx")?.trim().toLowerCase() ?? "";
  if (!/^0x[0-9a-f]{64}$/.test(tx)) {
    return NextResponse.json({ error: "INVALID_TX_HASH" }, { status: 400 });
  }

  const claim = getRelayStore().chainState.settledClaims.find(
    (c) => c.txHash.toLowerCase() === tx
  );
  if (!claim) {
    return NextResponse.json({ error: "CLAIM_NOT_FOUND" }, { status: 404 });
  }

  return new NextResponse(JSON.stringify(buildClaimResponse(claim), null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/fhir+json",
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="claim-response-${tx.slice(2, 10)}.json"`,
    },
  });
}
