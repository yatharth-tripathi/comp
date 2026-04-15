import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { and, db, desc, eq, schema, sql } from "@salescontent/db";
import { bulkInviteSchema } from "@salescontent/schemas";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { NotFoundError } from "../lib/errors.js";
import { hashPassword } from "../lib/session.js";
import { dpdpErasureHandler } from "../middleware/security.js";

export const adminRoutes = new Hono();

// ---------------------------------------------------------------------------
// DELETE /api/admin/user-data — DPDP Act 2023 right-to-erasure (PRD §13.3)
// ---------------------------------------------------------------------------
adminRoutes.delete(
  "/user-data",
  authMiddleware,
  requireRole("enterprise_admin"),
  dpdpErasureHandler,
);

// ---------------------------------------------------------------------------
// POST /api/admin/campaigns — create a content push campaign (PRD §12.3)
// ---------------------------------------------------------------------------
const createCampaignSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  scheduleJson: z
    .array(
      z.object({
        dayOffset: z.number().int().nonnegative(),
        contentAssetIds: z.array(z.string().uuid()).default([]),
        reelIds: z.array(z.string().uuid()).default([]),
        broadcastMessage: z.string().max(2000).optional(),
      }),
    )
    .default([]),
});

adminRoutes.post(
  "/campaigns",
  authMiddleware,
  requireRole("enterprise_admin", "content_manager"),
  zValidator("json", createCampaignSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const userId = c.get("userId");
    const body = c.req.valid("json");

    const [campaign] = await db
      .insert(schema.campaigns)
      .values({
        tenantId,
        createdById: userId,
        name: body.name,
        description: body.description,
        status: "draft",
        startsAt: new Date(body.startsAt),
        endsAt: new Date(body.endsAt),
        scheduleJson: body.scheduleJson,
      })
      .returning();
    if (!campaign) throw new Error("Failed to create campaign");

    await c.var.audit({
      action: "create",
      resourceType: "campaign",
      resourceId: campaign.id,
    });

    return c.json({ data: campaign }, 201);
  },
);

// ---------------------------------------------------------------------------
// GET /api/admin/campaigns
// ---------------------------------------------------------------------------
adminRoutes.get(
  "/campaigns",
  authMiddleware,
  requireRole("enterprise_admin", "content_manager"),
  async (c) => {
    const tenantId = c.get("tenantId");
    const campaigns = await db.query.campaigns.findMany({
      where: eq(schema.campaigns.tenantId, tenantId),
      orderBy: [desc(schema.campaigns.createdAt)],
    });
    return c.json({ data: campaigns });
  },
);

// ---------------------------------------------------------------------------
// PATCH /api/admin/campaigns/:id/status — activate, pause, cancel
// ---------------------------------------------------------------------------
const updateStatusSchema = z.object({
  status: z.enum(["scheduled", "active", "paused", "completed", "cancelled"]),
});

adminRoutes.patch(
  "/campaigns/:id/status",
  authMiddleware,
  requireRole("enterprise_admin", "content_manager"),
  zValidator("json", updateStatusSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const id = c.req.param("id");
    const { status } = c.req.valid("json");

    const [updated] = await db
      .update(schema.campaigns)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(schema.campaigns.id, id), eq(schema.campaigns.tenantId, tenantId)))
      .returning();
    if (!updated) throw new NotFoundError("Campaign");

    await c.var.audit({
      action: "update",
      resourceType: "campaign",
      resourceId: id,
      metadata: { status },
    });

    return c.json({ data: updated });
  },
);

// ---------------------------------------------------------------------------
// POST /api/admin/bulk-import-users — CSV-style bulk user import (PRD §12.1)
// ---------------------------------------------------------------------------
adminRoutes.post(
  "/bulk-import-users",
  authMiddleware,
  requireRole("enterprise_admin"),
  zValidator("json", bulkInviteSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const userId = c.get("userId");
    const { rows } = c.req.valid("json");

    let created = 0;
    let skipped = 0;
    const errors: Array<{ index: number; reason: string }> = [];

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i]!;
      try {
        const passwordHash = await hashPassword(row.initialPassword);

        const [user] = await db
          .insert(schema.users)
          .values({
            tenantId,
            email: row.email,
            passwordHash,
            firstName: row.firstName,
            lastName: row.lastName,
            phone: row.phone,
            role: row.role,
            branchId: row.branchId,
            teamId: row.teamId,
            employeeCode: row.employeeCode,
            designation: row.designation,
            preferredLanguages: row.preferredLanguages,
            assignedProducts: row.assignedProducts,
            assignedGeographies: row.assignedGeographies,
            active: true,
          })
          .onConflictDoNothing()
          .returning({ id: schema.users.id });

        if (user) {
          await db
            .insert(schema.userXp)
            .values({ userId: user.id, tenantId })
            .onConflictDoNothing();
          created += 1;
        } else {
          skipped += 1;
        }
      } catch (err) {
        errors.push({
          index: i,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }

    await c.var.audit({
      action: "bulk_import",
      resourceType: "user",
      metadata: { total: rows.length, created, skipped, errorCount: errors.length },
    });

    return c.json({
      data: {
        total: rows.length,
        created,
        skipped,
        errors: errors.slice(0, 20),
      },
    });
  },
);

// ---------------------------------------------------------------------------
// GET /api/admin/audit-logs — recent audit trail (PRD §13.3)
// ---------------------------------------------------------------------------
adminRoutes.get(
  "/audit-logs",
  authMiddleware,
  requireRole("enterprise_admin"),
  async (c) => {
    const tenantId = c.get("tenantId");
    const limit = Math.min(100, parseInt(c.req.query("limit") ?? "50", 10));
    const offset = parseInt(c.req.query("offset") ?? "0", 10);

    const logs = await db.query.auditLogs.findMany({
      where: eq(schema.auditLogs.tenantId, tenantId),
      orderBy: [desc(schema.auditLogs.createdAt)],
      limit,
      offset,
    });

    return c.json({ data: logs });
  },
);

// Keep imports
void sql;
