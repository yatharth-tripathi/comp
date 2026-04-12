"use client";

import { motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  BookOpenCheck,
  Crown,
  FileText,
  Flame,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
  Video,
  Zap,
} from "lucide-react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";

interface Props {
  overview: Record<string, unknown> | null;
  leaderboard: Record<string, unknown> | null;
  contentPerf: Record<string, unknown> | null;
  reelCompliance: unknown[] | null;
  velocity: Record<string, unknown> | null;
}

/**
 * Manager dashboard — the command center.
 *
 * Layout inspired by premium sports analytics dashboards (ESPN, Opta):
 * dense but legible, colour-coded urgency, every number has context
 * (vs last period, vs target), and the top performers section feels
 * like a "Player of the Week" card.
 */
export function ManagerDashboardView({
  overview,
  leaderboard,
  contentPerf,
  reelCompliance,
  velocity,
}: Props): JSX.Element {
  const team = (overview as { team?: { totalAgents: number; activeAgents: number; activityRate: number } })?.team;
  const content = (overview as { content?: { totalShares: number; uniqueSharers: number; totalOpens: number; shareOpenRate: number } })?.content;
  const rolePlay = (overview as { rolePlay?: { sessionsCompleted: number; avgScore: number; uniqueParticipants: number } })?.rolePlay;
  const leads = (overview as { leads?: { totalLeads: number; closedWon: number; pipelineValue: number } })?.leads;
  const reels = (overview as { reels?: { totalViews: number; uniqueViewers: number } })?.reels;

  const topPerformers = (leaderboard as { topPerformers?: Array<{
    id: string; name: string; avatarUrl: string | null; designation: string | null;
    xp: number; level: number; streak: number; periodShares: number;
    periodRolePlays: number; periodRolePlayAvg: number; totalLeads: number; activityScore: number;
  }> })?.topPerformers ?? [];
  const bottomPerformers = (leaderboard as { bottomPerformers?: typeof topPerformers })?.bottomPerformers ?? [];

  const topContent = (contentPerf as { topContent?: Array<{
    id: string; title: string; contentType: string; shareCount: number; viewCount: number;
  }> })?.topContent ?? [];
  const staleContent = (contentPerf as { staleContent?: Array<{
    id: string; title: string; contentType: string; lastUsedAt: string;
  }> })?.staleContent ?? [];

  const reelComplianceData = (reelCompliance as Array<{
    reelId: string; title: string; assigned: number; completed: number; completionPct: number;
    dueDate: string | null;
  }>) ?? [];

  const vel = (velocity as { velocity?: { stageChangesThisPeriod: number; velocityDeltaPct: number };
    newLeads?: { thisPeriod: number; lastPeriod: number };
    closures?: { won: number; lost: number };
  }) ?? {};

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <BarChart3 className="h-4 w-4" />
          Manager Command Center
        </div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Team Performance</h1>
        <p className="mt-1 text-sm text-muted-foreground">Last 7 days overview</p>
      </div>

      {/* Hero metrics — the sports-style stats bar */}
      <div className="grid gap-3 md:grid-cols-5">
        <MetricCard
          icon={<Users className="h-5 w-5" />}
          label="Active agents"
          value={`${team?.activeAgents ?? 0}/${team?.totalAgents ?? 0}`}
          sub={`${team?.activityRate ?? 0}% activity rate`}
          color="text-sky-500"
        />
        <MetricCard
          icon={<FileText className="h-5 w-5" />}
          label="Content shared"
          value={String(content?.totalShares ?? 0)}
          sub={`${content?.shareOpenRate ?? 0}% open rate`}
          color="text-emerald-500"
        />
        <MetricCard
          icon={<Zap className="h-5 w-5" />}
          label="Role-plays"
          value={String(rolePlay?.sessionsCompleted ?? 0)}
          sub={`Avg score: ${rolePlay?.avgScore ?? 0}%`}
          color="text-violet-500"
        />
        <MetricCard
          icon={<Target className="h-5 w-5" />}
          label="Pipeline"
          value={`₹${((leads?.pipelineValue ?? 0) / 100_000).toFixed(1)}L`}
          sub={`${leads?.closedWon ?? 0} closed won`}
          color="text-amber-500"
        />
        <MetricCard
          icon={<Video className="h-5 w-5" />}
          label="Reel views"
          value={String(reels?.totalViews ?? 0)}
          sub={`${reels?.uniqueViewers ?? 0} unique viewers`}
          color="text-rose-500"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top performers — "Player of the Week" style */}
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Trophy className="h-4 w-4 text-amber-500" />
            Top performers
          </div>
          <div className="mt-4 space-y-3">
            {topPerformers.slice(0, 5).map((agent, idx) => (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="flex items-center gap-3 rounded-xl bg-muted/30 p-3"
              >
                <div className="relative">
                  {idx === 0 && (
                    <Crown className="absolute -top-2 -right-1 h-4 w-4 text-amber-400" />
                  )}
                  {agent.avatarUrl ? (
                    <Image
                      src={agent.avatarUrl}
                      alt={agent.name}
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-primary to-indigo-600 text-sm font-bold text-white">
                      {agent.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold">{agent.name}</span>
                    {agent.streak > 0 && (
                      <span className="flex items-center gap-0.5 text-[10px] font-semibold text-orange-500">
                        <Flame className="h-3 w-3" />{agent.streak}d
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span>{agent.periodShares} shares</span>
                    <span>{agent.periodRolePlays} plays</span>
                    <span>{agent.totalLeads} leads</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold tabular-nums text-primary">
                    {agent.activityScore}
                  </div>
                  <div className="text-[10px] text-muted-foreground">score</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom performers — coaching needed */}
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Activity className="h-4 w-4 text-rose-500" />
            Needs coaching
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Low activity or low scores — schedule 1:1s with these agents.
          </p>
          <div className="mt-4 space-y-3">
            {bottomPerformers.slice(0, 5).map((agent, idx) => (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="flex items-center justify-between rounded-xl border border-rose-200/50 bg-rose-50/30 p-3 dark:border-rose-900/30 dark:bg-rose-950/10"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-rose-100 text-sm font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                    {agent.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{agent.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {agent.periodShares} shares · {agent.periodRolePlays} plays
                    </div>
                  </div>
                </div>
                <div className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                  {agent.activityScore}
                </div>
              </motion.div>
            ))}
            {bottomPerformers.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No low-activity agents. Your team is on fire.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pipeline velocity */}
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            Pipeline velocity
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div>
              <div className="text-2xl font-bold tabular-nums">
                {vel.velocity?.stageChangesThisPeriod ?? 0}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">Stage moves this week</div>
              {(vel.velocity?.velocityDeltaPct ?? 0) !== 0 && (
                <Badge
                  variant={
                    (vel.velocity?.velocityDeltaPct ?? 0) > 0 ? "success" : "destructive"
                  }
                  className="mt-1"
                >
                  {(vel.velocity?.velocityDeltaPct ?? 0) > 0 ? "+" : ""}
                  {vel.velocity?.velocityDeltaPct}% vs last week
                </Badge>
              )}
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">
                {vel.newLeads?.thisPeriod ?? 0}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">New leads</div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                vs {vel.newLeads?.lastPeriod ?? 0} last week
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums text-emerald-600">
                {vel.closures?.won ?? 0}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">Closed won</div>
              <div className="mt-1 text-[10px] text-rose-500">
                {vel.closures?.lost ?? 0} lost
              </div>
            </div>
          </div>
        </div>

        {/* Reel compliance */}
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-amber-500" />
            Mandatory training compliance
          </div>
          <div className="mt-4 space-y-3">
            {reelComplianceData.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No mandatory reels assigned.
              </p>
            ) : (
              reelComplianceData.map((reel) => (
                <div key={reel.reelId} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate font-medium">{reel.title}</span>
                    <span className="shrink-0 font-semibold">
                      {reel.completed}/{reel.assigned}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${reel.completionPct}%` }}
                      transition={{ duration: 0.7, ease: "easeOut" }}
                      className={`h-full ${
                        reel.completionPct >= 80
                          ? "bg-emerald-500"
                          : reel.completionPct >= 50
                            ? "bg-amber-500"
                            : "bg-rose-500"
                      }`}
                    />
                  </div>
                  {reel.dueDate && (
                    <div className="text-[10px] text-muted-foreground">
                      Due: {new Date(reel.dueDate).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Content performance */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <BookOpenCheck className="h-4 w-4 text-sky-500" />
            Top performing content
          </div>
          <div className="mt-4 divide-y">
            {topContent.slice(0, 8).map((item, idx) => (
              <div key={item.id} className="flex items-center justify-between py-2.5 text-sm">
                <div className="flex items-center gap-3">
                  <span className="w-5 text-center text-xs font-bold text-muted-foreground">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{item.title}</div>
                    <div className="text-[10px] capitalize text-muted-foreground">
                      {item.contentType.replace(/_/g, " ")}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs tabular-nums">
                  <span>{item.shareCount} shares</span>
                  <span className="text-muted-foreground">{item.viewCount} views</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <TrendingDown className="h-4 w-4 text-rose-500" />
            Stale content — consider archiving
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Not used in 60+ days. Archive or refresh these.
          </p>
          <div className="mt-4 divide-y">
            {staleContent.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                No stale content. All assets are active.
              </p>
            ) : (
              staleContent.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{item.title}</div>
                    <div className="text-[10px] capitalize text-muted-foreground">
                      {item.contentType.replace(/_/g, " ")}
                    </div>
                  </div>
                  <div className="text-xs text-rose-500">
                    Last used:{" "}
                    {item.lastUsedAt
                      ? new Date(item.lastUsedAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })
                      : "Never"}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: string;
}): JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border bg-card p-5 shadow-sm"
    >
      <div className={`flex items-center gap-2 text-xs font-semibold ${color}`}>
        {icon}
        <span className="uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-3 text-3xl font-bold tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
    </motion.div>
  );
}
