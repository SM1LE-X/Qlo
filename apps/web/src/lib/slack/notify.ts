import { assertZeroPhiPayload } from "@/lib/relayStore";
import type { SlackBlockMessage, SlackRole } from "./blocks";

const ENV_BY_ROLE: Record<SlackRole, string> = {
  patient: "SLACK_WEBHOOK_URL_PATIENT",
  hospital: "SLACK_WEBHOOK_URL_HOSPITAL",
  insurer: "SLACK_WEBHOOK_URL_INSURER",
};

const POST_TIMEOUT_MS = 5000;

export type NotifyResult =
  | { sent: true }
  | { sent: false; reason: "not_configured" | "phi_blocked" | "http_error" | "network_error" };

/**
 * Posts a card to the role's private channel webhook. No-op when the
 * webhook is not configured. Every payload passes the Zero-PHI guard.
 */
export async function notifyRole(
  role: SlackRole,
  message: SlackBlockMessage
): Promise<NotifyResult> {
  const url = process.env[ENV_BY_ROLE[role]];
  if (!url) return { sent: false, reason: "not_configured" };

  if (assertZeroPhiPayload(message)) return { sent: false, reason: "phi_blocked" };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(POST_TIMEOUT_MS),
    });
    return res.ok ? { sent: true } : { sent: false, reason: "http_error" };
  } catch {
    return { sent: false, reason: "network_error" };
  }
}
