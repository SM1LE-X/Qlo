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
        "divide-y divide-[#1E242D] overflow-hidden rounded-xl border border-[#1E242D] bg-[#111419]",
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
              className="flex w-full items-center justify-between gap-4 px-5 py-3.5 text-left transition-colors hover:bg-[#161B22] cursor-pointer"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-[#F3F4F6]">{item.title}</span>
                  {item.badge ? (
                    <span className="rounded-md border border-[#1E242D] bg-[#0D1014] px-2 py-0.5 text-[10px] font-mono-tabular font-medium text-[#94A3B8]">
                      {item.badge}
                    </span>
                  ) : null}
                </div>
                {item.subtitle ? (
                  <p className="mt-0.5 text-xs text-[#94A3B8]">{item.subtitle}</p>
                ) : null}
              </div>

              <motion.span
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={motionTransitions.springSnappy}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#1E242D] bg-[#0D1014] text-[#94A3B8]"
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
                  <div className="border-t border-[#1E242D] bg-[#0D1014] px-5 py-4 text-xs leading-relaxed text-[#94A3B8]">
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
