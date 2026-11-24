import { after, NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { openUserDm, postEphemeral, postMessage, publishAppHome } from "@/lib/slack/api";
import { readLiveChainSummary } from "@/lib/slack/serverEngine";
import { getSlackUserRole, markWelcomed } from "@/lib/slack/userRoles";
import { getMetrics } from "@/lib/slack/metrics";
import { verifySlackSignature } from "@/lib/slack/verifySignature";
import { buildAppHomeView, buildChannelWelcome, buildOnboardingMessage } from "@/lib/slack/views";

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
    channel?: string;
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

  // Slack retries events it thinks timed out; App Home publishes are idempotent, so drop retries.
  if (request.headers.get("x-slack-retry-num")) {
    return NextResponse.json({ ok: true }, { status: 200, headers: NO_STORE });
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
        await publishAppHome(userId, buildAppHomeView({ role, summary, metrics: getMetrics() }));
        if (!role && markWelcomed(userId)) {
          const dm = await openUserDm(userId);
          if (dm) await postMessage(dm, buildOnboardingMessage());
        }
      });
    }
  }

  if (body.type === "event_callback" && body.event?.type === "member_joined_channel") {
    const { user: userId, channel } = body.event;
    if (userId && channel) {
      after(async () => {
        const info = await slackChannelRole(channel);
        if (info) await postEphemeral(channel, userId, buildChannelWelcome(info));
      });
    }
  }

  return NextResponse.json({ ok: true }, { status: 200, headers: NO_STORE });
}

async function slackChannelRole(channelId: string): Promise<"patient" | "hospital" | "insurer" | null> {
  const { slackApi } = await import("@/lib/slack/api");
  const res = await slackApi("conversations.info", { channel: channelId });
  const name = (res.channel as unknown as { name?: string } | undefined)?.name ?? "";
  const map: Record<string, "patient" | "hospital" | "insurer"> = {
    [process.env.SLACK_CHANNEL_PATIENT ?? "patient-vault"]: "patient",
    [process.env.SLACK_CHANNEL_HOSPITAL ?? "hospital-claims"]: "hospital",
    [process.env.SLACK_CHANNEL_INSURER ?? "insurer-escrow"]: "insurer",
  };
  return map[name] ?? null;
}
