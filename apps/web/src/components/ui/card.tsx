import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[#1E242D] bg-[#111419] transition-colors duration-150 hover:border-[#2B3340]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("border-b border-[#1E242D] px-5 py-3.5", className)}>
      {children}
    </div>
  );
}

export function CardContent({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("p-5", className)}>{children}</div>;
}

export function Badge({
  variant = "neutral",
  className,
  children,
}: {
  variant?: "neutral" | "emerald" | "teal" | "cobalt" | "amber" | "crimson";
  className?: string;
  children: ReactNode;
}) {
  const styles = {
    neutral: "border-[#2B3340] bg-[#161B22] text-[#94A3B8]",
    emerald: "border-[#10B981]/30 bg-[#10B981]/10 text-[#10B981]",
    teal: "border-[#38BDF8]/30 bg-[#38BDF8]/10 text-[#38BDF8]",
    cobalt: "border-[#38BDF8]/30 bg-[#38BDF8]/10 text-[#38BDF8]",
    amber: "border-[#F59E0B]/30 bg-[#F59E0B]/10 text-[#F59E0B]",
    crimson: "border-[#EF4444]/30 bg-[#EF4444]/10 text-[#EF4444]",
  }[variant];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium tracking-tight whitespace-nowrap",
        styles,
        className
      )}
    >
      {children}
    </span>
  );
}
