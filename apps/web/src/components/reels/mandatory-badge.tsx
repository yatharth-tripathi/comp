"use client";

import { motion } from "framer-motion";
import { Clock, Shield } from "lucide-react";

interface MandatoryBadgeProps {
  dueDate: string | null;
  completed: boolean;
}

/**
 * Top-left badge that marks a reel as mandatory training.
 * Shows a due-date countdown when set. Turns green when the viewer has
 * completed the reel — they still see the badge but it's no longer blocking.
 */
export function MandatoryBadge({ dueDate, completed }: MandatoryBadgeProps): JSX.Element {
  const due = dueDate ? new Date(dueDate) : null;
  const now = Date.now();
  const hoursRemaining = due ? Math.max(0, Math.round((due.getTime() - now) / 3_600_000)) : null;
  const overdue = hoursRemaining !== null && hoursRemaining === 0 && !completed;

  return (
    <motion.div
      initial={{ y: -6, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider backdrop-blur-xl ${
        completed
          ? "bg-emerald-500/80 text-white"
          : overdue
            ? "bg-rose-500/80 text-white"
            : "bg-amber-500/80 text-white"
      }`}
    >
      <Shield className="h-3.5 w-3.5" />
      {completed ? "Completed" : overdue ? "Overdue" : "Required"}
      {hoursRemaining !== null && !completed && (
        <span className="flex items-center gap-1 border-l border-white/40 pl-1.5">
          <Clock className="h-3 w-3" />
          {hoursRemaining < 24 ? `${hoursRemaining}h left` : `${Math.round(hoursRemaining / 24)}d left`}
        </span>
      )}
    </motion.div>
  );
}
