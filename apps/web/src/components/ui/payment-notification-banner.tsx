"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { motionTransitions } from "@/lib/motion-tokens";

export interface PaymentNotificationBannerProps {
  appName?: string;
  amount: string;
  from: string;
  time?: string;
  showTriggerLabel?: string;
  className?: string;
}

/**
 * OpenSourceUI-inspired live instant settlement notification card
 * with crisp alabaster surface, emerald bank/shield badge, and dismiss/restore control.
 */
export function PaymentNotificationBanner({
  appName = "Qlo Clearinghouse",
  amount,
  from,
  time = "just now",
  showTriggerLabel = "Show settlement alert",
  className,
}: PaymentNotificationBannerProps) {
  const [visible, setVisible] = React.useState(true);

  return (
    <div className={cn("w-full", className)}>
      <AnimatePresence mode="wait">
        {visible ? (
          <motion.div
            key="banner"
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={motionTransitions.springGentle}
            className="flex items-start justify-between gap-3 rounded-2xl border border-[#E4E4E7] bg-white px-4 py-3 shadow-[0_6px_20px_rgba(9,9,11,0.06)]"
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]">
                <ShieldCheck className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="font-semibold text-[#09090B]">{appName}</span>
                  <span className="text-[#A1A1AA]">·</span>
                  <span className="font-mono-tabular text-[#71717A]">{time}</span>
                </div>
                <p className="mt-0.5 text-xs text-[#52525B]">
                  Instant escrow payout{" "}
                  <span className="font-mono-tabular font-semibold text-[#047857]">
                    {amount}
                  </span>{" "}
                  from{" "}
                  <span className="font-medium text-[#09090B]">{from}</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              aria-label="Dismiss settlement notification"
              onClick={() => setVisible(false)}
              className="rounded-lg p-1 text-[#71717A] transition-colors hover:bg-[#F4F4F5] hover:text-[#09090B] cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ) : (
          <motion.button
            key="restore"
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setVisible(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#E4E4E7] bg-white px-3 py-1.5 text-[11px] font-medium text-[#52525B] shadow-2xs transition-colors hover:border-[#D4D4D8] hover:text-[#09090B] cursor-pointer"
          >
            <Bell className="h-3 w-3 text-[#0F766E]" />
            <span>{showTriggerLabel}</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
