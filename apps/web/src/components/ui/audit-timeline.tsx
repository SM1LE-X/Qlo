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

export function AuditTimeline({ items }: { items: AuditEventItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#1E242D] bg-[#0D1014] px-4 py-8 text-center text-xs text-[#64748B]">
        No audit events recorded yet. Encrypt, grant, revoke, or settle a claim to populate on-chain event entries.
      </div>
    );
  }

  const iconMap = {
    registered: {
      Icon: Lock,
      tone: "text-[#38BDF8] bg-[#38BDF8]/10 border-[#38BDF8]/25",
    },
    granted: {
      Icon: CheckCircle2,
      tone: "text-[#10B981] bg-[#10B981]/10 border-[#10B981]/25",
    },
    revoked: {
      Icon: ShieldOff,
      tone: "text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/25",
    },
    accessed: {
      Icon: Eye,
      tone: "text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/25",
    },
    settled: {
      Icon: Landmark,
      tone: "text-[#10B981] bg-[#10B981]/10 border-[#10B981]/25",
    },
  };

  return (
    <div className="relative space-y-2.5 pl-5 before:absolute before:bottom-3 before:left-[15px] before:top-3 before:w-[1px] before:bg-[#1E242D]">
      {items.map((item, idx) => {
        const { Icon, tone } = iconMap[item.kind];
        return (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...motionTransitions.springGentle, delay: Math.min(idx * 0.04, 0.2) }}
            className="relative flex items-start gap-3 rounded-xl border border-[#1E242D] bg-[#0D1014] p-3.5 hover:border-[#2B3340] transition-colors"
          >
            <div
              className={`-ml-7 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${tone}`}
            >
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#F3F4F6]">{item.title}</span>
                <span className="font-mono-tabular text-[11px] text-[#64748B]">
                  {item.timestamp}
                </span>
              </div>
              <p className="text-xs text-[#94A3B8] break-all font-mono-tabular">{item.detail}</p>
              {item.txHash ? (
                <div className="pt-0.5">
                  <CopyHash label="Tx" value={item.txHash} explorerUrl={item.explorerUrl} />
                </div>
              ) : null}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
