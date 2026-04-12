"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight, Phone } from "lucide-react";

interface PipelineLead {
  id: string;
  fullName: string;
  phone: string | null;
  stage: string;
  city: string | null;
  profession: string | null;
  lastActivityAt: string | null;
  nextFollowUpAt: string | null;
  aiSuggestedNextAction: string | null;
  premiumValue: number | null;
}

interface Props {
  pipeline: Record<string, PipelineLead[]>;
  counts: Record<string, number>;
}

const STAGE_CONFIG: Array<{
  key: string;
  label: string;
  shortLabel: string;
  color: string;
}> = [
  { key: "new", label: "New leads", shortLabel: "New", color: "bg-sky-500" },
  { key: "contacted", label: "Contacted", shortLabel: "Contacted", color: "bg-blue-500" },
  { key: "interested", label: "Interested", shortLabel: "Interested", color: "bg-indigo-500" },
  { key: "meeting_scheduled", label: "Meeting", shortLabel: "Meeting", color: "bg-violet-500" },
  { key: "proposal_sent", label: "Proposal", shortLabel: "Proposal", color: "bg-purple-500" },
  {
    key: "under_consideration",
    label: "Considering",
    shortLabel: "Considering",
    color: "bg-amber-500",
  },
  { key: "closed_won", label: "Closed Won", shortLabel: "Won", color: "bg-emerald-500" },
  { key: "closed_lost", label: "Closed Lost", shortLabel: "Lost", color: "bg-rose-500" },
  { key: "dormant", label: "Dormant", shortLabel: "Dormant", color: "bg-gray-400" },
];

/**
 * Horizontal Kanban pipeline — scroll horizontally on mobile, all visible
 * on desktop. Each column shows up to 20 lead cards.
 *
 * This is designed to look like what a Trello board would look like if
 * Trello understood Indian insurance. The stage progression arrow at the
 * top makes the lifecycle visual.
 */
export function LeadPipeline({ pipeline, counts }: Props): JSX.Element {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Pipeline
      </h2>

      {/* Stage header strip */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-xl border bg-card p-2">
        {STAGE_CONFIG.map((stage, idx) => {
          const count = counts[stage.key] ?? 0;
          return (
            <div key={stage.key} className="flex shrink-0 items-center">
              <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs">
                <span className={`h-2 w-2 rounded-full ${stage.color}`} />
                <span className="font-medium">{stage.shortLabel}</span>
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold tabular-nums">
                  {count}
                </span>
              </div>
              {idx < STAGE_CONFIG.length - 1 && (
                <ChevronRight className="mx-0.5 h-3 w-3 text-muted-foreground/40" />
              )}
            </div>
          );
        })}
      </div>

      {/* Kanban columns */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGE_CONFIG.map((stage) => {
          const leads = pipeline[stage.key] ?? [];
          return (
            <div
              key={stage.key}
              className="w-72 shrink-0 rounded-2xl border bg-muted/30 p-3"
            >
              <div className="mb-3 flex items-center gap-2 px-1">
                <span className={`h-2.5 w-2.5 rounded-full ${stage.color}`} />
                <span className="text-xs font-semibold">{stage.label}</span>
                <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground">
                  {leads.length}
                </span>
              </div>
              <div className="space-y-2">
                {leads.length === 0 ? (
                  <div className="rounded-xl border border-dashed bg-background/50 p-4 text-center text-xs text-muted-foreground">
                    No leads
                  </div>
                ) : (
                  leads.map((lead, idx) => (
                    <motion.div
                      key={lead.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                    >
                      <Link
                        href={`/leads/${lead.id}`}
                        className="block rounded-xl border bg-card p-3 shadow-sm transition hover:shadow-md"
                      >
                        <div className="flex items-start justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold">
                              {lead.fullName}
                            </div>
                            {(lead.city || lead.profession) && (
                              <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                {[lead.profession, lead.city].filter(Boolean).join(" · ")}
                              </div>
                            )}
                          </div>
                          {lead.phone && (
                            <a
                              href={`tel:${lead.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="ml-2 grid h-7 w-7 shrink-0 place-items-center rounded-full text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                              aria-label="Call"
                            >
                              <Phone className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                        {lead.aiSuggestedNextAction && (
                          <div className="mt-2 rounded-md bg-primary/5 px-2 py-1 text-[10px] text-primary">
                            AI: {lead.aiSuggestedNextAction}
                          </div>
                        )}
                        {lead.premiumValue !== null && lead.premiumValue > 0 && (
                          <div className="mt-1.5 text-[10px] font-semibold text-muted-foreground">
                            ₹{(lead.premiumValue / 100_000).toFixed(1)}L
                          </div>
                        )}
                        {lead.nextFollowUpAt && (
                          <div className="mt-1 text-[10px] text-muted-foreground">
                            Follow up:{" "}
                            {new Date(lead.nextFollowUpAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                            })}
                          </div>
                        )}
                      </Link>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
