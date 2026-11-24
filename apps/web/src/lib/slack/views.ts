import type { SlackRole } from "./blocks";
import type { MetricsSnapshot } from "./metrics";
import { PROVIDER_OPTIONS, VISIT_PRESETS, type LiveChainSummary } from "./serverEngine";

export const SLACK_ACTIONS = {
  ROLE_PATIENT: "qlo_role_patient",
  ROLE_HOSPITAL: "qlo_role_hospital",
  ROLE_INSURER: "qlo_role_insurer",
  OPEN_SUBMIT: "qlo_open_submit_modal",
  CHECK_STATUS: "qlo_check_status",
  APPROVE_SETTLE: "qlo_approve_settle",
  REVOKE_ACCESS: "qlo_revoke_access",
  INSPECT_PROOF: "qlo_inspect_proof",
  REFRESH_HOME: "qlo_refresh_home",
  SETUP_WORKSPACE: "qlo_setup_workspace",
} as const;

export const SLACK_CALLBACKS = {
  SUBMIT_BILL: "qlo_submit_bill",
} as const;

const ROLE_LABELS: Record<SlackRole, { title: string; subtitle: string; channel: string }> = {
  patient: {
    title: "Patient",
    subtitle: "Submit medical bills privately and revoke provider access anytime.",
    channel: "#patient-vault",
  },
  hospital: {
    title: "Provider · Metro Cardiac Center",
    subtitle: "Review verified claims and settle escrow payouts in one click.",
    channel: "#hospital-claims",
  },
  insurer: {
    title: "Insurer · Meridian Health Plan",
    subtitle: "Monitor escrow disbursements and audit zero-PHI settlement proofs.",
    channel: "#insurer-escrow",
  },
};

const short = (value: string, head = 10, tail = 6): string =>
  value.length <= head + tail + 3 ? value : `${value.slice(0, head)}...${value.slice(-tail)}`;

function roleButtons(activeRole?: SlackRole) {
  const mk = (role: SlackRole, label: string, actionId: string) => ({
    type: "button",
    text: {
      type: "plain_text",
      text: activeRole === role ? `✓ ${label}` : label,
    },
    action_id: actionId,
    ...(activeRole === role ? { style: "primary" } : {}),
  });

  return {
    type: "actions",
    elements: [
      mk("patient", "Patient", SLACK_ACTIONS.ROLE_PATIENT),
      mk("hospital", "Provider", SLACK_ACTIONS.ROLE_HOSPITAL),
      mk("insurer", "Insurer", SLACK_ACTIONS.ROLE_INSURER),
    ],
  };
}

function bar(fraction: number, width = 20): string {
  const f = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));
  const filled = Math.round(f * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

export function buildAnalyticsBlocks(
  summary: LiveChainSummary,
  metrics?: MetricsSnapshot
): Array<Record<string, unknown>> {
  const capEth = 0.03;
  const spent = Number(summary.policySpentEth);
  const capFrac = Number.isFinite(spent) ? spent / capEth : 0;
  const updated = new Date(summary.readAt || Date.now()).toISOString().slice(11, 19);
  const blocks: Array<Record<string, unknown>> = [
    { type: "divider" },
    {
      type: "section",
      text: { type: "mrkdwn", text: "*📊 Live Protocol Analytics*" },
      accessory: {
        type: "button",
        text: { type: "plain_text", text: "↻ Refresh" },
        action_id: SLACK_ACTIONS.REFRESH_HOME,
      },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Insurer escrow*\n${summary.escrowEth} ETH` },
        { type: "mrkdwn", text: `*Claims settled on-chain*\n${summary.settledCount}` },
        { type: "mrkdwn", text: `*PHI bytes on-chain / in Slack*\n0 / 0` },
        { type: "mrkdwn", text: `*Relayer gas balance*\n${summary.relayerBalanceEth ? `${summary.relayerBalanceEth} ETH` : summary.relayerEnabled ? "—" : "demo mode (no relayer key)"}` },
      ],
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Annual policy cap*  \`${bar(capFrac)}\`  ${summary.policySpentEth} / ${capEth.toFixed(4)} ETH (${Math.round(capFrac * 100)}%)`,
      },
    },
  ];

  if (metrics && metrics.attempts > 0) {
    const blockedText = Object.entries(metrics.blockedByCode)
      .map(([code, n]) => `\`${code}\` ×${n}`)
      .join("  ") || "none";
    blocks.push({
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Session settlements*\n${metrics.settled} ok / ${metrics.attempts} attempts` },
        { type: "mrkdwn", text: `*Groth16 prove time*\navg ${metrics.avgProofMs ?? "—"} ms · p95 ${metrics.p95ProofMs ?? "—"} ms` },
        { type: "mrkdwn", text: `*ETH released this session*\n${metrics.totalSettledEth} ETH` },
        { type: "mrkdwn", text: `*Blocked by protocol*\n${blockedText}` },
      ],
    });
    const recent = metrics.recent
      .map((e) => {
        const t = new Date(e.at).toISOString().slice(11, 19);
        const link = e.explorerUrl ? ` · <${e.explorerUrl}|tx>` : "";
        return e.ok
          ? `✅ ${t}  ${e.amountEth} ETH · ${e.proofMs ?? "?"} ms${link}`
          : `⛔ ${t}  ${e.amountEth} ETH · \`${e.code ?? "REJECTED"}\``;
      })
      .join("\n");
    blocks.push({ type: "section", text: { type: "mrkdwn", text: `*Recent activity*\n${recent}` } });
  }

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `${summary.networkLive ? "🟢 Live Sepolia read" : "🟡 Cached — RPC unreachable"}${summary.rpcLatencyMs ? ` · RPC ${summary.rpcLatencyMs} ms` : ""} · updated ${updated} UTC`,
      },
    ],
  });
  return blocks;
}

export function buildAppHomeView(params: {
  role?: SlackRole;
  summary: LiveChainSummary;
  metrics?: MetricsSnapshot;
}): Record<string, unknown> {
  const { role, summary, metrics } = params;
  const blocks: Array<Record<string, unknown>> = [
    {
      type: "header",
      text: { type: "plain_text", text: "Qlo" },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "Private health insurance claims, settled directly in Slack with *0 bytes of medical data* exposed.",
      },
    },
    { type: "divider" },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "*How a claim flows through your workspace*\n" +
          "`#patient-vault`  →  bill encrypted, time-boxed consent\n" +
          "`#hospital-claims`  →  one tap: private proof + instant payout\n" +
          "`#insurer-escrow`  →  verified receipt, zero patient data\n" +
          "_No wallets, gas or crypto — Qlo's relayer handles the chain._",
      },
      accessory: {
        type: "button",
        text: { type: "plain_text", text: "⚡ Set up workspace" },
        style: "primary",
        action_id: SLACK_ACTIONS.SETUP_WORKSPACE,
      },
    },
  ];

  if (role === "patient" || !role) {
    blocks.push(
      { type: "divider" },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Submit a medical bill*\nEncrypted automatically. Shared only for the window you choose.",
        },
        accessory: {
          type: "button",
          text: { type: "plain_text", text: "Submit Bill" },
          style: "primary",
          action_id: SLACK_ACTIONS.OPEN_SUBMIT,
        },
      }
    );
  }

  if (role === "hospital") {
    blocks.push(
      { type: "divider" },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Claims Queue*\nIncoming patient bills appear in `#hospital-claims` ready for one-click settlement.",
        },
        accessory: {
          type: "button",
          text: { type: "plain_text", text: "Submit Test Bill" },
          action_id: SLACK_ACTIONS.OPEN_SUBMIT,
        },
      }
    );
  }

  if (role === "insurer") {
    blocks.push(
      { type: "divider" },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Escrow Treasury*\nAvailable balance: *${summary.escrowEth} ETH* · Settled claims: *${summary.settledCount}*\nPolicy cap used: *${summary.policySpentEth} / 0.0300 ETH*`,
        },
      }
    );
  }

  blocks.push(...buildAnalyticsBlocks(summary, metrics));

  return { type: "home", blocks };
}

export function buildOnboardingMessage(role?: SlackRole) {
  return {
    text: "Welcome to Qlo. Choose your role or submit a bill.",
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "Welcome to Qlo" },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "Qlo settles health insurance claims privately inside Slack. Open the *Home* tab and tap *⚡ Set up workspace* — channels, team and a sandbox claim are ready in seconds.",
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Submit Medical Bill" },
            style: "primary",
            action_id: SLACK_ACTIONS.OPEN_SUBMIT,
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Escrow Status" },
            action_id: SLACK_ACTIONS.CHECK_STATUS,
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "Commands: `/qlo submit` · `/qlo status` · `/qlo start`",
          },
        ],
      },
    ],
  };
}

export function buildSubmitBillModal(channelId?: string): Record<string, unknown> {
  return {
    type: "modal",
    callback_id: SLACK_CALLBACKS.SUBMIT_BILL,
    private_metadata: JSON.stringify({ channelId: channelId ?? "" }),
    title: { type: "plain_text", text: "Submit Medical Bill" },
    submit: { type: "plain_text", text: "Encrypt & Share" },
    close: { type: "plain_text", text: "Cancel" },
    blocks: [
      {
        type: "input",
        block_id: "visit_block",
        label: { type: "plain_text", text: "Visit / Procedure" },
        element: {
          type: "static_select",
          action_id: "visit_select",
          initial_option: {
            text: { type: "plain_text", text: VISIT_PRESETS[0].label },
            value: VISIT_PRESETS[0].id,
          },
          options: VISIT_PRESETS.map((v) => ({
            text: { type: "plain_text", text: v.label },
            value: v.id,
          })),
        },
      },
      {
        type: "input",
        block_id: "provider_block",
        label: { type: "plain_text", text: "Provider" },
        element: {
          type: "static_select",
          action_id: "provider_select",
          initial_option: {
            text: { type: "plain_text", text: PROVIDER_OPTIONS[0].name },
            value: PROVIDER_OPTIONS[0].id,
          },
          options: PROVIDER_OPTIONS.map((p) => ({
            text: { type: "plain_text", text: p.name },
            value: p.id,
          })),
        },
      },
      {
        type: "input",
        block_id: "duration_block",
        label: { type: "plain_text", text: "Access Window" },
        element: {
          type: "static_select",
          action_id: "duration_select",
          initial_option: {
            text: { type: "plain_text", text: "10 minutes" },
            value: "600",
          },
          options: [
            { text: { type: "plain_text", text: "10 minutes" }, value: "600" },
            { text: { type: "plain_text", text: "30 minutes" }, value: "1800" },
            { text: { type: "plain_text", text: "1 hour" }, value: "3600" },
          ],
        },
      },
      {
        type: "input",
        block_id: "notes_block",
        optional: true,
        label: { type: "plain_text", text: "Reference Note (encrypted, never posted)" },
        element: {
          type: "plain_text_input",
          action_id: "notes_input",
          placeholder: { type: "plain_text", text: "Optional visit reference" },
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "Clinical details are encrypted immediately and never posted to Slack or on-chain.",
          },
        ],
      },
    ],
  };
}

export function buildPatientReceiptCard(params: {
  recordLabel: string;
  providerName: string;
  categoryLabel: string;
  amountEth: string;
  status: "active" | "revoked" | "settled";
  revokeToken?: string;
  explorerUrl?: string;
}) {
  const statusLine =
    params.status === "revoked"
      ? "🔴 *Access revoked* — provider can no longer settle this record"
      : params.status === "settled"
        ? "✅ *Settled* — claim paid to provider"
        : "🟢 *Access active* — shared temporarily with provider";

  const blocks: Array<Record<string, unknown>> = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text:
          params.status === "revoked"
            ? "Access Revoked"
            : params.status === "settled"
              ? "Bill Settled"
              : "Bill Shared Privately",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Record:* ${params.recordLabel}\n*Provider:* ${params.providerName}\n*Category:* ${params.categoryLabel} · *${params.amountEth} ETH*\n${statusLine}`,
      },
    },
  ];

  const actions: Array<Record<string, unknown>> = [];
  if (params.status === "active" && params.revokeToken) {
    actions.push({
      type: "button",
      text: { type: "plain_text", text: "Revoke Access" },
      style: "danger",
      action_id: SLACK_ACTIONS.REVOKE_ACCESS,
      value: params.revokeToken,
    });
  }
  if (params.explorerUrl) {
    actions.push({
      type: "button",
      text: { type: "plain_text", text: "View Receipt" },
      url: params.explorerUrl,
    });
  }
  if (actions.length > 0) {
    blocks.push({ type: "actions", elements: actions });
  }

  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: "Zero-PHI: 0 bytes of identity or diagnosis stored in Slack." }],
  });

  return {
    text: `${params.recordLabel} — ${params.status}`,
    blocks,
  };
}

export function buildHospitalClaimCard(params: {
  recordLabel: string;
  providerName: string;
  categoryLabel: string;
  amountEth: string;
  status: "ready" | "settling" | "settled" | "rejected" | "revoked";
  settleToken?: string;
  inspectToken?: string;
  txHash?: string;
  explorerUrl?: string;
  errorMessage?: string;
}) {
  const titleMap: Record<typeof params.status, string> = {
    ready: "Claim Ready for Settlement",
    settling: "Verifying & Settling...",
    settled: "Claim Settled",
    rejected: "Claim Rejected (Fail-Closed)",
    revoked: "Claim Blocked — Access Revoked",
  };

  let detail = `*Claim:* ${params.recordLabel}\n*Provider:* ${params.providerName}\n*Category:* ${params.categoryLabel}\n*Payout:* *${params.amountEth} ETH*`;
  if (params.status === "settling") {
    detail += "\n⏳ Verifying eligibility proof and settling escrow...";
  } else if (params.status === "settled") {
    detail += params.txHash && params.explorerUrl
      ? `\n✅ Paid · <${params.explorerUrl}|${short(params.txHash)}>`
      : "\n✅ Verified & settled (0 PHI exposed)";
  } else if (params.errorMessage) {
    detail += `\n🚫 ${params.errorMessage}`;
  }

  const blocks: Array<Record<string, unknown>> = [
    { type: "header", text: { type: "plain_text", text: titleMap[params.status] } },
    { type: "section", text: { type: "mrkdwn", text: detail } },
  ];

  const actions: Array<Record<string, unknown>> = [];
  if (params.status === "ready" && params.settleToken) {
    actions.push({
      type: "button",
      text: { type: "plain_text", text: "Approve & Settle" },
      style: "primary",
      action_id: SLACK_ACTIONS.APPROVE_SETTLE,
      value: params.settleToken,
    });
  }
  if (params.inspectToken) {
    actions.push({
      type: "button",
      text: { type: "plain_text", text: "Inspect Proof" },
      action_id: SLACK_ACTIONS.INSPECT_PROOF,
      value: params.inspectToken,
    });
  }
  if (params.explorerUrl && params.status === "settled") {
    actions.push({
      type: "button",
      text: { type: "plain_text", text: "View on Etherscan" },
      url: params.explorerUrl,
    });
  }
  if (actions.length > 0) {
    blocks.push({ type: "actions", elements: actions });
  }

  return {
    text: `${titleMap[params.status]} · ${params.recordLabel}`,
    blocks,
  };
}

export function buildInsurerDisbursementCard(params: {
  recordLabel: string;
  providerName: string;
  amountEth: string;
  txHash?: string;
  explorerUrl?: string;
  inspectToken?: string;
}) {
  const txLine =
    params.txHash && params.explorerUrl
      ? `\n*Tx:* <${params.explorerUrl}|${short(params.txHash)}>`
      : "";

  const actions: Array<Record<string, unknown>> = [];
  if (params.inspectToken) {
    actions.push({
      type: "button",
      text: { type: "plain_text", text: "Audit Proof" },
      action_id: SLACK_ACTIONS.INSPECT_PROOF,
      value: params.inspectToken,
    });
  }
  if (params.explorerUrl) {
    actions.push({
      type: "button",
      text: { type: "plain_text", text: "Etherscan" },
      url: params.explorerUrl,
    });
  }

  const blocks: Array<Record<string, unknown>> = [
    { type: "header", text: { type: "plain_text", text: "Escrow Disbursed" } },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Claim:* ${params.recordLabel}\n*Payee:* ${params.providerName}\n*Disbursed:* *+${params.amountEth} ETH*\n*Privacy:* 🟢 Verified · 0 Medical Bytes${txLine}`,
      },
    },
  ];
  if (actions.length > 0) {
    blocks.push({ type: "actions", elements: actions });
  }

  return {
    text: `Escrow disbursed +${params.amountEth} ETH to ${params.providerName}`,
    blocks,
  };
}

export function buildAuditProofModal(params: {
  recordLabel: string;
  providerName: string;
  amountEth: string;
  recordCommitmentHex: string;
  nullifier?: string;
  proofElapsedMs?: number;
  txHash?: string;
  explorerUrl?: string;
  status: string;
}): Record<string, unknown> {
  const lines = [
    `*Claim:* ${params.recordLabel}`,
    `*Provider:* ${params.providerName}`,
    `*Amount:* ${params.amountEth} ETH`,
    `*Status:* ${params.status}`,
    `*Privacy Audit:* 🟢 0 Medical Bytes Found`,
    `*Record Commitment:* \`${short(params.recordCommitmentHex, 14, 8)}\``,
  ];
  if (params.nullifier) {
    lines.push(`*Nullifier:* \`${short(params.nullifier, 14, 8)}\` (replay blocked)`);
  }
  if (params.proofElapsedMs) {
    lines.push(`*Groth16 Proving:* ${params.proofElapsedMs}ms (BN254 · 4,349 constraints)`);
  }
  if (params.txHash && params.explorerUrl) {
    lines.push(`*Ethereum Sepolia Tx:* <${params.explorerUrl}|${short(params.txHash, 14, 8)}>`);
  }

  return {
    type: "modal",
    title: { type: "plain_text", text: "Settlement Proof Audit" },
    close: { type: "plain_text", text: "Close" },
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: lines.join("\n") },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "Verified cryptographically without exposing patient identity, ICD-10, or CPT codes.",
          },
        ],
      },
    ],
  };
}

const CHANNEL_WELCOME: Record<SlackRole, string> = {
  patient: "Welcome to *#patient-vault* 👋 Your receipts land here. Run `/qlo submit` to send a bill — nothing medical is ever posted, and you can revoke access anytime.",
  hospital: "Welcome to *#hospital-claims* 👋 Verified claims arrive here as cards. Tap *Approve & Settle* — proof + payout happen automatically.",
  insurer: "Welcome to *#insurer-escrow* 👋 Every payout shows up here with a tamper-proof receipt. Tap *Inspect Proof* to audit — zero patient data revealed.",
};

export function buildChannelWelcome(role: SlackRole): string {
  return CHANNEL_WELCOME[role];
}
