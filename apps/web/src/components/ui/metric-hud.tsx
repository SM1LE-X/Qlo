"use client";

import React, { useId, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Activity, ShieldCheck, Zap } from "lucide-react";
import { motionTransitions } from "@/lib/motion-tokens";
import { cn } from "@/lib/utils";
import { SpotlightCard } from "./spotlight-card";

interface HudMetric {
  id: string;
  label: string;
  headline: string;
  sublabel: string;
  deltaLabel: string;
  labels: string[];
  series: number[];
  unit: string;
}

const HUD_METRICS: HudMetric[] = [
  {
    id: "proving",
    label: "Groth16 Prover",
    headline: "~408 ms",
    sublabel: "Client-side BN254 witness + pairing verification (vs. ~120,000 ms AVS zkVM)",
    deltaLabel: "294x faster than AVS",
    labels: ["Witness", "Poseidon Hashes", "Merkle Depth-6", "BN254 MSM", "Verify Key", "Ready"],
    series: [12, 85, 165, 290, 380, 408],
    unit: "ms",
  },
  {
    id: "settlement",
    label: "Claim Settlement",
    headline: "< 3.0 s",
    sublabel: "Base Sepolia instant ETH transfer (vs. 14–30 day centralized EDI 837 clearinghouse)",
    deltaLabel: "0 clearinghouse intermediaries",
    labels: ["Intake", "AES-GCM", "Grant", "Prove", "Submit", "Settled"],
    series: [0.2, 0.35, 0.9, 1.4, 2.2, 2.7],
    unit: "s",
  },
  {
    id: "constraints",
    label: "Circuit Density",
    headline: "4,349 R1CS",
    sublabel: "Compiled --O2 within 8,192 capacity EF PSE Perpetual Powers of Tau (ppot_0080_13)",
    deltaLabel: "53.1% ptau_13 utilization",
    labels: ["Hospital", "Policy", "Clock", "CPT Tree", "Annual Cap", "Nullifier"],
    series: [720, 1490, 2110, 2980, 3760, 4349],
    unit: " R1CS",
  },
];

/**
 * EasyUI Light MetricHUD (MIT): crisp porcelain SVG bezier area telemetry with interactive hover crosshair.
 */
export function MetricHUD() {
  const [activeId, setActiveId] = useState<string>(HUD_METRICS[0].id);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const gradId = useId();

  const active = useMemo(
    () => HUD_METRICS.find((m) => m.id === activeId) ?? HUD_METRICS[0],
    [activeId]
  );

  const { lineD, areaD, pts } = useMemo(() => {
    const w = 520;
    const h = 128;
    const padX = 16;
    const padY = 16;
    const min = 0;
    const max = Math.max(...active.series, 1);

    const coords = active.series.map((v, i) => {
      const x = padX + (i / (active.series.length - 1)) * (w - padX * 2);
      const y = h - padY - ((v - min) / (max - min)) * (h - padY * 2);
      return { x, y, val: v, label: active.labels[i] };
    });

    const d = coords.reduce((acc, pt, i) => {
      if (i === 0) return `M ${pt.x} ${pt.y}`;
      const prev = coords[i - 1];
      const cx = (prev.x + pt.x) / 2;
      return `${acc} C ${cx} ${prev.y}, ${cx} ${pt.y}, ${pt.x} ${pt.y}`;
    }, "");

    const area = `${d} L ${coords[coords.length - 1].x} ${h} L ${coords[0].x} ${h} Z`;
    return { lineD: d, areaD: area, pts: coords };
  }, [active]);

  const inspected = hoverIdx !== null ? pts[hoverIdx] : pts[pts.length - 1];

  return (
    <SpotlightCard accent="emerald" className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#F4F4F5] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#99F6E4] bg-[#F0FDFA] text-[#0F766E]">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#09090B]">
              Protocol Telemetry &amp; Clearinghouse Benchmark
            </h2>
            <p className="text-xs text-[#52525B]">
              Zero-knowledge client execution profile vs. centralized EDI clearinghouses (192.7M records exposed in Change Healthcare).
            </p>
          </div>
        </div>

        {/* Light EasyUI Segmented Switcher */}
        <div className="inline-flex rounded-xl border border-[#E4E4E7] bg-[#F4F4F5] p-1">
          {HUD_METRICS.map((m) => {
            const isSel = m.id === active.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setActiveId(m.id);
                  setHoverIdx(null);
                }}
                className={cn(
                  "relative rounded-lg px-3 py-1 text-xs font-medium transition-colors cursor-pointer",
                  isSel ? "text-[#09090B]" : "text-[#71717A] hover:text-[#09090B]"
                )}
              >
                {isSel ? (
                  <motion.span
                    layoutId="metric-hud-pill"
                    transition={motionTransitions.springMorph}
                    className="absolute inset-0 rounded-lg bg-white shadow-xs border border-[#E4E4E7]/80"
                  />
                ) : null}
                <span className="relative z-10">{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <div className="lg:col-span-5 space-y-3">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#99F6E4] bg-[#F0FDFA] px-2.5 py-0.5 text-[11px] font-mono-tabular font-medium text-[#0F766E]">
            <Zap className="h-3 w-3" />
            {active.deltaLabel}
          </div>
          <div className="text-3xl sm:text-4xl font-bold tracking-tight font-mono-tabular text-[#09090B]">
            {active.headline}
          </div>
          <p className="text-xs text-[#52525B] leading-relaxed">{active.sublabel}</p>

          <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
            <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2]/60 px-3 py-2">
              <div className="text-[#71717A]">Legacy EDI 837</div>
              <div className="mt-0.5 font-mono-tabular font-semibold text-[#B91C1C]">14 – 30+ Days</div>
            </div>
            <div className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5]/80 px-3 py-2">
              <div className="text-[#52525B]">Qlo Browser Groth16</div>
              <div className="mt-0.5 font-mono-tabular font-semibold text-[#047857] flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> &lt; 3 Seconds
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-4">
          <div className="mb-2 flex items-center justify-between text-[11px] font-mono-tabular">
            <span className="text-[#52525B]">
              Stage: <span className="text-[#09090B] font-semibold">{inspected?.label}</span>
            </span>
            <span className="text-[#0F766E] font-semibold">
              {inspected?.val}
              {active.unit}
            </span>
          </div>

          <svg
            viewBox="0 0 520 128"
            className="h-32 w-full overflow-visible"
            onMouseLeave={() => setHoverIdx(null)}
          >
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0F766E" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#0F766E" stopOpacity="0" />
              </linearGradient>
            </defs>

            <path d={areaD} fill={`url(#${gradId})`} />
            <motion.path
              key={active.id}
              d={lineD}
              fill="none"
              stroke="#0F766E"
              strokeWidth="2.4"
              initial={{ opacity: 0.2 }}
              animate={{ opacity: 1 }}
              transition={motionTransitions.easeSoft}
            />

            {pts.map((pt, idx) => (
              <g key={pt.label}>
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={hoverIdx === idx ? 5.5 : 3.5}
                  fill={hoverIdx === idx ? "#09090B" : "#0F766E"}
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                />
                <rect
                  x={pt.x - 32}
                  y={0}
                  width={64}
                  height={128}
                  fill="transparent"
                  className="cursor-crosshair"
                  onMouseEnter={() => setHoverIdx(idx)}
                />
              </g>
            ))}
          </svg>

          <div className="mt-1 flex justify-between text-[10px] font-mono-tabular text-[#71717A]">
            {pts.map((p) => (
              <span key={p.label}>{p.label}</span>
            ))}
          </div>
        </div>
      </div>
    </SpotlightCard>
  );
}
