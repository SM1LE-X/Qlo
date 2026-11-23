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
        "rounded-2xl border border-[#E4E4E7] bg-white card-porcelain transition-colors duration-200 hover:border-[#D4D4D8]",
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
  return <div className={cn("border-b border-[#F4F4F5] px-6 py-4", className)}>{children}</div>;
}

export function CardContent({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("p-6", className)}>{children}</div>;
}

export function Badge({
  variant = "neutral",
  className,
  children,
}: {
  variant?: "neutral" | "emerald" | "teal" | "amber" | "crimson";
  className?: string;
  children: ReactNode;
}) {
  const styles = {
    neutral: "border-[#E4E4E7] bg-[#F4F4F5] text-[#52525B]",
    emerald: "border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]",
    teal: "border-[#99F6E4] bg-[#F0FDFA] text-[#0F766E]",
    amber: "border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]",
    crimson: "border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]",
  }[variant];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-tight",
        styles,
        className
      )}
    >
      {children}
    </span>
  );
}
