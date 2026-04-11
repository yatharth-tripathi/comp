"use client";

import { motion } from "framer-motion";

/**
 * Circular mood meter — the live gauge on the left of the runner.
 * Mood is 1 (hostile) to 10 (delighted). Colour shifts from rose through
 * amber to emerald as the customer warms up.
 */
interface MoodMeterProps {
  mood: number;
  moodDelta: number | null;
}

export function MoodMeter({ mood, moodDelta }: MoodMeterProps): JSX.Element {
  const pct = Math.max(0, Math.min(1, (mood - 1) / 9));
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);

  const color =
    mood <= 3
      ? "rgb(244, 63, 94)" // rose
      : mood <= 5
        ? "rgb(249, 115, 22)" // orange
        : mood <= 7
          ? "rgb(234, 179, 8)" // amber
          : "rgb(16, 185, 129)"; // emerald

  const label =
    mood <= 2
      ? "Hostile"
      : mood <= 4
        ? "Guarded"
        : mood <= 6
          ? "Open"
          : mood <= 8
            ? "Warm"
            : "Delighted";

  return (
    <div className="relative flex flex-col items-center gap-3">
      <div className="relative">
        <svg width="148" height="148" className="-rotate-90">
          <circle
            cx="74"
            cy="74"
            r={radius}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="6"
            fill="none"
          />
          <motion.circle
            cx="74"
            cy="74"
            r={radius}
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
            strokeDasharray={circumference}
            animate={{ strokeDashoffset: offset }}
            transition={{ type: "spring", damping: 18, stiffness: 150 }}
          />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            key={mood}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-4xl font-semibold tabular-nums text-white"
          >
            {mood}
          </motion.span>
          <span className="mt-0.5 text-[10px] font-medium uppercase tracking-widest text-white/60">
            / 10
          </span>
        </div>
      </div>
      <div className="text-center">
        <div className="text-xs font-semibold uppercase tracking-wider text-white/60">
          Customer mood
        </div>
        <div className="mt-0.5 text-sm font-medium" style={{ color }}>
          {label}
        </div>
        {moodDelta !== null && moodDelta !== 0 && (
          <motion.div
            key={`${mood}-${moodDelta}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`mt-1 text-[11px] font-semibold ${
              moodDelta > 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {moodDelta > 0 ? `+${moodDelta}` : moodDelta} from last turn
          </motion.div>
        )}
      </div>
    </div>
  );
}
