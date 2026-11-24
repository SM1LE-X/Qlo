"use client";

import { CheckCircle2, Cpu, ShieldAlert } from "lucide-react";
import type { ProveStage } from "@/lib/prover";
import { cn } from "@/lib/utils";

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
    idle: "Ready — 4,349 R1CS Constraints Loaded",
    building_witness: "Constructing 20-signal Poseidon Witness...",
    loading_artifacts: "Loading proving key artifacts...",
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
          ? "border-[#059669]/30 bg-[#ECFDF5]"
          : isFailed
          ? "border-[#DC2626]/30 bg-[#FEF2F2]"
          : isProving
          ? "border-[#F59E0B]/30 bg-[#FFFBEB]"
          : "border-[#E4E4E7] bg-[#F4F4F5]"
      )}
    >
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
        <span
          className={cn(
            "absolute inset-0 rounded-full border border-dashed",
            isDone
              ? "border-[#059669]/60"
              : isFailed
              ? "border-[#DC2626]/60"
              : isProving
              ? "border-[#F59E0B]/80"
              : "border-[#D4D4D8]"
          )}
          style={{
            animation: `easyui-orbit-cw ${isProving ? "2.4s" : "18s"} linear infinite`,
          }}
        />
        <span
          className={cn(
            "absolute inset-1.5 rounded-full border",
            isDone
              ? "border-[#059669]/40"
              : isFailed
              ? "border-[#DC2626]/40"
              : isProving
              ? "border-[#F59E0B]/50"
              : "border-[#E4E4E7]"
          )}
          style={{
            animation: `easyui-orbit-ccw ${isProving ? "1.6s" : "12s"} linear infinite`,
          }}
        />
        <div
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full border",
            isDone
              ? "border-[#059669]/30 bg-[#ECFDF5] text-[#059669]"
              : isFailed
              ? "border-[#DC2626]/30 bg-[#EF4444]/15 text-[#DC2626]"
              : isProving
              ? "border-[#F59E0B]/30 bg-[#F59E0B]/15 text-[#B45309]"
              : "border-[#E4E4E7] bg-[#F4F4F5] text-[#52525B]"
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
        <div className="text-[10px] font-mono-tabular uppercase tracking-[0.14em] text-[#71717A]">
          Client-Side Groth16 Prover · BN254
        </div>
        <div
          className={cn(
            "text-xs font-semibold",
            isDone
              ? "text-[#059669]"
              : isFailed
              ? "text-[#DC2626]"
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
