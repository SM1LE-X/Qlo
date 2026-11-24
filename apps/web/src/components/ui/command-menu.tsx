"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  Cpu,
  ExternalLink,
  FileLock2,
  Landmark,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  DEPLOYMENT,
  IS_CHAIN_DEPLOYED,
  explorerAddressUrl,
  sourcifyContractUrl,
} from "@/lib/contracts";
import { motionTransitions } from "@/lib/motion-tokens";
import { cn, shortHex } from "@/lib/utils";

const COMMANDS = [
  {
    label: "Overview",
    sub: "Live Sepolia escrow state, settled claims, consent logs & contracts",
    href: "/",
    tag: "/",
    icon: Activity,
  },
  {
    label: "Vault",
    sub: "Browser-local AES-256-GCM record encryption & ECDH hospital consent grants",
    href: "/patient",
    tag: "/patient",
    icon: FileLock2,
  },
  {
    label: "Claims",
    sub: "ECDH DEK unwrap, 8-predicate Groth16 BN254 prover & atomic ETH settlement",
    href: "/hospital",
    tag: "/hospital",
    icon: Cpu,
  },
  {
    label: "Treasury",
    sub: "ClaimsVault ETH escrow funding, settled ledger & raw calldata inspection",
    href: "/insurer",
    tag: "/insurer",
    icon: Landmark,
  },
  {
    label: "Protocol",
    sub: "R1CS circuit constraints, .zkey SHA-256 verification & contract ABIs",
    href: "/story",
    tag: "/story",
    icon: ShieldCheck,
  },
] as const;

export function CommandMenu({
  open,
  onOpenChange,
  onOpenOnboarding: _onOpenOnboarding,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onOpenOnboarding?: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMANDS;
    return COMMANDS.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.sub.toLowerCase().includes(q) ||
        c.tag.toLowerCase().includes(q)
    );
  }, [query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
        return;
      }
      if (!open) return;

      if (e.key === "Escape") {
        onOpenChange(false);
      } else if (e.key === "ArrowDown" && filtered.length > 0) {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % filtered.length);
      } else if (e.key === "ArrowUp" && filtered.length > 0) {
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === "Enter" && filtered[activeIndex]) {
        e.preventDefault();
        router.push(filtered[activeIndex].href);
        onOpenChange(false);
        setQuery("");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange, filtered, activeIndex, router]);

  return (
    <AnimatePresence mode="wait">
      {open ? (
        <motion.div
          key="cmd-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={motionTransitions.easeFast}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 pt-20 backdrop-blur-xs"
          onClick={() => onOpenChange(false)}
        >
          <motion.div
            key="cmd-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Protocol Command Menu"
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={motionTransitions.springSnappy}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg overflow-hidden rounded-xl border border-[#D4D4D8] bg-[#FFFFFF] shadow-[0_24px_64px_-16px_rgba(0,0,0,0.85)]"
          >
            <div className="flex items-center gap-3 border-b border-[#E4E4E7] px-4 py-3">
              <Search className="h-4 w-4 text-[#71717A] shrink-0" />
              <input
                autoFocus
                aria-label="Command menu search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Navigate protocol modules or contracts..."
                className="flex-1 bg-transparent text-sm text-[#09090B] placeholder-[#64748B] outline-none"
              />
              <kbd className="hidden sm:inline rounded border border-[#D4D4D8] bg-[#F4F4F5] px-1.5 py-0.5 font-mono-tabular text-[10px] text-[#71717A]">
                ESC
              </kbd>
              <button
                type="button"
                aria-label="Close command menu"
                onClick={() => onOpenChange(false)}
                className="rounded-md p-1 text-[#71717A] hover:bg-[#F4F4F5] hover:text-[#09090B] transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-2 space-y-1 max-h-96 overflow-y-auto">
              <div className="px-2.5 pt-1 pb-0.5 font-mono-tabular text-[10px] uppercase tracking-[0.14em] text-[#71717A]">
                Modules
              </div>

              {filtered.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-[#71717A]">
                  No matching modules for &ldquo;{query}&rdquo;
                </div>
              ) : (
                filtered.map((item, idx) => {
                  const Icon = item.icon;
                  const isActive = idx === activeIndex;
                  return (
                    <button
                      key={item.href}
                      type="button"
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => {
                        router.push(item.href);
                        onOpenChange(false);
                        setQuery("");
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors cursor-pointer",
                        isActive
                          ? "bg-[#F4F4F5] text-[#09090B]"
                          : "text-[#52525B] hover:bg-[#F4F4F5]"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                          isActive
                            ? "border-[#059669]/35 bg-[#ECFDF5] text-[#059669]"
                            : "border-[#E4E4E7] bg-[#F4F4F5] text-[#52525B]"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium text-[#09090B]">
                          {item.label}
                        </div>
                        <div className="text-[11px] text-[#71717A] truncate">
                          {item.sub}
                        </div>
                      </div>
                      <span className="rounded border border-[#E4E4E7] bg-[#F4F4F5] px-1.5 py-0.5 font-mono-tabular text-[10px] text-[#71717A]">
                        {item.tag}
                      </span>
                    </button>
                  );
                })
              )}

              {IS_CHAIN_DEPLOYED ? (
                <div className="mt-2 pt-2 border-t border-[#E4E4E7] space-y-0.5">
                  <div className="px-2.5 pb-0.5 font-mono-tabular text-[10px] uppercase tracking-[0.14em] text-[#71717A]">
                    Sepolia Contracts (11155111)
                  </div>
                  <a
                    href={explorerAddressUrl(DEPLOYMENT.contracts.ClaimsVault)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => onOpenChange(false)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs text-[#52525B] hover:bg-[#F4F4F5] hover:text-[#09090B] transition-colors"
                  >
                    <span className="font-medium">ClaimsVault · Etherscan</span>
                    <span className="inline-flex items-center gap-1.5 font-mono-tabular text-[11px] text-[#059669]">
                      {shortHex(DEPLOYMENT.contracts.ClaimsVault, 6, 4)}
                      <ExternalLink className="h-3 w-3" />
                    </span>
                  </a>
                  <a
                    href={sourcifyContractUrl(DEPLOYMENT.contracts.Groth16Verifier)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => onOpenChange(false)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs text-[#52525B] hover:bg-[#F4F4F5] hover:text-[#09090B] transition-colors"
                  >
                    <span className="font-medium">Groth16Verifier · Sourcify</span>
                    <span className="inline-flex items-center gap-1.5 font-mono-tabular text-[11px] text-[#0284C7]">
                      {shortHex(DEPLOYMENT.contracts.Groth16Verifier, 6, 4)}
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
