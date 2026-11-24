"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ChevronDown, Copy, RefreshCw, Terminal } from "lucide-react";
import { DEPLOYMENT, IS_CHAIN_DEPLOYED } from "@/lib/contracts";

type Level = "green" | "amber" | "red" | "pending";

interface CheckRow {
  id: string;
  label: string;
  level: Level;
  detail: string;
  hint: string;
}

const DOT_CLASS: Record<Level, string> = {
  green: "bg-[#059669]",
  amber: "bg-[#F59E0B]",
  red: "bg-[#EF4444]",
  pending: "bg-[#A1A1AA] animate-pulse",
};

const LEVEL_TEXT: Record<Level, string> = {
  green: "OK",
  amber: "WARN",
  red: "FAIL",
  pending: "WAIT",
};

const LEVEL_BADGE_CLASS: Record<Level, string> = {
  green: "text-[#059669]",
  amber: "text-[#B45309]",
  red: "text-[#DC2626]",
  pending: "text-[#71717A]",
};

const ENV_TEMPLATE = [
  "SLACK_SIGNING_SECRET=",
  "SLACK_WEBHOOK_URL_PATIENT=",
  "SLACK_WEBHOOK_URL_HOSPITAL=",
  "SLACK_WEBHOOK_URL_INSURER=",
  "QLO_DATA_DIR=",
].join("\n");

const PENDING_ROWS: ReadonlyArray<CheckRow> = [
  { id: "health", label: "API health", level: "pending", detail: "Probing GET /api/health…", hint: "" },
  { id: "relay", label: "Relay state", level: "pending", detail: "Probing GET /api/relay/state…", hint: "" },
  { id: "chain", label: "Contracts on Sepolia", level: "pending", detail: "Reading deployment manifest…", hint: "" },
  { id: "slack", label: "Slack ChatOps", level: "pending", detail: "Probing GET /api/slack/status…", hint: "" },
];

async function getJson(url: string): Promise<{ ok: boolean; data: unknown }> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    const data: unknown = await res.json().catch(() => null);
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: null };
  }
}

function asRecord(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
}

async function runChecks(): Promise<CheckRow[]> {
  const [health, relay, slack] = await Promise.all([
    getJson("/api/health"),
    getJson("/api/relay/state"),
    getJson("/api/slack/status"),
  ]);

  const s = asRecord(slack.data);
  const hooks = asRecord(s.webhooks);
  const hookCount = ["patient", "hospital", "insurer"].filter((k) => hooks[k] === true).length;
  const slackReady = slack.ok && s.signingSecret === true && hookCount === 3;

  return [
    {
      id: "health",
      label: "API health",
      level: health.ok ? "green" : "red",
      detail: health.ok ? "GET /api/health ok" : "GET /api/health failed",
      hint: health.ok ? "" : "Start the web app (npm run dev in apps/web) and re-run.",
    },
    {
      id: "relay",
      label: "Relay state",
      level: relay.ok ? "green" : "red",
      detail: relay.ok ? "Relay reachable" : "GET /api/relay/state failed",
      hint: relay.ok ? "" : "Ensure QLO_DATA_DIR points to a writable directory.",
    },
    {
      id: "chain",
      label: "Contracts on Sepolia",
      level: IS_CHAIN_DEPLOYED ? "green" : "amber",
      detail: IS_CHAIN_DEPLOYED
        ? `Deployed on ${String(DEPLOYMENT.network)} (chain ${String(DEPLOYMENT.chainId)})`
        : "No deployment recorded",
      hint: IS_CHAIN_DEPLOYED
        ? ""
        : "Deploy contracts and refresh src/contracts/deployment.json; preview remains active.",
    },
    {
      id: "slack",
      label: "Slack ChatOps",
      level: slackReady ? "green" : "amber",
      detail: slack.ok
        ? `Signing secret ${s.signingSecret === true ? "set" : "missing"}; ${hookCount}/3 webhooks`
        : "Status endpoint unavailable",
      hint: slackReady
        ? ""
        : "Direct web channels active. Add SLACK_SIGNING_SECRET & webhook URLs below to mirror to your enterprise Slack workspace.",
    },
  ];
}

export function OnboardingChecks() {
  const [rows, setRows] = useState<ReadonlyArray<CheckRow> | null>(null);
  const [running, setRunning] = useState(true);
  const [envOpen, setEnvOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    setRunning(true);
    const nextRows = await runChecks();
    setRows(nextRows);
    setRunning(false);
  }, []);

  useEffect(() => {
    let alive = true;
    runChecks().then((nextRows) => {
      if (!alive) return;
      setRows(nextRows);
      setRunning(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  const handleCopyEnv = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(ENV_TEMPLATE);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }, []);

  const displayRows = rows ?? PENDING_ROWS;
  const okCount = rows ? rows.filter((r) => r.level === "green").length : 0;
  const failCount = rows ? rows.filter((r) => r.level === "red").length : 0;

  return (
    <section aria-label="Deployment telemetry self-check" className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-[#E4E4E7] bg-[#FAFAFA]">
        <div className="flex items-center justify-between border-b border-[#E4E4E7] bg-[#FFFFFF]/60 px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <span className="font-mono-tabular text-[11px] uppercase tracking-wider text-[#52525B]">
              Telemetry Probe
            </span>
            <span className="h-3 w-px bg-[#E4E4E7]" aria-hidden="true" />
            <span className="font-mono-tabular text-[11px] text-[#71717A]" aria-live="polite">
              {running
                ? "Checking endpoints…"
                : failCount > 0
                  ? `${okCount}/${displayRows.length} ok · ${failCount} failed`
                  : `${okCount}/${displayRows.length} operational`}
            </span>
          </div>

          <button
            type="button"
            onClick={refresh}
            disabled={running}
            aria-label="Re-run system checks"
            className="inline-flex items-center gap-1.5 rounded-md border border-[#E4E4E7] bg-[#FAFAFA] px-2.5 py-1 text-xs font-medium text-[#27272A] transition-colors hover:border-[#D4D4D8] hover:text-[#09090B] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-3 w-3 ${running ? "animate-spin text-[#059669]" : "text-[#71717A]"}`} />
            Re-run
          </button>
        </div>

        <ul role="list" className="divide-y divide-[#E4E4E7]">
          {displayRows.map((row) => {
            const showHint = (row.level === "amber" || row.level === "red") && Boolean(row.hint);
            return (
              <li
                key={row.id}
                className="grid grid-cols-1 gap-1.5 px-4 py-3 sm:grid-cols-[12px_180px_1fr_auto] sm:items-start sm:gap-4"
              >
                <span
                  aria-hidden="true"
                  className={`mt-1.5 hidden h-2 w-2 rounded-full sm:block ${DOT_CLASS[row.level]}`}
                />

                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 shrink-0 rounded-full sm:hidden ${DOT_CLASS[row.level]}`}
                  />
                  <span className="font-mono-tabular text-xs font-medium text-[#09090B]">
                    {row.label}
                  </span>
                </div>

                <div className="min-w-0">
                  <div className="font-mono-tabular text-xs text-[#52525B]">{row.detail}</div>
                  {showHint ? (
                    <p className="mt-1 text-[11px] leading-relaxed text-[#71717A]">
                      <span className="font-mono-tabular text-[#52525B]">Hint:</span> {row.hint}
                    </p>
                  ) : null}
                </div>

                <span
                  className={`hidden font-mono-tabular text-[10px] font-semibold tracking-wider sm:inline ${LEVEL_BADGE_CLASS[row.level]}`}
                >
                  {LEVEL_TEXT[row.level]}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E4E4E7] bg-[#FAFAFA]">
        <button
          type="button"
          onClick={() => setEnvOpen((prev) => !prev)}
          aria-expanded={envOpen}
          aria-controls="self-host-env-template"
          className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-[#FFFFFF]/60 cursor-pointer"
        >
          <span className="flex items-center gap-2 text-xs font-medium text-[#52525B]">
            <Terminal className="h-3.5 w-3.5 text-[#71717A]" />
            Self-host .env template
            <span className="font-mono-tabular text-[11px] text-[#71717A]">(optional)</span>
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 text-[#71717A] transition-transform duration-150 ${envOpen ? "rotate-180" : ""}`}
          />
        </button>

        {envOpen ? (
          <div id="self-host-env-template" className="border-t border-[#E4E4E7] bg-[#FAFAFA] p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-mono-tabular text-[11px] text-[#71717A]">
                apps/web/.env.local
              </span>
              <button
                type="button"
                onClick={handleCopyEnv}
                aria-label="Copy .env template"
                className="inline-flex items-center gap-1.5 rounded-md border border-[#E4E4E7] bg-[#FAFAFA] px-2.5 py-1 font-mono-tabular text-[11px] text-[#27272A] transition-colors hover:border-[#D4D4D8] hover:text-[#09090B] cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 text-[#059669]" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 text-[#71717A]" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <pre className="overflow-x-auto rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] p-3 font-mono-tabular text-xs leading-6 text-[#27272A]">
              <code>{ENV_TEMPLATE}</code>
            </pre>
          </div>
        ) : null}
      </div>
    </section>
  );
}
