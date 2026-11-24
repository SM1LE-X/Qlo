"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen, Code2, CornerDownLeft, Lock, Pause, Play,
  RotateCcw, ShieldCheck, SkipForward, SlidersHorizontal, Sparkles,
} from "lucide-react";
import { useActiveRole } from "@/components/role-context";
import type { RelayChainMirror } from "@/lib/relayStore";
import { ROLE_META, ROLE_ORDER, type AppRole } from "@/lib/roles";
import type { SlackBlockMessage, SlackRole } from "@/lib/slack/blocks";
import { runCommand } from "@/lib/slack/commands";
import { GENESIS_CHANNEL_FEED, buildFeed, type FeedItem } from "@/lib/slack/feed";
import { BlockRenderer } from "./block-renderer";
import { SlackLockWall } from "./slack-lock-wall";
import { STORY_BEATS } from "./story-script";
import { WireDiffDrawer } from "./wire-diff-drawer";

const POLL_MS = 4000;
const QUICK_COMMANDS: ReadonlyArray<string> = ["/qlo status", "/qlo claims", "/qlo help"];
const BEAT_LABELS: ReadonlyArray<string> = ["Intake", "Grant", "Proof", "Settled", "Excluded", "Replay", "Revoke"];
const ROLE_GATE_PILLS: Record<AppRole, string> = {
  patient: "Patient only",
  hospital: "Approved Hospital only",
  insurer: "Insurer Treasury only",
};
const RAIL_LINK_CLS = "flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-[#52525B] transition hover:border-[#E4E4E7] hover:bg-[#FFFFFF] hover:text-[#09090B]";

type Tab = "live" | "story";
interface LocalReply { id: string; channel: SlackRole; timestamp: string; message: SlackBlockMessage; }
interface InspectedState { message: SlackBlockMessage; channel: SlackRole; label: string; }

const isSlackRole = (v: string | null): v is SlackRole => v === "patient" || v === "hospital" || v === "insurer";

export function SlackWorkspace() {
  const { activeRole, activeMeta, mode, canAccess } = useActiveRole();
  const [tab, setTab] = useState<Tab>("live");
  const [channel, setChannel] = useState<SlackRole>("patient");
  const [chain, setChain] = useState<RelayChainMirror | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replies, setReplies] = useState<ReadonlyArray<LocalReply>>([]);
  const [input, setInput] = useState("");
  const [revealed, setRevealed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [inspected, setInspected] = useState<InspectedState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paramChannel = params.get("channel");
    if (isSlackRole(paramChannel)) setChannel(paramChannel);
    if (params.get("tab") === "story") {
      setTab("story");
      setRevealed(1);
      setPlaying(true);
      if (!isSlackRole(paramChannel) && STORY_BEATS[0]) setChannel(STORY_BEATS[0].channel);
    }
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
        if (!cancelled) setError(err instanceof Error ? err.message : "Chain state unavailable");
      }
    };
    void load();
    const id = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  useEffect(() => {
    if (!playing) return;
    if (revealed >= STORY_BEATS.length) { setPlaying(false); return; }
    const nextBeat = STORY_BEATS[revealed];
    if (!nextBeat) return;
    timer.current = setTimeout(() => { setChannel(nextBeat.channel); setRevealed((c) => c + 1); }, nextBeat.delayMs);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [playing, revealed]);

  const stepStory = useCallback(() => {
    const nextBeat = STORY_BEATS[revealed];
    if (!nextBeat) return;
    setPlaying(false);
    setChannel(nextBeat.channel);
    setRevealed((c) => Math.min(c + 1, STORY_BEATS.length));
  }, [revealed]);

  const jumpToBeat = useCallback((idx: number) => {
    const beat = STORY_BEATS[idx];
    if (!beat) return;
    if (timer.current) clearTimeout(timer.current);
    setPlaying(false);
    setRevealed((prev) => Math.max(prev, idx + 1));
    setChannel(beat.channel);
  }, []);

  const togglePlay = useCallback(() => {
    if (playing) return setPlaying(false);
    if (revealed >= STORY_BEATS.length || revealed === 0) {
      setRevealed(1);
      if (STORY_BEATS[0]) setChannel(STORY_BEATS[0].channel);
    }
    setPlaying(true);
  }, [playing, revealed]);

  const resetStory = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setPlaying(false);
    setRevealed(0);
  }, []);

  const handleSelectTab = useCallback((nextTab: Tab) => {
    setTab(nextTab);
    if (nextTab === "story" && revealed === 0 && STORY_BEATS[0]) {
      setRevealed(1);
      setChannel(STORY_BEATS[0].channel);
    }
  }, [revealed]);

  const liveFeed: ReadonlyArray<FeedItem> = useMemo(
    () => [...GENESIS_CHANNEL_FEED, ...(chain ? buildFeed(chain) : [])],
    [chain]
  );
  const storyFeed: ReadonlyArray<FeedItem> = useMemo(
    () => STORY_BEATS.slice(0, revealed).map((b, i) => ({
      id: b.id, channel: b.channel, timestamp: `Beat ${i + 1} · ${BEAT_LABELS[i] ?? b.id}`, message: b.message,
    })),
    [revealed]
  );

  const source = tab === "live" ? [...liveFeed, ...replies] : storyFeed;
  const visibleItems = source.filter((item) => item.channel === channel);
  const latestChannelItem = visibleItems.length > 0 ? visibleItems[visibleItems.length - 1] : null;
  const isLocked = tab === "live" && !canAccess(channel);
  const channelMeta = ROLE_META[channel];

  const executeSlashCommand = useCallback((rawText: string) => {
    const text = rawText.trim();
    if (!text || !chain || isLocked) return;
    const message: SlackBlockMessage = text.startsWith("/qlo")
      ? runCommand(text, chain)
      : { text: "Unknown input", blocks: [{ type: "section", text: { type: "mrkdwn", text: "Try `/qlo help`" } }] };
    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setReplies((prev) => [...prev, { id: `reply-${Date.now()}-${prev.length}`, channel, timestamp, message }]);
    setInput("");
  }, [chain, channel, isLocked]);

  const openInspector = (item: FeedItem | null) => {
    setInspected(item ? { message: item.message, channel: item.channel, label: item.timestamp } : null);
    setDrawerOpen(true);
  };

  return (
    <>
      <div aria-label="Qlo Slack desktop workspace" className="flex min-h-[640px] flex-col overflow-hidden rounded-2xl border border-[#E4E4E7] bg-[#FFFFFF] shadow-[0_1px_3px_rgba(9,9,11,0.06),0_12px_32px_rgba(9,9,11,0.04)] lg:grid lg:grid-cols-[56px_268px_minmax(0,1fr)]">
        {/* Zone 1: Workspace Rail (56px) */}
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

        {/* Zone 2: Channel Sidebar (236px) */}
        <nav aria-label="Private channels" className="flex flex-col justify-between border-b border-[#E4E4E7] bg-[#F4F4F5] lg:border-r lg:border-b-0">
          <div className="p-3">
            <div className="mb-4 border-b border-[#E4E4E7] pb-3">
              <p className="truncate text-[14px] font-semibold tracking-[-0.015em] text-[#09090B]">Qlo Clearinghouse</p>
              <p className="mt-1 flex items-center gap-1.5 font-mono-tabular text-[11px] text-[#52525B]">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#059669]" aria-hidden="true" />
                <span className="truncate">Sepolia 11155111 · Zero-PHI</span>
              </p>
            </div>
            <p className="mb-2 px-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#71717A]">PRIVATE CHANNELS</p>
            <div className="space-y-1">
              {ROLE_ORDER.map((roleId) => {
                const meta = ROLE_META[roleId];
                const isSelected = channel === roleId;
                const channelLocked = tab === "live" && !canAccess(roleId);
                const count = source.filter((item) => item.channel === roleId).length;
                return (
                  <button
                    key={roleId}
                    type="button"
                    onClick={() => setChannel(roleId)}
                    aria-current={isSelected ? "page" : undefined}
                    aria-label={`Private channel ${meta.channelName}${channelLocked ? " (Locked)" : ""}`}
                    className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left text-[13px] transition ${
                      isSelected ? "border-[#D4D4D8] bg-[#FFFFFF] font-medium text-[#09090B]" : "border-transparent text-[#52525B] hover:bg-[#FFFFFF] hover:text-[#18181B]"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2 whitespace-nowrap">
                      <Lock className="h-3.5 w-3.5 shrink-0" style={{ color: isSelected ? meta.accentHex : "#64748B" }} aria-hidden="true" />
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
              {mode === "wallet" ? "Sepolia Signer · Verified" : activeMeta.accountSubtitle}
            </p>
          </div>
        </nav>

        {/* Zone 3: Main Channel Pane */}
        <section aria-label={`${channelMeta.channelName} feed`} className="flex min-w-0 flex-1 flex-col bg-[#FFFFFF]">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E4E4E7] bg-[#FAFAFA]/85 px-4 py-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2.5">
              <span className="flex items-center gap-1.5 text-[14px] font-semibold tracking-[-0.015em] text-[#09090B]">
                <Lock className="h-3.5 w-3.5 shrink-0" style={{ color: channelMeta.accentHex }} aria-hidden="true" />
                <span>{channelMeta.channelName}</span>
              </span>
              <span className="rounded-full border border-[#D4D4D8] bg-[#FFFFFF] px-2.5 py-0.5 text-[11px] font-medium text-[#52525B]">{ROLE_GATE_PILLS[channel]}</span>
              <span className="inline-flex items-center gap-1.5 font-mono-tabular text-[11px] text-[#71717A]">
                <span className={`h-2 w-2 rounded-full ${isLocked ? "bg-[#F59E0B]" : "bg-[#059669]"}`} aria-hidden="true" />
                <span>{isLocked ? "Locked" : tab === "story" ? "Narrated" : "Authorized"}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div role="tablist" aria-label="Workspace mode" className="inline-flex rounded-lg border border-[#E4E4E7] bg-[#FFFFFF] p-0.5">
                {(["live", "story"] as const).map((modeTab) => (
                  <button key={modeTab} type="button" role="tab" aria-selected={tab === modeTab} onClick={() => handleSelectTab(modeTab)} className={`cursor-pointer rounded-md px-2.5 py-1 text-[12px] font-medium transition ${tab === modeTab ? "bg-[#FFFFFF] text-[#09090B] shadow-[0_1px_0_rgba(255,255,255,0.06)_inset]" : "text-[#52525B] hover:text-[#18181B]"}`}>
                    {modeTab === "live" ? "Live" : "Story mode"}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => openInspector(latestChannelItem)} aria-label="Inspect Wire payload" className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#D4D4D8] bg-[#FFFFFF] px-2.5 py-1.5 text-[12px] font-medium text-[#27272A] transition hover:border-[#A1A1AA] hover:text-[#09090B]">
                <Code2 className="h-3.5 w-3.5 text-[#059669]" aria-hidden="true" /><span>Inspect Wire</span>
              </button>
            </div>
          </header>

          {tab === "story" ? (
            <div aria-label="7-beat protocol story controls" className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#E4E4E7] bg-[#FAFAFA]/60 px-4 py-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                {STORY_BEATS.map((beat, idx) => {
                  const isRevealed = idx < revealed;
                  const isCurrent = idx === revealed - 1;
                  const dotColor = /rejected|revoked/i.test(beat.message.text) ? "#EF4444" : ROLE_META[beat.channel].accentHex;
                  return (
                    <button key={beat.id} type="button" onClick={() => jumpToBeat(idx)} aria-label={`Beat ${idx + 1}: ${BEAT_LABELS[idx]} in ${ROLE_META[beat.channel].channelName}`} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono-tabular text-[11px] transition ${isCurrent ? "border-[#D4D4D8] bg-[#FFFFFF] text-[#09090B]" : isRevealed ? "border-[#E4E4E7] bg-[#F4F4F5] text-[#52525B] hover:text-[#09090B]" : "border-transparent text-[#71717A] hover:border-[#E4E4E7] hover:text-[#52525B]"}`}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: isRevealed ? dotColor : "#334155" }} aria-hidden="true" />
                      <span>{idx + 1} {BEAT_LABELS[idx]}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={togglePlay} aria-label={playing ? "Pause story" : "Play story"} className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-[#059669]/45 bg-[#ECFDF5] px-2.5 py-1 text-[11.5px] font-medium text-[#059669] transition hover:bg-[#D1FAE5]">
                  {playing ? <Pause className="h-3 w-3" aria-hidden="true" /> : <Play className="h-3 w-3" aria-hidden="true" />}<span>{playing ? "Pause" : "Play"}</span>
                </button>
                <button type="button" onClick={stepStory} disabled={revealed >= STORY_BEATS.length} aria-label="Step to next beat" className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-[#D4D4D8] bg-[#FFFFFF] px-2 py-1 text-[11.5px] font-medium text-[#27272A] transition hover:text-[#09090B] disabled:cursor-not-allowed disabled:opacity-40">
                  <SkipForward className="h-3 w-3" aria-hidden="true" /><span>Step</span>
                </button>
                <button type="button" onClick={resetStory} aria-label="Reset story" className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-[#E4E4E7] bg-[#FFFFFF] px-2 py-1 text-[11.5px] font-medium text-[#52525B] transition hover:text-[#09090B]">
                  <RotateCcw className="h-3 w-3" aria-hidden="true" /><span>Reset</span>
                </button>
              </div>
            </div>
          ) : null}

          {isLocked ? (
            <SlackLockWall channel={channel} />
          ) : (
            <div className="flex-1 space-y-1 overflow-y-auto px-4 py-4" aria-live="polite">
              {tab === "live" && error ? (
                <div className="mb-3 rounded-lg border border-[#DC2626]/35 bg-[#FEF2F2] px-3 py-2 text-[12px] text-[#DC2626]">Relay feed unavailable: {error}</div>
              ) : null}

              {visibleItems.length === 0 ? (
                <div className="flex h-full min-h-[340px] flex-col items-center justify-center text-center">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-[#E4E4E7] bg-[#FFFFFF]">
                    <ShieldCheck className="h-5 w-5" style={{ color: channelMeta.accentHex }} aria-hidden="true" />
                  </div>
                  <p className="text-[14px] font-medium text-[#18181B]">
                    {tab === "story" ? `Ready to narrate ${channelMeta.channelName}` : `No events in ${channelMeta.channelName} yet`}
                  </p>
                  <p className="mt-1 max-w-sm text-[12.5px] leading-relaxed text-[#71717A]">
                    {tab === "story"
                      ? "Press Play or Step above to watch the 7-beat Zero-PHI clearinghouse handoff unfold across roles."
                      : `Run a /qlo command below, perform an action as ${ROLE_META[activeRole].label}, or switch to Story mode.`}
                  </p>
                  {tab === "story" ? (
                    <button type="button" onClick={togglePlay} className="mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#059669]/50 bg-[#ECFDF5] px-3.5 py-1.5 text-[12px] font-medium text-[#059669] transition hover:bg-[#D1FAE5]">
                      <Play className="h-3.5 w-3.5" aria-hidden="true" /><span>Play 7-Beat Protocol</span>
                    </button>
                  ) : null}
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
                          <span className="rounded border border-[#D4D4D8] bg-[#FFFFFF] px-1.5 py-0.5 font-mono-tabular text-[9.5px] font-semibold uppercase tracking-wider text-[#52525B]">APP</span>
                          <span className="font-mono-tabular text-[11px] text-[#71717A]">{item.timestamp}</span>
                          {tab === "story" ? (
                            <span className="rounded-full border px-2 py-0.5 text-[10.5px] font-medium" style={{ borderColor: `${roleInfo.accentHex}44`, backgroundColor: `${roleInfo.accentHex}16`, color: roleInfo.accentHex }}>{roleInfo.label}</span>
                          ) : null}
                        </div>
                        <BlockRenderer message={item.message} accentHex={roleInfo.accentHex} />
                      </div>
                      <div className="absolute top-2 right-2 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
                        <button type="button" onClick={() => openInspector(item)} className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-[#D4D4D8] bg-[#FFFFFF] px-2 py-1 text-[11px] font-medium text-[#27272A] shadow-sm transition hover:border-[#A1A1AA] hover:text-[#09090B]">
                          <Code2 className="h-3 w-3 text-[#059669]" aria-hidden="true" /><span>Inspect Wire</span>
                        </button>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          )}

          <div className="border-t border-[#E4E4E7] bg-[#FAFAFA]/80 px-4 py-3">
            {tab === "live" && !isLocked ? (
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-[11px] text-[#71717A]"><Sparkles className="h-3 w-3" aria-hidden="true" />Quick commands:</span>
                {QUICK_COMMANDS.map((cmd) => (
                  <button key={cmd} type="button" disabled={!chain} onClick={() => executeSlashCommand(cmd)} className="cursor-pointer rounded-md border border-[#E4E4E7] bg-[#FFFFFF] px-2 py-0.5 font-mono-tabular text-[11px] text-[#27272A] transition hover:border-[#D4D4D8] hover:text-[#059669] disabled:cursor-not-allowed disabled:opacity-40">{cmd}</button>
                ))}
              </div>
            ) : null}

            <form onSubmit={(e) => { e.preventDefault(); executeSlashCommand(input); }} className="relative flex items-center">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={tab === "story" || isLocked}
                aria-label={`Message ${channelMeta.channelName}`}
                placeholder={
                  isLocked
                    ? `Access restricted — sign in as ${channelMeta.accountName} to post in ${channelMeta.channelName}`
                    : tab === "story"
                      ? "Protocol walkthrough active — switch to Live to run /qlo slash commands"
                      : "/qlo status | claims | audit <n> | help"
                }
                className="w-full rounded-xl border border-[#E4E4E7] bg-[#FFFFFF] py-2.5 pr-11 pl-3.5 text-[13px] text-[#09090B] placeholder:text-[#71717A] focus:border-[#D4D4D8] focus:outline-none disabled:cursor-not-allowed disabled:opacity-55"
              />
              <button type="submit" disabled={tab === "story" || isLocked || !input.trim() || !chain} aria-label="Send slash command" className="absolute right-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-[#D4D4D8] bg-[#F4F4F5] text-[#27272A] transition hover:border-[#059669]/60 hover:text-[#059669] disabled:cursor-not-allowed disabled:opacity-35">
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
