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
        "inline-flex items-center gap-2 rounded-lg border border-[#E4E4E7] bg-[#F4F4F5] px-2.5 py-1 text-xs transition-colors hover:border-[#D4D4D8]",
        className
      )}
    >
      {label ? <span className="text-[#52525B] font-medium">{label}</span> : null}
      <code className="font-mono-tabular text-[#09090B]">
        {truncate ? shortHex(value, 10, 8) : value}
      </code>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={`Copy ${label || "value"}`}
        className="text-[#71717A] hover:text-[#059669] transition-colors cursor-pointer"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-[#059669]" />
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
          className="text-[#71717A] hover:text-[#0284C7] transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ) : null}
    </div>
  );
}
