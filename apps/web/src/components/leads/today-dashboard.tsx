"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle, Clock, Flame, Phone } from "lucide-react";

interface LeadRow {
  id: string;
  fullName: string;
  phone: string | null;
  stage: string;
  nextFollowUpAt: string | null;
  aiSuggestedNextAction: string | null;
  lastActivityAt: string | null;
}

interface Props {
  overdue: LeadRow[];
  today: LeadRow[];
  hotLeads: LeadRow[];
  summary: { overdueCount: number; todayCount: number; hotCount: number };
}

/**
 * Morning dashboard — the first thing an LIC agent sees when they open
 * the app at 9am. "Who do I call today?" answered in one glance.
 *
 * Three sections:
 *   🔴 Overdue — follow-ups you missed. RED urgency.
 *   🟡 Today — scheduled for today. AMBER.
 *   🔥 Hot — leads who opened your content but haven't heard back in 48h.
 */
export function TodayDashboard({ overdue, today, hotLeads, summary }: Props): JSX.Element {
  const hasAnything = summary.overdueCount + summary.todayCount + summary.hotCount > 0;
  if (!hasAnything) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
        No follow-ups for today. Go make some calls and log them here.
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Overdue */}
      <Section
        title="Overdue"
        count={summary.overdueCount}
        icon={<AlertTriangle className="h-4 w-4" />}
        tint="border-rose-200 bg-rose-50/50 dark:border-rose-900/40 dark:bg-rose-950/20"
        badgeColor="bg-rose-500"
        leads={overdue}
      />

      {/* Today */}
      <Section
        title="Today's follow-ups"
        count={summary.todayCount}
        icon={<Clock className="h-4 w-4" />}
        tint="border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20"
        badgeColor="bg-amber-500"
        leads={today}
      />

      {/* Hot */}
      <Section
        title="Hot — they opened your content"
        count={summary.hotCount}
        icon={<Flame className="h-4 w-4" />}
        tint="border-orange-200 bg-orange-50/50 dark:border-orange-900/40 dark:bg-orange-950/20"
        badgeColor="bg-orange-500"
        leads={hotLeads}
      />
    </div>
  );
}

function Section({
  title,
  count,
  icon,
  tint,
  badgeColor,
  leads,
}: {
  title: string;
  count: number;
  icon: React.ReactNode;
  tint: string;
  badgeColor: string;
  leads: LeadRow[];
}): JSX.Element {
  return (
    <div className={`rounded-2xl border p-5 ${tint}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
          {icon}
          {title}
        </div>
        <span
          className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold text-white ${badgeColor}`}
        >
          {count}
        </span>
      </div>
      <div className="mt-4 space-y-2">
        {leads.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing here.</p>
        ) : (
          leads.map((lead, idx) => (
            <motion.div
              key={lead.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.04 }}
            >
              <Link
                href={`/leads/${lead.id}`}
                className="flex items-center justify-between rounded-xl bg-background/80 p-3 text-sm transition hover:shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{lead.fullName}</div>
                  {lead.aiSuggestedNextAction && (
                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      AI: {lead.aiSuggestedNextAction}
                    </div>
                  )}
                  {lead.nextFollowUpAt && (
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      Follow up: {new Date(lead.nextFollowUpAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
                {lead.phone && (
                  <a
                    href={`tel:${lead.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="ml-2 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
                    aria-label={`Call ${lead.fullName}`}
                  >
                    <Phone className="h-4 w-4" />
                  </a>
                )}
              </Link>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
