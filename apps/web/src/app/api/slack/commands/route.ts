import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { getRelayStore } from "@/lib/relayStore";
import { runCommand } from "@/lib/slack/commands";
import { verifySlackSignature } from "@/lib/slack/verifySignature";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  const rl = checkRateLimit(request, "slack-cmd", 60, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMIT_EXCEEDED" },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const secret = process.env.SLACK_SIGNING_SECRET ?? "";
  if (!secret) {
    return NextResponse.json(
      { error: "SLACK_NOT_CONFIGURED", detail: "Set SLACK_SIGNING_SECRET to enable /qlo." },
      { status: 503, headers: NO_STORE }
    );
  }

  const rawBody = await request.text();
  const valid = verifySlackSignature({
    signingSecret: secret,
    timestamp: request.headers.get("x-slack-request-timestamp"),
    signature: request.headers.get("x-slack-signature"),
    rawBody,
  });
  if (!valid) {
    return NextResponse.json({ error: "INVALID_SLACK_SIGNATURE" }, { status: 401, headers: NO_STORE });
  }

  const params = new URLSearchParams(rawBody);
  const result = runCommand(params.get("text") ?? "", getRelayStore().chainState);
  return NextResponse.json({ response_type: "ephemeral", ...result }, { headers: NO_STORE });
}
