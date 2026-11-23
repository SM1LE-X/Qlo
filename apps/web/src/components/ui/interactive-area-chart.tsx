"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { motionTransitions } from "@/lib/motion-tokens";

export interface AreaSeriesPoint {
  label: string;
  value: number;
}

export interface InteractiveAreaChartProps {
  data: Record<string, AreaSeriesPoint[]>;
  defaultRange?: string;
  title?: string;
  subtitle?: string;
  accentColor?: string;
  formatValue?: (value: number) => string;
  className?: string;
}

function buildCatmullRomPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;

  let path = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? i : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return path;
}

/**
 * EasyUI-inspired interactive area chart using deterministic Catmull-Rom splines,
 * animated timeframe switcher pills, and hover crosshair inspection.
 */
export function InteractiveAreaChart({
  data,
  defaultRange,
  title,
  subtitle,
  accentColor = "#0F766E",
  formatValue = (v) => `${v}`,
  className,
}: InteractiveAreaChartProps) {
  const uid = React.useId().replace(/:/g, "");
  const ranges = Object.keys(data);
  const [range, setRange] = React.useState<string>(
    defaultRange && data[defaultRange] ? defaultRange : ranges[0] ?? ""
  );
  const [hoverIdx, setHoverIdx] = React.useState<number | null>(null);

  const series = React.useMemo(() => data[range] ?? [], [data, range]);
  const width = 640;
  const height = 210;
  const padL = 10;
  const padR = 10;
  const padT = 18;
  const padB = 26;

  const coords = React.useMemo(() => {
    if (series.length === 0) return [];
    const maxVal = Math.max(...series.map((d) => d.value), 1);
    const minVal = Math.min(...series.map((d) => d.value), 0);
    const span = maxVal - minVal || 1;
    const innerW = width - padL - padR;
    const innerH = height - padT - padB;
    return series.map((pt, idx) => {
      const x =
        series.length === 1 ? padL + innerW / 2 : padL + (idx / (series.length - 1)) * innerW;
      const y = padT + (1 - (pt.value - minVal) / span) * innerH;
      return { ...pt, x, y };
    });
  }, [series]);

  const linePath = React.useMemo(() => buildCatmullRomPath(coords), [coords]);
  const areaPath = React.useMemo(() => {
    if (coords.length === 0) return "";
    const base = height - padB;
    return `${linePath} L ${coords[coords.length - 1].x.toFixed(2)} ${base} L ${coords[0].x.toFixed(2)} ${base} Z`;
  }, [coords, linePath]);

  const active =
    hoverIdx !== null && coords[hoverIdx]
      ? coords[hoverIdx]
      : coords[coords.length - 1] ?? null;

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (coords.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const relX = ((e.clientX - rect.left) / rect.width) * width;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < coords.length; i++) {
      const d = Math.abs(coords[i].x - relX);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    setHoverIdx(best);
  };

  return (
    <div
      className={cn(
        "rounded-2xl border border-[#E4E4E7] bg-white p-5 shadow-[0_1px_2px_rgba(9,9,11,0.03)]",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {title ? (
            <h3 className="text-sm font-semibold text-[#09090B]">{title}</h3>
          ) : null}
          {subtitle ? (
            <p className="text-xs text-[#52525B] mt-0.5">{subtitle}</p>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          {active ? (
            <div className="text-right font-mono-tabular">
              <div className="text-sm font-bold text-[#09090B]">
                {formatValue(active.value)}
              </div>
              <div className="text-[10px] text-[#71717A]">{active.label}</div>
            </div>
          ) : null}

          {ranges.length > 1 ? (
            <div
              role="group"
              aria-label="Chart timeframe"
              className="inline-flex items-center rounded-xl border border-[#E4E4E7] bg-[#F4F4F5] p-0.5"
            >
              {ranges.map((r) => {
                const selected = r === range;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setRange(r);
                      setHoverIdx(null);
                    }}
                    className={cn(
                      "relative rounded-lg px-2.5 py-1 text-[11px] font-mono-tabular font-semibold transition-colors cursor-pointer",
                      selected ? "text-[#09090B]" : "text-[#71717A] hover:text-[#09090B]"
                    )}
                  >
                    {selected ? (
                      <motion.span
                        layoutId={`area-range-pill-${uid}`}
                        transition={motionTransitions.springSnappy}
                        className="absolute inset-0 rounded-lg bg-white shadow-xs"
                      />
                    ) : null}
                    <span className="relative z-10">{r}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-44 w-full cursor-crosshair select-none overflow-visible"
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoverIdx(null)}
          role="img"
          aria-label={title ?? "Clearinghouse analytics chart"}
        >
          <defs>
            <linearGradient id={`area-grad-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accentColor} stopOpacity="0.22" />
              <stop offset="100%" stopColor={accentColor} stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {[0.25, 0.5, 0.75, 1].map((pct) => {
            const y = padT + pct * (height - padT - padB);
            return (
              <line
                key={pct}
                x1={padL}
                x2={width - padR}
                y1={y}
                y2={y}
                stroke="#F4F4F5"
                strokeWidth="1"
              />
            );
          })}

          {areaPath ? <path d={areaPath} fill={`url(#area-grad-${uid})`} /> : null}
          {linePath ? (
            <path
              d={linePath}
              fill="none"
              stroke={accentColor}
              strokeWidth="2.25"
              strokeLinecap="round"
            />
          ) : null}

          {coords.map((pt, i) => {
            const showLabel =
              i === 0 ||
              i === coords.length - 1 ||
              (coords.length >= 4 && i === Math.floor(coords.length / 2));
            if (!showLabel) return null;
            return (
              <text
                key={`${pt.label}-${i}`}
                x={pt.x}
                y={height - 6}
                textAnchor={
                  i === 0 ? "start" : i === coords.length - 1 ? "end" : "middle"
                }
                className="fill-[#71717A] text-[10px] font-mono-tabular"
              >
                {pt.label}
              </text>
            );
          })}

          {active ? (
            <>
              <line
                x1={active.x}
                x2={active.x}
                y1={padT - 4}
                y2={height - padB}
                stroke="#D4D4D8"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              <circle
                cx={active.x}
                cy={active.y}
                r="4.5"
                fill="#FFFFFF"
                stroke={accentColor}
                strokeWidth="2.5"
              />
            </>
          ) : null}
        </svg>
      </div>
    </div>
  );
}
