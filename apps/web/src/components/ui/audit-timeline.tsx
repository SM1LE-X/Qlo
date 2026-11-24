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
      <div className="rounded-xl border border-dashed border-[#E4E4E7] bg-[#F4F4F5] px-4 py-8 text-center text-xs text-[#71717A]">
        No audit events recorded yet. Encrypt, grant, revoke, or settle a claim to populate on-chain event entries.
      </div>
    );
  }

  const iconMap = {
    registered: {
      Icon: Lock,
      tone: "text-[#0284C7] bg-[#F0F9FF] border-[#0284C7]/25",
    },
    granted: {
      Icon: CheckCircle2,
      tone: "text-[#059669] bg-[#ECFDF5] border-[#059669]/25",
    },
    revoked: {
      Icon: ShieldOff,
      tone: "text-[#DC2626] bg-[#FEF2F2] border-[#DC2626]/25",
    },
    accessed: {
      Icon: Eye,
      tone: "text-[#B45309] bg-[#FFFBEB] border-[#F59E0B]/25",
    },
    settled: {
      Icon: Landmark,
      tone: "text-[#059669] bg-[#ECFDF5] border-[#059669]/25",
    },
  };

  return (
    <div className="relative space-y-2.5 pl-5 before:absolute before:bottom-3 before:left-[15px] before:top-3 before:w-[1px] before:bg-[#E4E4E7]">
      {items.map((item, idx) => {
        const { Icon, tone } = iconMap[item.kind];
        return (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...motionTransitions.springGentle, delay: Math.min(idx * 0.04, 0.2) }}
            className="relative flex items-start gap-3 rounded-xl border border-[#E4E4E7] bg-[#F4F4F5] p-3.5 hover:border-[#D4D4D8] transition-colors"
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
              <p className="text-xs text-[#52525B] break-all font-mono-tabular">{item.detail}</p>
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
