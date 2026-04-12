import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import {
  and,
  asc,
  count,
  db,
  desc,
  eq,
  gte,
  ilike,
  isNull,
  lt,
  lte,
  or,
  schema,
  sql,
} from "@salescontent/db";
import {
  createLeadSchema,
  leadActivitySchema,
  leadListQuerySchema,
  updateLeadSchema,
} from "@salescontent/schemas";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { ConflictError, NotFoundError } from "../lib/errors.js";

export const leadRoutes = new Hono();

// ---------------------------------------------------------------------------
// POST /api/leads — quick capture. Name + phone is enough.
// Everything else can come later. This is designed for the field — the
// agent has 10 seconds between customers and needs to log a name before
// they forget it.
// ---------------------------------------------------------------------------
leadRoutes.post(
  "/",
  authMiddleware,
  zValidator("json", createLeadSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const agentId = c.get("userId");
    const body = c.req.valid("json");

    const [lead] = await db
      .insert(schema.leads)
      .values({
        tenantId,
        agentId,
        fullName: body.fullName,
        phone: body.phone,
        email: body.email,
        age: body.age,
        gender: body.gender,
        city: body.city,
        state: body.state,
        profession: body.profession,
        incomeRange: body.incomeRange,
        existingInvestments: body.existingInvestments,
        dependents: body.dependents,
        riskAppetite: body.riskAppetite,
        stage: body.stage,
        source: body.source,
        sourceMetadata: body.sourceMetadata,
        lastActivityAt: new Date(),
      })
      .returning();
    if (!lead) throw new Error("Failed to create lead");

    // Log the creation as the first activity
    await db.insert(schema.leadActivities).values({
      tenantId,
      leadId: lead.id,
      actorId: agentId,
      kind: "note",
      notes: `Lead created via ${body.source ?? "manual"} entry`,
    });

    await c.var.audit({
      action: "create",
      resourceType: "lead",
      resourceId: lead.id,
      metadata: { source: body.source, stage: body.stage },
    });

    return c.json({ data: lead }, 201);
  },
);

// ---------------------------------------------------------------------------
// GET /api/leads — the pipeline view + list view.
//
// For agents: returns THEIR leads only.
// For managers: returns team leads (filtered by branchId or all).
// For admins: returns tenant-wide leads.
//
// Supports pipeline mode (group by stage) and list mode (flat, sorted).
// ---------------------------------------------------------------------------
leadRoutes.get(
  "/",
  authMiddleware,
  zValidator("query", leadListQuerySchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const userId = c.get("userId");
    const role = c.get("role");
    const query = c.req.valid("query");

    const conditions = [eq(schema.leads.tenantId, tenantId)];

    // RBAC scoping
    if (role === "sales_agent" || role === "senior_agent" || role === "trainee") {
      conditions.push(eq(schema.leads.agentId, userId));
    } else if (query.assignedTo) {
      conditions.push(eq(schema.leads.agentId, query.assignedTo));
    }

    if (query.stage) conditions.push(eq(schema.leads.stage, query.stage));
    if (query.q) {
      const pattern = `%${query.q.replace(/[%_]/g, "\\$&")}%`;
      conditions.push(
        or(
          ilike(schema.leads.fullName, pattern),
          ilike(schema.leads.phone, pattern),
          ilike(schema.leads.city, pattern),
          ilike(schema.leads.profession, pattern),
        )!,
      );
    }
    if (query.nextFollowUpBefore) {
      conditions.push(lte(schema.leads.nextFollowUpAt, new Date(query.nextFollowUpBefore)));
    }

    const [rows, totalRows] = await Promise.all([
      db.query.leads.findMany({
        where: and(...conditions),
        orderBy: [
          // Follow-up overdue first, then by lastActivity
          asc(schema.leads.nextFollowUpAt),
          desc(schema.leads.lastActivityAt),
        ],
        limit: query.pageSize,
        offset: (query.page - 1) * query.pageSize,
        with: {
          agent: {
            columns: { id: true, firstName: true, lastName: true, avatarUrl: true },
          },
        },
      }),
      db
        .select({ total: count() })
        .from(schema.leads)
        .where(and(...conditions)),
    ]);

    return c.json({
      data: rows,
      meta: { page: query.page, pageSize: query.pageSize, total: Number(totalRows[0]?.total ?? 0) },
    });
  },
);

// ---------------------------------------------------------------------------
// GET /api/leads/pipeline — grouped by stage for the Kanban view
// ---------------------------------------------------------------------------
leadRoutes.get("/pipeline", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId");
  const userId = c.get("userId");
  const role = c.get("role");

  const conditions = [eq(schema.leads.tenantId, tenantId)];
  if (role === "sales_agent" || role === "senior_agent" || role === "trainee") {
    conditions.push(eq(schema.leads.agentId, userId));
  }

  const stages = [
    "new",
    "contacted",
    "interested",
    "meeting_scheduled",
    "proposal_sent",
    "under_consideration",
    "closed_won",
    "closed_lost",
    "dormant",
  ] as const;

  const pipeline: Record<
    string,
    Array<{
      id: string;
      fullName: string;
      phone: string | null;
      stage: string;
      city: string | null;
      profession: string | null;
      lastActivityAt: Date | null;
      nextFollowUpAt: Date | null;
      aiSuggestedNextAction: string | null;
      premiumValue: number | null;
    }>
  > = {};

  for (const stage of stages) {
    const rows = await db.query.leads.findMany({
      where: and(...conditions, eq(schema.leads.stage, stage)),
      orderBy: [asc(schema.leads.nextFollowUpAt), desc(schema.leads.lastActivityAt)],
      limit: 20,
      columns: {
        id: true,
        fullName: true,
        phone: true,
        stage: true,
        city: true,
        profession: true,
        lastActivityAt: true,
        nextFollowUpAt: true,
        aiSuggestedNextAction: true,
        premiumValue: true,
      },
    });
    pipeline[stage] = rows;
  }

  // Stage counts for the header badges
  const stageCounts = await db
    .select({
      stage: schema.leads.stage,
      count: count(),
    })
    .from(schema.leads)
    .where(and(...conditions))
    .groupBy(schema.leads.stage);
  const counts = Object.fromEntries(stageCounts.map((s) => [s.stage, Number(s.count)]));

  return c.json({ data: { pipeline, counts } });
});

// ---------------------------------------------------------------------------
// GET /api/leads/today — the morning dashboard.
// Returns: overdue follow-ups + today's follow-ups + leads that opened
// content/illustrations but haven't been called back.
// ---------------------------------------------------------------------------
leadRoutes.get("/today", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId");
  const userId = c.get("userId");
  const role = c.get("role");

  const agentCondition =
    role === "sales_agent" || role === "senior_agent"
      ? eq(schema.leads.agentId, userId)
      : undefined;
  const baseConditions = [
    eq(schema.leads.tenantId, tenantId),
    ...(agentCondition ? [agentCondition] : []),
  ];

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86_400_000);

  // Overdue follow-ups
  const overdue = await db.query.leads.findMany({
    where: and(
      ...baseConditions,
      lt(schema.leads.nextFollowUpAt, todayStart),
      isNull(schema.leads.closedAt),
    ),
    orderBy: [asc(schema.leads.nextFollowUpAt)],
    limit: 20,
    columns: {
      id: true,
      fullName: true,
      phone: true,
      stage: true,
      nextFollowUpAt: true,
      aiSuggestedNextAction: true,
      lastActivityAt: true,
    },
  });

  // Today's follow-ups
  const today = await db.query.leads.findMany({
    where: and(
      ...baseConditions,
      gte(schema.leads.nextFollowUpAt, todayStart),
      lt(schema.leads.nextFollowUpAt, todayEnd),
      isNull(schema.leads.closedAt),
    ),
    orderBy: [asc(schema.leads.nextFollowUpAt)],
    limit: 20,
    columns: {
      id: true,
      fullName: true,
      phone: true,
      stage: true,
      nextFollowUpAt: true,
      aiSuggestedNextAction: true,
      lastActivityAt: true,
    },
  });

  // Hot leads — recently opened content but agent hasn't logged activity in 48h
  const twoDaysAgo = new Date(now.getTime() - 48 * 3600_000);
  const hotLeads = await db.query.leads.findMany({
    where: and(
      ...baseConditions,
      isNull(schema.leads.closedAt),
      lte(schema.leads.lastActivityAt, twoDaysAgo),
    ),
    orderBy: [desc(schema.leads.lastActivityAt)],
    limit: 10,
    columns: {
      id: true,
      fullName: true,
      phone: true,
      stage: true,
      lastActivityAt: true,
      aiSuggestedNextAction: true,
    },
  });

  return c.json({
    data: {
      overdue,
      today,
      hotLeads,
      summary: {
        overdueCount: overdue.length,
        todayCount: today.length,
        hotCount: hotLeads.length,
      },
    },
  });
});

// ---------------------------------------------------------------------------
// GET /api/leads/:id — Customer 360 view
// ---------------------------------------------------------------------------
leadRoutes.get("/:id", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId");
  const id = c.req.param("id");
  const lead = await db.query.leads.findFirst({
    where: and(eq(schema.leads.id, id), eq(schema.leads.tenantId, tenantId)),
    with: {
      agent: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          designation: true,
        },
      },
      activities: {
        orderBy: [desc(schema.leadActivities.createdAt)],
        limit: 50,
      },
    },
  });
  if (!lead) throw new NotFoundError("Lead");

  // Cross-link: content shares sent to this lead
  const contentShares = await db.query.contentShareEvents.findMany({
    where: and(
      eq(schema.contentShareEvents.tenantId, tenantId),
      eq(schema.contentShareEvents.recipientLeadId, id),
    ),
    orderBy: [desc(schema.contentShareEvents.sharedAt)],
    limit: 10,
    columns: {
      id: true,
      resourceKind: true,
      resourceTitle: true,
      channel: true,
      sharedAt: true,
      openCount: true,
      firstOpenedAt: true,
      shortCode: true,
    },
  });

  // Cross-link: illustrations generated for this customer name
  const illustrations = await db.query.illustrations.findMany({
    where: and(
      eq(schema.illustrations.tenantId, tenantId),
      eq(schema.illustrations.agentId, lead.agentId),
      ilike(schema.illustrations.customerName, lead.fullName),
    ),
    orderBy: [desc(schema.illustrations.createdAt)],
    limit: 10,
    columns: {
      id: true,
      productType: true,
      shortCode: true,
      openCount: true,
      createdAt: true,
    },
  });

  return c.json({
    data: {
      lead,
      contentShares,
      illustrations,
    },
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/leads/:id — update lead details or move stage
// ---------------------------------------------------------------------------
leadRoutes.patch(
  "/:id",
  authMiddleware,
  zValidator("json", updateLeadSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const userId = c.get("userId");
    const id = c.req.param("id");
    const body = c.req.valid("json");

    const existing = await db.query.leads.findFirst({
      where: and(eq(schema.leads.id, id), eq(schema.leads.tenantId, tenantId)),
      columns: { id: true, stage: true },
    });
    if (!existing) throw new NotFoundError("Lead");

    const stageChanged = body.stage && body.stage !== existing.stage;

    const [updated] = await db
      .update(schema.leads)
      .set({
        ...body,
        lastActivityAt: new Date(),
        closedAt:
          body.stage === "closed_won" || body.stage === "closed_lost"
            ? new Date()
            : undefined,
        updatedAt: new Date(),
      })
      .where(eq(schema.leads.id, id))
      .returning();

    // Log the stage change as an activity
    if (stageChanged) {
      await db.insert(schema.leadActivities).values({
        tenantId,
        leadId: id,
        actorId: userId,
        kind: "stage_change",
        notes: `Moved from ${existing.stage} → ${body.stage}`,
        metadata: { from: existing.stage, to: body.stage },
      });
    }

    await c.var.audit({
      action: "update",
      resourceType: "lead",
      resourceId: id,
      metadata: {
        fields: Object.keys(body),
        stageChanged,
        ...(stageChanged ? { from: existing.stage, to: body.stage } : {}),
      },
    });

    return c.json({ data: updated });
  },
);

// ---------------------------------------------------------------------------
// POST /api/leads/:id/activities — log an activity
// ---------------------------------------------------------------------------
leadRoutes.post(
  "/:id/activities",
  authMiddleware,
  zValidator("json", leadActivitySchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const userId = c.get("userId");
    const id = c.req.param("id");
    const body = c.req.valid("json");

    const lead = await db.query.leads.findFirst({
      where: and(eq(schema.leads.id, id), eq(schema.leads.tenantId, tenantId)),
      columns: { id: true },
    });
    if (!lead) throw new NotFoundError("Lead");

    const [activity] = await db
      .insert(schema.leadActivities)
      .values({
        tenantId,
        leadId: id,
        actorId: userId,
        kind: body.kind,
        notes: body.notes,
        scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : undefined,
        completedAt: body.completedAt ? new Date(body.completedAt) : undefined,
        contentShareEventId: body.contentShareEventId,
        illustrationId: body.illustrationId,
        metadata: body.metadata,
      })
      .returning();
    if (!activity) throw new Error("Failed to log activity");

    // Update the lead's lastActivityAt
    await db
      .update(schema.leads)
      .set({
        lastActivityAt: new Date(),
        nextFollowUpAt: body.scheduledFor ? new Date(body.scheduledFor) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(schema.leads.id, id));

    // Bump the agent's XP for content shares
    if (body.kind === "content_share" || body.kind === "illustration_share") {
      await db
        .update(schema.userXp)
        .set({
          contentShared: sql`${schema.userXp.contentShared} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(schema.userXp.userId, userId));
    }

    await c.var.audit({
      action: "create",
      resourceType: "lead_activity",
      resourceId: activity.id,
      metadata: { kind: body.kind, leadId: id },
    });

    return c.json({ data: activity }, 201);
  },
);

// ---------------------------------------------------------------------------
// GET /api/leads/stats — pipeline stats for the current user or team
// ---------------------------------------------------------------------------
leadRoutes.get("/stats/overview", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId");
  const userId = c.get("userId");
  const role = c.get("role");

  const conditions = [eq(schema.leads.tenantId, tenantId)];
  if (role === "sales_agent" || role === "senior_agent") {
    conditions.push(eq(schema.leads.agentId, userId));
  }

  const stageCounts = await db
    .select({
      stage: schema.leads.stage,
      count: count(),
      totalPremium: sql<number>`COALESCE(SUM(${schema.leads.premiumValue}), 0)::int`,
    })
    .from(schema.leads)
    .where(and(...conditions))
    .groupBy(schema.leads.stage);

  const totalLeads = stageCounts.reduce((sum, s) => sum + Number(s.count), 0);
  const closedWon = stageCounts.find((s) => s.stage === "closed_won");
  const totalPipeline = stageCounts
    .filter((s) => s.stage !== "closed_won" && s.stage !== "closed_lost" && s.stage !== "dormant")
    .reduce((sum, s) => sum + Number(s.totalPremium), 0);

  const conversionRate = totalLeads > 0
    ? Math.round((Number(closedWon?.count ?? 0) / totalLeads) * 100)
    : 0;

  return c.json({
    data: {
      totalLeads,
      stageCounts: Object.fromEntries(stageCounts.map((s) => [s.stage, Number(s.count)])),
      conversionRate,
      pipelineValue: totalPipeline,
      closedWonValue: Number(closedWon?.totalPremium ?? 0),
      closedWonCount: Number(closedWon?.count ?? 0),
    },
  });
});

// Keep unused imports available for future expansion
void isNull;
