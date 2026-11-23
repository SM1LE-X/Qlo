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
    fill: "rgba(15, 23, 42, 0.03)",
    border: "rgba(15, 23, 42, 0.12)",
  },
  emerald: {
    fill: "rgba(15, 118, 110, 0.05)",
    border: "rgba(15, 118, 110, 0.25)",
  },
  amber: {
    fill: "rgba(217, 119, 6, 0.05)",
    border: "rgba(217, 119, 6, 0.24)",
  },
  crimson: {
    fill: "rgba(185, 28, 28, 0.045)",
    border: "rgba(185, 28, 28, 0.24)",
  },
} as const;

/**
 * EasyUI Light SpotlightCard (MIT): clean #FFFFFF porcelain card with subtle cursor luminance.
 */
export function SpotlightCard({
  children,
  accent = "neutral",
  spotlightSize = 360,
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

  const backgroundGradient = useMotionTemplate`radial-gradient(${spotlightSize}px circle at ${mouseX}px ${mouseY}px, ${fill}, transparent 78%)`;
  const borderGradient = useMotionTemplate`radial-gradient(220px circle at ${mouseX}px ${mouseY}px, ${border}, transparent 78%)`;

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        mouseX.set(-1000);
        mouseY.set(-1000);
      }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-[#E4E4E7] bg-white card-porcelain transition-colors duration-200 hover:border-[#D4D4D8]",
        className
      )}
      {...props}
    >
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-px rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: borderGradient }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: backgroundGradient }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
