"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Code2, CornerDownLeft, Lock, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { useActiveRole } from "@/components/role-context";
import type { RelayChainMirror } from "@/lib/relayStore";
import { ROLE_META, ROLE_ORDER, type AppRole } from "@/lib/roles";
import type { SlackBlockMessage, SlackRole } from "@/lib/slack/blocks";
import { runCommand } from "@/lib/slack/commands";
import { GENESIS_CHANNEL_FEED, buildFeed, type FeedItem } from "@/lib/slack/feed";
import { BlockRenderer } from "./block-renderer";
import { SlackLockWall } from "./slack-lock-wall";
import { WireDiffDrawer } from "./wire-diff-drawer";

const POLL_MS = 4000;
const QUICK_COMMANDS: ReadonlyArray<string> = ["/qlo status", "/qlo claims", "/qlo help"];
const ROLE_GATE_PILLS: Record<AppRole, string> = {
  patient: "Patient only",
  hospital: "Approved Hospital only",
  insurer: "Insurer Treasury only",
};
const RAIL_LINK_CLS =
  "flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-[#52525B] transition hover:border-[#E4E4E7] hover:bg-[#FFFFFF] hover:text-[#09090B]";

interface LocalReply {
  id: string;
  channel: SlackRole;
  timestamp: string;
  message: SlackBlockMessage;
}

interface InspectedState {
  message: SlackBlockMessage;
  channel: SlackRole;
  label: string;
}

const isSlackRole = (v: string | null): v is SlackRole =>
  v === "patient" || v === "hospital" || v === "insurer";

export function SlackWorkspace() {
  const { activeRole, activeMeta, mode, canAccess } = useActiveRole();
  const [channel, setChannel] = useState<SlackRole>("patient");
  const [chain, setChain] = useState<RelayChainMirror | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replies, setReplies] = useState<ReadonlyArray<LocalReply>>([]);
  const [input, setInput] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [inspected, setInspected] = useState<InspectedState | null>(null);

  useEffect(() => {
    const paramChannel = new URLSearchParams(window.location.search).get("channel");
    if (isSlackRole(paramChannel)) setChannel(paramChannel);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/relay/state", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as RelayChainMirror;
        if (!cancelled) { setChain(data); setError(null); }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Feed unavailable");
      }
    };
    void load();
    const id = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const liveFeed = useMemo<ReadonlyArray<FeedItem>>(
    () => [...GENESIS_CHANNEL_FEED, ...(chain ? buildFeed(chain) : [])],
    [chain]
  );
  const source = useMemo(() => [...liveFeed, ...replies], [liveFeed, replies]);
  const visibleItems = useMemo(() => source.filter((item) => item.channel === channel), [source, channel]);
  const latestChannelItem = visibleItems.length > 0 ? visibleItems[visibleItems.length - 1] : null;
  const isLocked = !canAccess(channel);
  const channelMeta = ROLE_META[channel];

  const executeSlashCommand = useCallback(
    (rawText: string) => {
      const text = rawText.trim();
      if (!text || !chain || isLocked) return;
      const message: SlackBlockMessage = text.startsWith("/qlo")
        ? runCommand(text, chain)
        : { text: "Unknown command", blocks: [{ type: "section", text: { type: "mrkdwn", text: "Try `/qlo help`" } }] };
      const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setReplies((prev) => [...prev, { id: `reply-${Date.now()}-${prev.length}`, channel, timestamp, message }]);
      setInput("");
    },
    [chain, channel, isLocked]
  );

  const openInspector = (item: FeedItem | null) => {
    setInspected(item ? { message: item.message, channel: item.channel, label: item.timestamp } : null);
    setDrawerOpen(true);
  };

  return (
    <>
      <div
        aria-label="Qlo Slack desktop workspace"
        className="flex min-h-[640px] flex-col overflow-hidden rounded-2xl border border-[#E4E4E7] bg-[#FFFFFF] shadow-[0_1px_3px_rgba(9,9,11,0.06),0_12px_32px_rgba(9,9,11,0.04)] lg:grid lg:grid-cols-[56px_268px_minmax(0,1fr)]"
      >
        <aside aria-label="Workspace navigation" className="flex items-center justify-between gap-2 border-b border-[#E4E4E7] bg-[#FAFAFA] px-3 py-2.5 lg:flex-col lg:border-r lg:border-b-0 lg:px-0 lg:py-3.5">
          <div className="flex items-center gap-2.5 lg:flex-col">
            <div title="Qlo Clearinghouse Workspace" className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[#09090B] bg-[#09090B] font-mono-tabular text-[14px] font-bold text-white">
              Q<span aria-hidden="true" className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#FFFFFF] bg-[#059669]" />
            </div>
            <div className="h-5 w-px bg-[#E4E4E7] lg:my-1 lg:h-px lg:w-6" aria-hidden="true" />
            <Link href="/onboarding" title="Role Sign-In" aria-label="Role Sign-In" className={RAIL_LINK_CLS}>
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/story" title="Protocol" aria-label="Protocol" className={RAIL_LINK_CLS}>
              <BookOpen className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div
            title={`${activeMeta.accountName} · ${activeMeta.accountSubtitle}`}
            aria-label={`Signed in as ${activeMeta.accountName}`}
            className="flex h-8 w-8 items-center justify-center rounded-full border font-mono-tabular text-[12px] font-bold text-white"
            style={{ backgroundColor: activeMeta.accentHex, borderColor: `${activeMeta.accentHex}88` }}
          >
            {activeMeta.accountName.charAt(0)}
          </div>
        </aside>

        <nav aria-label="Private channels" className="flex flex-col justify-between border-b border-[#E4E4E7] bg-[#F4F4F5] lg:border-r lg:border-b-0">
          <div className="p-3">
            <div className="mb-4 border-b border-[#E4E4E7] pb-3">
              <p className="truncate text-[14px] font-semibold tracking-[-0.015em] text-[#09090B]">Qlo Clearinghouse</p>
              <p className="mt-1 flex items-center gap-1.5 font-mono-tabular text-[11px] text-[#52525B]">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#059669]" aria-hidden="true" />
                <span className="truncate">Sepolia · 0 PHI</span>
              </p>
            </div>
            <p className="mb-2 px-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#71717A]">Private channels</p>
            <div className="space-y-1">
              {ROLE_ORDER.map((roleId) => {
                const meta = ROLE_META[roleId];
                const isSelected = channel === roleId;
                const channelLocked = !canAccess(roleId);
                const count = source.filter((item) => item.channel === roleId).length;
                return (
                  <button
                    key={roleId}
                    type="button"
                    onClick={() => setChannel(roleId)}
                    aria-current={isSelected ? "page" : undefined}
                    aria-label={`Private channel ${meta.channelName}${channelLocked ? " (Locked)" : ""}`}
                    className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left text-[13px] transition ${
                      isSelected ? "border-[#D4D4D8] bg-[#FFFFFF] font-medium text-[#09090B]" : "border-transparent text-[#52525B] hover:bg-[#FFFFFF] hover:text-[#09090B]"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2 whitespace-nowrap">
                      <Lock className="h-3.5 w-3.5 shrink-0" style={{ color: isSelected ? meta.accentHex : "#71717A" }} aria-hidden="true" />
                      <span className="truncate">{meta.channelName}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {channelLocked ? <span className="rounded border border-[#D4D4D8] bg-[#FAFAFA] px-1.5 py-0.5 font-mono-tabular text-[10px] text-[#71717A]">Locked</span> : null}
                      {count > 0 ? (
                        <span className="rounded px-1.5 py-0.5 font-mono-tabular text-[10px] font-semibold" style={{ backgroundColor: isSelected ? `${meta.accentHex}1A` : "#E4E4E7", color: isSelected ? meta.accentHex : "#52525B" }}>
                          {count}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="border-t border-[#E4E4E7] bg-[#F4F4F5] px-3.5 py-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: activeMeta.accentHex }} aria-hidden="true" />
              <span className="truncate text-[12px] font-medium text-[#09090B]">{activeMeta.accountName}</span>
            </div>
            <p className="mt-1 truncate pl-4 font-mono-tabular text-[10.5px] text-[#71717A]">
              {mode === "wallet" ? "Sepolia signer" : activeMeta.accountSubtitle}
            </p>
          </div>
        </nav>

        <section aria-label={`${channelMeta.channelName} feed`} className="flex min-w-0 flex-1 flex-col bg-[#FFFFFF]">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E4E4E7] bg-[#FAFAFA]/85 px-4 py-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2.5">
              <span className="flex items-center gap-1.5 text-[14px] font-semibold tracking-[-0.015em] text-[#09090B]">
                <Lock className="h-3.5 w-3.5 shrink-0" style={{ color: channelMeta.accentHex }} aria-hidden="true" />
                <span>{channelMeta.channelName}</span>
              </span>
              <span className="rounded-full border border-[#E4E4E7] bg-[#FFFFFF] px-2.5 py-0.5 text-[11px] font-medium text-[#52525B]">{ROLE_GATE_PILLS[channel]}</span>
              <span className="inline-flex items-center gap-1.5 font-mono-tabular text-[11px] text-[#71717A]">
                <span className={`h-2 w-2 rounded-full ${isLocked ? "bg-[#D97706]" : "bg-[#059669]"}`} aria-hidden="true" />
                <span>{isLocked ? "Locked" : "Authorized"}</span>
              </span>
            </div>
            <button type="button" onClick={() => openInspector(latestChannelItem)} aria-label="Inspect wire payload" className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#E4E4E7] bg-[#FFFFFF] px-2.5 py-1.5 text-[12px] font-medium text-[#09090B] transition hover:border-[#D4D4D8] hover:bg-[#F4F4F5]">
              <Code2 className="h-3.5 w-3.5 text-[#059669]" aria-hidden="true" /><span>Wire payload</span>
            </button>
          </header>

          {isLocked ? (
            <SlackLockWall channel={channel} />
          ) : (
            <div className="flex-1 space-y-1 overflow-y-auto px-4 py-4" aria-live="polite">
              {error ? <div className="mb-3 rounded-lg border border-[#DC2626]/30 bg-[#FEF2F2] px-3 py-2 text-[12px] text-[#DC2626]">Relay feed unavailable: {error}</div> : null}
              {visibleItems.length === 0 ? (
                <div className="flex h-full min-h-[340px] flex-col items-center justify-center text-center">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-[#E4E4E7] bg-[#FFFFFF]">
                    <ShieldCheck className="h-5 w-5" style={{ color: channelMeta.accentHex }} aria-hidden="true" />
                  </div>
                  <p className="text-[14px] font-medium text-[#09090B]">No events in {channelMeta.channelName}</p>
                  <p className="mt-1 max-w-sm text-[12.5px] text-[#71717A]">
                    Run a /qlo command below or complete an action as {ROLE_META[activeRole].label}.
                  </p>
                </div>
              ) : (
                visibleItems.map((item) => {
                  const roleInfo = ROLE_META[item.channel];
                  return (
                    <article key={item.id} className="group relative flex gap-3 rounded-xl px-2.5 py-2.5 transition hover:bg-[#F4F4F5]">
                      <div aria-hidden="true" className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#09090B] bg-[#09090B] font-mono-tabular text-[13px] font-bold text-white">Q</div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13.5px] font-semibold text-[#09090B]">Qlo</span>
                          <span className="rounded border border-[#E4E4E7] bg-[#FFFFFF] px-1.5 py-0.5 font-mono-tabular text-[9.5px] font-semibold uppercase tracking-wider text-[#52525B]">APP</span>
                          <span className="font-mono-tabular text-[11px] text-[#71717A]">{item.timestamp}</span>
                        </div>
                        <BlockRenderer message={item.message} accentHex={roleInfo.accentHex} />
                      </div>
                      <div className="absolute top-2 right-2 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
                        <button type="button" onClick={() => openInspector(item)} className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-[#E4E4E7] bg-[#FFFFFF] px-2 py-1 text-[11px] font-medium text-[#09090B] shadow-sm transition hover:border-[#D4D4D8]">
                          <Code2 className="h-3 w-3 text-[#059669]" aria-hidden="true" /><span>Wire payload</span>
                        </button>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          )}

          <div className="border-t border-[#E4E4E7] bg-[#FAFAFA]/80 px-4 py-3">
            {!isLocked ? (
              <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] text-[#71717A]">
                <span>Commands:</span>
                {QUICK_COMMANDS.map((cmd, idx) => (
                  <span key={cmd} className="inline-flex items-center gap-1.5">
                    {idx > 0 ? <span aria-hidden="true">·</span> : null}
                    <button type="button" disabled={!chain} onClick={() => executeSlashCommand(cmd)} className="cursor-pointer font-mono-tabular text-[#52525B] transition hover:text-[#09090B] disabled:cursor-not-allowed disabled:opacity-40">
                      {cmd}
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <form onSubmit={(e) => { e.preventDefault(); executeSlashCommand(input); }} className="relative flex items-center">
              <label htmlFor="slack-command-input" className="sr-only">Message {channelMeta.channelName}</label>
              <input
                id="slack-command-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLocked}
                aria-label={`Message ${channelMeta.channelName}`}
                placeholder={isLocked ? `Restricted — sign in as ${channelMeta.accountName}` : "/qlo status · /qlo claims · /qlo help"}
                className="w-full rounded-xl border border-[#E4E4E7] bg-[#FFFFFF] py-2.5 pr-11 pl-3.5 text-[13px] text-[#09090B] placeholder:text-[#71717A] focus:border-[#09090B] focus:outline-none disabled:cursor-not-allowed disabled:opacity-55"
              />
              <button type="submit" disabled={isLocked || !input.trim() || !chain} aria-label="Send slash command" className="absolute right-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-[#E4E4E7] bg-[#F4F4F5] text-[#09090B] transition hover:border-[#09090B] disabled:cursor-not-allowed disabled:opacity-35">
                <CornerDownLeft className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </form>
          </div>
        </section>
      </div>

      <WireDiffDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        message={inspected?.message ?? latestChannelItem?.message ?? null}
        channel={inspected?.channel ?? channel}
        messageLabel={inspected?.label ?? latestChannelItem?.timestamp}
      />
    </>
  );
}
