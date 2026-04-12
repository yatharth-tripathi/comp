import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import {
  and,
  asc,
  count,
  countDistinct,
  db,
  desc,
  eq,
  gte,
  lt,
  lte,
  schema,
  sql,
  sum,
} from "@salescontent/db";
import { authMiddleware, requireRole } from "../middleware/auth.js";

export const managerDashboardRoutes = new Hono();

const periodSchema = z.object({
  period: z.enum(["7d", "30d", "90d"]).default("7d"),
});

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

function periodToDays(period: string): number {
  if (period === "30d") return 30;
  if (period === "90d") return 90;
  return 7;
}

// ---------------------------------------------------------------------------
// GET /api/manager/team-overview
// The hero section — one-glance team health.
// ---------------------------------------------------------------------------
managerDashboardRoutes.get(
  "/team-overview",
  authMiddleware,
  requireRole("enterprise_admin", "branch_manager", "content_manager"),
  zValidator("query", periodSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const { period } = c.req.valid("query");
    const since = daysAgo(periodToDays(period));

    // Total active agents
    const [agentStats] = await db
      .select({
        totalAgents: count(),
        activeAgents: sql<number>`COALESCE(SUM(CASE WHEN ${schema.users.lastActiveAt} >= ${since} THEN 1 ELSE 0 END), 0)::int`,
      })
      .from(schema.users)
      .where(
        and(
          eq(schema.users.tenantId, tenantId),
          eq(schema.users.active, true),
        ),
      );

    // Content shared in period
    const [shareStats] = await db
      .select({
        totalShares: count(),
        uniqueSharers: countDistinct(schema.contentShareEvents.sharedById),
        totalOpens: sql<number>`COALESCE(SUM(${schema.contentShareEvents.openCount}), 0)::int`,
      })
      .from(schema.contentShareEvents)
      .where(
        and(
          eq(schema.contentShareEvents.tenantId, tenantId),
          gte(schema.contentShareEvents.sharedAt, since),
        ),
      );

    // Role-play sessions in period
    const [rpStats] = await db
      .select({
        sessionsCompleted: count(),
        avgPercentage: sql<number>`COALESCE(AVG(${schema.rolePlaySessions.percentage})::int, 0)`,
        uniqueParticipants: countDistinct(schema.rolePlaySessions.userId),
      })
      .from(schema.rolePlaySessions)
      .where(
        and(
          eq(schema.rolePlaySessions.tenantId, tenantId),
          gte(schema.rolePlaySessions.startedAt, since),
        ),
      );

    // Lead pipeline summary
    const [leadStats] = await db
      .select({
        totalLeads: count(),
        closedWon: sql<number>`COALESCE(SUM(CASE WHEN ${schema.leads.stage} = 'closed_won' THEN 1 ELSE 0 END), 0)::int`,
        pipelineValue: sql<number>`COALESCE(SUM(CASE WHEN ${schema.leads.stage} NOT IN ('closed_won','closed_lost','dormant') THEN ${schema.leads.premiumValue} ELSE 0 END), 0)::int`,
      })
      .from(schema.leads)
      .where(eq(schema.leads.tenantId, tenantId));

    // Reel views in period
    const [reelStats] = await db
      .select({
        totalViews: count(),
        uniqueViewers: countDistinct(schema.reelViews.viewerId),
      })
      .from(schema.reelViews)
      .where(
        and(
          eq(schema.reelViews.tenantId, tenantId),
          gte(schema.reelViews.startedAt, since),
        ),
      );

    return c.json({
      data: {
        period,
        team: {
          totalAgents: Number(agentStats?.totalAgents ?? 0),
          activeAgents: Number(agentStats?.activeAgents ?? 0),
          activityRate:
            Number(agentStats?.totalAgents ?? 0) > 0
              ? Math.round(
                  (Number(agentStats?.activeAgents ?? 0) /
                    Number(agentStats?.totalAgents ?? 1)) *
                    100,
                )
              : 0,
        },
        content: {
          totalShares: Number(shareStats?.totalShares ?? 0),
          uniqueSharers: Number(shareStats?.uniqueSharers ?? 0),
          totalOpens: Number(shareStats?.totalOpens ?? 0),
          shareOpenRate:
            Number(shareStats?.totalShares ?? 0) > 0
              ? Math.round(
                  (Number(shareStats?.totalOpens ?? 0) /
                    Number(shareStats?.totalShares ?? 1)) *
                    100,
                )
              : 0,
        },
        rolePlay: {
          sessionsCompleted: Number(rpStats?.sessionsCompleted ?? 0),
          avgScore: Number(rpStats?.avgPercentage ?? 0),
          uniqueParticipants: Number(rpStats?.uniqueParticipants ?? 0),
        },
        leads: {
          totalLeads: Number(leadStats?.totalLeads ?? 0),
          closedWon: Number(leadStats?.closedWon ?? 0),
          pipelineValue: Number(leadStats?.pipelineValue ?? 0),
        },
        reels: {
          totalViews: Number(reelStats?.totalViews ?? 0),
          uniqueViewers: Number(reelStats?.uniqueViewers ?? 0),
        },
      },
    });
  },
);

// ---------------------------------------------------------------------------
// GET /api/manager/agent-leaderboard
// Top and bottom performers ranked by a composite activity score.
// ---------------------------------------------------------------------------
managerDashboardRoutes.get(
  "/agent-leaderboard",
  authMiddleware,
  requireRole("enterprise_admin", "branch_manager", "content_manager"),
  zValidator("query", periodSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const { period } = c.req.valid("query");
    const since = daysAgo(periodToDays(period));

    // Get all agents with their XP + recent activity stats
    const agents = await db.query.users.findMany({
      where: and(eq(schema.users.tenantId, tenantId), eq(schema.users.active, true)),
      columns: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        designation: true,
        lastActiveAt: true,
      },
      with: {
        xp: {
          columns: {
            totalXp: true,
            level: true,
            streakDays: true,
            contentShared: true,
            rolePlaysCompleted: true,
            modulesCompleted: true,
          },
        },
      },
    });

    // Enrich with period-specific metrics
    const enriched = await Promise.all(
      agents.map(async (agent) => {
        const [shares] = await db
          .select({ count: count() })
          .from(schema.contentShareEvents)
          .where(
            and(
              eq(schema.contentShareEvents.sharedById, agent.id),
              gte(schema.contentShareEvents.sharedAt, since),
            ),
          );

        const [rpSessions] = await db
          .select({
            count: count(),
            avgPct: sql<number>`COALESCE(AVG(${schema.rolePlaySessions.percentage})::int, 0)`,
          })
          .from(schema.rolePlaySessions)
          .where(
            and(
              eq(schema.rolePlaySessions.userId, agent.id),
              gte(schema.rolePlaySessions.startedAt, since),
            ),
          );

        const [leadCount] = await db
          .select({ count: count() })
          .from(schema.leads)
          .where(
            and(
              eq(schema.leads.agentId, agent.id),
              eq(schema.leads.tenantId, tenantId),
            ),
          );

        // Composite score: shares×3 + roleplay_score×0.5 + leads×2 + xp×0.01
        const sharesCount = Number(shares?.count ?? 0);
        const rpAvg = Number(rpSessions?.avgPct ?? 0);
        const rpCount = Number(rpSessions?.count ?? 0);
        const leadsCount = Number(leadCount?.count ?? 0);
        const xp = agent.xp?.totalXp ?? 0;

        const activityScore =
          sharesCount * 3 + rpAvg * 0.5 + rpCount * 2 + leadsCount * 2 + xp * 0.01;

        return {
          id: agent.id,
          name: `${agent.firstName ?? ""} ${agent.lastName ?? ""}`.trim() || "Unknown",
          avatarUrl: agent.avatarUrl,
          designation: agent.designation,
          lastActiveAt: agent.lastActiveAt,
          xp,
          level: agent.xp?.level ?? 1,
          streak: agent.xp?.streakDays ?? 0,
          periodShares: sharesCount,
          periodRolePlays: rpCount,
          periodRolePlayAvg: rpAvg,
          totalLeads: leadsCount,
          activityScore: Math.round(activityScore),
        };
      }),
    );

    enriched.sort((a, b) => b.activityScore - a.activityScore);

    return c.json({
      data: {
        topPerformers: enriched.slice(0, 10),
        bottomPerformers: enriched.slice(-5).reverse(),
        all: enriched,
      },
    });
  },
);

// ---------------------------------------------------------------------------
// GET /api/manager/content-performance
// Which content pieces are being used and driving engagement.
// ---------------------------------------------------------------------------
managerDashboardRoutes.get(
  "/content-performance",
  authMiddleware,
  requireRole("enterprise_admin", "branch_manager", "content_manager"),
  zValidator("query", periodSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const { period } = c.req.valid("query");
    const since = daysAgo(periodToDays(period));

    const topContent = await db
      .select({
        id: schema.contentAssets.id,
        title: schema.contentAssets.title,
        contentType: schema.contentAssets.contentType,
        shareCount: schema.contentAssets.shareCount,
        viewCount: schema.contentAssets.viewCount,
        publishedAt: schema.contentAssets.publishedAt,
      })
      .from(schema.contentAssets)
      .where(
        and(
          eq(schema.contentAssets.tenantId, tenantId),
          eq(schema.contentAssets.approvalStatus, "published"),
        ),
      )
      .orderBy(desc(schema.contentAssets.shareCount))
      .limit(20);

    // Content by type breakdown
    const typeBreakdown = await db
      .select({
        contentType: schema.contentAssets.contentType,
        count: count(),
        totalShares: sql<number>`COALESCE(SUM(${schema.contentAssets.shareCount}), 0)::int`,
      })
      .from(schema.contentAssets)
      .where(
        and(
          eq(schema.contentAssets.tenantId, tenantId),
          eq(schema.contentAssets.approvalStatus, "published"),
        ),
      )
      .groupBy(schema.contentAssets.contentType);

    // Stale content — not used in 60+ days
    const staleThreshold = daysAgo(60);
    const staleContent = await db.query.contentAssets.findMany({
      where: and(
        eq(schema.contentAssets.tenantId, tenantId),
        eq(schema.contentAssets.approvalStatus, "published"),
        lte(schema.contentAssets.lastUsedAt, staleThreshold),
      ),
      orderBy: [asc(schema.contentAssets.lastUsedAt)],
      limit: 10,
      columns: { id: true, title: true, contentType: true, lastUsedAt: true },
    });

    return c.json({
      data: {
        topContent,
        typeBreakdown: typeBreakdown.map((t) => ({
          type: t.contentType,
          count: Number(t.count),
          shares: Number(t.totalShares),
        })),
        staleContent,
      },
    });
  },
);

// ---------------------------------------------------------------------------
// GET /api/manager/reel-compliance
// Mandatory training reel completion tracking.
// ---------------------------------------------------------------------------
managerDashboardRoutes.get(
  "/reel-compliance",
  authMiddleware,
  requireRole("enterprise_admin", "branch_manager", "content_manager"),
  async (c) => {
    const tenantId = c.get("tenantId");

    // Get all mandatory reels
    const mandatoryReels = await db.query.reels.findMany({
      where: and(
        eq(schema.reels.tenantId, tenantId),
        eq(schema.reels.isMandatory, true),
      ),
      with: {
        contentAsset: { columns: { title: true } },
      },
      columns: {
        id: true,
        totalViews: true,
        uniqueViewers: true,
        completionRateBps: true,
        mandatoryDueDate: true,
      },
    });

    // For each mandatory reel, get assignment stats
    const reelCompliance = await Promise.all(
      mandatoryReels.map(async (reel) => {
        const [stats] = await db
          .select({
            assigned: count(),
            completed: sql<number>`COALESCE(SUM(CASE WHEN ${schema.reelMandatoryAssignments.completedAt} IS NOT NULL THEN 1 ELSE 0 END), 0)::int`,
          })
          .from(schema.reelMandatoryAssignments)
          .where(eq(schema.reelMandatoryAssignments.reelId, reel.id));

        return {
          reelId: reel.id,
          title: reel.contentAsset?.title ?? "Untitled",
          dueDate: reel.mandatoryDueDate,
          assigned: Number(stats?.assigned ?? 0),
          completed: Number(stats?.completed ?? 0),
          completionPct:
            Number(stats?.assigned ?? 0) > 0
              ? Math.round(
                  (Number(stats?.completed ?? 0) / Number(stats?.assigned ?? 1)) * 100,
                )
              : 0,
          totalViews: reel.totalViews,
          avgCompletionPct: reel.completionRateBps / 100,
        };
      }),
    );

    return c.json({ data: reelCompliance });
  },
);

// ---------------------------------------------------------------------------
// GET /api/manager/pipeline-velocity
// How fast are leads moving through stages this period vs last.
// ---------------------------------------------------------------------------
managerDashboardRoutes.get(
  "/pipeline-velocity",
  authMiddleware,
  requireRole("enterprise_admin", "branch_manager"),
  zValidator("query", periodSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const { period } = c.req.valid("query");
    const days = periodToDays(period);
    const thisPeriodStart = daysAgo(days);
    const lastPeriodStart = daysAgo(days * 2);

    // Stage changes this period
    const thisStageChanges = await db
      .select({
        count: count(),
      })
      .from(schema.leadActivities)
      .where(
        and(
          eq(schema.leadActivities.tenantId, tenantId),
          eq(schema.leadActivities.kind, "stage_change"),
          gte(schema.leadActivities.createdAt, thisPeriodStart),
        ),
      );

    // Stage changes last period
    const lastStageChanges = await db
      .select({
        count: count(),
      })
      .from(schema.leadActivities)
      .where(
        and(
          eq(schema.leadActivities.tenantId, tenantId),
          eq(schema.leadActivities.kind, "stage_change"),
          gte(schema.leadActivities.createdAt, lastPeriodStart),
          lt(schema.leadActivities.createdAt, thisPeriodStart),
        ),
      );

    // New leads this period vs last
    const [newThisPeriod] = await db
      .select({ count: count() })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenantId, tenantId),
          gte(schema.leads.createdAt, thisPeriodStart),
        ),
      );
    const [newLastPeriod] = await db
      .select({ count: count() })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenantId, tenantId),
          gte(schema.leads.createdAt, lastPeriodStart),
          lt(schema.leads.createdAt, thisPeriodStart),
        ),
      );

    // Closed this period
    const [closedThisPeriod] = await db
      .select({
        won: sql<number>`COALESCE(SUM(CASE WHEN ${schema.leads.stage} = 'closed_won' THEN 1 ELSE 0 END), 0)::int`,
        lost: sql<number>`COALESCE(SUM(CASE WHEN ${schema.leads.stage} = 'closed_lost' THEN 1 ELSE 0 END), 0)::int`,
      })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenantId, tenantId),
          gte(schema.leads.closedAt, thisPeriodStart),
        ),
      );

    const thisChanges = Number(thisStageChanges[0]?.count ?? 0);
    const lastChanges = Number(lastStageChanges[0]?.count ?? 0);
    const velocityDelta =
      lastChanges > 0
        ? Math.round(((thisChanges - lastChanges) / lastChanges) * 100)
        : thisChanges > 0
          ? 100
          : 0;

    return c.json({
      data: {
        period,
        velocity: {
          stageChangesThisPeriod: thisChanges,
          stageChangesLastPeriod: lastChanges,
          velocityDeltaPct: velocityDelta,
        },
        newLeads: {
          thisPeriod: Number(newThisPeriod?.count ?? 0),
          lastPeriod: Number(newLastPeriod?.count ?? 0),
        },
        closures: {
          won: Number(closedThisPeriod?.won ?? 0),
          lost: Number(closedThisPeriod?.lost ?? 0),
        },
      },
    });
  },
);

// Keep imports available
void sum;
void lte;
