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
      "bg-[#09090B] text-white border-[#09090B] hover:bg-[#18181B] font-semibold",
    emerald:
      "bg-[#059669] text-white border-[#059669] hover:bg-[#047857] font-semibold",
    amber:
      "bg-[#FFFBEB] text-[#B45309] border-[#F59E0B]/40 hover:bg-[#FEF3C7] font-medium",
    crimson:
      "bg-[#FEF2F2] text-[#DC2626] border-[#DC2626]/30 hover:bg-[#FEE2E2] font-medium",
    secondary:
      "bg-[#FFFFFF] text-[#09090B] border-[#E4E4E7] hover:bg-[#F4F4F5] hover:border-[#D4D4D8] font-medium shadow-[0_1px_2px_rgba(9,9,11,0.03)]",
    ghost:
      "bg-transparent text-[#52525B] border-transparent hover:text-[#09090B] hover:bg-[#F4F4F5] font-medium",
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
