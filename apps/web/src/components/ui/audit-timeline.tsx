"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Eye, Landmark, Lock, ShieldOff } from "lucide-react";
import { motionTransitions } from "@/lib/motion-tokens";
import { CopyHash } from "./copy-hash";

export interface AuditEventItem {
  id: string;
  kind: "registered" | "granted" | "revoked" | "accessed" | "settled";
  title: string;
  detail: string;
  timestamp: string;
  txHash?: string;
  explorerUrl?: string;
}

/**
 * EasyUI Light InteractiveTimeline (MIT) for immutable audit event logs.
 */
export function AuditTimeline({ items }: { items: AuditEventItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#D4D4D8] bg-[#FAFAFA] px-4 py-8 text-center text-xs text-[#52525B]">
        No audit events recorded in this session yet. Encrypt, grant, or settle a claim to inspect immutable trail entries.
      </div>
    );
  }

  const iconMap = {
    registered: { Icon: Lock, tone: "text-[#0369A1] bg-[#F0F9FF] border-[#BAE6FD]" },
    granted: { Icon: CheckCircle2, tone: "text-[#047857] bg-[#ECFDF5] border-[#A7F3D0]" },
    revoked: { Icon: ShieldOff, tone: "text-[#B91C1C] bg-[#FEF2F2] border-[#FECACA]" },
    accessed: { Icon: Eye, tone: "text-[#B45309] bg-[#FFFBEB] border-[#FDE68A]" },
    settled: { Icon: Landmark, tone: "text-[#047857] bg-[#ECFDF5] border-[#A7F3D0]" },
  };

  return (
    <div className="relative space-y-3 pl-5 before:absolute before:bottom-3 before:left-[15px] before:top-3 before:w-[1px] before:bg-[#E4E4E7]">
      {items.map((item, idx) => {
        const { Icon, tone } = iconMap[item.kind];
        return (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...motionTransitions.springGentle, delay: Math.min(idx * 0.04, 0.2) }}
            className="relative flex items-start gap-3 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-3.5 hover:border-[#D4D4D8] hover:bg-white transition-colors"
          >
            <div
              className={`-ml-7 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${tone}`}
            >
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#09090B]">{item.title}</span>
                <span className="font-mono-tabular text-[11px] text-[#71717A]">
                  {item.timestamp}
                </span>
              </div>
              <p className="text-xs text-[#52525B] break-all">{item.detail}</p>
              {item.txHash ? (
                <CopyHash label="Tx" value={item.txHash} explorerUrl={item.explorerUrl} />
              ) : null}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
