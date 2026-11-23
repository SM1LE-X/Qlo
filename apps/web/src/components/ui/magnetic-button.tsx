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
 * EasyUI Light MagneticButton (MIT): crisp ink-on-porcelain hierarchy with subtle spring pull.
 */
export function MagneticButton({
  children,
  strength = 0.18,
  variant = "primary",
  size = "md",
  className,
  disabled,
  ...props
}: MagneticButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const springX = useSpring(0, { stiffness: 280, damping: 22 });
  const springY = useSpring(0, { stiffness: 280, damping: 22 });

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || !ref.current) return;
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
      "bg-[#09090B] text-white border-[#09090B] hover:bg-[#18181B] shadow-[0_2px_10px_-2px_rgba(9,9,11,0.28)] font-medium",
    emerald:
      "bg-[#0F766E] text-white border-[#0F766E] hover:bg-[#115E59] shadow-[0_4px_14px_-4px_rgba(15,118,110,0.38)] font-medium",
    amber:
      "bg-[#D97706] text-white border-[#D97706] hover:bg-[#B45309] shadow-xs font-medium",
    crimson:
      "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA] hover:bg-[#FEE2E2] font-medium",
    secondary:
      "bg-white text-[#09090B] border-[#E4E4E7] hover:bg-[#F4F4F5] hover:border-[#D4D4D8] shadow-[0_1px_2px_rgba(15,23,42,0.05)] font-medium",
    ghost:
      "bg-transparent text-[#52525B] border-transparent hover:text-[#09090B] hover:bg-[#F4F4F5]",
  }[variant];

  const sizes = {
    sm: "h-8 px-3 text-xs rounded-lg gap-1.5",
    md: "h-10 px-4 text-xs sm:text-sm rounded-xl gap-2",
    lg: "h-11 px-5 text-sm rounded-xl gap-2",
  }[size];

  return (
    <motion.button
      ref={ref}
      style={{ x: springX, y: springY }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      whileTap={disabled ? undefined : { scale: 0.97 }}
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
