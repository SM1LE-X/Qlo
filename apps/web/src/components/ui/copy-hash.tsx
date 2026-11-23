"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { cn, shortHex } from "@/lib/utils";

export function CopyHash({
  label,
  value,
  explorerUrl,
  truncate = true,
  className,
}: {
  label?: string;
  value: string;
  explorerUrl?: string;
  truncate?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked in restricted context
    }
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border border-[#1E242D] bg-[#0D1014] px-2.5 py-1 text-xs transition-colors hover:border-[#2B3340]",
        className
      )}
    >
      {label ? <span className="text-[#94A3B8] font-medium">{label}</span> : null}
      <code className="font-mono-tabular text-[#F3F4F6]">
        {truncate ? shortHex(value, 10, 8) : value}
      </code>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={`Copy ${label || "value"}`}
        className="text-[#64748B] hover:text-[#10B981] transition-colors cursor-pointer"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-[#10B981]" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
      {explorerUrl ? (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="Open on block explorer"
          className="text-[#64748B] hover:text-[#38BDF8] transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ) : null}
    </div>
  );
}
