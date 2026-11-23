"use client";

import React, { useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { motion, useSpring } from "framer-motion";
import { motionTransitions } from "@/lib/motion-tokens";
import { cn } from "@/lib/utils";

export interface MagneticButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  strength?: number;
  variant?: "primary" | "emerald" | "amber" | "crimson" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Institutional action button with strict dark-obsidian hierarchy.
 */
export function MagneticButton({
  children,
  strength = 0.08,
  variant = "primary",
  size = "md",
  className,
  disabled,
  ...props
}: MagneticButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const springX = useSpring(0, { stiffness: 320, damping: 26 });
  const springY = useSpring(0, { stiffness: 320, damping: 26 });

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || !ref.current || strength <= 0) return;
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    springX.set((e.clientX - (left + width / 2)) * strength);
    springY.set((e.clientY - (top + height / 2)) * strength);
  };

  const handleMouseLeave = () => {
    springX.set(0);
    springY.set(0);
  };

  const variants = {
    primary:
      "bg-[#F3F4F6] text-[#090B0E] border-[#F3F4F6] hover:bg-white font-semibold",
    emerald:
      "bg-[#10B981] text-[#090B0E] border-[#10B981] hover:bg-[#34D399] font-semibold",
    amber:
      "bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/35 hover:bg-[#F59E0B]/25 font-medium",
    crimson:
      "bg-[#EF4444]/12 text-[#EF4444] border-[#EF4444]/30 hover:bg-[#EF4444]/20 font-medium",
    secondary:
      "bg-[#161B22] text-[#F3F4F6] border-[#2B3340] hover:bg-[#1E242D] hover:border-[#374151] font-medium",
    ghost:
      "bg-transparent text-[#94A3B8] border-transparent hover:text-[#F3F4F6] hover:bg-[#161B22] font-medium",
  }[variant];

  const sizes = {
    sm: "h-8 px-3 text-xs rounded-lg gap-1.5",
    md: "h-9 px-3.5 text-xs sm:text-[13px] rounded-lg gap-2",
    lg: "h-10 px-4 text-sm rounded-lg gap-2",
  }[size];

  return (
    <motion.button
      ref={ref}
      style={{ x: springX, y: springY }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      transition={motionTransitions.springSnappy}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap",
        variants,
        sizes,
        className
      )}
      {...(props as Record<string, unknown>)}
    >
      {children}
    </motion.button>
  );
}
