"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { motionTransitions } from "@/lib/motion-tokens";

export interface AccordionItem {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  content: React.ReactNode;
}

export interface SmoothAccordionProps {
  items: AccordionItem[];
  allowMultiple?: boolean;
  defaultOpen?: string[];
  className?: string;
}

/**
 * EasyUI-inspired accessible light accordion with spring height expansion
 * and crisp alabaster border dividers.
 */
export function SmoothAccordion({
  items,
  allowMultiple = false,
  defaultOpen = [],
  className,
}: SmoothAccordionProps) {
  const [openIds, setOpenIds] = React.useState<string[]>(defaultOpen);

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const exists = prev.includes(id);
      if (allowMultiple) {
        return exists ? prev.filter((item) => item !== id) : [...prev, id];
      }
      return exists ? [] : [id];
    });
  };

  return (
    <div
      className={cn(
        "divide-y divide-[#E4E4E7] overflow-hidden rounded-2xl border border-[#E4E4E7] bg-white shadow-[0_1px_2px_rgba(9,9,11,0.03)]",
        className
      )}
    >
      {items.map((item) => {
        const isOpen = openIds.includes(item.id);
        const panelId = `accordion-panel-${item.id}`;
        const buttonId = `accordion-trigger-${item.id}`;

        return (
          <div key={item.id}>
            <button
              id={buttonId}
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => toggle(item.id)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-[#FAFAFA] cursor-pointer"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-[#09090B]">
                    {item.title}
                  </span>
                  {item.badge ? (
                    <span className="rounded-full border border-[#E4E4E7] bg-[#F4F4F5] px-2 py-0.5 text-[10px] font-mono-tabular font-semibold text-[#52525B]">
                      {item.badge}
                    </span>
                  ) : null}
                </div>
                {item.subtitle ? (
                  <p className="mt-0.5 text-xs text-[#52525B]">{item.subtitle}</p>
                ) : null}
              </div>

              <motion.span
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={motionTransitions.springSnappy}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] text-[#52525B]"
              >
                <ChevronDown className="h-4 w-4" />
              </motion.span>
            </button>

            <AnimatePresence initial={false}>
              {isOpen ? (
                <motion.div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={motionTransitions.easeSoft}
                  className="overflow-hidden"
                >
                  <div className="border-t border-[#F4F4F5] bg-[#FAFAFA]/60 px-5 py-4 text-xs leading-relaxed text-[#52525B]">
                    {item.content}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
