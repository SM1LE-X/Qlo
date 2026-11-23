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
    emerald: "from-transparent via-[#0F766E] to-transparent",
    amber: "from-transparent via-[#D97706] to-transparent",
    crimson: "from-transparent via-[#DC2626] to-transparent",
  }[color];

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
    >
      <div
        className={cn(
          "absolute -inset-[1px] rounded-2xl bg-gradient-to-r opacity-50 animate-pulse",
          gradient
        )}
        style={{
          mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          maskComposite: "exclude",
          WebkitMaskComposite: "xor",
          padding: "1.5px",
        }}
      />
    </div>
  );
}

/**
 * Stripe Docs-style high-contrast dark terminal block nested cleanly inside light workspaces.
 */
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
        "rounded-xl border border-[#27272A] bg-[#111113] overflow-hidden shadow-sm",
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-white/[0.08] bg-[#18181B] px-3.5 py-2 text-[11px] font-mono-tabular text-[#A1A1AA]">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#EF4444]/85" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B]/85" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#10B981]/85" />
          <span className="ml-2 text-[#FAFAFA]">{title}</span>
        </div>
        <span>BN254 / GROTH16</span>
      </div>
      <div className="max-h-56 overflow-y-auto p-3.5 font-mono-tabular text-xs leading-relaxed space-y-1">
        {lines.map((line, i) => {
          const toneClass = {
            info: "text-[#E4E4E7]",
            ok: "text-[#34D399]",
            warn: "text-[#FBBF24]",
            err: "text-[#FCA5A5]",
          }[line.tone ?? "info"];
          return (
            <div key={i} className={toneClass}>
              <span className="mr-2 text-[#71717A]">$</span>
              {line.text}
            </div>
          );
        })}
      </div>
    </div>
  );
}
