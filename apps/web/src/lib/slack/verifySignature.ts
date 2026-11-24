import crypto from "node:crypto";

const MAX_SKEW_SEC = 300;

export interface SlackSignatureInput {
  signingSecret: string;
  timestamp: string | null;
  signature: string | null;
  rawBody: string;
  nowSec?: number;
}

/**
 * Verifies a Slack request signature (v0 HMAC-SHA256) with a replay window.
 * Fails closed on any missing or malformed input.
 */
export function verifySlackSignature(input: SlackSignatureInput): boolean {
  const { signingSecret, timestamp, signature, rawBody } = input;
  if (!signingSecret || !timestamp || !signature) return false;

  const ts = Number(timestamp);
  if (!Number.isInteger(ts)) return false;

  const now = input.nowSec ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > MAX_SKEW_SEC) return false;

  const expected = `v0=${crypto
    .createHmac("sha256", signingSecret)
    .update(`v0:${timestamp}:${rawBody}`)
    .digest("hex")}`;

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function signSlackBody(
  signingSecret: string,
  timestamp: string,
  rawBody: string
): string {
  return `v0=${crypto
    .createHmac("sha256", signingSecret)
    .update(`v0:${timestamp}:${rawBody}`)
    .digest("hex")}`;
}
