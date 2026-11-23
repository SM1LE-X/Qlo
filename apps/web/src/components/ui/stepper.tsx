"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { motionTransitions } from "@/lib/motion-tokens";

export interface StepItem {
  title: string;
  description?: string;
}

export interface StepperProps {
  steps: StepItem[];
  current: number;
  onStepChange?: (index: number) => void;
  orientation?: "horizontal" | "vertical";
  className?: string;
}

/**
 * EasyUI-inspired clinical milestone stepper with spring active indicator
 * and animated SVG checkmark draw for completed stages.
 */
export function Stepper({
  steps,
  current,
  onStepChange,
  orientation = "horizontal",
  className,
}: StepperProps) {
  const uid = React.useId();
  const isVertical = orientation === "vertical";

  return (
    <nav
      aria-label="Workflow steps"
      className={cn(
        "rounded-2xl border border-[#E4E4E7] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(9,9,11,0.03)]",
        className
      )}
    >
      <ol
        className={cn(
          isVertical
            ? "flex flex-col gap-3"
            : "grid gap-3 sm:gap-2",
          !isVertical && steps.length === 3 && "grid-cols-1 sm:grid-cols-3",
          !isVertical && steps.length === 4 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
          !isVertical && steps.length > 4 && "grid-cols-1 sm:grid-cols-3 lg:grid-cols-5"
        )}
      >
        {steps.map((step, index) => {
          const isCompleted = index < current;
          const isCurrent = index === current;
          const isUpcoming = index > current;
          const clickable = Boolean(onStepChange);

          const Wrapper = clickable ? "button" : "div";

          return (
            <li key={`${step.title}-${index}`} className="relative flex items-start">
              <Wrapper
                {...(clickable
                  ? {
                      type: "button" as const,
                      onClick: () => onStepChange?.(index),
                    }
                  : {})}
                className={cn(
                  "group relative flex w-full items-start gap-3 rounded-xl px-2.5 py-2 text-left transition-colors",
                  clickable && "cursor-pointer hover:bg-[#FAFAFA]",
                  isCurrent && "bg-[#F0FDFA]/70"
                )}
              >
                <div className="relative mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center">
                  {isCurrent ? (
                    <motion.span
                      layoutId={`stepper-ring-${uid}`}
                      transition={motionTransitions.springSnappy}
                      className="absolute inset-0 rounded-full border-2 border-[#0F766E] bg-[#CCFBF1]/60"
                    />
                  ) : null}

                  <span
                    className={cn(
                      "relative z-10 flex h-6 w-6 items-center justify-center rounded-full text-xs font-mono-tabular font-semibold transition-colors",
                      isCompleted && "bg-[#047857] text-white",
                      isCurrent && "bg-[#0F766E] text-white",
                      isUpcoming && "border border-[#E4E4E7] bg-[#FAFAFA] text-[#71717A]"
                    )}
                  >
                    {isCompleted ? (
                      <svg
                        viewBox="0 0 16 16"
                        fill="none"
                        className="h-3.5 w-3.5"
                        aria-hidden="true"
                      >
                        <motion.path
                          d="M3.5 8.5L6.5 11.5L12.5 4.5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeDasharray="16"
                          initial={{ strokeDashoffset: 16 }}
                          animate={{ strokeDashoffset: 0 }}
                          transition={{ duration: 0.32, ease: "easeOut" }}
                        />
                      </svg>
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "truncate text-xs font-semibold",
                        isCompleted && "text-[#047857]",
                        isCurrent && "text-[#09090B]",
                        isUpcoming && "text-[#71717A]"
                      )}
                    >
                      {step.title}
                    </span>
                    {isCurrent ? (
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#0F766E]" />
                    ) : null}
                  </div>
                  {step.description ? (
                    <p
                      className={cn(
                        "mt-0.5 line-clamp-1 text-[11px]",
                        isUpcoming ? "text-[#A1A1AA]" : "text-[#52525B]"
                      )}
                    >
                      {step.description}
                    </p>
                  ) : null}
                </div>
              </Wrapper>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
