"use client";

import { motion } from "framer-motion";

interface FunnelProps {
  funnel: {
    started: number;
    watched25: number;
    watched50: number;
    watched75: number;
    watched100: number;
  };
}

/**
 * Horizontal completion funnel — each bar shows the count AND the drop-off
 * vs the previous bucket. This is the single chart that matters for reel
 * quality and it's the one Instagram never shows creators.
 */
export function AnalyticsFunnel({ funnel }: FunnelProps): JSX.Element {
  const buckets = [
    { label: "Started", value: funnel.started },
    { label: "25%", value: funnel.watched25 },
    { label: "50%", value: funnel.watched50 },
    { label: "75%", value: funnel.watched75 },
    { label: "100%", value: funnel.watched100 },
  ];
  const max = Math.max(1, ...buckets.map((b) => b.value));

  return (
    <div className="space-y-3">
      {buckets.map((bucket, idx) => {
        const pct = Math.round((bucket.value / max) * 100);
        const dropoff =
          idx > 0 && buckets[idx - 1]!.value > 0
            ? Math.round(
                ((buckets[idx - 1]!.value - bucket.value) / buckets[idx - 1]!.value) * 100,
              )
            : 0;
        return (
          <div key={bucket.label}>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="font-semibold">{bucket.label}</span>
              <div className="flex items-center gap-3 text-white/60">
                <span>{bucket.value}</span>
                {idx > 0 && bucket.value < (buckets[idx - 1]?.value ?? 0) && (
                  <span className="text-rose-400">−{dropoff}%</span>
                )}
              </div>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-white/5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.7, delay: idx * 0.06, ease: "easeOut" }}
                className={`h-full ${
                  idx === buckets.length - 1
                    ? "bg-emerald-400"
                    : idx === 0
                      ? "bg-sky-400"
                      : "bg-gradient-to-r from-sky-400 to-indigo-400"
                }`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
