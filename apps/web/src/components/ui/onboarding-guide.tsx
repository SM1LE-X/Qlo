"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Compass,
  Cpu,
  FileLock2,
  Landmark,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { IS_CHAIN_DEPLOYED } from "@/lib/contracts";
import { resetLocalChainMirror } from "@/lib/localState";
import { motionTransitions } from "@/lib/motion-tokens";
import { clearVaultEntries } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { TactileButton } from "./tactile-button";

export const ONBOARDING_DISMISSED_KEY = "qlo-onboarding-dismissed-v1";
export const ONBOARDING_VISITS_KEY = "qlo-onboarding-visits-v1";

interface OnboardingVisits {
  insurer?: boolean;
  story?: boolean;
}

export interface OnboardingStateProps {
  vaultCount: number;
  hasActiveGrant: boolean;
  settledCount: number;
  zkeyVerified: boolean;
}

interface MilestoneItem {
  id: string;
  stepNum: number;
  title: string;
  description: string;
  href: string;
  done: boolean;
}

function readVisits(): OnboardingVisits {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(ONBOARDING_VISITS_KEY);
    return raw ? (JSON.parse(raw) as OnboardingVisits) : {};
  } catch {
    return {};
  }
}

function buildMilestones(
  { vaultCount, hasActiveGrant, settledCount, zkeyVerified }: OnboardingStateProps,
  visits: OnboardingVisits
): MilestoneItem[] {
  return [
    {
      id: "encrypt-authorize",
      stepNum: 1,
      title: "Encrypt & Authorize",
      description:
        "Run on-device CMS-1500 OCR, seal ciphertext via AES-256-GCM, and issue a time-bounded hospital grant.",
      href: "/patient",
      done: vaultCount > 0 && (hasActiveGrant || settledCount > 0),
    },
    {
      id: "prove-disburse",
      stepNum: 2,
      title: "Prove & Disburse",
      description:
        "Unwrap the granted DEK, generate an 8-predicate Groth16 Web Worker proof, and settle from ClaimsVault escrow.",
      href: "/hospital",
      done: settledCount > 0,
    },
    {
      id: "audit-calldata",
      stepNum: 3,
      title: "Audit Calldata",
      description:
        "Inspect raw transaction inputs in Payer Treasury to confirm zero clinical diagnoses or CPT codes leak on-chain.",
      href: "/insurer",
      done: settledCount > 0 && Boolean(visits.insurer),
    },
    {
      id: "verify-key",
      stepNum: 4,
      title: "Verify Circuit Key",
      description:
        "Verify the browser proving key SHA-256 checksum and review the 8 public signal invariants in Trust Center.",
      href: "/story",
      done: zkeyVerified && Boolean(visits.story),
    },
  ];
}

const ROLE_TRACKS = [
  {
    id: "patient",
    title: "Member / Patient",
    workspace: "Patient Vault",
    href: "/patient",
    cta: "Open Patient Vault",
    icon: FileLock2,
    summary:
      "Parse medical bills on-device with local OCR, encrypt clinical records with AES-256-GCM, and control provider access.",
    boundary: "Diagnoses, Rx, and identifiers remain off-chain.",
  },
  {
    id: "hospital",
    title: "Provider Billing (RCM)",
    workspace: "Provider Clearinghouse",
    href: "/hospital",
    cta: "Open Clearinghouse",
    icon: Cpu,
    summary:
      "Unwrap authorized patient records, prove 8 coverage predicates in a Web Worker, and receive direct escrow payout.",
    boundary: "Proves eligibility without revealing clinical notes.",
  },
  {
    id: "insurer",
    title: "Payer Treasury & Audit",
    workspace: "Payer Treasury",
    href: "/insurer",
    cta: "Open Payer Treasury",
    icon: Landmark,
    summary:
      "Fund native ETH escrow reserves, track cumulative policy outlays, and audit settled calldata for zero PHI leakage.",
    boundary: "Annual policy caps stay concealed inside Poseidon(6).",
  },
] as const;

export function OnboardingChecklistRail({
  pathname,
  vaultCount,
  hasActiveGrant,
  settledCount,
  zkeyVerified,
  onOpenGuide,
}: OnboardingStateProps & {
  pathname: string;
  onOpenGuide: () => void;
}) {
  const [hydrated, setHydrated] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);
  const [visits, setVisits] = React.useState<OnboardingVisits>({});

  React.useEffect(() => {
    const syncState = () => {
      const currentVisits = readVisits();
      let updated = false;
      if (pathname === "/insurer" && settledCount > 0 && !currentVisits.insurer) {
        currentVisits.insurer = true;
        updated = true;
      }
      if (pathname === "/story" && !currentVisits.story) {
        currentVisits.story = true;
        updated = true;
      }
      if (updated) {
        window.localStorage.setItem(ONBOARDING_VISITS_KEY, JSON.stringify(currentVisits));
      }
      setVisits(currentVisits);
      setDismissed(window.localStorage.getItem(ONBOARDING_DISMISSED_KEY) === "1");
      setHydrated(true);
    };

    syncState();
    window.addEventListener("storage", syncState);
    return () => window.removeEventListener("storage", syncState);
  }, [pathname, settledCount]);

  if (!hydrated || dismissed) return null;

  const milestones = buildMilestones(
    { vaultCount, hasActiveGrant, settledCount, zkeyVerified },
    visits
  );
  const doneCount = milestones.filter((m) => m.done).length;
  if (doneCount === milestones.length) return null;

  const handleDismiss = () => {
    window.localStorage.setItem(ONBOARDING_DISMISSED_KEY, "1");
    setDismissed(true);
  };

  return (
    <div className="mb-6 rounded-2xl border border-[#E4E4E7] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(9,9,11,0.03)] space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#99F6E4] bg-[#F0FDFA] px-2.5 py-0.5 text-[11px] font-medium text-[#0F766E]">
            <Compass className="h-3 w-3" />
            {IS_CHAIN_DEPLOYED ? "Base Sepolia Testnet" : "Sandbox Mode · No Wallet Required"}
          </span>
          <span className="text-xs font-mono-tabular font-medium text-[#52525B]">
            {doneCount} of {milestones.length} milestones
          </span>
          <div className="hidden sm:block h-1.5 w-24 overflow-hidden rounded-full bg-[#F4F4F5]">
            <div
              className="h-full rounded-full bg-[#0F766E] transition-all duration-300"
              style={{ width: `${(doneCount / milestones.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenGuide}
            className="rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] px-2.5 py-1 text-[11px] font-medium text-[#09090B] hover:bg-[#F4F4F5] transition-colors cursor-pointer"
          >
            Role &amp; Reset Guide
          </button>
          <button
            type="button"
            aria-label="Dismiss onboarding checklist"
            onClick={handleDismiss}
            className="rounded-lg p-1 text-[#71717A] hover:bg-[#F4F4F5] hover:text-[#09090B] transition-colors cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <nav
        aria-label="Onboarding milestones"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2"
      >
        {milestones.map((m) => {
          const isHere = pathname === m.href;
          return (
            <Link
              key={m.id}
              href={m.href}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[11px] font-medium transition-colors",
                m.done
                  ? "border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]"
                  : isHere
                  ? "border-[#0F766E] bg-[#F0FDFA]/80 text-[#09090B]"
                  : "border-[#E4E4E7] bg-[#FAFAFA] text-[#52525B] hover:border-[#D4D4D8] hover:text-[#09090B]"
              )}
            >
              <span
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full font-mono-tabular text-[10px] font-semibold",
                  m.done
                    ? "bg-[#047857] text-white"
                    : isHere
                    ? "bg-[#0F766E] text-white"
                    : "bg-[#E4E4E7] text-[#52525B]"
                )}
              >
                {m.done ? <Check className="h-2.5 w-2.5" /> : m.stepNum}
              </span>
              <span className="truncate">{m.title}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function OnboardingModal({
  open,
  onOpenChange,
  vaultCount,
  hasActiveGrant,
  settledCount,
  zkeyVerified,
}: OnboardingStateProps & {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const router = useRouter();
  const uid = React.useId();
  const [tab, setTab] = React.useState<"roles" | "walkthrough">("roles");
  const [visits, setVisits] = React.useState<OnboardingVisits>({});
  const [resetting, setResetting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setVisits(readVisits());
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  const milestones = buildMilestones(
    { vaultCount, hasActiveGrant, settledCount, zkeyVerified },
    visits
  );

  const handleResetSession = async () => {
    setResetting(true);
    try {
      await clearVaultEntries().catch(() => undefined);
      resetLocalChainMirror();
      window.localStorage.removeItem(ONBOARDING_DISMISSED_KEY);
      window.localStorage.removeItem(ONBOARDING_VISITS_KEY);
      setVisits({});
      window.dispatchEvent(new Event("storage"));
      toast.success("Sandbox session cleared and escrow reset to 1.00 ETH");
      onOpenChange(false);
      router.refresh();
    } finally {
      setResetting(false);
    }
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={motionTransitions.easeFast}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#09090B]/40 px-4 py-8 backdrop-blur-xs"
          onClick={() => onOpenChange(false)}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`onboarding-title-${uid}`}
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={motionTransitions.springSnappy}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl overflow-hidden rounded-2xl border border-[#E4E4E7] bg-white shadow-[0_24px_64px_-16px_rgba(15,23,42,0.28)]"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-[#F4F4F5] px-6 py-5">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#99F6E4] bg-[#F0FDFA] px-2.5 py-0.5 text-[11px] font-medium text-[#0F766E]">
                    <ShieldCheck className="h-3 w-3" />
                    {IS_CHAIN_DEPLOYED
                      ? "Base Sepolia Testnet"
                      : "Sandbox Mode — Zero Wallet Setup"}
                  </span>
                </div>
                <h2
                  id={`onboarding-title-${uid}`}
                  className="text-lg font-bold tracking-tight text-[#09090B]"
                >
                  Qlo Clearinghouse Onboarding
                </h2>
                <p className="text-xs text-[#52525B]">
                  Evaluate zero-knowledge claim adjudication locally or connect MetaMask for Base Sepolia.
                </p>
              </div>

              <button
                type="button"
                aria-label="Close onboarding guide"
                onClick={() => onOpenChange(false)}
                className="rounded-lg p-1.5 text-[#71717A] hover:bg-[#F4F4F5] hover:text-[#09090B] transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Segmented Tab Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F4F4F5] bg-[#FAFAFA] px-6 py-3">
              <div className="inline-flex rounded-xl border border-[#E4E4E7] bg-[#F4F4F5] p-1">
                {(
                  [
                    ["roles", "Choose a Role"],
                    ["walkthrough", "End-to-End Walkthrough"],
                  ] as const
                ).map(([id, label]) => {
                  const selected = tab === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setTab(id)}
                      className={cn(
                        "relative rounded-lg px-3 py-1 text-xs font-medium transition-colors cursor-pointer",
                        selected ? "text-[#09090B]" : "text-[#71717A] hover:text-[#09090B]"
                      )}
                    >
                      {selected ? (
                        <motion.span
                          layoutId={`onboarding-tab-${uid}`}
                          transition={motionTransitions.springMorph}
                          className="absolute inset-0 rounded-lg border border-[#E4E4E7]/80 bg-white shadow-2xs"
                        />
                      ) : null}
                      <span className="relative z-10">{label}</span>
                    </button>
                  );
                })}
              </div>

              <span className="text-[11px] font-mono-tabular text-[#71717A]">
                All roles run safely with synthetic clinical fixtures
              </span>
            </div>

            {/* Body */}
            <div className="max-h-[70vh] overflow-y-auto p-6">
              {tab === "roles" ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {ROLE_TRACKS.map((role) => {
                    const Icon = role.icon;
                    return (
                      <div
                        key={role.id}
                        className="flex flex-col justify-between rounded-2xl border border-[#E4E4E7] bg-[#FAFAFA] p-4 space-y-4"
                      >
                        <div className="space-y-2.5">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E4E4E7] bg-white text-[#0F766E]">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-[#09090B]">{role.title}</div>
                            <div className="text-[11px] text-[#71717A]">{role.workspace}</div>
                          </div>
                          <p className="text-xs text-[#52525B] leading-relaxed">{role.summary}</p>
                        </div>

                        <div className="space-y-3 border-t border-[#E4E4E7] pt-3">
                          <div className="text-[11px] font-medium text-[#047857]">
                            {role.boundary}
                          </div>
                          <Link href={role.href} onClick={() => onOpenChange(false)}>
                            <TactileButton size="sm" variant="primary" className="w-full">
                              {role.cta}
                              <ArrowRight className="h-3.5 w-3.5" />
                            </TactileButton>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2.5">
                    {milestones.map((m) => (
                      <div
                        key={m.id}
                        className={cn(
                          "flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5 transition-colors",
                          m.done
                            ? "border-[#A7F3D0] bg-[#ECFDF5]/60"
                            : "border-[#E4E4E7] bg-[#FAFAFA]"
                        )}
                      >
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <span
                            className={cn(
                              "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono-tabular text-xs font-semibold",
                              m.done
                                ? "bg-[#047857] text-white"
                                : "border border-[#D4D4D8] bg-white text-[#52525B]"
                            )}
                          >
                            {m.done ? <Check className="h-3.5 w-3.5" /> : m.stepNum}
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-[#09090B]">{m.title}</div>
                            <p className="mt-0.5 text-[11px] text-[#52525B]">{m.description}</p>
                          </div>
                        </div>

                        <Link href={m.href} onClick={() => onOpenChange(false)}>
                          <TactileButton size="sm" variant={m.done ? "secondary" : "emerald"}>
                            {m.done ? "Review" : "Launch"}
                            <ArrowRight className="h-3 w-3" />
                          </TactileButton>
                        </Link>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#F4F4F5] pt-4">
                    <span className="text-[11px] text-[#71717A]">
                      Clears local IndexedDB records, consent grants, and demo ledger entries.
                    </span>
                    <TactileButton
                      size="sm"
                      variant="secondary"
                      onClick={handleResetSession}
                      disabled={resetting}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {resetting ? "Resetting..." : "Reset Sandbox Session"}
                    </TactileButton>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
