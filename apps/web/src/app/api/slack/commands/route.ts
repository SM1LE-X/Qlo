import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { getRelayStore } from "@/lib/relayStore";
import { openModal } from "@/lib/slack/api";
import { runCommand } from "@/lib/slack/commands";
import { readLiveChainSummary } from "@/lib/slack/serverEngine";
import { getSlackUserRole } from "@/lib/slack/userRoles";
import { verifySlackSignature } from "@/lib/slack/verifySignature";
import { buildOnboardingMessage, buildSubmitBillModal } from "@/lib/slack/views";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  const rl = checkRateLimit(request, "slack-cmd", 60, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMIT_EXCEEDED" },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const secret = (process.env.SLACK_SIGNING_SECRET ?? "").trim();
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
  const rawText = (params.get("text") ?? "").trim();
  const sub = rawText.split(/\s+/)[0]?.toLowerCase() ?? "";
  const triggerId = params.get("trigger_id") ?? "";
  const channelId = params.get("channel_id") ?? "";
  const userId = params.get("user_id") ?? "";

  if (!sub || sub === "start" || sub === "onboard") {
    const role = userId ? getSlackUserRole(userId) : undefined;
    return NextResponse.json(
      { response_type: "ephemeral", ...buildOnboardingMessage(role) },
      { headers: NO_STORE }
    );
  }

  if (sub === "submit" || sub === "bill") {
    if (triggerId) {
      const opened = await openModal(triggerId, buildSubmitBillModal(channelId));
      if (opened.ok) {
        return new NextResponse("", { status: 200, headers: NO_STORE });
      }
      return NextResponse.json(
        {
          response_type: "ephemeral",
          text: `Could not open bill form (${opened.error ?? "configure SLACK_BOT_TOKEN"}).`,
        },
        { headers: NO_STORE }
      );
    }
  }

  if (sub === "status") {
    const live = await readLiveChainSummary();
    return NextResponse.json(
      {
        response_type: "ephemeral",
        text: `*Qlo Status*\nEscrow Balance: *${live.escrowEth} ETH*\nSettled Claims: *${live.settledCount}*\nPolicy Cap Used: *${live.policySpentEth} / 0.0300 ETH*\nNetwork: ${live.networkLive ? "🟢 Ethereum Sepolia" : "🟡 Sepolia (cached)"}`,
      },
      { headers: NO_STORE }
    );
  }

  const result = runCommand(rawText, getRelayStore().chainState);
  return NextResponse.json({ response_type: "ephemeral", ...result }, { headers: NO_STORE });
}
