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
        "rounded-xl border border-[#E4E4E7] bg-[#FFFFFF] shadow-[0_1px_2px_rgba(9,9,11,0.03)] transition-colors duration-150 hover:border-[#D4D4D8]",
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
    <div className={cn("border-b border-[#E4E4E7] px-5 py-3.5", className)}>
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
    neutral: "border-[#E4E4E7] bg-[#F4F4F5] text-[#52525B]",
    emerald: "border-[#059669]/25 bg-[#ECFDF5] text-[#059669]",
    teal: "border-[#0284C7]/25 bg-[#F0F9FF] text-[#0284C7]",
    cobalt: "border-[#0284C7]/25 bg-[#F0F9FF] text-[#0284C7]",
    amber: "border-[#D97706]/25 bg-[#FFFBEB] text-[#B45309]",
    crimson: "border-[#DC2626]/25 bg-[#FEF2F2] text-[#DC2626]",
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
