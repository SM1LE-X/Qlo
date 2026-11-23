"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Cpu,
  ExternalLink,
  FileLock2,
  Landmark,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { DecryptedText } from "@/components/ui/decrypted-text";
import { IS_CHAIN_DEPLOYED, explorerTxUrl } from "@/lib/contracts";
import { motionTransitions } from "@/lib/motion-tokens";

const LIVE_SEPOLIA_SETTLE_TX =
  "0xf8cb4e31169eac006b4c5dd0a69fa763de7b9ddb79a7cd25419062ead7aa2ed0";

const STAGES = [
  {
    id: "patient",
    step: "01",
    label: "Patient Locks",
    icon: FileLock2,
    caption: "Medical bill encrypted locally with AES-256-GCM before anything leaves the device.",
  },
  {
    id: "hospital",
    step: "02",
    label: "Hospital Proves",
    icon: Cpu,
    caption: "Browser Web Worker generates a BN254 Groth16 proof across 8 policy rules in < 3s.",
  },
  {
    id: "chain",
    step: "03",
    label: "Chain Settles",
    icon: Landmark,
    caption: "ClaimsVault verifies math on Ethereum Sepolia and transfers ETH with 0 medical bytes.",
  },
] as const;

type StageId = (typeof STAGES)[number]["id"];

export function LivePrivacyStage() {
  const [stage, setStage] = useState<StageId>("patient");
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
      setStage((prev) =>
        prev === "patient" ? "hospital" : prev === "hospital" ? "chain" : "patient"
      );
    }, 4500);
    return () => clearInterval(timer);
  }, [paused]);

  const isEncryptedView = stage !== "patient";

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-obsidian-grid p-5 sm:p-6 text-white card-obsidian"
    >
      {/* Top Stage Header + Interactive Phase Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-2 w-2 rounded-full bg-[#34D399]" />
          <span className="font-mono-tabular text-[11px] uppercase tracking-[0.14em] text-zinc-400">
            Live Privacy Boundary
          </span>
        </div>

        <div
          role="tablist"
          aria-label="Zero-knowledge claim stages"
          className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1"
        >
          {STAGES.map((item) => {
            const Icon = item.icon;
            const active = stage === item.id;
            return (
              <button
                key={item.id}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => {
                  setStage(item.id);
                  setPaused(true);
                }}
                className={`relative inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                  active ? "text-[#090C0E]" : "text-zinc-400 hover:text-white"
                }`}
              >
                {active ? (
                  <motion.span
                    layoutId="hero-privacy-stage-tab"
                    transition={motionTransitions.springMorph}
                    className="absolute inset-0 rounded-full bg-[#34D399]"
                  />
                ) : null}
                <Icon className="relative z-10 h-3 w-3" />
                <span className="relative z-10">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive Split Visualization */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Left: Private Device Zone */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-200">
              <Lock className="h-3.5 w-3.5 text-[#34D399]" />
              Off-Chain Private Device
            </span>
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 font-mono-tabular text-[10px] text-emerald-300">
              {isEncryptedView ? "AES-256 Locked" : "Local Plaintext"}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between rounded-xl border border-white/8 bg-black/35 px-3 py-2">
              <span className="text-zinc-400">Diagnosis</span>
              <DecryptedText
                text="ICD-10 I21.0"
                encrypted={isEncryptedView}
                className={
                  isEncryptedView
                    ? "font-mono-tabular text-amber-300 text-xs"
                    : "font-mono-tabular text-emerald-300 text-xs"
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/8 bg-black/35 px-3 py-2">
              <span className="text-zinc-400">Procedure</span>
              <DecryptedText
                text="CPT 99285 ER"
                encrypted={isEncryptedView}
                className={
                  isEncryptedView
                    ? "font-mono-tabular text-amber-300 text-xs"
                    : "font-mono-tabular text-emerald-300 text-xs"
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/8 bg-black/35 px-3 py-2">
              <span className="text-zinc-400">Medication</span>
              <DecryptedText
                text="Aspirin + Ticagrelor"
                encrypted={isEncryptedView}
                className={
                  isEncryptedView
                    ? "font-mono-tabular text-amber-300 text-xs"
                    : "font-mono-tabular text-emerald-300 text-xs"
                }
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 text-[11px] font-mono-tabular text-zinc-400">
            <span>CIDv1 Fingerprint</span>
            <span className="text-zinc-300">bafkrei7f...94e</span>
          </div>
        </div>

        {/* Right: Public Ethereum Sepolia Proof Output */}
        <div className="rounded-2xl border border-emerald-400/25 bg-emerald-950/25 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-200">
              <ShieldCheck className="h-3.5 w-3.5 text-[#34D399]" />
              Ethereum Sepolia Sees
            </span>
            <span className="rounded-full border border-emerald-400/40 bg-emerald-400/15 px-2 py-0.5 font-mono-tabular text-[10px] font-semibold text-emerald-300">
              0 PHI Bytes
            </span>
          </div>

          {stage === "hospital" ? (
            <div className="space-y-1.5 text-[11px]">
              {[
                "Approved Hospital Merkle Proof",
                "Active Unexpired Policy Hash",
                "Covered Procedure Tree Match",
                "Annual Cap & Anti-Replay Guard",
              ].map((check) => (
                <div
                  key={check}
                  className="flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-black/30 px-2.5 py-1.5 text-emerald-100"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#34D399] shrink-0" />
                  <span>{check}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2 text-xs font-mono-tabular">
              <div className="flex items-center justify-between rounded-xl border border-emerald-400/15 bg-black/35 px-3 py-2">
                <span className="font-sans text-zinc-400">Groth16 Proof</span>
                <span className="text-emerald-300">
                  {stage === "chain" ? "VERIFIED (574ms)" : "PENDING"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-emerald-400/15 bg-black/35 px-3 py-2">
                <span className="font-sans text-zinc-400">Auto Payout</span>
                <span className="text-white font-semibold">+0.0050 ETH</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-emerald-400/15 bg-black/35 px-3 py-2">
                <span className="font-sans text-zinc-400">Nullifier</span>
                <span className="text-zinc-300">131479...8592</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-1 text-[11px]">
            <span className="text-zinc-400">Live Mined Proof</span>
            {IS_CHAIN_DEPLOYED ? (
              <a
                href={explorerTxUrl(LIVE_SEPOLIA_SETTLE_TX)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-mono-tabular text-emerald-300 hover:text-emerald-200 hover:underline"
              >
                0xf8cb...2ed0 <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span className="font-mono-tabular text-zinc-300">Local Sandbox</span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Animated Zero-PHI Firewall Strip */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs">
        <span className="text-zinc-300">
          {STAGES.find((s) => s.id === stage)?.caption}
        </span>
        <span className="font-mono-tabular text-[11px] text-emerald-300 shrink-0">
          4,349 R1CS · BN254
        </span>
      </div>
    </div>
  );
}
