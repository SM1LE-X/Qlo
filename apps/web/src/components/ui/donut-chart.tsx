"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

export interface DonutChartProps {
  data: DonutSlice[];
  centerLabel?: string;
  centerValue?: string;
  formatValue?: (value: number) => string;
  size?: number;
  thickness?: number;
  className?: string;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180.0;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeDonutArc(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngle: number,
  endAngle: number
) {
  const clampedEnd = Math.min(endAngle, startAngle + 359.9);
  const startOuter = polarToCartesian(cx, cy, rOuter, clampedEnd);
  const endOuter = polarToCartesian(cx, cy, rOuter, startAngle);
  const startInner = polarToCartesian(cx, cy, rInner, clampedEnd);
  const endInner = polarToCartesian(cx, cy, rInner, startAngle);
  const largeArc = clampedEnd - startAngle <= 180 ? "0" : "1";

  return [
    "M",
    startOuter.x.toFixed(2),
    startOuter.y.toFixed(2),
    "A",
    rOuter,
    rOuter,
    0,
    largeArc,
    0,
    endOuter.x.toFixed(2),
    endOuter.y.toFixed(2),
    "L",
    endInner.x.toFixed(2),
    endInner.y.toFixed(2),
    "A",
    rInner,
    rInner,
    0,
    largeArc,
    1,
    startInner.x.toFixed(2),
    startInner.y.toFixed(2),
    "Z",
  ].join(" ");
}

/**
 * EasyUI-inspired interactive SVG DonutChart with hover highlighting and tabular legend.
 */
export function DonutChart({
  data,
  centerLabel = "Total",
  centerValue,
  formatValue = (v) => v.toLocaleString("en-US", { maximumFractionDigits: 4 }),
  size = 152,
  thickness = 22,
  className,
}: DonutChartProps) {
  const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null);
  const total = data.reduce((sum, item) => sum + Math.max(0, item.value), 0);
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - 8;
  const rInner = Math.max(16, rOuter - thickness);

  const slices = React.useMemo(() => {
    if (total <= 0) return [];
    let angleCursor = 0;
    return data
      .filter((d) => d.value > 0)
      .map((item) => {
        const pct = (item.value / total) * 100;
        const sweep = (item.value / total) * 360;
        const start = angleCursor;
        const end = angleCursor + sweep;
        angleCursor = end;
        return {
          ...item,
          pct,
          start,
          end,
          path: describeDonutArc(cx, cy, rOuter, rInner, start, end),
        };
      });
  }, [data, total, cx, cy, rOuter, rInner]);

  const activeSlice = hoveredIdx !== null ? slices[hoveredIdx] : null;

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full overflow-visible">
          {slices.length === 0 ? (
            <circle
              cx={cx}
              cy={cy}
              r={(rOuter + rInner) / 2}
              fill="none"
              stroke="#E4E4E7"
              strokeWidth={thickness}
            />
          ) : (
            slices.map((slice, idx) => {
              const isHovered = hoveredIdx === idx;
              const isDimmed = hoveredIdx !== null && hoveredIdx !== idx;
              return (
                <path
                  key={slice.label}
                  d={slice.path}
                  fill={slice.color}
                  stroke="#FFFFFF"
                  strokeWidth="2"
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className="cursor-pointer transition-all duration-200"
                  style={{
                    opacity: isDimmed ? 0.45 : 1,
                    transform: isHovered ? "scale(1.03)" : "scale(1)",
                    transformOrigin: `${cx}px ${cy}px`,
                  }}
                />
              );
            })
          )}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
          <span className="text-[10px] font-medium uppercase tracking-wider text-[#71717A] truncate max-w-[104px]">
            {activeSlice ? activeSlice.label : centerLabel}
          </span>
          <span className="mt-0.5 text-sm font-bold text-[#09090B] font-mono-tabular">
            {activeSlice
              ? formatValue(activeSlice.value)
              : centerValue ?? formatValue(total)}
          </span>
          {activeSlice ? (
            <span className="text-[10px] font-mono-tabular text-[#0F766E]">
              {activeSlice.pct.toFixed(1)}%
            </span>
          ) : null}
        </div>
      </div>

      <ul className="w-full flex-1 space-y-2 text-xs">
        {data.map((item, idx) => {
          const pct = total > 0 ? ((Math.max(0, item.value) / total) * 100).toFixed(1) : "0.0";
          const sliceIndex = slices.findIndex((s) => s.label === item.label);
          const isHovered = sliceIndex !== -1 && hoveredIdx === sliceIndex;
          return (
            <li
              key={item.label}
              onMouseEnter={() => sliceIndex !== -1 && setHoveredIdx(sliceIndex)}
              onMouseLeave={() => setHoveredIdx(null)}
              className={cn(
                "flex items-center justify-between gap-3 rounded-lg border border-transparent px-2.5 py-1.5 transition-colors cursor-default",
                isHovered && "border-[#E4E4E7] bg-[#FAFAFA]"
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="truncate font-medium text-[#09090B]">{item.label}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 font-mono-tabular">
                <span className="font-semibold text-[#09090B]">
                  {formatValue(item.value)}
                </span>
                <span className="w-11 text-right text-[11px] text-[#71717A]">{pct}%</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
