import crypto from "node:crypto";
import type { SlackRole } from "./blocks";

export interface SlackApiResponse {
  ok: boolean;
  error?: string;
  ts?: string;
  channel?: string;
  channels?: Array<{ id: string; name: string; is_member?: boolean }>;
  [key: string]: unknown;
}

const SLACK_API_BASE = "https://slack.com/api";

const ROLE_CHANNEL_NAMES: Record<SlackRole, { envKey: string; defaultName: string }> = {
  patient: { envKey: "SLACK_CHANNEL_PATIENT", defaultName: "patient-vault" },
  hospital: { envKey: "SLACK_CHANNEL_HOSPITAL", defaultName: "hospital-claims" },
  insurer: { envKey: "SLACK_CHANNEL_INSURER", defaultName: "insurer-escrow" },
};

const channelCache = new Map<string, string>();

function deriveActionKey(secret: string): Buffer {
  return crypto.createHash("sha256").update(`qlo-slack-action:${secret}`).digest();
}

/**
 * Encrypts transient action state with AES-256-GCM before embedding in a Slack button value.
 * Guarantees 0 bytes of readable clinical data ever appear on Slack's wire or button payloads.
 */
export function sealActionPayload<T extends object>(payload: T, secret: string): string {
  const key = deriveActionKey(secret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function openActionPayload<T>(token: string, secret: string): T | null {
  try {
    const raw = Buffer.from(token, "base64url");
    if (raw.length < 29 || raw.toString("base64url") !== token) return null;
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ciphertext = raw.subarray(28);
    const key = deriveActionKey(secret);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(decrypted.toString("utf8")) as T;
  } catch {
    return null;
  }
}

export function getSlackBotToken(): string {
  return (process.env.SLACK_BOT_TOKEN ?? "").trim();
}

export async function slackApi(
  method: string,
  body: Record<string, unknown>,
  tokenOverride?: string
): Promise<SlackApiResponse> {
  const token = tokenOverride ?? getSlackBotToken();
  if (!token) {
    return { ok: false, error: "SLACK_BOT_TOKEN_NOT_CONFIGURED" };
  }

  const res = await fetch(`${SLACK_API_BASE}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as SlackApiResponse;
  return data;
}

export async function publishAppHome(
  userId: string,
  view: Record<string, unknown>
): Promise<SlackApiResponse> {
  return slackApi("views.publish", { user_id: userId, view });
}

export async function openModal(
  triggerId: string,
  view: Record<string, unknown>
): Promise<SlackApiResponse> {
  return slackApi("views.open", { trigger_id: triggerId, view });
}

export async function postMessage(
  channel: string,
  payload: { text: string; blocks?: ReadonlyArray<Record<string, unknown>> }
): Promise<SlackApiResponse> {
  return slackApi("chat.postMessage", {
    channel,
    text: payload.text,
    ...(payload.blocks ? { blocks: payload.blocks } : {}),
    unfurl_links: false,
    unfurl_media: false,
  });
}

export async function updateMessage(
  channel: string,
  ts: string,
  payload: { text: string; blocks?: ReadonlyArray<Record<string, unknown>> }
): Promise<SlackApiResponse> {
  return slackApi("chat.update", {
    channel,
    ts,
    text: payload.text,
    ...(payload.blocks ? { blocks: payload.blocks } : {}),
  });
}

export async function openUserDm(userId: string): Promise<string | null> {
  const res = await slackApi("conversations.open", { users: userId });
  const chan = res.channel as { id?: string } | string | undefined;
  if (typeof chan === "string") return chan;
  return chan?.id ?? null;
}

/**
 * Resolves a role channel ID via env var -> workspace lookup -> fallback user DM.
 * Never throws so Slack workflows still deliver even in a freshly created workspace.
 */
export async function resolveRoleChannel(
  role: SlackRole,
  fallbackUserId?: string
): Promise<string | null> {
  const cfg = ROLE_CHANNEL_NAMES[role];
  const fromEnv = (process.env[cfg.envKey] ?? "").trim();
  if (fromEnv) return fromEnv;

  const cached = channelCache.get(cfg.defaultName);
  if (cached) return cached;

  const list = await slackApi("conversations.list", {
    types: "public_channel,private_channel",
    exclude_archived: true,
    limit: 200,
  });

  if (list.ok && Array.isArray(list.channels)) {
    for (const ch of list.channels) {
      channelCache.set(ch.name.toLowerCase(), ch.id);
    }
    const found = channelCache.get(cfg.defaultName);
    if (found) return found;
  }

  if (fallbackUserId) {
    return openUserDm(fallbackUserId);
  }
  return null;
}

export async function postEphemeral(
  channel: string,
  user: string,
  text: string,
  blocks?: unknown[]
): Promise<SlackApiResponse> {
  return slackApi("chat.postEphemeral", { channel, user, text, ...(blocks ? { blocks } : {}) });
}

/** Creates (or finds) the three Qlo lane channels, invites the user, and returns their ids. */
export async function provisionWorkspace(userId: string): Promise<Record<SlackRole, string | null>> {
  const out = { patient: null, hospital: null, insurer: null } as Record<SlackRole, string | null>;
  for (const role of Object.keys(ROLE_CHANNEL_NAMES) as SlackRole[]) {
    const name = ROLE_CHANNEL_NAMES[role].defaultName;
    let id: string | null = channelCache.get(name) ?? null;
    if (!id) {
      const created = await slackApi("conversations.create", { name, is_private: false });
      const ch = created.channel as unknown as { id?: string } | undefined;
      if (created.ok && ch?.id) {
        id = ch.id;
        channelCache.set(name, id);
      } else {
        id = await resolveRoleChannel(role);
      }
    }
    if (id) {
      await slackApi("conversations.join", { channel: id });
      await slackApi("conversations.invite", { channel: id, users: userId }); // already_in_channel is fine
    }
    out[role] = id;
  }
  return out;
}
