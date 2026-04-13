import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { LeadPipeline } from "@/components/leads/lead-pipeline";
import { TodayDashboard } from "@/components/leads/today-dashboard";
import { Button } from "@/components/ui/button";
import { Plus, BarChart3 } from "lucide-react";

export const metadata = { title: "Leads" };
export const dynamic = "force-dynamic";

interface PipelineData {
  pipeline: Record<
    string,
    Array<{
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
    }>
  >;
  counts: Record<string, number>;
}

interface TodayData {
  overdue: Array<{
    id: string;
    fullName: string;
    phone: string | null;
    stage: string;
    nextFollowUpAt: string | null;
    aiSuggestedNextAction: string | null;
    lastActivityAt: string | null;
  }>;
  today: TodayData["overdue"];
  hotLeads: TodayData["overdue"];
  summary: {
    overdueCount: number;
    todayCount: number;
    hotCount: number;
  };
}

interface StatsData {
  totalLeads: number;
  conversionRate: number;
  pipelineValue: number;
  closedWonValue: number;
  closedWonCount: number;
  stageCounts: Record<string, number>;
}

export default async function LeadsPage(): Promise<JSX.Element> {
  const [pipelineRes, todayRes, statsRes] = await Promise.all([
    apiFetch<PipelineData>("/api/leads/pipeline").catch(() => null),
    apiFetch<TodayData>("/api/leads/today").catch(() => null),
    apiFetch<StatsData>("/api/leads/stats/overview").catch(() => null),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your pipeline. Overdue follow-ups. Hot prospects. Everything in one view.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/leads/new">
            <Button>
              <Plus className="h-4 w-4" />
              Quick capture
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats bar */}
      {statsRes && (
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard label="Total leads" value={statsRes.totalLeads.toString()} />
          <StatCard
            label="Pipeline value"
            value={
              statsRes.pipelineValue > 0
                ? `₹${(statsRes.pipelineValue / 100_000).toFixed(1)}L`
                : "—"
            }
          />
          <StatCard label="Conversion rate" value={`${statsRes.conversionRate}%`} />
          <StatCard
            label="Closed won"
            value={`${statsRes.closedWonCount}`}
            sub={
              statsRes.closedWonValue > 0
                ? `₹${(statsRes.closedWonValue / 100_000).toFixed(1)}L`
                : undefined
            }
          />
        </div>
      )}

      {/* Today's dashboard */}
      {todayRes && (
        <TodayDashboard
          overdue={todayRes.overdue}
          today={todayRes.today}
          hotLeads={todayRes.hotLeads}
          summary={todayRes.summary}
        />
      )}

      {/* Pipeline Kanban */}
      {pipelineRes && (
        <LeadPipeline pipeline={pipelineRes.pipeline} counts={pipelineRes.counts} />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}): JSX.Element {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
