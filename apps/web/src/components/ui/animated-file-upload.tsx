"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ScanText, Sparkles, Upload } from "lucide-react";
import { motionTransitions } from "@/lib/motion-tokens";
import { cn } from "@/lib/utils";
import { TactileButton } from "./tactile-button";

export interface AnimatedFileUploadProps {
  ocrRunning: boolean;
  ocrStatus: string;
  onRunSampleOcr: () => void;
  onFileSelected: (file: File) => void;
}

/**
 * EasyUI Light AnimatedFileUpload (MIT) for 100% browser-local CMS-1500 & Tesseract OCR intake.
 */
export function AnimatedFileUpload({
  ocrRunning,
  ocrStatus,
  onRunSampleOcr,
  onFileSelected,
}: AnimatedFileUploadProps) {
  const [dragging, setDragging] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onFileSelected(file);
      }}
      className={cn(
        "relative overflow-hidden rounded-xl border border-dashed p-4 transition-all duration-200",
        dragging
          ? "border-[#0F766E] bg-[#F0FDFA]"
          : ocrRunning
          ? "border-[#0F766E]/60 bg-[#F0FDFA]/70"
          : "border-[#D4D4D8] bg-[#FAFAFA] hover:border-[#A1A1AA]"
      )}
    >
      {ocrRunning ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#0F766E] to-transparent shadow-[0_0_12px_rgba(15,118,110,0.55)]"
          style={{ animation: "ocr-laser-sweep 1.6s ease-in-out infinite" }}
        />
      ) : null}

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors",
              ocrRunning
                ? "border-[#99F6E4] bg-[#F0FDFA] text-[#0F766E]"
                : "border-[#E4E4E7] bg-white text-[#09090B]"
            )}
          >
            {ocrRunning ? <Sparkles className="h-4 w-4 animate-pulse" /> : <Upload className="h-4 w-4" />}
          </div>
          <div className="space-y-0.5">
            <div className="text-xs font-semibold text-[#09090B]">
              Drop CMS-1500 medical bill (PNG / JSON / TXT)
            </div>
            <div className="text-[11px] text-[#52525B]">
              Same-origin Tesseract WASM OCR runs locally in your browser — 0 bytes sent externally.
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <TactileButton
            size="sm"
            variant="primary"
            onClick={onRunSampleOcr}
            disabled={ocrRunning}
          >
            <ScanText className="h-3.5 w-3.5" />
            {ocrRunning ? "OCR Running..." : "Run Sample Bill OCR"}
          </TactileButton>

          <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-[#E4E4E7] bg-white px-3 text-xs font-medium text-[#09090B] hover:bg-[#F4F4F5] transition-colors">
            <Upload className="h-3.5 w-3.5" />
            Upload Bill (PNG/JSON/TXT)
            <input
              id="bill-upload"
              aria-label="Upload medical bill PNG, JSON, or TXT"
              type="file"
              accept="image/*,.json,.txt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onFileSelected(file);
              }}
            />
          </label>
        </div>
      </div>

      <AnimatePresence>
        {ocrStatus ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={motionTransitions.easeFast}
            className="mt-3 rounded-lg border border-[#99F6E4] bg-white px-3 py-1.5 font-mono-tabular text-[11px] text-[#0F766E]"
          >
            {ocrStatus}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
