"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  Compass,
  Cpu,
  FileLock2,
  Landmark,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { motionTransitions } from "@/lib/motion-tokens";

const COMMANDS = [
  { label: "Platform Overview", sub: "Clearinghouse overview, throughput metrics, and credential preview", href: "/", icon: Activity },
  { label: "Patient Vault", sub: "Local CMS-1500 OCR, AES-256-GCM encryption, and consent controls", href: "/patient", icon: FileLock2 },
  { label: "Provider Clearinghouse", sub: "8-predicate Groth16 proving, automated settlement, and verification guardrails", href: "/hospital", icon: Cpu },
  { label: "Payer Treasury & Ledger", sub: "Escrow reserves, settled claims ledger, and calldata privacy audit", href: "/insurer", icon: Landmark },
  { label: "Security Trust Center", sub: "Proving key SHA-256 verification, contract registry, and security architecture", href: "/story", icon: ShieldCheck },
];

/**
 * EasyUI Light CommandMenu (MIT): Cmd+K / Ctrl+K workspace switcher.
 */
export function CommandMenu({
  open,
  onOpenChange,
  onOpenOnboarding,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onOpenOnboarding?: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      } else if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMANDS;
    return COMMANDS.filter(
      (c) => c.label.toLowerCase().includes(q) || c.sub.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={motionTransitions.easeFast}
          className="fixed inset-0 z-50 flex items-start justify-center bg-[#09090B]/35 px-4 pt-24 backdrop-blur-xs"
          onClick={() => onOpenChange(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={motionTransitions.springSnappy}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#E4E4E7] bg-white shadow-[0_24px_60px_-16px_rgba(15,23,42,0.28)]"
          >
            <div className="flex items-center gap-2.5 border-b border-[#F4F4F5] px-4 py-3">
              <Search className="h-4 w-4 text-[#71717A]" />
              <input
                autoFocus
                aria-label="Command menu search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Jump to Qlo workspace or Trust Center..."
                className="flex-1 bg-transparent text-sm text-[#09090B] placeholder-[#A1A1AA] outline-none"
              />
              <button
                type="button"
                aria-label="Close command menu"
                onClick={() => onOpenChange(false)}
                className="rounded-md p-1 text-[#71717A] hover:bg-[#F4F4F5] hover:text-[#09090B] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-2 space-y-1 max-h-80 overflow-y-auto">
              {onOpenOnboarding ? (
                <button
                  type="button"
                  onClick={() => {
                    onOpenChange(false);
                    onOpenOnboarding();
                    setQuery("");
                  }}
                  className="flex w-full items-center gap-3 rounded-xl border border-[#99F6E4]/60 bg-[#F0FDFA]/50 px-3 py-2.5 text-left hover:bg-[#F0FDFA] transition-colors cursor-pointer"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#99F6E4] bg-white text-[#0F766E]">
                    <Compass className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-[#09090B]">
                      Guided Onboarding &amp; Role Selector
                    </div>
                    <div className="text-[11px] text-[#52525B] truncate">
                      Pick a role workflow, track milestones, or reset sandbox data
                    </div>
                  </div>
                  <span className="font-mono-tabular text-[10px] text-[#0F766E]">Guide</span>
                </button>
              ) : null}
              {filtered.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.href}
                    type="button"
                    onClick={() => {
                      router.push(item.href);
                      onOpenChange(false);
                      setQuery("");
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-[#F4F4F5] transition-colors cursor-pointer"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] text-[#0F766E]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-[#09090B]">{item.label}</div>
                      <div className="text-[11px] text-[#52525B] truncate">{item.sub}</div>
                    </div>
                    <span className="font-mono-tabular text-[10px] text-[#71717A]">{item.href}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
