"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Lock, Play, ShieldCheck, Unlock, Wallet } from "lucide-react";
import { useConnect, useDisconnect } from "wagmi";
import { OnboardingChecks } from "@/components/onboarding/checks";
import { useActiveRole } from "@/components/role-context";
import { ROLE_META, ROLE_ORDER, type AppRole, type RoleMeta } from "@/lib/roles";
import { connectInjectedWallet, type WalletRolesState } from "@/lib/useWalletRoles";
import { shortHex } from "@/lib/utils";

const STEPS = [
  { index: 0, code: "01", label: "Role" },
  { index: 1, code: "02", label: "Identity" },
  { index: 2, code: "03", label: "System" },
  { index: 3, code: "04", label: "Enter" },
] as const;

const ACCOUNT_SESSION_POINTS = [
  "Verified Sepolia registry credentials",
  "Local AES-256-GCM vault and OCR",
  "Role-scoped channel access",
] as const;

const PRIMARY_BTN = "inline-flex items-center gap-1.5 rounded-lg bg-[#09090B] px-4 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer";
const GHOST_LINK = "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-[#52525B] transition-colors hover:bg-[#FFFFFF] hover:text-[#09090B]";

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable);
}

function StepHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="space-y-1.5">
      <h1 className="text-2xl font-semibold tracking-tight text-[#09090B]">{title}</h1>
      <p className="text-sm text-[#52525B]">{subtitle}</p>
    </div>
  );
}

function BoundaryRow({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <span className="flex items-center gap-2 text-xs font-medium text-[#27272A]">{icon} {label}</span>
      <div className="flex flex-wrap items-center gap-2 font-mono-tabular text-xs">{children}</div>
    </div>
  );
}

export function OnboardingWizard() {
  const [step, setStep] = useState(0);
  const { activeRole, activeMeta, mode, walletRoles, setActiveRole, canAccess } = useActiveRole();
  const { connectors, connectAsync, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();

  const goNext = useCallback(() => setStep((s) => Math.min(STEPS.length - 1, s + 1)), []);
  const goBack = useCallback(() => setStep((s) => Math.max(0, s - 1)), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
      if (event.key === "ArrowRight") { event.preventDefault(); goNext(); }
      else if (event.key === "ArrowLeft") { event.preventDefault(); goBack(); }
      else if (step === 0 && (event.key === "1" || event.key === "2" || event.key === "3")) {
        const picked = ROLE_ORDER[Number(event.key) - 1];
        if (picked) { event.preventDefault(); setActiveRole(picked); }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [step, goNext, goBack, setActiveRole]);

  const handleConnect = useCallback(() => { void connectInjectedWallet(connectors, connectAsync); }, [connectors, connectAsync]);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="overflow-hidden rounded-2xl border border-[#E4E4E7] bg-[#FAFAFA]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E4E4E7] bg-[#FAFAFA] px-4 py-3 sm:px-6">
          <nav aria-label="Onboarding steps" className="flex items-center gap-1 sm:gap-2">
            {STEPS.map((item, idx) => {
              const current = step === item.index;
              const done = step > item.index;
              const cls = current
                ? "bg-[#ECFDF5] text-[#059669] ring-1 ring-inset ring-[#059669]/35"
                : done ? "text-[#27272A] hover:bg-[#FFFFFF]" : "text-[#71717A] hover:bg-[#FFFFFF] hover:text-[#52525B]";
              return (
                <div key={item.code} className="flex items-center gap-1 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(item.index)}
                    aria-current={current ? "step" : undefined}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors cursor-pointer ${cls}`}
                  >
                    {done ? <Check className="h-3 w-3 text-[#059669]" aria-hidden="true" /> : <span className="font-mono-tabular text-[11px]">{item.code}</span>}
                    <span className="font-medium">{item.label}</span>
                  </button>
                  {idx < STEPS.length - 1 ? <span aria-hidden="true" className="h-px w-3 bg-[#E4E4E7] sm:w-5" /> : null}
                </div>
              );
            })}
          </nav>
          <Link href="/slack?tab=story" className={GHOST_LINK}>
            <Play className="h-3 w-3 text-[#059669]" aria-hidden="true" /> Walkthrough
          </Link>
        </header>

        <div className="min-h-[440px] px-5 py-7 sm:px-8 sm:py-9">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.14, ease: "easeOut" }}
            >
              {step === 0 ? <StepRole activeRole={activeRole} onSelect={setActiveRole} /> : null}
              {step === 1 ? (
                <StepIdentity mode={mode} walletRoles={walletRoles} isConnecting={isConnecting} onConnect={handleConnect} onDisconnect={() => disconnect()} />
              ) : null}
              {step === 2 ? (
                <div className="space-y-6">
                  <StepHeading title="System status" subtitle="Live API, relay, and Sepolia contract checks." />
                  <OnboardingChecks />
                </div>
              ) : null}
              {step === 3 ? (
                <StepEnter activeRole={activeRole} activeMeta={activeMeta} mode={mode} walletAddress={walletRoles.address} canAccess={canAccess} />
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>

        <footer className="flex items-center justify-between gap-4 border-t border-[#E4E4E7] bg-[#FAFAFA] px-5 py-3.5 sm:px-8">
          <button
            type="button"
            onClick={goBack}
            disabled={step === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] px-3.5 py-1.5 text-xs font-medium text-[#27272A] transition-colors hover:border-[#D4D4D8] hover:text-[#09090B] disabled:cursor-not-allowed disabled:opacity-35 cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back
          </button>
          <div className="flex items-center gap-3 font-mono-tabular">
            <span className="text-xs text-[#52525B]">Step {step + 1} of {STEPS.length}</span>
            <span className="hidden text-[11px] text-[#71717A] sm:inline">{step === 0 ? "· Keys 1-3, ← →" : "· Keys ← →"}</span>
          </div>
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={goNext} className={PRIMARY_BTN}>
              Continue <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : (
            <Link href={`/slack?channel=${activeRole}`} className={PRIMARY_BTN}>
              Enter {activeMeta.channelName} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          )}
        </footer>
      </div>
    </div>
  );
}

function StepRole({ activeRole, onSelect }: { activeRole: AppRole; onSelect: (role: AppRole) => void }) {
  const selected = ROLE_META[activeRole];
  return (
    <div className="space-y-6">
      <StepHeading title="Sign in" subtitle="Select an account. Access is scoped by role." />

      <div role="radiogroup" aria-label="Clearinghouse role" className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {ROLE_ORDER.map((roleId, idx) => {
          const meta = ROLE_META[roleId];
          const isSelected = roleId === activeRole;
          return (
            <button
              key={roleId}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(roleId)}
              style={{ borderColor: isSelected ? `${meta.accentHex}75` : undefined }}
              className={`flex flex-col justify-between rounded-xl border p-4 text-left transition-colors cursor-pointer ${
                isSelected ? "bg-[#FFFFFF]" : "border-[#E4E4E7] bg-[#FAFAFA] hover:border-[#D4D4D8] hover:bg-[#FFFFFF]/60"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-semibold text-[#09090B]">
                  <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.accentHex }} />
                  {meta.accountName}
                </span>
                <kbd className="rounded border border-[#E4E4E7] bg-[#FAFAFA] px-1.5 py-0.5 font-mono-tabular text-[10px] text-[#71717A]">{idx + 1}</kbd>
              </div>
              <div className="mt-3 space-y-1">
                <div className="text-xs text-[#52525B]">{meta.accountSubtitle}</div>
                <div className="flex items-center justify-between gap-2 font-mono-tabular text-[11px]">
                  <span style={{ color: isSelected ? meta.accentHex : "#64748B" }}>{meta.channelName}</span>
                  <span className="text-[#71717A]">{shortHex(meta.accountAddress, 6, 4)}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E4E4E7] bg-[#FAFAFA]">
        <div className="flex items-center justify-between border-b border-[#E4E4E7] bg-[#FFFFFF]/50 px-4 py-2 font-mono-tabular text-[11px]">
          <span className="uppercase tracking-wider text-[#52525B]">Access scope</span>
          <span style={{ color: selected.accentHex }}>{selected.channelName}</span>
        </div>
        <div className="grid grid-cols-1 divide-y divide-[#E4E4E7] md:grid-cols-2 md:divide-x md:divide-y-0">
          <div className="space-y-3 p-4 sm:p-5">
            <div className="font-mono-tabular text-[11px] font-semibold uppercase tracking-wider text-[#059669]">Allowed</div>
            <ul className="space-y-2.5">
              {selected.canSee.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-xs leading-relaxed text-[#27272A]">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#059669]" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col justify-between gap-4 p-4 sm:p-5">
            <div className="space-y-3">
              <div className="font-mono-tabular text-[11px] font-semibold uppercase tracking-wider text-[#71717A]">Hidden</div>
              <ul className="space-y-2.5">
                {selected.hiddenFromRole.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-xs leading-relaxed text-[#52525B]">
                    <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#71717A]" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] px-3 py-2 font-mono-tabular">
              <div className="text-[10px] uppercase tracking-wider text-[#71717A]">Contract Gate</div>
              <div className="mt-0.5 break-all text-xs text-[#27272A]">{selected.contractGate}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepIdentity({
  mode, walletRoles, isConnecting, onConnect, onDisconnect,
}: {
  mode: "wallet" | "sandbox"; walletRoles: WalletRolesState; isConnecting: boolean;
  onConnect: () => void; onDisconnect: () => void;
}) {
  const isSandbox = mode === "sandbox";
  const badges = [
    { label: "Patient", active: walletRoles.isPatient, accent: "#10B981" },
    { label: "Hospital", active: walletRoles.isApprovedHospital, accent: "#38BDF8" },
    { label: "Insurer", active: walletRoles.isInsurer, accent: "#F59E0B" },
  ];
  const cardCls = (active: boolean) => `flex flex-col justify-between rounded-xl border p-5 transition-colors ${active ? "border-[#059669]/50 bg-[#FFFFFF]" : "border-[#E4E4E7] bg-[#FAFAFA]"}`;
  const pillCls = (active: boolean) => `rounded-full border px-2 py-0.5 font-mono-tabular text-[10px] uppercase tracking-wider ${active ? "border-[#059669]/40 bg-[#ECFDF5] text-[#059669]" : "border-[#E4E4E7] text-[#71717A]"}`;

  return (
    <div className="space-y-6">
      <StepHeading title="Signing method" subtitle="Use an authenticated role session or connect MetaMask on Sepolia." />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <article className={cardCls(isSandbox)}>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-[#09090B]">
                <ShieldCheck className="h-4 w-4 text-[#059669]" aria-hidden="true" /> Role Session
              </h2>
              <span className={pillCls(isSandbox)}>{isSandbox ? "Active" : "Available"}</span>
            </div>
            <p className="text-xs leading-relaxed text-[#52525B]">Scoped account session backed by the Sepolia registry.</p>
            <ul className="space-y-2 border-t border-[#E4E4E7] pt-3.5 text-xs text-[#27272A]">
              {ACCOUNT_SESSION_POINTS.map((point) => (
                <li key={point} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#059669]" aria-hidden="true" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-5 border-t border-[#E4E4E7] pt-3.5">
            {isSandbox ? (
              <span className="font-mono-tabular text-[11px] text-[#059669]">Authenticated — Role session active</span>
            ) : (
              <button type="button" onClick={onDisconnect} className="rounded-lg border border-[#D4D4D8] bg-[#FAFAFA] px-3 py-1.5 text-xs font-medium text-[#27272A] transition-colors hover:border-[#94A3B8]/50 hover:text-[#09090B] cursor-pointer">
                Disconnect wallet to use Role Session
              </button>
            )}
          </div>
        </article>

        <article className={cardCls(!isSandbox)}>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-[#09090B]">
                <Wallet className="h-4 w-4 text-[#0284C7]" aria-hidden="true" /> Ethereum Sepolia Wallet
              </h2>
              <span className={pillCls(!isSandbox)}>{!isSandbox ? "Connected" : "Live On-Chain"}</span>
            </div>
            {walletRoles.isConnected && walletRoles.address ? (
              <div className="space-y-2.5 rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] p-3.5 font-mono-tabular">
                <div className="flex items-center justify-between text-xs"><span className="text-[11px] text-[#71717A]">Signer</span><span className="font-medium text-[#09090B]">{shortHex(walletRoles.address)}</span></div>
                <div className="flex items-center justify-between text-xs"><span className="text-[11px] text-[#71717A]">Balance</span><span className="text-[#27272A]">{walletRoles.balanceEth ?? "0.0000"} ETH</span></div>
                <div className="border-t border-[#E4E4E7] pt-2.5">
                  <div className="mb-1.5 text-[10px] uppercase tracking-wider text-[#71717A]">Verified On-Chain Roles</div>
                  <div className="flex flex-wrap gap-1.5">
                    {badges.map((b) => (
                      <span key={b.label} className={`inline-flex items-center gap-1 rounded border border-[#E4E4E7] px-2 py-0.5 text-[11px] ${b.active ? "bg-[#FFFFFF] text-[#09090B]" : "text-[#71717A]"}`}>
                        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: b.active ? b.accent : "#334155" }} />
                        {b.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs leading-relaxed text-[#52525B]">Connect MetaMask on Ethereum Sepolia (Chain ID 11155111) to sign live Groth16 claim settlements and revocations.</p>
                <button
                  type="button"
                  onClick={onConnect}
                  disabled={isConnecting}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#D4D4D8] bg-[#FFFFFF] px-4 py-2 text-xs font-semibold text-[#09090B] transition-colors hover:border-[#059669]/60 hover:bg-[#F4F4F5] disabled:opacity-50 cursor-pointer"
                >
                  <Wallet className="h-3.5 w-3.5 text-[#059669]" aria-hidden="true" />
                  {isConnecting ? "Connecting MetaMask…" : "Connect MetaMask"}
                </button>
              </div>
            )}
            <p className="text-[11px] leading-relaxed text-[#71717A]">
              On-chain settlement (<code className="font-mono-tabular text-[#52525B]">submitClaim</code>) and revocation (<code className="font-mono-tabular text-[#52525B]">revokeAccess</code>) bind strictly to the signer&apos;s wallet.
            </p>
          </div>
          {walletRoles.isConnected ? (
            <div className="mt-5 flex items-center justify-between gap-2 border-t border-[#E4E4E7] pt-3.5">
              {walletRoles.wrongChain ? (
                <button type="button" onClick={() => void walletRoles.switchToSepolia()} className="rounded-md border border-[#F59E0B]/40 bg-[#FFFBEB] px-2.5 py-1 font-mono-tabular text-[11px] text-[#B45309] hover:bg-[#FEF3C7] cursor-pointer">Switch to Sepolia</button>
              ) : (
                <span className="font-mono-tabular text-[11px] text-[#059669]">Sepolia signer bound</span>
              )}
              <button type="button" onClick={onDisconnect} className="text-xs text-[#71717A] transition-colors hover:text-[#27272A] cursor-pointer">Disconnect</button>
            </div>
          ) : null}
        </article>
      </div>
    </div>
  );
}

function StepEnter({
  activeRole, activeMeta, mode, walletAddress, canAccess,
}: {
  activeRole: AppRole; activeMeta: RoleMeta; mode: "wallet" | "sandbox";
  walletAddress: `0x${string}` | undefined; canAccess: (target: AppRole) => boolean;
}) {
  const lockedChannels = ROLE_ORDER.filter((id) => id !== activeRole);
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 font-mono-tabular text-[11px] uppercase tracking-wider text-[#71717A]">
          <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: activeMeta.accentHex }} />
          <span>{activeMeta.accountSubtitle}</span>
          <span>·</span>
          <span>{mode === "wallet" && walletAddress ? `Sepolia ${shortHex(walletAddress)}` : shortHex(activeMeta.accountAddress, 6, 4)}</span>
        </div>
        <StepHeading title={`Signed in as ${activeMeta.accountName}`} subtitle="Channel and portal permissions are active." />
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] divide-y divide-[#E4E4E7]">
        <BoundaryRow label="Unlocked for you" icon={<Unlock className="h-3.5 w-3.5 text-[#059669]" aria-hidden="true" />}>
          <span className="rounded-md border border-[#059669]/35 bg-[#ECFDF5] px-2.5 py-1 font-medium text-[#059669]">{activeMeta.channelName}</span>
          <span className="rounded-md border border-[#E4E4E7] bg-[#FAFAFA] px-2.5 py-1 text-[#52525B]">{activeMeta.portalHref}</span>
        </BoundaryRow>
        <BoundaryRow label="Locked by RBAC" icon={<Lock className="h-3.5 w-3.5 text-[#71717A]" aria-hidden="true" />}>
          {lockedChannels.map((roleId) => {
            const meta = ROLE_META[roleId];
            const walletHolds = mode === "wallet" && canAccess(roleId);
            return (
              <span
                key={roleId}
                title={walletHolds ? `${meta.channelName} is also authorized for your wallet` : `Click ${meta.channelName} in /slack to test the RBAC Lock Wall`}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#E4E4E7] bg-[#FAFAFA] px-2.5 py-1 text-[#71717A]"
              >
                <Lock className="h-3 w-3 text-[#71717A]" aria-hidden="true" /> {meta.channelName}
              </span>
            );
          })}
        </BoundaryRow>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Link href={`/slack?channel=${activeRole}`} className="inline-flex items-center gap-2 rounded-lg bg-[#09090B] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90">Enter {activeMeta.channelName} <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        <Link href={activeMeta.portalHref} className="inline-flex items-center gap-2 rounded-lg border border-[#D4D4D8] bg-[#FFFFFF] px-4 py-2.5 text-sm font-medium text-[#09090B] transition-colors hover:border-[#94A3B8]/50 hover:bg-[#F4F4F5]">{activeMeta.portalLabel} <ArrowUpRight className="h-4 w-4 text-[#52525B]" aria-hidden="true" /></Link>
        <Link href="/slack?tab=story" className={GHOST_LINK}><Play className="h-3 w-3 text-[#059669]" aria-hidden="true" /> Walkthrough</Link>
      </div>
    </div>
  );
}
