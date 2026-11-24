import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { verifySlackSignature } from "@/lib/slack/verifySignature";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Slack interactivity endpoint. Approve/Revoke buttons are URL buttons that
 * open the wallet, so this only acknowledges verified interaction payloads.
 * Slack clicks never authorize settlement; the wallet signature does.
 */
export async function POST(request: NextRequest) {
  const rl = checkRateLimit(request, "slack-interact", 60, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "RATE_LIMIT_EXCEEDED" }, { status: 429, headers: NO_STORE });
  }

  const secret = process.env.SLACK_SIGNING_SECRET ?? "";
  if (!secret) {
    return NextResponse.json({ error: "SLACK_NOT_CONFIGURED" }, { status: 503, headers: NO_STORE });
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

  return NextResponse.json({}, { status: 200, headers: NO_STORE });
}
