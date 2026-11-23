"use client";

import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * OpenSourceUI Light BrowserMockupCard (MIT): clean macOS browser window for the Zero-PHI Inspector.
 */
export function BrowserMockupCard({
  url = "sepolia://claimsvault/submitClaim",
  rightSlot,
  children,
  className,
}: {
  url?: string;
  rightSlot?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-[#E4E4E7] bg-white card-porcelain",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E4E4E7] bg-[#F4F4F5] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#EF4444]/85" />
          <span className="h-3 w-3 rounded-full bg-[#F59E0B]/85" />
          <span className="h-3 w-3 rounded-full bg-[#10B981]/85" />
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-[#E4E4E7] bg-white px-3 py-1 text-[11px] font-mono-tabular text-[#52525B] shadow-2xs">
          <Lock className="h-3 w-3 text-[#0F766E]" />
          <span className="truncate max-w-[240px] sm:max-w-md">{url}</span>
        </div>

        <div className="flex items-center">{rightSlot}</div>
      </div>

      <div className="p-6 bg-white">{children}</div>
    </div>
  );
}
