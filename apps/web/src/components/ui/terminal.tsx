"use client";

import { cn } from "@/lib/utils";

export function BorderBeam({
  active = true,
  color = "emerald",
}: {
  active?: boolean;
  color?: "emerald" | "amber" | "crimson";
}) {
  if (!active) return null;
  const gradient = {
    emerald: "from-transparent via-[#10B981] to-transparent",
    amber: "from-transparent via-[#F59E0B] to-transparent",
    crimson: "from-transparent via-[#EF4444] to-transparent",
  }[color];

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl"
    >
      <div
        className={cn(
          "absolute -inset-[1px] rounded-xl bg-gradient-to-r opacity-40 animate-pulse",
          gradient
        )}
        style={{
          mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          maskComposite: "exclude",
          WebkitMaskComposite: "xor",
          padding: "1px",
        }}
      />
    </div>
  );
}

export function Terminal({
  title = "qlo-prover-console",
  lines,
  className,
}: {
  title?: string;
  lines: { text: string; tone?: "info" | "ok" | "warn" | "err" }[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[#1E242D] bg-[#090B0E] overflow-hidden",
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-[#1E242D] bg-[#0D1014] px-3.5 py-2 text-[11px] font-mono-tabular text-[#94A3B8]">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#10B981]" />
          <span className="text-[#F3F4F6]">{title}</span>
        </div>
        <span className="text-[#64748B]">BN254 / GROTH16</span>
      </div>
      <div className="max-h-56 overflow-y-auto p-3.5 font-mono-tabular text-xs leading-relaxed space-y-1">
        {lines.map((line, i) => {
          const toneClass = {
            info: "text-[#94A3B8]",
            ok: "text-[#10B981]",
            warn: "text-[#F59E0B]",
            err: "text-[#EF4444]",
          }[line.tone ?? "info"];
          return (
            <div key={i} className={toneClass}>
              <span className="mr-2 text-[#64748B]">$</span>
              {line.text}
            </div>
          );
        })}
      </div>
    </div>
  );
}
