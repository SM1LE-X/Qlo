"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Receipt } from "lucide-react";
import { motionTransitions } from "@/lib/motion-tokens";
import { shortHex } from "@/lib/utils";
import { CopyHash } from "./copy-hash";

const CUT_TEETH = Array.from({ length: 18 }, (_, i) => i);

/**
 * EasyUI Light Paper PaymentReceiptPrinter (MIT) for ZK claim auto-settlement receipts.
 */
export function PaymentReceiptPrinter({
  txHash,
  explorerUrl,
  amountEth,
  hospitalAddress,
  nullifier,
}: {
  txHash: string;
  explorerUrl?: string;
  amountEth: string;
  hospitalAddress: string;
  nullifier: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={motionTransitions.springGentle}
      className="relative overflow-hidden rounded-xl border border-[#A7F3D0] bg-white p-4 pb-5 shadow-[0_10px_28px_-10px_rgba(15,118,110,0.2)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-dashed border-[#E4E4E7] pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ECFDF5] border border-[#A7F3D0] text-[#047857]">
            <Receipt className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[10px] font-mono-tabular uppercase tracking-wider font-semibold text-[#047857]">
              Settlement Confirmation
            </div>
            <div className="text-xs font-semibold text-[#09090B]">
              ClaimsVault Escrow Payout
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-sm font-mono-tabular font-bold text-[#047857]">
          <CheckCircle2 className="h-4 w-4" />+{amountEth} ETH
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono-tabular">
        <div>
          <span className="text-[#71717A]">Hospital Recipient: </span>
          <span className="text-[#09090B] font-medium">{shortHex(hospitalAddress, 8, 6)}</span>
        </div>
        <div>
          <span className="text-[#71717A]">Nullifier Spent: </span>
          <span className="text-[#09090B] font-medium">{nullifier.slice(0, 14)}...</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#F4F4F5]">
        <CopyHash label="Settled Tx" value={txHash} explorerUrl={explorerUrl} />
        <span className="text-[10px] font-mono-tabular uppercase tracking-widest text-[#047857] font-medium">
          0 PHI Bytes On-Chain
        </span>
      </div>

      <div aria-hidden="true" className="absolute -bottom-1.5 inset-x-2 flex justify-between">
        {CUT_TEETH.map((t) => (
          <span key={t} className="h-2.5 w-2.5 rounded-full bg-[#FAFAFA] border border-[#E4E4E7]" />
        ))}
      </div>
    </motion.div>
  );
}
