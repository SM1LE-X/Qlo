"use client";

import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { TactileButton } from "@/components/ui/tactile-button";

export default function QloErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl py-16 px-4">
      <div className="rounded-2xl border border-[#FECACA] bg-white p-8 shadow-sm space-y-4">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold tracking-tight text-[#09090B]">
            Workspace Recovery Boundary
          </h1>
          <p className="text-xs text-[#52525B] leading-relaxed">
            A rendering or network exception occurred in this portal view. Your encrypted local IndexedDB vault and Ethereum Sepolia state remain untouched.
          </p>
        </div>
        {error?.message ? (
          <div className="rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] px-3.5 py-2.5 font-mono-tabular text-[11px] text-[#B91C1C] break-words">
            {error.message.slice(0, 220)}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2.5 pt-2">
          <TactileButton variant="primary" size="sm" onClick={() => reset()}>
            <RotateCcw className="h-3.5 w-3.5" />
            Try Again
          </TactileButton>
          <Link href="/">
            <TactileButton variant="secondary" size="sm">
              Return to Overview
            </TactileButton>
          </Link>
        </div>
      </div>
    </div>
  );
}
