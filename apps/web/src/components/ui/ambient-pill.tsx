"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Check, Loader2 } from "lucide-react";

export type AmbientTone = "working" | "done" | "error";

interface AmbientState {
  label: string;
  detail?: string;
  tone: AmbientTone;
}

interface AmbientContextValue {
  showStatus: (label: string, tone?: AmbientTone, detail?: string) => void;
  clearStatus: () => void;
}

const AmbientContext = createContext<AmbientContextValue | null>(null);

export function AmbientStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AmbientState | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const clearStatus = useCallback(() => {
    clearTimer();
    setStatus(null);
  }, []);

  const showStatus = useCallback(
    (label: string, tone: AmbientTone = "working", detail?: string) => {
      clearTimer();
      setStatus({ label, tone, detail });
      if (tone === "done" || tone === "error") {
        timerRef.current = window.setTimeout(() => {
          setStatus(null);
          timerRef.current = null;
        }, tone === "done" ? 3200 : 4800);
      }
    },
    []
  );

  useEffect(() => clearTimer, []);

  const value = useMemo(
    () => ({ showStatus, clearStatus }),
    [showStatus, clearStatus]
  );

  return (
    <AmbientContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4"
      >
        <AnimatePresence>
          {status ? (
            <motion.div
              key={`${status.tone}-${status.label}`}
              initial={{ opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.96 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto inline-flex max-w-md items-center gap-2.5 rounded-full border border-[#27272A] bg-[#09090B] px-4 py-2 text-xs font-medium text-white shadow-[0_12px_32px_rgba(9,9,11,0.22)]"
            >
              {status.tone === "working" ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#34D399]" aria-hidden="true" />
              ) : status.tone === "done" ? (
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#059669] text-white">
                  <Check className="h-2.5 w-2.5" aria-hidden="true" />
                </span>
              ) : (
                <AlertCircle className="h-3.5 w-3.5 shrink-0 text-[#F87171]" aria-hidden="true" />
              )}
              <span className="truncate">{status.label}</span>
              {status.detail ? (
                <span className="hidden sm:inline truncate border-l border-white/15 pl-2.5 font-mono-tabular text-[11px] text-[#A1A1AA]">
                  {status.detail}
                </span>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </AmbientContext.Provider>
  );
}

export function useAmbientStatus(): AmbientContextValue {
  const ctx = useContext(AmbientContext);
  if (!ctx) {
    return {
      showStatus: () => undefined,
      clearStatus: () => undefined,
    };
  }
  return ctx;
}
