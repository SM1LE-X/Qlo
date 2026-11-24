import { after, NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { publishAppHome } from "@/lib/slack/api";
import { readLiveChainSummary } from "@/lib/slack/serverEngine";
import { getSlackUserRole } from "@/lib/slack/userRoles";
import { verifySlackSignature } from "@/lib/slack/verifySignature";
import { buildAppHomeView } from "@/lib/slack/views";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };

interface SlackEventEnvelope {
  type?: string;
  challenge?: string;
  event?: {
    type?: string;
    user?: string;
    tab?: string;
  };
}

export async function POST(request: NextRequest) {
  const rl = checkRateLimit(request, "slack-events", 120, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMIT_EXCEEDED" },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const secret = (process.env.SLACK_SIGNING_SECRET ?? "").trim();
  if (!secret) {
    return NextResponse.json(
      { error: "SLACK_NOT_CONFIGURED", detail: "Set SLACK_SIGNING_SECRET to enable Slack Events." },
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

  let body: SlackEventEnvelope;
  try {
    body = JSON.parse(rawBody) as SlackEventEnvelope;
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400, headers: NO_STORE });
  }

  if (body.type === "url_verification" && typeof body.challenge === "string") {
    return NextResponse.json({ challenge: body.challenge }, { status: 200, headers: NO_STORE });
  }

  if (body.type === "event_callback" && body.event?.type === "app_home_opened") {
    const userId = body.event.user;
    if (userId) {
      after(async () => {
        const summary = await readLiveChainSummary();
        const role = getSlackUserRole(userId);
        await publishAppHome(userId, buildAppHomeView({ role, summary }));
      });
    }
  }

  return NextResponse.json({ ok: true }, { status: 200, headers: NO_STORE });
}
