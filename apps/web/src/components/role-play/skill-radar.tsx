"use client";

import { motion } from "framer-motion";

interface SkillRadarProps {
  skills: Array<{ skill: string; score: number; maxScore: number }>;
  size?: number;
}

/**
 * Per-skill radar chart. Custom SVG polygon. Animated fill-in on mount.
 * Labels wrap cleanly at standard radial positions.
 */
export function SkillRadar({ skills, size = 320 }: SkillRadarProps): JSX.Element {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 60;
  const n = skills.length;

  // Polygon points — each skill at angle (i / n) × 2π, offset by -π/2 so 12 o'clock is first
  const points = skills.map((s, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const pct = s.maxScore > 0 ? s.score / s.maxScore : 0;
    const r = radius * pct;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      labelX: cx + (radius + 28) * Math.cos(angle),
      labelY: cy + (radius + 28) * Math.sin(angle),
      angle,
      skill: s.skill,
      score: s.score,
      maxScore: s.maxScore,
    };
  });

  const polygonPath = points.map((p) => `${p.x},${p.y}`).join(" ");

  // Background rings
  const rings = [0.25, 0.5, 0.75, 1.0];
  const ringPolygons = rings.map((ringR) => {
    const ringPts = Array.from({ length: n }, (_, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const r = radius * ringR;
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
    });
    return ringPts.join(" ");
  });

  return (
    <svg width={size} height={size} className="overflow-visible">
      {/* Rings */}
      {ringPolygons.map((pts, i) => (
        <polygon
          key={i}
          points={pts}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.08}
          strokeWidth={1}
        />
      ))}
      {/* Spokes */}
      {points.map((p, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={cx + radius * Math.cos(p.angle)}
          y2={cy + radius * Math.sin(p.angle)}
          stroke="currentColor"
          strokeOpacity={0.08}
          strokeWidth={1}
        />
      ))}
      {/* Filled polygon */}
      <motion.polygon
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, type: "spring" }}
        points={polygonPath}
        fill="rgb(59, 130, 246)"
        fillOpacity={0.25}
        stroke="rgb(59, 130, 246)"
        strokeWidth={2.5}
        strokeLinejoin="round"
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      />
      {/* Score dots */}
      {points.map((p, i) => (
        <motion.circle
          key={i}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.4 + i * 0.05 }}
          cx={p.x}
          cy={p.y}
          r={4}
          fill="rgb(59, 130, 246)"
        />
      ))}
      {/* Labels */}
      {points.map((p) => {
        const anchor =
          Math.abs(p.labelX - cx) < 10
            ? "middle"
            : p.labelX > cx
              ? "start"
              : "end";
        return (
          <g key={p.skill}>
            <text
              x={p.labelX}
              y={p.labelY}
              textAnchor={anchor}
              className="fill-current text-[11px] font-semibold"
            >
              {p.skill}
            </text>
            <text
              x={p.labelX}
              y={p.labelY + 14}
              textAnchor={anchor}
              className="fill-current text-[10px] opacity-60"
            >
              {p.score}/{p.maxScore}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
