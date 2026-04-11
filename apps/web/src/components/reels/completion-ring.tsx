"use client";

import { motion } from "framer-motion";

/**
 * Circular completion ring that replaces the flat playback bar.
 * Renders an SVG circle whose stroke-dashoffset is bound to the current
 * playback progress. The ring sits inside the play/pause button so a
 * single glyph tells you state + progress at once.
 */
interface CompletionRingProps {
  progress: number; // 0..1
  size?: number;
  strokeWidth?: number;
  isPlaying: boolean;
  isMandatory?: boolean;
  onToggle: () => void;
}

export function CompletionRing({
  progress,
  size = 96,
  strokeWidth = 4,
  isPlaying,
  isMandatory = false,
  onToggle,
}: CompletionRingProps): JSX.Element {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - Math.min(1, Math.max(0, progress)));
  const accent = isMandatory ? "#f59e0b" : "#ffffff";

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isPlaying ? "Pause" : "Play"}
      className="group pointer-events-auto relative grid place-items-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="-rotate-90 drop-shadow-[0_4px_18px_rgba(0,0,0,0.35)]"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.2)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={accent}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 0.2, ease: "linear" }}
        />
      </svg>
      <motion.span
        className="absolute inset-0 grid place-items-center"
        animate={{ scale: isPlaying ? 0.85 : 1, opacity: isPlaying ? 0 : 1 }}
        transition={{ duration: 0.25 }}
      >
        <svg viewBox="0 0 24 24" width={36} height={36} fill="white">
          <path d="M8 5v14l11-7z" />
        </svg>
      </motion.span>
    </button>
  );
}
