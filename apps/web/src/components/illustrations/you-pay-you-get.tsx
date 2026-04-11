"use client";

import { motion } from "framer-motion";
import { ArrowRight, CircleDollarSign, ShieldCheck } from "lucide-react";

interface Section {
  heading: string;
  rows: Array<{ label: string; value: string }>;
}

interface Props {
  sections: Section[];
}

/**
 * The hero pair — "You Pay" on the left, "You Get" on the right.
 * This is the single most important visual on the customer-facing view.
 * Big numbers, clear hierarchy, no fluff.
 */
export function YouPayYouGet({ sections }: Props): JSX.Element {
  const [pay, get] = sections;
  if (!pay || !get) return <></>;
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
      <HeroCard
        title={pay.heading}
        rows={pay.rows}
        tint="from-rose-50 to-rose-100 dark:from-rose-950/30 dark:to-rose-900/20"
        accent="text-rose-700 dark:text-rose-300"
        icon={<CircleDollarSign className="h-5 w-5" />}
      />
      <div className="hidden items-center justify-center md:flex">
        <motion.div
          initial={{ x: -6, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="grid h-12 w-12 place-items-center rounded-full bg-background shadow-md"
        >
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
        </motion.div>
      </div>
      <HeroCard
        title={get.heading}
        rows={get.rows}
        tint="from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/20"
        accent="text-emerald-700 dark:text-emerald-300"
        icon={<ShieldCheck className="h-5 w-5" />}
      />
    </div>
  );
}

function HeroCard({
  title,
  rows,
  tint,
  accent,
  icon,
}: {
  title: string;
  rows: Array<{ label: string; value: string }>;
  tint: string;
  accent: string;
  icon: React.ReactNode;
}): JSX.Element {
  return (
    <motion.div
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className={`relative flex flex-col gap-4 rounded-3xl bg-gradient-to-br p-6 shadow-sm ${tint}`}
    >
      <div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wider ${accent}`}>
        {icon}
        {title}
      </div>
      <div className="space-y-4">
        {rows.map((row, i) => (
          <div key={i}>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {row.label}
            </div>
            <div className="mt-0.5 text-[22px] font-semibold tracking-tight">{row.value}</div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
