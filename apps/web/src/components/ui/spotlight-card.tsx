"use client";

import React, { useRef, type HTMLAttributes, type ReactNode } from "react";
import { motion, useMotionTemplate, useMotionValue } from "framer-motion";
import { cn } from "@/lib/utils";

export interface SpotlightCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  accent?: "neutral" | "emerald" | "amber" | "crimson";
  spotlightSize?: number;
  className?: string;
}

const ACCENT_MAP = {
  neutral: {
    fill: "rgba(243, 244, 246, 0.025)",
    border: "rgba(148, 163, 184, 0.16)",
  },
  emerald: {
    fill: "rgba(16, 185, 129, 0.04)",
    border: "rgba(16, 185, 129, 0.24)",
  },
  amber: {
    fill: "rgba(245, 158, 11, 0.04)",
    border: "rgba(245, 158, 11, 0.24)",
  },
  crimson: {
    fill: "rgba(239, 68, 68, 0.04)",
    border: "rgba(239, 68, 68, 0.24)",
  },
} as const;

/**
 * Institutional dark surface container with subtle hairline hover response.
 */
export function SpotlightCard({
  children,
  accent = "neutral",
  spotlightSize = 320,
  className,
  ...props
}: SpotlightCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(-1000);
  const mouseY = useMotionValue(-1000);

  const { fill, border } = ACCENT_MAP[accent];

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const { left, top } = cardRef.current.getBoundingClientRect();
    mouseX.set(e.clientX - left);
    mouseY.set(e.clientY - top);
  };

  const backgroundGradient = useMotionTemplate`radial-gradient(${spotlightSize}px circle at ${mouseX}px ${mouseY}px, ${fill}, transparent 75%)`;
  const borderGradient = useMotionTemplate`radial-gradient(200px circle at ${mouseX}px ${mouseY}px, ${border}, transparent 75%)`;

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        mouseX.set(-1000);
        mouseY.set(-1000);
      }}
      className={cn(
        "group relative overflow-hidden rounded-xl border border-[#1E242D] bg-[#111419] text-[#F3F4F6] transition-colors duration-150 hover:border-[#2B3340]",
        className
      )}
      {...props}
    >
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-px rounded-[inherit] opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{ background: borderGradient }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{ background: backgroundGradient }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
