"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ShieldAlert } from "lucide-react";

/**
 * Compliance violation flash — pops from the top-right when the trainee
 * uses a banned phrase. Red border, regulator name, specific phrase.
 *
 * The indicator auto-dismisses after 6 seconds OR on next turn.
 */
interface ComplianceAlertProps {
  violations: string[];
  onDismiss: () => void;
}

export function ComplianceAlert({ violations, onDismiss }: ComplianceAlertProps): JSX.Element | null {
  if (violations.length === 0) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 40, opacity: 0 }}
        transition={{ type: "spring", damping: 20, stiffness: 300 }}
        className="pointer-events-auto absolute right-5 top-5 z-40 max-w-sm rounded-2xl border border-rose-500/50 bg-rose-950/80 p-4 text-rose-50 shadow-2xl backdrop-blur-xl"
      >
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-rose-500/30">
            <ShieldAlert className="h-5 w-5 text-rose-300" />
          </div>
          <div className="flex-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-rose-300">
              Compliance violation detected
            </div>
            <div className="mt-1.5 text-sm font-medium leading-snug">
              You just used a phrase that would trigger a regulator flag in production:
            </div>
            <ul className="mt-2 space-y-1">
              {violations.map((v) => (
                <li
                  key={v}
                  className="rounded-md bg-rose-950/70 px-2 py-1 font-mono text-xs text-rose-200"
                >
                  &ldquo;{v}&rdquo;
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={onDismiss}
              className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-rose-200 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
