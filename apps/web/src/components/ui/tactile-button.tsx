"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { MagneticButton } from "./magnetic-button";

interface TactileButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "emerald" | "amber" | "crimson" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

export function TactileButton({
  variant = "primary",
  size = "md",
  children,
  ...rest
}: TactileButtonProps) {
  return (
    <MagneticButton variant={variant} size={size} {...rest}>
      {children}
    </MagneticButton>
  );
}
