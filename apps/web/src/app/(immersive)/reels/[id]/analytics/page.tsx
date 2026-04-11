import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { AnalyticsFunnel } from "@/components/reels/analytics-funnel";

interface ReelAnalytics {
  reelId: string;
  totalViews: number;
  uniqueViewers: number;
  totalShares: number;
  completionRatePct: number;
  funnel: {
    started: number;
    watched25: number;
    watched50: number;
    watched75: number;
    watched100: number;
  };
  shares: {
    totalShares: number;
    uniqueOpened: number;
    totalOpens: number;
    openRatePct: number;
  };
  mandatoryCompliance: {
    assigned: number;
    completed: number;
  };
  recentViewers: Array<{
    userId: string;
    name: string;
    startedAt: string;
    completionPct: number;
  }>;
}

interface ReelBasic {
  id: string;
  contentAsset: {
    title: string;
    description: string | null;
  };
  posterUrl: string | null;
}

export const dynamic = "force-dynamic";
export const metadata = { title: "Reel analytics" };

export default async function ReelAnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<JSX.Element> {
  const { id } = await params;
  let data: ReelAnalytics | null = null;
  let reel: ReelBasic | null = null;
  try {
    [data, reel] = await Promise.all([
      apiFetch<ReelAnalytics>(`/api/reels/${id}/analytics`),
      apiFetch<ReelBasic>(`/api/reels/${id}`),
    ]);
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) notFound();
    throw error;
  }
  if (!data || !reel) notFound();

  return (
    <div className="min-h-[100dvh] overflow-y-auto bg-black text-white">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-black/70 px-5 py-4 backdrop-blur">
        <Link
          href="/reels"
          className="flex items-center gap-2 text-sm text-white/80 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to feed
        </Link>
        <h1 className="text-base font-semibold">Reel analytics</h1>
        <div className="w-20" />
      </header>

      <div className="mx-auto max-w-4xl space-y-8 px-5 py-8">
        <div className="flex items-start gap-4">
          {reel.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={reel.posterUrl}
              alt={reel.contentAsset.title}
              className="h-28 w-16 rounded-md object-cover"
            />
          ) : null}
          <div>
            <h2 className="text-xl font-semibold">{reel.contentAsset.title}</h2>
            {reel.contentAsset.description && (
              <p className="mt-1 text-sm text-white/70">{reel.contentAsset.description}</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Metric label="Total views" value={data.totalViews.toString()} />
          <Metric label="Unique viewers" value={data.uniqueViewers.toString()} />
          <Metric
            label="Avg completion"
            value={`${data.completionRatePct.toFixed(1)}%`}
            sub="the ÷ Instagram hides"
          />
          <Metric label="Total shares" value={data.totalShares.toString()} />
        </div>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-lg font-semibold">Completion funnel</h3>
          <p className="mt-1 text-sm text-white/60">
            How far viewers actually watch — the number Instagram doesn&apos;t show.
          </p>
          <div className="mt-6">
            <AnalyticsFunnel funnel={data.funnel} />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-lg font-semibold">Share → open conversion</h3>
            <p className="mt-1 text-xs text-white/60">
              Percentage of customers who actually opened the trackable link an agent sent.
            </p>
            <div className="mt-4 flex items-end gap-6">
              <div>
                <div className="text-4xl font-semibold">{data.shares.openRatePct}%</div>
                <div className="mt-1 text-xs text-white/60">Open rate</div>
              </div>
              <div className="space-y-1 text-sm">
                <div className="text-white/70">
                  <span className="font-semibold text-white">{data.shares.totalShares}</span>{" "}
                  shares
                </div>
                <div className="text-white/70">
                  <span className="font-semibold text-white">{data.shares.uniqueOpened}</span>{" "}
                  unique opens
                </div>
                <div className="text-white/70">
                  <span className="font-semibold text-white">{data.shares.totalOpens}</span> total
                  opens
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-lg font-semibold">Mandatory training</h3>
            <p className="mt-1 text-xs text-white/60">Agents assigned vs completed.</p>
            {data.mandatoryCompliance.assigned === 0 ? (
              <p className="mt-4 text-sm text-white/60">Not a mandatory reel.</p>
            ) : (
              <div className="mt-6 space-y-3">
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span>Completed</span>
                    <span className="font-semibold">
                      {data.mandatoryCompliance.completed} /{" "}
                      {data.mandatoryCompliance.assigned}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-emerald-400"
                      style={{
                        width: `${
                          data.mandatoryCompliance.assigned > 0
                            ? Math.round(
                                (data.mandatoryCompliance.completed /
                                  data.mandatoryCompliance.assigned) *
                                  100,
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-lg font-semibold">Most recent viewers</h3>
          <div className="mt-4 divide-y divide-white/10">
            {data.recentViewers.length === 0 ? (
              <p className="py-6 text-sm text-white/60">No viewers yet.</p>
            ) : (
              data.recentViewers.map((viewer) => (
                <div
                  key={`${viewer.userId}-${viewer.startedAt}`}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <div className="text-sm font-medium">{viewer.name || "Unknown"}</div>
                    <div className="text-xs text-white/60">
                      {new Date(viewer.startedAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-sm font-semibold">
                    {viewer.completionPct.toFixed(0)}%
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}): JSX.Element {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="text-xs uppercase tracking-wider text-white/50">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
      {sub && <div className="mt-1 text-[11px] text-white/50">{sub}</div>}
    </div>
  );
}
