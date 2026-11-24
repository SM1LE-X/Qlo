import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/** Reports which Slack features are configured. Booleans only, never secrets. */
export async function GET(request: NextRequest) {
  const rl = checkRateLimit(request, "slack-status", 60, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "RATE_LIMIT_EXCEEDED" }, { status: 429 });
  }
  return NextResponse.json(
    {
      signingSecret: Boolean(process.env.SLACK_SIGNING_SECRET),
      webhooks: {
        patient: Boolean(process.env.SLACK_WEBHOOK_URL_PATIENT),
        hospital: Boolean(process.env.SLACK_WEBHOOK_URL_HOSPITAL),
        insurer: Boolean(process.env.SLACK_WEBHOOK_URL_INSURER),
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
