import { apiFetch } from "@/lib/api-client";
import { ManagerDashboardView } from "@/components/manager/dashboard-view";

export const metadata = { title: "Manager Dashboard" };
export const dynamic = "force-dynamic";

export default async function ManagerDashboardPage(): Promise<JSX.Element> {
  const [overview, leaderboard, contentPerf, reelCompliance, velocity] =
    await Promise.all([
      apiFetch("/api/manager/team-overview?period=7d").catch(() => null),
      apiFetch("/api/manager/agent-leaderboard?period=7d").catch(() => null),
      apiFetch("/api/manager/content-performance?period=7d").catch(() => null),
      apiFetch("/api/manager/reel-compliance").catch(() => null),
      apiFetch("/api/manager/pipeline-velocity?period=7d").catch(() => null),
    ]);

  return (
    <ManagerDashboardView
      overview={overview as Record<string, unknown> | null}
      leaderboard={leaderboard as Record<string, unknown> | null}
      contentPerf={contentPerf as Record<string, unknown> | null}
      reelCompliance={reelCompliance as unknown[] | null}
      velocity={velocity as Record<string, unknown> | null}
    />
  );
}
