"use client";

import { CheckCircle2, Cpu, ShieldAlert } from "lucide-react";
import type { ProveStage } from "@/lib/prover";
import { cn } from "@/lib/utils";

/**
 * EasyUI Light OrbitalLoadingRing (MIT) + AIAgentActivity for Groth16 Web Worker proving.
 */
export function OrbitalProver({
  stage,
  elapsedMs,
}: {
  stage: ProveStage;
  elapsedMs?: number;
}) {
  const isProving =
    stage === "building_witness" ||
    stage === "loading_artifacts" ||
    stage === "computing_witness" ||
    stage === "verifying_locally";
  const isDone = stage === "done";
  const isFailed = stage === "failed";

  const statusText = {
    idle: "4,349 R1CS Constraints Standby",
    building_witness: "Constructing 20-signal Poseidon Witness...",
    loading_artifacts: "Streaming /zk/ClaimValidity.zkey...",
    computing_witness: "Generating BN254 Groth16 Proof...",
    verifying_locally: "Verifying Pairing Before Broadcast...",
    done: `Groth16 Proof Verified Locally (${elapsedMs ?? 0}ms)`,
    failed: "Circuit Assertion Failed Closed",
  }[stage];

  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-xl border p-4 transition-colors",
        isDone
          ? "border-[#A7F3D0] bg-[#ECFDF5]"
          : isFailed
          ? "border-[#FECACA] bg-[#FEF2F2]"
          : isProving
          ? "border-[#FDE68A] bg-[#FFFBEB]"
          : "border-[#E4E4E7] bg-[#FAFAFA]"
      )}
    >
      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
        <span
          className={cn(
            "absolute inset-0 rounded-full border-2 border-dashed",
            isDone
              ? "border-[#047857]/60"
              : isFailed
              ? "border-[#B91C1C]/60"
              : isProving
              ? "border-[#D97706]/80"
              : "border-[#D4D4D8]"
          )}
          style={{
            animation: `easyui-orbit-cw ${isProving ? "2.4s" : "16s"} linear infinite`,
          }}
        />
        <span
          className={cn(
            "absolute inset-2 rounded-full border",
            isDone
              ? "border-[#0F766E]"
              : isFailed
              ? "border-[#DC2626]"
              : isProving
              ? "border-[#D97706]"
              : "border-[#E4E4E7]"
          )}
          style={{
            animation: `easyui-orbit-ccw ${isProving ? "1.6s" : "10s"} linear infinite`,
          }}
        />
        <div
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full",
            isDone
              ? "bg-[#D1FAE5] text-[#047857]"
              : isFailed
              ? "bg-[#FEE2E2] text-[#B91C1C]"
              : isProving
              ? "bg-[#FEF3C7] text-[#B45309]"
              : "bg-white border border-[#E4E4E7] text-[#52525B]"
          )}
        >
          {isDone ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : isFailed ? (
            <ShieldAlert className="h-4 w-4" />
          ) : (
            <Cpu className={cn("h-4 w-4", isProving && "animate-pulse")} />
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="text-[10px] font-mono-tabular uppercase tracking-[0.16em] text-[#71717A]">
          Web Worker SNARK Core · PPOT 13
        </div>
        <div
          className={cn(
            "text-xs font-semibold",
            isDone
              ? "text-[#047857]"
              : isFailed
              ? "text-[#B91C1C]"
              : isProving
              ? "text-[#B45309]"
              : "text-[#09090B]"
          )}
        >
          {statusText}
        </div>
      </div>
    </div>
  );
}
