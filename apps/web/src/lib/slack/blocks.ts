/**
 * Slack Block Kit builders for the Qlo clearinghouse.
 * Zero-PHI rule: cards carry commitments, hashes, amounts and generic
 * categories only. Never CPT/ICD codes, names or documents.
 */

export interface SlackBlockMessage {
  text: string;
  blocks: ReadonlyArray<Record<string, unknown>>;
}

export type SlackRole = "patient" | "hospital" | "insurer";

const short = (value: string, head = 10, tail = 6): string =>
  value.length <= head + tail + 3
    ? value
    : `${value.slice(0, head)}...${value.slice(-tail)}`;

const md = (text: string) => ({ type: "mrkdwn", text });

const section = (text: string) => ({
  type: "section",
  text: md(text),
});

const header = (text: string) => ({
  type: "header",
  text: { type: "plain_text", text },
});

const context = (text: string) => ({
  type: "context",
  elements: [md(text)],
});

const linkButton = (label: string, url: string, style?: "primary" | "danger") => ({
  type: "button",
  text: { type: "plain_text", text: label },
  url,
  ...(style ? { style } : {}),
});

export function revokedCard(input: {
  recordLabel: string;
  hospitalAddress: string;
}): SlackBlockMessage {
  return {
    text: "Hospital access revoked",
    blocks: [
      header("Access revoked by patient"),
      section(
        `*Record:* ${input.recordLabel}\n*Hospital:* \`${short(input.hospitalAddress, 8, 6)}\`\n*Effect:* wrapped key deleted; new claims on this record fail closed`
      ),
    ],
  };
}

export function intakeCard(input: {
  commitmentHex: string;
  categoryLabel: string;
  amountEth?: string;
}): SlackBlockMessage {
  const amountLine = input.amountEth ? `\n*Amount:* ${input.amountEth} ETH` : "";
  return {
    text: "Encrypted record sealed",
    blocks: [
      header("Encrypted intake sealed"),
      section(
        `*Commitment:* \`${short(input.commitmentHex)}\`\n*Category:* ${input.categoryLabel}${amountLine}`
      ),
      context("Zero-PHI: 0 bytes of identity or clinical data left the patient device."),
    ],
  };
}

export function proofReadyCard(input: {
  claimLabel: string;
  amountEth: string;
  hospitalAddress: string;
  settleUrl: string;
  inspectUrl: string;
}): SlackBlockMessage {
  return {
    text: "Zero-knowledge claim ready",
    blocks: [
      header("Claim ready for settlement"),
      section(
        `*Claim:* ${input.claimLabel}\n*Hospital:* \`${short(input.hospitalAddress, 8, 6)}\`\n*Payout:* ${input.amountEth} ETH\n*Proof:* Groth16 verified`
      ),
      {
        type: "actions",
        elements: [
          linkButton("Sign and settle", input.settleUrl, "primary"),
          linkButton("Inspect proof", input.inspectUrl),
        ],
      },
      context("Approval requires the hospital wallet signature, not a Slack click."),
    ],
  };
}

export function settledCard(input: {
  txHash: string;
  amountEth: string;
  nullifier: string;
  explorerUrl: string;
}): SlackBlockMessage {
  return {
    text: "Claim settled on Ethereum Sepolia",
    blocks: [
      header("Claim settled"),
      section(
        `*Tx:* <${input.explorerUrl}|${short(input.txHash)}>\n*Paid:* ${input.amountEth} ETH\n*Nullifier:* \`${short(input.nullifier)}\` (double-claim blocked)`
      ),
    ],
  };
}

export function rejectCard(input: { reason: string; code: string }): SlackBlockMessage {
  return {
    text: `Claim rejected: ${input.code}`,
    blocks: [
      header("Claim rejected (fail-closed)"),
      section(`*Reason:* ${input.reason}\n*Code:* \`${input.code}\`\n*ETH released:* 0`),
    ],
  };
}

export function accessCard(input: {
  recordLabel: string;
  hospitalAddress: string;
  expiresAtIso: string;
  revokeUrl: string;
}): SlackBlockMessage {
  return {
    text: "Hospital access granted",
    blocks: [
      header("Access granted"),
      section(
        `*Record:* ${input.recordLabel}\n*Hospital:* \`${short(input.hospitalAddress, 8, 6)}\`\n*Expires:* ${input.expiresAtIso}`
      ),
      {
        type: "actions",
        elements: [linkButton("Revoke in wallet", input.revokeUrl, "danger")],
      },
    ],
  };
}

export function digestCard(input: {
  ready: number;
  rejected: number;
  pendingEth: string;
}): SlackBlockMessage {
  return {
    text: `${input.ready} claims ready`,
    blocks: [
      header("Claims digest"),
      section(
        `*Ready:* ${input.ready}\n*Rejected:* ${input.rejected}\n*Pending payout:* ${input.pendingEth} ETH`
      ),
    ],
  };
}
