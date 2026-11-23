"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type StatDeltaTone = "emerald" | "teal" | "amber" | "neutral";

export interface StatCardProps {
  label: string;
  valueText: React.ReactNode;
  sublabel?: string;
  deltaText?: string;
  deltaTone?: StatDeltaTone;
  trend?: number[];
  trendLabels?: string[];
  accentColor?: string;
  className?: string;
}

const DELTA_STYLES: Record<StatDeltaTone, string> = {
  emerald: "border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]",
  teal: "border-[#99F6E4] bg-[#F0FDFA] text-[#0F766E]",
  amber: "border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]",
  neutral: "border-[#E4E4E7] bg-[#F4F4F5] text-[#52525B]",
};

function buildMonotonePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const midX = (p0.x + p1.x) / 2;
    d += ` C ${midX.toFixed(2)} ${p0.y.toFixed(2)}, ${midX.toFixed(2)} ${p1.y.toFixed(2)}, ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
  }
  return d;
}

/**
 * EasyUI-inspired metric card with an interactive scrubbable smooth SVG sparkline,
 * high-contrast tabular numbers, and a pill delta indicator.
 */
export function StatCard({
  label,
  valueText,
  sublabel,
  deltaText,
  deltaTone = "emerald",
  trend = [],
  trendLabels,
  accentColor = "#0F766E",
  className,
}: StatCardProps) {
  const uid = React.useId().replace(/:/g, "");
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);

  const width = 164;
  const height = 42;
  const padX = 4;
  const padY = 5;

  const coords = React.useMemo(() => {
    if (trend.length === 0) return [];
    const min = Math.min(...trend);
    const max = Math.max(...trend);
    const span = max - min || 1;
    const innerW = width - padX * 2;
    const innerH = height - padY * 2;
    return trend.map((v, i) => {
      const x =
        trend.length === 1 ? padX + innerW / 2 : padX + (i / (trend.length - 1)) * innerW;
      const y = padY + (1 - (v - min) / span) * innerH;
      return { x, y, v };
    });
  }, [trend]);

  const strokePath = React.useMemo(() => buildMonotonePath(coords), [coords]);
  const areaPath = React.useMemo(() => {
    if (coords.length === 0) return "";
    const first = coords[0];
    const last = coords[coords.length - 1];
    return `${strokePath} L ${last.x.toFixed(2)} ${height} L ${first.x.toFixed(2)} ${height} Z`;
  }, [coords, strokePath]);

  const activePoint = hoverIndex !== null ? coords[hoverIndex] : null;
  const activeLabel =
    hoverIndex !== null && trendLabels?.[hoverIndex] ? trendLabels[hoverIndex] : null;

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (coords.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const relX = ((e.clientX - rect.left) / rect.width) * width;
    let closest = 0;
    let minDist = Infinity;
    for (let i = 0; i < coords.length; i++) {
      const d = Math.abs(coords[i].x - relX);
      if (d < minDist) {
        minDist = d;
        closest = i;
      }
    }
    setHoverIndex(closest);
  };

  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[#E4E4E7] bg-white p-4 shadow-[0_1px_2px_rgba(9,9,11,0.03)] transition-colors hover:border-[#D4D4D8]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-[#52525B]">{label}</span>
        {deltaText ? (
          <span
            className={cn(
              "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-mono-tabular font-semibold",
              DELTA_STYLES[deltaTone]
            )}
          >
            {deltaText}
          </span>
        ) : null}
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <div className="min-w-0 text-lg sm:text-xl font-bold tracking-tight text-[#09090B] font-mono-tabular whitespace-nowrap">
          {valueText}
        </div>

        {coords.length >= 2 ? (
          <div className="shrink-0">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="h-8 w-20 cursor-crosshair overflow-visible"
              onPointerMove={handlePointerMove}
              onPointerLeave={() => setHoverIndex(null)}
              aria-hidden="true"
            >
              <defs>
                <linearGradient id={`spark-${uid}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accentColor} stopOpacity="0.22" />
                  <stop offset="100%" stopColor={accentColor} stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path d={areaPath} fill={`url(#spark-${uid})`} />
              <path
                d={strokePath}
                fill="none"
                stroke={accentColor}
                strokeWidth="1.75"
                strokeLinecap="round"
              />
              {activePoint ? (
                <>
                  <line
                    x1={activePoint.x}
                    x2={activePoint.x}
                    y1={2}
                    y2={height - 2}
                    stroke="#D4D4D8"
                    strokeDasharray="2 2"
                    strokeWidth="1"
                  />
                  <circle
                    cx={activePoint.x}
                    cy={activePoint.y}
                    r="3.2"
                    fill="#FFFFFF"
                    stroke={accentColor}
                    strokeWidth="2"
                  />
                </>
              ) : null}
            </svg>
          </div>
        ) : null}
      </div>

      <div className="mt-1.5 min-h-[16px] text-[11px] text-[#71717A] truncate">
        {activePoint ? (
          <span className="font-mono-tabular text-[#09090B]">
            {activeLabel ? `${activeLabel}: ` : ""}
            {activePoint.v}
          </span>
        ) : (
          sublabel ?? ""
        )}
      </div>
    </div>
  );
}
