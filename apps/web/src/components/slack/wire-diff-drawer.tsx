"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Lock, ShieldCheck, ShieldOff, X } from "lucide-react";
import { ROLE_META } from "@/lib/roles";
import type { SlackBlockMessage, SlackRole } from "@/lib/slack/blocks";

interface WireDiffDrawerProps {
  open: boolean;
  onClose: () => void;
  message: SlackBlockMessage | null;
  channel: SlackRole;
  messageLabel?: string;
}

const REDACTED_FIELDS: ReadonlyArray<string> = [
  "Patient Name",
  "Diagnosis / ICD-10",
  "CPT Line Items",
  "Clinical Notes",
];

const CIPHERTEXT_ENVELOPE_PREVIEW = [
  '{"version":1,"alg":"AES-256-GCM","iv":"7f9c2a1b4e8d30f1a9c2b4e6",',
  '"ciphertext":"U2FsdGVkX19q8xM4kV2p9L0nR7wT3zC1yB6hF5dJ8mQ..."}',
].join("\n");

export function WireDiffDrawer({
  open,
  onClose,
  message,
  channel,
  messageLabel,
}: WireDiffDrawerProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(id);
  }, [copied]);

  const { prettyJson, byteLength } = useMemo(() => {
    if (!message) return { prettyJson: "", byteLength: 0 };
    const serialized = JSON.stringify(message, null, 2);
    return {
      prettyJson: serialized,
      byteLength: new TextEncoder().encode(serialized).length,
    };
  }, [message]);

  const handleCopy = async () => {
    if (!prettyJson) return;
    try {
      await navigator.clipboard.writeText(prettyJson);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const meta = ROLE_META[channel];

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
            aria-hidden="true"
            className="fixed inset-0 bg-[#09090B]/25 backdrop-blur-[2px]"
          />

          {/* Slide-over panel */}
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Wire payload inspector"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 flex h-full w-full max-w-lg flex-col border-l border-[#E4E4E7] bg-[#FAFAFA] text-[#09090B] shadow-[0_0_40px_rgba(9,9,11,0.12)]"
          >
            {/* Header */}
            <header className="flex items-start justify-between gap-3 border-b border-[#E4E4E7] px-5 py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-[#09090B]">
                    Wire payload
                  </h2>
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#059669]/35 bg-[#ECFDF5] px-2 py-0.5 font-mono-tabular text-[11px] font-medium text-[#059669]">
                    <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                    0 PHI Bytes
                  </span>
                </div>
                <p className="mt-1 font-mono-tabular text-[11px] text-[#71717A]">
                  {meta.channelName}
                  {messageLabel ? ` · ${messageLabel}` : " · Latest Block Kit event"}
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close wire payload inspector"
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#E4E4E7] bg-[#FFFFFF] text-[#52525B] transition hover:border-[#D4D4D8] hover:text-[#09090B]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>

            {/* Body */}
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
              {/* Section 1: Sent to Slack */}
              <section aria-label="Outbound zero-PHI Slack payload" className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#059669]" aria-hidden="true" />
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#27272A]">
                      Outbound payload
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="rounded-md border border-[#E4E4E7] bg-[#FFFFFF] px-2 py-0.5 font-mono-tabular text-[11px] text-[#52525B]">
                      {byteLength} bytes
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleCopy()}
                      disabled={!prettyJson}
                      aria-label="Copy JSON payload"
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[#D4D4D8] bg-[#FFFFFF] px-2.5 py-1 text-[11px] font-medium text-[#18181B] transition hover:border-[#A1A1AA] hover:bg-[#19202B] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3 w-3 text-[#059669]" aria-hidden="true" />
                          <span className="text-[#059669]">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 text-[#52525B]" aria-hidden="true" />
                          <span>Copy JSON</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-[#E4E4E7] bg-[#FAFAFA]">
                  <div className="flex items-center justify-between border-b border-[#E4E4E7] bg-[#F4F4F5] px-3.5 py-2 font-mono-tabular text-[11px] text-[#71717A]">
                    <span>POST /services/webhook · application/json</span>
                    <span className="text-[#059669]">HMAC-SHA256</span>
                  </div>
                  {prettyJson ? (
                    <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap break-words p-3.5 font-mono-tabular text-[11.5px] leading-[1.6] text-[#27272A]">
                      {prettyJson}
                    </pre>
                  ) : (
                    <div className="p-4 text-[12px] text-[#71717A]">
                      No payload in {meta.channelName} yet. Run a /qlo command or open Walkthrough.
                    </div>
                  )}
                </div>
              </section>

              {/* Section 2: Kept on Patient Device */}
              <section aria-label="Local ciphertext never transmitted" className="space-y-3">
                <div className="flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-[#B45309]" aria-hidden="true" />
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#27272A]">
                    Local vault (never transmitted)
                  </h3>
                </div>

                <div className="rounded-xl border border-[#E4E4E7] bg-[#FFFFFF] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-medium text-[#18181B]">
                      Encrypted locally (AES-256-GCM)
                    </span>
                    <span className="rounded border border-[#D4D4D8] bg-[#FAFAFA] px-2 py-0.5 font-mono-tabular text-[10px] uppercase tracking-wider text-[#52525B]">
                      Local Vault
                    </span>
                  </div>

                  <p className="whitespace-pre-wrap break-words rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] p-3 font-mono-tabular text-[11px] leading-relaxed text-[#059669]">
                    {CIPHERTEXT_ENVELOPE_PREVIEW}
                  </p>

                  <div className="pt-1">
                    <p className="mb-2 text-[11px] text-[#71717A]">
                      Never transmitted:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {REDACTED_FIELDS.map((field) => (
                        <span
                          key={field}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[#DC2626]/30 bg-[#FEF2F2] px-2.5 py-1 text-[11px] font-medium text-[#DC2626]"
                        >
                          <ShieldOff className="h-3 w-3 text-[#DC2626]" aria-hidden="true" />
                          <span>{field}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
