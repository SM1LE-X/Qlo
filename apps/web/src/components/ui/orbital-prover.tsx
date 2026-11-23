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
          ? "border-[#10B981]/30 bg-[#10B981]/10"
          : isFailed
          ? "border-[#EF4444]/30 bg-[#EF4444]/10"
          : isProving
          ? "border-[#F59E0B]/30 bg-[#F59E0B]/10"
          : "border-[#1E242D] bg-[#0D1014]"
      )}
    >
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
        <span
          className={cn(
            "absolute inset-0 rounded-full border border-dashed",
            isDone
              ? "border-[#10B981]/60"
              : isFailed
              ? "border-[#EF4444]/60"
              : isProving
              ? "border-[#F59E0B]/80"
              : "border-[#2B3340]"
          )}
          style={{
            animation: `easyui-orbit-cw ${isProving ? "2.4s" : "18s"} linear infinite`,
          }}
        />
        <span
          className={cn(
            "absolute inset-1.5 rounded-full border",
            isDone
              ? "border-[#10B981]/40"
              : isFailed
              ? "border-[#EF4444]/40"
              : isProving
              ? "border-[#F59E0B]/50"
              : "border-[#1E242D]"
          )}
          style={{
            animation: `easyui-orbit-ccw ${isProving ? "1.6s" : "12s"} linear infinite`,
          }}
        />
        <div
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full border",
            isDone
              ? "border-[#10B981]/30 bg-[#10B981]/15 text-[#10B981]"
              : isFailed
              ? "border-[#EF4444]/30 bg-[#EF4444]/15 text-[#EF4444]"
              : isProving
              ? "border-[#F59E0B]/30 bg-[#F59E0B]/15 text-[#F59E0B]"
              : "border-[#1E242D] bg-[#161B22] text-[#94A3B8]"
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
        <div className="text-[10px] font-mono-tabular uppercase tracking-[0.14em] text-[#64748B]">
          Client-Side Groth16 Prover · BN254
        </div>
        <div
          className={cn(
            "text-xs font-semibold",
            isDone
              ? "text-[#10B981]"
              : isFailed
              ? "text-[#EF4444]"
              : isProving
              ? "text-[#F59E0B]"
              : "text-[#F3F4F6]"
          )}
        >
          {statusText}
        </div>
      </div>
    </div>
  );
}
