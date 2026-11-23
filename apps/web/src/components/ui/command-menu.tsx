"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  Compass,
  Cpu,
  ExternalLink,
  FileLock2,
  Landmark,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { DEPLOYMENT, IS_CHAIN_DEPLOYED, explorerAddressUrl, explorerTxUrl } from "@/lib/contracts";
import { motionTransitions } from "@/lib/motion-tokens";

const LIVE_SEPOLIA_SETTLE_TX =
  "0xf8cb4e31169eac006b4c5dd0a69fa763de7b9ddb79a7cd25419062ead7aa2ed0";

const COMMANDS = [
  {
    label: "Platform Control Plane",
    sub: "Executive overview, live privacy simulator, and BN254 benchmark telemetry",
    href: "/",
    badge: "Overview",
    icon: Activity,
  },
  {
    label: "Step 1 · Patient Sovereign Studio",
    sub: "Local CMS-1500 WASM OCR, AES-256-GCM encryption, 3D policy pass & consent grants",
    href: "/patient",
    badge: "Step 01",
    icon: FileLock2,
  },
  {
    label: "Step 2 · Hospital Prover Workbench",
    sub: "ECDH DEK unwrap, 8-predicate Groth16 Web Worker prover, attack lab & FHIR/X12",
    href: "/hospital",
    badge: "Step 02",
    icon: Cpu,
  },
  {
    label: "Step 3 · Insurer Treasury & Forensic Audit",
    sub: "Native ETH escrow pool, settled claims ledger & zero-PHI calldata inspector",
    href: "/insurer",
    badge: "Step 03",
    icon: Landmark,
  },
  {
    label: "Cryptographic Trust Center",
    sub: "Live browser .zkey SHA-256 verification, 5/5 Sourcify contracts & STRIDE matrix",
    href: "/story",
    badge: "Specs",
    icon: ShieldCheck,
  },
];

/**
 * Enterprise Cmd+K / Ctrl+K Command Palette with workspace navigation, onboarding guide trigger,
 * and direct Ethereum Sepolia Etherscan verification shortcuts.
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
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.sub.toLowerCase().includes(q) ||
        c.badge.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <AnimatePresence mode="wait">
      {open ? (
        <motion.div
          key="cmd-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={motionTransitions.easeFast}
          className="fixed inset-0 z-50 flex items-start justify-center bg-[#090C0E]/45 px-4 pt-20 backdrop-blur-xs"
          onClick={() => onOpenChange(false)}
        >
          <motion.div
            key="cmd-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Enterprise Command Palette"
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={motionTransitions.springSnappy}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-[#E4E4E7] bg-white shadow-[0_28px_70px_-16px_rgba(9,12,14,0.35)]"
          >
            <div className="flex items-center gap-3 border-b border-[#F4F4F5] px-4 py-3.5">
              <Search className="h-4 w-4 text-[#0F766E]" />
              <input
                autoFocus
                aria-label="Command menu search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Jump to workspace, role guide, or verified Sepolia contract..."
                className="flex-1 bg-transparent text-sm text-[#09090B] placeholder-[#A1A1AA] outline-none"
              />
              <span className="hidden sm:inline rounded-md border border-[#E4E4E7] bg-[#F7F8F7] px-1.5 py-0.5 font-mono-tabular text-[10px] text-[#71717A]">
                ESC
              </span>
              <button
                type="button"
                aria-label="Close command menu"
                onClick={() => onOpenChange(false)}
                className="rounded-lg p-1 text-[#71717A] hover:bg-[#F4F4F5] hover:text-[#09090B] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-2.5 space-y-1.5 max-h-96 overflow-y-auto">
              {onOpenOnboarding ? (
                <button
                  type="button"
                  onClick={() => {
                    onOpenChange(false);
                    onOpenOnboarding();
                    setQuery("");
                  }}
                  className="flex w-full items-center gap-3 rounded-xl border border-[#99F6E4]/80 bg-[#F0FDFA]/70 px-3.5 py-2.5 text-left hover:bg-[#F0FDFA] transition-colors cursor-pointer"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#99F6E4] bg-white text-[#0F766E]">
                    <Compass className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-[#09090B]">
                      Interactive Role &amp; Walkthrough Guide
                    </div>
                    <div className="text-[11px] text-[#52525B] truncate">
                      Launch guided role tracks, inspect 4 milestones, or reset local sandbox state
                    </div>
                  </div>
                  <span className="rounded-full border border-[#99F6E4] bg-white px-2 py-0.5 font-mono-tabular text-[10px] font-semibold text-[#0F766E]">
                    Guide
                  </span>
                </button>
              ) : null}

              <div className="px-2 pt-1 text-[10px] font-mono-tabular uppercase tracking-[0.14em] text-[#71717A]">
                Workspaces
              </div>

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
                    className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left hover:bg-[#F4F5F4] transition-colors cursor-pointer"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E4E4E7] bg-[#F7F8F7] text-[#0F766E]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-[#09090B]">{item.label}</div>
                      <div className="text-[11px] text-[#52525B] truncate">{item.sub}</div>
                    </div>
                    <span className="rounded-md border border-[#E4E4E7] bg-[#F7F8F7] px-2 py-0.5 font-mono-tabular text-[10px] text-[#52525B]">
                      {item.badge}
                    </span>
                  </button>
                );
              })}

              {IS_CHAIN_DEPLOYED ? (
                <div className="pt-2 border-t border-[#F4F4F5] space-y-1">
                  <div className="px-2 text-[10px] font-mono-tabular uppercase tracking-[0.14em] text-[#71717A]">
                    Live Ethereum Sepolia Verification
                  </div>
                  <a
                    href={explorerTxUrl(LIVE_SEPOLIA_SETTLE_TX)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => onOpenChange(false)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-2 text-xs text-[#047857] hover:bg-[#ECFDF5]/60 transition-colors"
                  >
                    <span className="font-medium">
                      Live Mined Groth16 Claim Settlement (0.0050 ETH · 0 PHI Bytes)
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono-tabular text-[11px]">
                      0xf8cb...2ed0 <ExternalLink className="h-3 w-3" />
                    </span>
                  </a>
                  <a
                    href={explorerAddressUrl(DEPLOYMENT.contracts.ClaimsVault)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => onOpenChange(false)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-2 text-xs text-[#0F766E] hover:bg-[#F0FDFA] transition-colors"
                  >
                    <span className="font-medium">
                      Verified ClaimsVault Contract on Sepolia Etherscan
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono-tabular text-[11px]">
                      {DEPLOYMENT.contracts.ClaimsVault.slice(0, 10)}...{" "}
                      <ExternalLink className="h-3 w-3" />
                    </span>
                  </a>
                </div>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
