"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

interface SeriesPoint {
  year: number;
  paid: number;
  value: number;
}

interface AreaChartProps {
  data: SeriesPoint[];
  paidLabel?: string;
  valueLabel?: string;
  paidColor?: string;
  valueColor?: string;
  formatY?: (v: number) => string;
  height?: number;
}

/**
 * Custom SVG area chart for illustrations.
 *
 * Two stacked series (paid vs value) with framer-motion reveal animations.
 * Responsive width (100%), fixed height.
 *
 * Why custom and not Recharts: total control over typography, animation,
 * and gradients. Also zero extra JS bundle vs a chart lib.
 */
export function IllustrationAreaChart({
  data,
  paidLabel = "Paid",
  valueLabel = "Value",
  paidColor = "rgb(59, 130, 246)",
  valueColor = "rgb(16, 185, 129)",
  formatY = (v) => `₹${v.toLocaleString("en-IN")}`,
  height = 280,
}: AreaChartProps): JSX.Element {
  const width = 800; // viewBox width
  const padding = { top: 24, right: 20, bottom: 32, left: 62 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const maxY = useMemo(
    () =>
      Math.max(
        1,
        ...data.map((d) => Math.max(d.paid, d.value)),
      ),
    [data],
  );

  const xStep = innerW / Math.max(1, data.length - 1);
  const yScale = (v: number): number => innerH - (v / maxY) * innerH;

  const buildPath = (points: number[]): string => {
    if (points.length === 0) return "";
    const head = `M ${padding.left} ${padding.top + yScale(points[0] ?? 0)}`;
    const mid = points
      .slice(1)
      .map((p, i) => `L ${padding.left + (i + 1) * xStep} ${padding.top + yScale(p)}`)
      .join(" ");
    return `${head} ${mid}`;
  };

  const buildAreaPath = (points: number[]): string => {
    const line = buildPath(points);
    if (!line) return "";
    const lastX = padding.left + (points.length - 1) * xStep;
    const baseline = padding.top + innerH;
    return `${line} L ${lastX} ${baseline} L ${padding.left} ${baseline} Z`;
  };

  const paidPoints = data.map((d) => d.paid);
  const valuePoints = data.map((d) => d.value);
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    v: maxY * t,
    y: padding.top + innerH - t * innerH,
  }));

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center gap-4 text-xs">
        <LegendDot color={paidColor} label={paidLabel} />
        <LegendDot color={valueColor} label={valueLabel} />
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full overflow-visible">
        <defs>
          <linearGradient id="gradValue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={valueColor} stopOpacity="0.45" />
            <stop offset="100%" stopColor={valueColor} stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="gradPaid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={paidColor} stopOpacity="0.35" />
            <stop offset="100%" stopColor={paidColor} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Y axis grid */}
        {yTicks.map((t) => (
          <g key={t.v}>
            <line
              x1={padding.left}
              y1={t.y}
              x2={width - padding.right}
              y2={t.y}
              stroke="currentColor"
              strokeOpacity="0.08"
              strokeDasharray="3 4"
            />
            <text
              x={padding.left - 8}
              y={t.y + 4}
              textAnchor="end"
              className="fill-current text-[11px] opacity-50"
            >
              {formatY(Math.round(t.v))}
            </text>
          </g>
        ))}

        {/* Areas */}
        <motion.path
          d={buildAreaPath(valuePoints)}
          fill="url(#gradValue)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
        <motion.path
          d={buildAreaPath(paidPoints)}
          fill="url(#gradPaid)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.9, delay: 0.1, ease: "easeOut" }}
        />

        {/* Lines */}
        <motion.path
          d={buildPath(valuePoints)}
          fill="none"
          stroke={valueColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.1, ease: "easeOut" }}
        />
        <motion.path
          d={buildPath(paidPoints)}
          fill="none"
          stroke={paidColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.1, delay: 0.1, ease: "easeOut" }}
        />

        {/* X axis labels — show first, middle, last */}
        {[0, Math.floor(data.length / 2), data.length - 1].map((idx, i) => {
          const d = data[idx];
          if (!d) return null;
          const x = padding.left + idx * xStep;
          return (
            <text
              key={i}
              x={x}
              y={height - 8}
              textAnchor="middle"
              className="fill-current text-[11px] opacity-50"
            >
              Year {d.year}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }): JSX.Element {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}
