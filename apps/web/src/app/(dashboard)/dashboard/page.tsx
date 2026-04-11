import { apiFetch } from "@/lib/api-client";

interface TenantPayload {
  id: string;
  name: string;
  slug: string;
  planTier: string;
}

interface UserMePayload {
  id: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  xp: { totalXp: number; level: number; streakDays: number } | null;
}

export default async function DashboardPage(): Promise<JSX.Element> {
  const [tenant, me] = await Promise.all([
    apiFetch<TenantPayload>("/api/tenants/me").catch(() => null),
    apiFetch<UserMePayload>("/api/users/me").catch(() => null),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {tenant ? tenant.name : "Connecting to tenant…"}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Plan</div>
          <div className="mt-2 text-2xl font-semibold capitalize">
            {tenant?.planTier ?? "—"}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Your XP</div>
          <div className="mt-2 text-2xl font-semibold">
            {me?.xp?.totalXp ?? 0}
            <span className="ml-1 text-sm text-muted-foreground">
              · level {me?.xp?.level ?? 1}
            </span>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Streak</div>
          <div className="mt-2 text-2xl font-semibold">
            {me?.xp?.streakDays ?? 0}
            <span className="ml-1 text-sm text-muted-foreground">days</span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Next modules (coming in Session 03+)</h2>
        <ul className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <li className="rounded-md border bg-muted/40 p-3">
            Content Library — upload, tag, share via WhatsApp
          </li>
          <li className="rounded-md border bg-muted/40 p-3">
            Reels — upload via Mux, feed, mandatory training
          </li>
          <li className="rounded-md border bg-muted/40 p-3">
            PitchWiz — term plan / health / SIP illustrators
          </li>
          <li className="rounded-md border bg-muted/40 p-3">
            AI Copilot — pre / during / post meeting modes
          </li>
          <li className="rounded-md border bg-muted/40 p-3">Lead Management — 9 stages</li>
          <li className="rounded-md border bg-muted/40 p-3">WhatsApp bot — 5 intents</li>
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">
          This dashboard is the Phase 1 foundation. Session 03 begins the Content Library build.
        </p>
      </div>
    </div>
  );
}
