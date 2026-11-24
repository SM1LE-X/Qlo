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
    fill: "rgba(9, 9, 11, 0.02)",
    border: "rgba(9, 9, 11, 0.12)",
  },
  emerald: {
    fill: "rgba(5, 150, 105, 0.035)",
    border: "rgba(5, 150, 105, 0.25)",
  },
  amber: {
    fill: "rgba(217, 119, 6, 0.035)",
    border: "rgba(217, 119, 6, 0.25)",
  },
  crimson: {
    fill: "rgba(220, 38, 38, 0.035)",
    border: "rgba(220, 38, 38, 0.25)",
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
        "group relative overflow-hidden rounded-xl border border-[#E4E4E7] bg-[#FFFFFF] text-[#09090B] shadow-[0_1px_2px_rgba(9,9,11,0.03)] transition-colors duration-150 hover:border-[#D4D4D8]",
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
