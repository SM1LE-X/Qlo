"use client";

import { motion } from "framer-motion";
import { ShieldAlert, Lock, Cpu, Landmark, UserCheck } from "lucide-react";

/**
 * Full-width Three-Party Zero-PHI Architecture flow visualization.
 */
export function AnimatedZkFlow({ tone = "light" }: { tone?: "light" | "obsidian" }) {
  const isDark = tone === "obsidian";

  const nodes = [
    {
      label: "Patient Vault",
      sub: "AES-256-GCM + OCR",
      icon: UserCheck,
      accent: isDark
        ? "border-teal-400/30 text-teal-300 bg-teal-400/10"
        : "border-[#99F6E4] text-[#0F766E] bg-[#F0FDFA]",
    },
    {
      label: "IPFS CIDv1",
      sub: "IndexedDB + .qlo.json",
      icon: Lock,
      accent: isDark
        ? "border-amber-400/30 text-amber-300 bg-amber-400/10"
        : "border-[#FDE68A] text-[#B45309] bg-[#FFFBEB]",
    },
    {
      label: "Hospital Prover",
      sub: "Groth16 (<3s WASM)",
      icon: Cpu,
      accent: isDark
        ? "border-emerald-400/30 text-emerald-300 bg-emerald-400/10"
        : "border-[#A7F3D0] text-[#047857] bg-[#ECFDF5]",
    },
    {
      label: "Ethereum Sepolia",
      sub: "ClaimsVault + ETH",
      icon: Landmark,
      accent: isDark
        ? "border-sky-400/30 text-sky-300 bg-sky-400/10"
        : "border-[#BAE6FD] text-[#0369A1] bg-[#F0F9FF]",
    },
  ];

  return (
    <div
      className={
        isDark
          ? "relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6"
          : "relative overflow-hidden rounded-2xl border border-[#E4E4E7] bg-white p-6 card-porcelain"
      }
    >
      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-3">
        {nodes.map((node, idx) => {
          const Icon = node.icon;
          return (
            <div key={node.label} className="flex items-center gap-2.5 w-full md:flex-1 min-w-0">
              <div
                className={
                  isDark
                    ? "flex items-center gap-3 rounded-xl border border-white/10 bg-black/40 px-4 py-3.5 w-full hover:border-emerald-400/35 transition-colors"
                    : "flex items-center gap-3 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] px-3.5 py-3 w-full hover:border-[#D4D4D8] transition-colors"
                }
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${node.accent}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div
                    className={`text-xs font-semibold whitespace-nowrap ${
                      isDark ? "text-white" : "text-[#09090B]"
                    }`}
                  >
                    {node.label}
                  </div>
                  <div
                    className={`text-[11px] font-mono-tabular whitespace-nowrap ${
                      isDark ? "text-zinc-400" : "text-[#52525B]"
                    }`}
                  >
                    {node.sub}
                  </div>
                </div>
              </div>
              {idx < nodes.length - 1 ? (
                <div className="hidden md:flex items-center w-8 shrink-0 relative h-4">
                  <div
                    className={`h-[1px] w-full ${isDark ? "bg-white/15" : "bg-[#E4E4E7]"}`}
                  />
                  <motion.div
                    className={`absolute h-2 w-2 rounded-full ${
                      isDark
                        ? "bg-[#34D399] shadow-[0_0_10px_rgba(52,211,153,0.8)]"
                        : "bg-[#0F766E] shadow-[0_0_8px_rgba(15,118,110,0.45)]"
                    }`}
                    animate={{ x: [0, 24, 0] }}
                    transition={{
                      repeat: Infinity,
                      duration: 2.2,
                      delay: idx * 0.35,
                      ease: "easeInOut",
                    }}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div
        className={
          isDark
            ? "mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-400/25 bg-rose-950/30 px-4 py-3 text-xs"
            : "mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-2.5 text-xs"
        }
      >
        <div
          className={`flex items-center gap-2 font-medium ${
            isDark ? "text-rose-200" : "text-[#B91C1C]"
          }`}
        >
          <ShieldAlert
            className={`h-4 w-4 shrink-0 ${isDark ? "text-rose-400" : "text-[#DC2626]"}`}
          />
          <span>Zero-PHI Firewall:</span>
          <span className={`font-mono-tabular ${isDark ? "text-zinc-200" : "text-[#09090B]"}`}>
            ICD-10 diagnoses, CPT codes, prescriptions, clinical notes, and private annual caps
            never touch the blockchain.
          </span>
        </div>
        <span
          className={
            isDark
              ? "font-mono-tabular text-[11px] text-emerald-300 border border-emerald-400/30 rounded-full px-3 py-0.5 bg-emerald-400/10"
              : "font-mono-tabular text-[11px] text-[#047857] border border-[#A7F3D0] rounded-full px-2.5 py-0.5 bg-[#ECFDF5]"
          }
        >
          8 Public Field Signals Only
        </span>
      </div>
    </div>
  );
}
