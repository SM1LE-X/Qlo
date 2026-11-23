"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Lock, QrCode, RotateCw, ShieldCheck, Unlock } from "lucide-react";
import { motionTransitions } from "@/lib/motion-tokens";
import { shortHex } from "@/lib/utils";
import { SlidingCountdown } from "./number-ticker";

const PASS_PERFORATIONS = Array.from({ length: 14 }, (_, i) => i);

export interface WalletPassCardProps {
  policyId: string;
  patientAlias: string;
  cptCode?: string;
  icd10Code?: string;
  claimAmountEth?: string;
  encrypted: boolean;
  cid?: string;
  recordCommitmentHex?: string;
  recordId?: string;
  secondsRemaining?: number;
  targetHospital?: string;
}

/**
 * OpenSourceUI WalletPassCard (MIT): authentic light card with cobalt-to-teal header,
 * scalloped ticket perforations, crisp white summary footer, and flippable QR proof back.
 */
export function WalletPassCard({
  policyId,
  patientAlias,
  cptCode = "99285",
  icd10Code = "I21.0",
  claimAmountEth = "0.01",
  encrypted,
  cid = "",
  recordCommitmentHex = "",
  recordId = "",
  secondsRemaining = 0,
  targetHospital = "",
}: WalletPassCardProps) {
  const [flipped, setFlipped] = useState(false);

  const qrCells = useMemo(() => {
    const seed = (recordCommitmentHex || cid || policyId || "qlo-zk-pass").toLowerCase();
    return Array.from({ length: 25 }, (_, i) => {
      const code = seed.charCodeAt(i % seed.length);
      return ((code + i * 7) % 11) > 4;
    });
  }, [recordCommitmentHex, cid, policyId]);

  const activeGrant = secondsRemaining > 0;

  return (
    <div className="select-none" style={{ perspective: 1100 }}>
      <motion.div
        role="button"
        tabIndex={0}
        aria-label="Flip encrypted health policy pass"
        onClick={() => setFlipped((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setFlipped((prev) => !prev);
          }
        }}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={motionTransitions.springSmooth}
        className="relative w-full cursor-pointer"
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* FRONT FACE (OpenSourceUI light WalletPass styling) */}
        <div
          className="relative overflow-hidden rounded-2xl border border-[#E4E4E7] bg-white shadow-[0_14px_36px_-12px_rgba(15,23,42,0.16)]"
          style={{ backfaceVisibility: "hidden" }}
        >
          {/* Clinical Cobalt-to-Teal Header */}
          <div className="bg-gradient-to-br from-[#0F4C81] to-[#0F766E] p-5 text-white">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur-xs">
                  <ShieldCheck className="h-4.5 w-4.5 text-white" />
                </div>
                <div>
                  <div className="text-[10px] font-mono-tabular uppercase tracking-[0.18em] text-white/75">
                    Encrypted Policy Pass
                  </div>
                  <div className="text-sm font-semibold text-white">
                    Policy #{policyId}
                  </div>
                </div>
              </div>

              {activeGrant ? (
                <div className="flex items-center gap-1.5">
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-mono-tabular font-semibold text-white">
                    GRANTED
                  </span>
                  <SlidingCountdown secondsLeft={secondsRemaining} />
                </div>
              ) : encrypted ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-mono-tabular font-medium text-white">
                  <Lock className="h-3 w-3" />
                  AES-256-GCM
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-black/20 px-2.5 py-0.5 text-[10px] font-mono-tabular text-white/90">
                  <Unlock className="h-3 w-3" />
                  LOCAL DRAFT
                </span>
              )}
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3 text-xs">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-white/65">Patient Alias</div>
                <div className="mt-0.5 font-mono-tabular font-semibold text-white truncate">
                  {patientAlias}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-white/65">Private Codes</div>
                <div className="mt-0.5 font-mono-tabular font-semibold text-white">
                  {encrypted ? "•••• • •••••" : `${icd10Code} · ${cptCode}`}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-white/65">Claim Charge</div>
                <div className="mt-0.5 font-mono-tabular font-semibold text-white">
                  {claimAmountEth} ETH
                </div>
              </div>
            </div>
          </div>

          {/* OpenSourceUI Scalloped Ticket Perforations */}
          <div className="relative bg-white px-5 pb-4 pt-5">
            <div
              aria-hidden="true"
              className="absolute -top-1.5 inset-x-3 flex justify-between"
            >
              {PASS_PERFORATIONS.map((idx) => (
                <span key={idx} className="h-3 w-3 rounded-full bg-white" />
              ))}
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono-tabular text-[#52525B]">
              <span className="font-medium text-[#09090B]">
                {recordId
                  ? `On-Chain Record #${recordId}`
                  : cid
                  ? shortHex(cid, 12, 8)
                  : "Zero-Knowledge Envelope"}
              </span>
              <span className="inline-flex items-center gap-1 text-[#71717A]">
                <RotateCw className="h-3 w-3" />
                Inspect commitment
              </span>
            </div>
          </div>
        </div>

        {/* BACK FACE */}
        <div
          className="absolute inset-0 flex flex-col justify-between overflow-hidden rounded-2xl border border-[#E4E4E7] bg-white p-5 shadow-[0_14px_36px_-12px_rgba(15,23,42,0.16)]"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#09090B]">
              <QrCode className="h-4 w-4 text-[#0F766E]" />
              Cryptographic Commitment
            </div>
            <span className="rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-2.5 py-0.5 text-[10px] font-mono-tabular font-semibold text-[#047857]">
              0 PHI BYTES
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="grid grid-cols-5 gap-1 rounded-xl border border-[#E4E4E7] bg-[#F4F4F5] p-2 shrink-0">
              {qrCells.map((lit, idx) => (
                <span
                  key={idx}
                  className={`h-2.5 w-2.5 rounded-[2px] ${
                    lit ? "bg-[#09090B]" : "bg-white"
                  }`}
                />
              ))}
            </div>
            <div className="min-w-0 flex-1 space-y-1.5 text-[11px] font-mono-tabular">
              <div>
                <span className="text-[#71717A]">Commit: </span>
                <span className="text-[#09090B] font-medium">
                  {recordCommitmentHex ? shortHex(recordCommitmentHex, 10, 8) : "Pending local encrypt"}
                </span>
              </div>
              <div>
                <span className="text-[#71717A]">CIDv1: </span>
                <span className="text-[#09090B] font-medium">
                  {cid ? shortHex(cid, 12, 6) : "IndexedDB qlo-vault-v1"}
                </span>
              </div>
              <div>
                <span className="text-[#71717A]">Hospital: </span>
                <span className="text-[#52525B]">
                  {targetHospital ? shortHex(targetHospital, 8, 6) : "Accredited ECDH P-256"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono-tabular text-[#71717A]">
            <span>Poseidon(policySalt, policyId, recordCommit)</span>
            <span className="inline-flex items-center gap-1">
              <RotateCw className="h-3 w-3" />
              Front
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
