"use client";

import { motion } from "framer-motion";
import { ShieldAlert, Lock, Cpu, Landmark, UserCheck } from "lucide-react";

/**
 * Light Three-Party Zero-PHI Architecture flow visualization.
 */
export function AnimatedZkFlow() {
  const nodes = [
    {
      label: "Patient Vault",
      sub: "AES-256-GCM + OCR",
      icon: UserCheck,
      accent: "border-[#99F6E4] text-[#0F766E] bg-[#F0FDFA]",
    },
    {
      label: "IPFS CIDv1",
      sub: "IndexedDB + .qlo.json",
      icon: Lock,
      accent: "border-[#FDE68A] text-[#B45309] bg-[#FFFBEB]",
    },
    {
      label: "Provider Prover",
      sub: "Groth16 (<3s WASM)",
      icon: Cpu,
      accent: "border-[#A7F3D0] text-[#047857] bg-[#ECFDF5]",
    },
    {
      label: "Ethereum Sepolia",
      sub: "ClaimsVault + ETH",
      icon: Landmark,
      accent: "border-[#BAE6FD] text-[#0369A1] bg-[#F0F9FF]",
    },
  ];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#E4E4E7] bg-white p-6 card-porcelain">
      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-3">
        {nodes.map((node, idx) => {
          const Icon = node.icon;
          return (
            <div key={node.label} className="flex items-center gap-2.5 w-full md:flex-1 min-w-0">
              <div className="flex items-center gap-3 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] px-3.5 py-3 w-full hover:border-[#D4D4D8] transition-colors">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${node.accent}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#09090B] whitespace-nowrap">
                    {node.label}
                  </div>
                  <div className="text-[11px] font-mono-tabular text-[#52525B] whitespace-nowrap">
                    {node.sub}
                  </div>
                </div>
              </div>
              {idx < nodes.length - 1 ? (
                <div className="hidden md:flex items-center w-7 shrink-0 relative h-4">
                  <div className="h-[1px] w-full bg-[#E4E4E7]" />
                  <motion.div
                    className="absolute h-2 w-2 rounded-full bg-[#0F766E] shadow-[0_0_8px_rgba(15,118,110,0.45)]"
                    animate={{ x: [0, 20, 0] }}
                    transition={{
                      repeat: Infinity,
                      duration: 2.2,
                      delay: idx * 0.35,
                      ease: "easeInOut",
                    }}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-2.5 text-xs">
        <div className="flex items-center gap-2 text-[#B91C1C] font-medium">
          <ShieldAlert className="h-4 w-4 text-[#DC2626] shrink-0" />
          <span>Zero-PHI Boundary:</span>
          <span className="font-mono-tabular text-[#09090B]">
            ICD-10 diagnoses, CPT codes, prescriptions, clinical notes, and private policy limits remain off-chain.
          </span>
        </div>
        <span className="font-mono-tabular text-[11px] text-[#047857] border border-[#A7F3D0] rounded-full px-2.5 py-0.5 bg-[#ECFDF5]">
          8 Public Field Signals Only
        </span>
      </div>
    </div>
  );
}
