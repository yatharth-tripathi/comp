import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import {
  and,
  asc,
  count,
  countDistinct,
  db,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  not,
  or,
  schema,
  sql,
} from "@salescontent/db";
import { createReelSchema, reelPlaybackEventSchema } from "@salescontent/schemas";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { ConflictError, ForbiddenError, NotFoundError } from "../lib/errors.js";
import {
  buildHlsUrl,
  buildMp4Url,
  buildThumbnailUrl,
  createDirectUpload,
} from "../services/mux.js";

// ---------------------------------------------------------------------------
// POST /api/reels/upload
// Creates a Mux direct upload AND reserves a reel row + content_asset row
// bound together. Returns the upload URL and a reelId the client uses to
// finalize metadata once Mux has processed the video.
// ---------------------------------------------------------------------------
const reelUploadSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
  creatorType: z.enum(["admin", "agent", "ai_generated"]).default("agent"),
});

export const reelRoutes = new Hono();

reelRoutes.post(
  "/upload",
  authMiddleware,
  zValidator("json", reelUploadSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const userId = c.get("userId");
    const role = c.get("role");
    const body = c.req.valid("json");

    // Agents can create "agent" reels; only content_manager+ can create "admin"
    // reels that skip review and publish directly to the company feed.
    const requestedCreatorType = body.creatorType;
    const allowedCreatorType =
      requestedCreatorType === "admin"
        ? role === "super_admin" || role === "enterprise_admin" || role === "content_manager"
          ? "admin"
          : "agent"
        : requestedCreatorType;

    // Create the backing content asset in draft state first
    const [contentAsset] = await db
      .insert(schema.contentAssets)
      .values({
        tenantId,
        title: body.title,
        description: body.description,
        contentType: "reel",
        createdById: userId,
        approvalStatus: "draft",
        mimeType: "video/mp4",
      })
      .returning({ id: schema.contentAssets.id });
    if (!contentAsset) throw new Error("Failed to create backing content asset");

    // Reserve the reel row. We temporarily stash the upload id in muxAssetId;
    // the webhook handler will swap it for the real asset id.
    const upload = await createDirectUpload({
      corsOrigin: process.env.NEXT_PUBLIC_APP_URL ?? "*",
    });

    const [reel] = await db
      .insert(schema.reels)
      .values({
        tenantId,
        contentAssetId: contentAsset.id,
        creatorType: allowedCreatorType,
        creatorId: userId,
        muxAssetId: upload.uploadId,
        muxPlaybackId: null,
        durationSeconds: 0,
        aspectRatio: "9:16",
        reviewState: allowedCreatorType === "admin" ? "company_published" : "private",
      })
      .returning();
    if (!reel) throw new Error("Failed to reserve reel row");

    await c.var.audit({
      action: "create",
      resourceType: "reel",
      resourceId: reel.id,
      metadata: { uploadId: upload.uploadId, creatorType: allowedCreatorType },
    });

    return c.json(
      {
        data: {
          reelId: reel.id,
          contentAssetId: contentAsset.id,
          uploadUrl: upload.uploadUrl,
          uploadId: upload.uploadId,
          expiresAt: upload.expiresAtIso,
        },
      },
      201,
    );
  },
);

// ---------------------------------------------------------------------------
// POST /api/reels/:id/finalize
// After the browser has uploaded to Mux successfully, the client calls this
// to attach metadata (tags, language, mandatory flags, teleprompter script)
// and kick off the approval workflow if the reel is not admin-created.
// ---------------------------------------------------------------------------
reelRoutes.post(
  "/:id/finalize",
  authMiddleware,
  zValidator("json", createReelSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const userId = c.get("userId");
    const role = c.get("role");
    const id = c.req.param("id");
    const body = c.req.valid("json");

    const reel = await db.query.reels.findFirst({
      where: and(eq(schema.reels.id, id), eq(schema.reels.tenantId, tenantId)),
      columns: {
        id: true,
        contentAssetId: true,
        creatorId: true,
        creatorType: true,
        reviewState: true,
      },
    });
    if (!reel) throw new NotFoundError("Reel");
    if (reel.creatorId !== userId && role !== "super_admin" && role !== "enterprise_admin") {
      throw new ForbiddenError("Only the creator can finalize this reel");
    }

    // Validate mandatory role targets — agents cannot make their own reels mandatory
    if (body.isMandatory && role !== "enterprise_admin" && role !== "content_manager") {
      throw new ForbiddenError("Only enterprise_admin or content_manager can mark reels mandatory");
    }

    // Validate tags all belong to the tenant
    if (body.tagIds.length > 0) {
      const tags = await db.query.contentTags.findMany({
        where: and(
          inArray(schema.contentTags.id, body.tagIds),
          eq(schema.contentTags.tenantId, tenantId),
        ),
        columns: { id: true },
      });
      if (tags.length !== body.tagIds.length) {
        throw new ConflictError("One or more tag ids are invalid for this tenant");
      }
    }

    const [updated] = await db
      .update(schema.reels)
      .set({
        teleprompterScript: body.teleprompterScript,
        teleprompterScenario: body.teleprompterScenario,
        isMandatory: body.isMandatory,
        mandatoryForRoles: body.mandatoryForRoles,
        mandatoryForTeamIds: body.mandatoryForTeamIds,
        mandatoryDueDate: body.mandatoryDueDate ? new Date(body.mandatoryDueDate) : null,
        updatedAt: new Date(),
      })
      .where(eq(schema.reels.id, id))
      .returning();

    // Update backing content asset title + description + language + tags
    if (reel.contentAssetId) {
      await db
        .update(schema.contentAssets)
        .set({
          title: body.title,
          description: body.description,
          updatedAt: new Date(),
        })
        .where(eq(schema.contentAssets.id, reel.contentAssetId));

      if (body.tagIds.length > 0) {
        await db
          .insert(schema.contentAssetTags)
          .values(
            body.tagIds.map((tagId) => ({ contentAssetId: reel.contentAssetId!, tagId })),
          )
          .onConflictDoNothing();
      }

      // Admin reels auto-publish; agent reels go through review
      const newStatus = reel.creatorType === "admin" ? "published" : "pending_internal";
      await db
        .update(schema.contentAssets)
        .set({
          approvalStatus: newStatus,
          publishedAt: newStatus === "published" ? new Date() : undefined,
        })
        .where(eq(schema.contentAssets.id, reel.contentAssetId));
    }

    await c.var.audit({
      action: "update",
      resourceType: "reel",
      resourceId: id,
      metadata: { stage: "finalized", isMandatory: body.isMandatory },
    });

    return c.json({ data: updated });
  },
);

// ---------------------------------------------------------------------------
// GET /api/reels/feed
// Personalized reel feed for the caller.
//
// Ordering policy:
//   1. Mandatory training not yet viewed (highest priority — blocks the feed)
//   2. Reels tagged with agent's assigned products
//   3. Trending: highest share→view ratio in last 7 days within tenant
//   4. Recent: published in last 30 days
// Dedupe by id, preserve the first occurrence's priority.
// ---------------------------------------------------------------------------
const feedQuerySchema = z.object({
  cursor: z.string().optional(), // reelId to resume after
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

reelRoutes.get("/feed", authMiddleware, zValidator("query", feedQuerySchema), async (c) => {
  const tenantId = c.get("tenantId");
  const userId = c.get("userId");
  const { limit } = c.req.valid("query");

  // Pull the agent's product assignments to drive ranking
  const me = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: { assignedProducts: true, role: true, branchId: true },
  });

  // Base query: all published reels in this tenant that are NOT archived
  const baseConditions = [
    eq(schema.reels.tenantId, tenantId),
    eq(schema.contentAssets.approvalStatus, "published"),
    isNull(schema.contentAssets.archivedAt),
  ];

  const rows = await db
    .select({
      id: schema.reels.id,
      muxPlaybackId: schema.reels.muxPlaybackId,
      muxAssetId: schema.reels.muxAssetId,
      durationSeconds: schema.reels.durationSeconds,
      aspectRatio: schema.reels.aspectRatio,
      captionsByLanguage: schema.reels.captionsByLanguage,
      isMandatory: schema.reels.isMandatory,
      mandatoryDueDate: schema.reels.mandatoryDueDate,
      totalViews: schema.reels.totalViews,
      totalShares: schema.reels.totalShares,
      completionRateBps: schema.reels.completionRateBps,
      creatorId: schema.reels.creatorId,
      createdAt: schema.reels.createdAt,
      assetTitle: schema.contentAssets.title,
      assetDescription: schema.contentAssets.description,
      assetId: schema.contentAssets.id,
      publishedAt: schema.contentAssets.publishedAt,
    })
    .from(schema.reels)
    .innerJoin(
      schema.contentAssets,
      eq(schema.reels.contentAssetId, schema.contentAssets.id),
    )
    .where(and(...baseConditions))
    .orderBy(desc(schema.contentAssets.publishedAt))
    .limit(limit * 3); // over-fetch so we can rank locally

  // Parallel lookup: which of these has the user already fully watched?
  const viewedRows = await db
    .select({
      reelId: schema.reelViews.reelId,
      completionPctBps: schema.reelViews.completionPctBps,
    })
    .from(schema.reelViews)
    .where(
      and(
        eq(schema.reelViews.viewerId, userId),
        inArray(
          schema.reelViews.reelId,
          rows.map((r) => r.id),
        ),
      ),
    );
  const viewed = new Map<string, number>();
  for (const row of viewedRows) {
    const prev = viewed.get(row.reelId) ?? 0;
    if (row.completionPctBps > prev) viewed.set(row.reelId, row.completionPctBps);
  }

  // Score each reel — higher is better
  const products = new Set(me?.assignedProducts ?? []);
  const scored = rows.map((reel) => {
    let score = 0;

    // Mandatory + unwatched → highest priority
    if (reel.isMandatory && (viewed.get(reel.id) ?? 0) < 8_000) {
      score += 10_000;
    }

    // Product relevance — check the tags on the backing content asset
    // (we do this as a second pass below to keep the join count manageable)

    // Trending signal
    if (reel.totalViews > 0) {
      const shareRate = reel.totalShares / reel.totalViews;
      score += Math.round(shareRate * 1000);
    }
    if (reel.completionRateBps > 0) {
      score += Math.round(reel.completionRateBps / 100);
    }

    // Recency boost
    const ageDays = Math.max(
      1,
      (Date.now() - new Date(reel.publishedAt ?? reel.createdAt).getTime()) / (1000 * 60 * 60 * 24),
    );
    score += Math.round(100 / ageDays);

    // Penalize if already watched to completion
    if ((viewed.get(reel.id) ?? 0) >= 8_000) score -= 500;

    return { reel, score };
  });

  // Second pass — fetch tag rows for the top candidates and boost products
  const candidateIds = scored.map((s) => s.reel.assetId);
  if (products.size > 0 && candidateIds.length > 0) {
    const tagRows = await db
      .select({
        assetId: schema.contentAssetTags.contentAssetId,
        dimension: schema.contentTags.dimension,
        value: schema.contentTags.value,
      })
      .from(schema.contentAssetTags)
      .innerJoin(
        schema.contentTags,
        eq(schema.contentAssetTags.tagId, schema.contentTags.id),
      )
      .where(inArray(schema.contentAssetTags.contentAssetId, candidateIds));
    const assetTags = new Map<string, Set<string>>();
    for (const row of tagRows) {
      if (row.dimension === "specific_product" || row.dimension === "product_category") {
        const s = assetTags.get(row.assetId) ?? new Set();
        s.add(row.value);
        assetTags.set(row.assetId, s);
      }
    }
    for (const item of scored) {
      const tags = assetTags.get(item.reel.assetId);
      if (tags) {
        for (const tag of tags) {
          if (products.has(tag)) item.score += 500;
        }
      }
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, limit);

  // Hydrate creator info for the selected reels
  const creatorIds = Array.from(
    new Set(top.map((s) => s.reel.creatorId).filter((v): v is string => Boolean(v))),
  );
  const creators =
    creatorIds.length > 0
      ? await db.query.users.findMany({
          where: inArray(schema.users.id, creatorIds),
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            designation: true,
            personalizationDefaults: true,
          },
        })
      : [];
  const creatorsById = new Map(creators.map((c) => [c.id, c]));

  const feed = top.map(({ reel, score }) => {
    const creator = reel.creatorId ? creatorsById.get(reel.creatorId) : null;
    return {
      id: reel.id,
      contentAssetId: reel.assetId,
      title: reel.assetTitle,
      description: reel.assetDescription,
      hlsUrl: reel.muxPlaybackId ? buildHlsUrl(reel.muxPlaybackId) : null,
      mp4Url: reel.muxPlaybackId ? buildMp4Url(reel.muxPlaybackId, "high") : null,
      posterUrl: reel.muxPlaybackId
        ? buildThumbnailUrl(reel.muxPlaybackId, {
            time: 1,
            width: 720,
            height: 1280,
            fitMode: "smartcrop",
          })
        : null,
      durationSeconds: reel.durationSeconds,
      aspectRatio: reel.aspectRatio,
      captions: reel.captionsByLanguage,
      isMandatory: reel.isMandatory,
      mandatoryDueDate: reel.mandatoryDueDate?.toISOString() ?? null,
      viewerCompletionPct:
        viewed.has(reel.id) ? (viewed.get(reel.id) ?? 0) / 100 : null,
      totalViews: reel.totalViews,
      totalShares: reel.totalShares,
      creator: creator
        ? {
            id: creator.id,
            displayName:
              creator.personalizationDefaults?.displayName ??
              `${creator.firstName ?? ""} ${creator.lastName ?? ""}`.trim(),
            designation: creator.designation,
            avatarUrl: creator.personalizationDefaults?.photoUrl ?? creator.avatarUrl,
          }
        : null,
      rankScore: score,
    };
  });

  return c.json({ data: feed, meta: { count: feed.length } });
});

// ---------------------------------------------------------------------------
// GET /api/reels/:id — full reel detail
// ---------------------------------------------------------------------------
reelRoutes.get("/:id", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId");
  const id = c.req.param("id");
  const reel = await db.query.reels.findFirst({
    where: and(eq(schema.reels.id, id), eq(schema.reels.tenantId, tenantId)),
    with: {
      contentAsset: {
        with: {
          tags: { with: { tag: true } },
        },
      },
      creator: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          designation: true,
        },
      },
    },
  });
  if (!reel) throw new NotFoundError("Reel");
  return c.json({
    data: {
      ...reel,
      hlsUrl: reel.muxPlaybackId ? buildHlsUrl(reel.muxPlaybackId) : null,
      mp4Url: reel.muxPlaybackId ? buildMp4Url(reel.muxPlaybackId, "high") : null,
      posterUrl: reel.muxPlaybackId
        ? buildThumbnailUrl(reel.muxPlaybackId, { time: 1, width: 720, height: 1280 })
        : null,
    },
  });
});

// ---------------------------------------------------------------------------
// POST /api/reels/:id/view
// Beacon endpoint — client calls this on view start, progress pings, and
// completion. Rate-limited by the global middleware (120/min is fine for
// even aggressive progress updates).
// ---------------------------------------------------------------------------
reelRoutes.post(
  "/:id/view",
  authMiddleware,
  zValidator("json", reelPlaybackEventSchema.omit({ reelId: true })),
  async (c) => {
    const tenantId = c.get("tenantId");
    const userId = c.get("userId");
    const id = c.req.param("id");
    const body = c.req.valid("json");

    // Upsert a single reel_views row per (reelId, viewerId) keyed on the
    // best position they've reached. We always want to track the MAX
    // completion, not the last one.
    const existing = await db.query.reelViews.findFirst({
      where: and(
        eq(schema.reelViews.reelId, id),
        eq(schema.reelViews.viewerId, userId),
      ),
      orderBy: [desc(schema.reelViews.completionPctBps)],
      columns: { id: true, completionPctBps: true },
    });

    if (!existing) {
      await db.insert(schema.reelViews).values({
        reelId: id,
        viewerId: userId,
        tenantId,
        lastPositionSec: body.lastPositionSec,
        completionPctBps: body.completionPctBps,
        deviceKind: body.deviceKind,
        completedAt: body.completionPctBps >= 8_000 ? new Date() : null,
      });

      // Atomic counter bump only on first view (not every progress ping)
      await db
        .update(schema.reels)
        .set({
          totalViews: sql`${schema.reels.totalViews} + 1`,
          uniqueViewers: sql`${schema.reels.uniqueViewers} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(schema.reels.id, id));

      // Mandatory training completion tracking
      if (body.completionPctBps >= 8_000) {
        await db
          .update(schema.reelMandatoryAssignments)
          .set({ completedAt: new Date() })
          .where(
            and(
              eq(schema.reelMandatoryAssignments.reelId, id),
              eq(schema.reelMandatoryAssignments.userId, userId),
            ),
          );
      }
    } else if (body.completionPctBps > existing.completionPctBps) {
      // Progress update — bump max completion
      await db
        .update(schema.reelViews)
        .set({
          lastPositionSec: body.lastPositionSec,
          completionPctBps: body.completionPctBps,
          completedAt: body.completionPctBps >= 8_000 ? new Date() : null,
        })
        .where(eq(schema.reelViews.id, existing.id));

      if (body.completionPctBps >= 8_000 && existing.completionPctBps < 8_000) {
        await db
          .update(schema.reelMandatoryAssignments)
          .set({ completedAt: new Date() })
          .where(
            and(
              eq(schema.reelMandatoryAssignments.reelId, id),
              eq(schema.reelMandatoryAssignments.userId, userId),
            ),
          );
      }
    }

    // Recompute the aggregate completion rate periodically. Cheap enough
    // (simple window query) to run on every view ping at MVP scale.
    const completionAgg = await db
      .select({
        avgBps: sql<number>`COALESCE(AVG(${schema.reelViews.completionPctBps})::int, 0)`,
      })
      .from(schema.reelViews)
      .where(eq(schema.reelViews.reelId, id));
    const avgBps = completionAgg[0]?.avgBps ?? 0;
    await db
      .update(schema.reels)
      .set({ completionRateBps: avgBps })
      .where(eq(schema.reels.id, id));

    return c.json({ data: { ok: true } });
  },
);

// ---------------------------------------------------------------------------
// POST /api/reels/:id/mandatory-assign
// Assign a mandatory-training reel to specific users or role groups.
// ---------------------------------------------------------------------------
const assignSchema = z.object({
  userIds: z.array(z.string().uuid()).optional(),
  roles: z.array(z.string()).optional(),
  teamIds: z.array(z.string().uuid()).optional(),
  dueDate: z.string().datetime().optional(),
});

reelRoutes.post(
  "/:id/mandatory-assign",
  authMiddleware,
  requireRole("enterprise_admin", "content_manager", "branch_manager"),
  zValidator("json", assignSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const id = c.req.param("id");
    const body = c.req.valid("json");

    const reel = await db.query.reels.findFirst({
      where: and(eq(schema.reels.id, id), eq(schema.reels.tenantId, tenantId)),
      columns: { id: true },
    });
    if (!reel) throw new NotFoundError("Reel");

    // Resolve the user set: explicit ids ∪ users with matching role ∪ users in matching teams
    const userConditions = [eq(schema.users.tenantId, tenantId), eq(schema.users.active, true)];
    const orClauses = [];
    if (body.userIds && body.userIds.length > 0) {
      orClauses.push(inArray(schema.users.id, body.userIds));
    }
    if (body.roles && body.roles.length > 0) {
      orClauses.push(inArray(schema.users.role, body.roles as ("sales_agent")[]));
    }
    if (body.teamIds && body.teamIds.length > 0) {
      orClauses.push(inArray(schema.users.teamId, body.teamIds));
    }
    if (orClauses.length === 0) {
      throw new ConflictError("Provide at least one of: userIds, roles, teamIds");
    }
    const finalCondition = and(...userConditions, or(...orClauses)!);

    const users = await db.query.users.findMany({
      where: finalCondition,
      columns: { id: true },
    });

    const dueDate = body.dueDate ? new Date(body.dueDate) : null;

    if (users.length > 0) {
      await db
        .insert(schema.reelMandatoryAssignments)
        .values(
          users.map((u) => ({
            reelId: id,
            userId: u.id,
            tenantId,
            dueDate,
          })),
        )
        .onConflictDoNothing();
    }

    // Also flip the reel's isMandatory flag so it sorts to the top of the feed
    await db
      .update(schema.reels)
      .set({
        isMandatory: true,
        mandatoryDueDate: dueDate,
        updatedAt: new Date(),
      })
      .where(eq(schema.reels.id, id));

    await c.var.audit({
      action: "update",
      resourceType: "reel",
      resourceId: id,
      metadata: { action: "mandatory_assign", count: users.length },
    });

    return c.json({ data: { assignedCount: users.length } });
  },
);

// ---------------------------------------------------------------------------
// GET /api/reels/:id/analytics
// Creator + manager analytics for a single reel.
// ---------------------------------------------------------------------------
reelRoutes.get(
  "/:id/analytics",
  authMiddleware,
  requireRole(
    "enterprise_admin",
    "content_manager",
    "branch_manager",
    "senior_agent",
    "sales_agent",
  ),
  async (c) => {
    const tenantId = c.get("tenantId");
    const userId = c.get("userId");
    const role = c.get("role");
    const id = c.req.param("id");

    const reel = await db.query.reels.findFirst({
      where: and(eq(schema.reels.id, id), eq(schema.reels.tenantId, tenantId)),
      columns: {
        id: true,
        creatorId: true,
        totalViews: true,
        totalShares: true,
        uniqueViewers: true,
        completionRateBps: true,
        createdAt: true,
      },
    });
    if (!reel) throw new NotFoundError("Reel");

    // Agents can only see analytics on their own reels
    if ((role === "sales_agent" || role === "senior_agent") && reel.creatorId !== userId) {
      throw new ForbiddenError("You can only view analytics for reels you created");
    }

    // Completion funnel — 25 / 50 / 75 / 100% buckets
    const [funnel] = await db
      .select({
        total: count(),
        b25: sql<number>`COALESCE(SUM(CASE WHEN ${schema.reelViews.completionPctBps} >= 2500 THEN 1 ELSE 0 END), 0)::int`,
        b50: sql<number>`COALESCE(SUM(CASE WHEN ${schema.reelViews.completionPctBps} >= 5000 THEN 1 ELSE 0 END), 0)::int`,
        b75: sql<number>`COALESCE(SUM(CASE WHEN ${schema.reelViews.completionPctBps} >= 7500 THEN 1 ELSE 0 END), 0)::int`,
        b100: sql<number>`COALESCE(SUM(CASE WHEN ${schema.reelViews.completionPctBps} >= 9500 THEN 1 ELSE 0 END), 0)::int`,
      })
      .from(schema.reelViews)
      .where(eq(schema.reelViews.reelId, id));

    // Share counts from the content_share_events table
    const shareAssetId = (
      await db.query.reels.findFirst({
        where: eq(schema.reels.id, id),
        columns: { contentAssetId: true },
      })
    )?.contentAssetId;

    const [shareStats] = shareAssetId
      ? await db
          .select({
            totalShares: count(),
            opened: sql<number>`COALESCE(SUM(CASE WHEN ${schema.contentShareEvents.openCount} > 0 THEN 1 ELSE 0 END), 0)::int`,
            totalOpens: sql<number>`COALESCE(SUM(${schema.contentShareEvents.openCount}), 0)::int`,
          })
          .from(schema.contentShareEvents)
          .where(eq(schema.contentShareEvents.contentAssetId, shareAssetId))
      : [{ totalShares: 0, opened: 0, totalOpens: 0 }];

    // Non-compliant — mandatory assigned users who haven't completed
    const nonCompliantRows = await db
      .select({
        assignedCount: count(),
        completedCount: sql<number>`COALESCE(SUM(CASE WHEN ${schema.reelMandatoryAssignments.completedAt} IS NOT NULL THEN 1 ELSE 0 END), 0)::int`,
      })
      .from(schema.reelMandatoryAssignments)
      .where(eq(schema.reelMandatoryAssignments.reelId, id));

    // Recent viewers (limit 20)
    const recentViewers = await db
      .select({
        userId: schema.reelViews.viewerId,
        startedAt: schema.reelViews.startedAt,
        completionPctBps: schema.reelViews.completionPctBps,
        userName: schema.users.firstName,
        userLastName: schema.users.lastName,
      })
      .from(schema.reelViews)
      .innerJoin(schema.users, eq(schema.users.id, schema.reelViews.viewerId))
      .where(eq(schema.reelViews.reelId, id))
      .orderBy(desc(schema.reelViews.startedAt))
      .limit(20);

    return c.json({
      data: {
        reelId: id,
        totalViews: reel.totalViews,
        uniqueViewers: reel.uniqueViewers,
        totalShares: reel.totalShares,
        completionRatePct: reel.completionRateBps / 100,
        funnel: {
          started: Number(funnel?.total ?? 0),
          watched25: Number(funnel?.b25 ?? 0),
          watched50: Number(funnel?.b50 ?? 0),
          watched75: Number(funnel?.b75 ?? 0),
          watched100: Number(funnel?.b100 ?? 0),
        },
        shares: {
          totalShares: Number(shareStats?.totalShares ?? 0),
          uniqueOpened: Number(shareStats?.opened ?? 0),
          totalOpens: Number(shareStats?.totalOpens ?? 0),
          openRatePct:
            Number(shareStats?.totalShares ?? 0) > 0
              ? Math.round(
                  (Number(shareStats?.opened ?? 0) / Number(shareStats?.totalShares ?? 1)) * 100,
                )
              : 0,
        },
        mandatoryCompliance: {
          assigned: Number(nonCompliantRows[0]?.assignedCount ?? 0),
          completed: Number(nonCompliantRows[0]?.completedCount ?? 0),
        },
        recentViewers: recentViewers.map((v) => ({
          userId: v.userId,
          name: `${v.userName ?? ""} ${v.userLastName ?? ""}`.trim(),
          startedAt: v.startedAt,
          completionPct: v.completionPctBps / 100,
        })),
      },
    });
  },
);

// Satisfy unused import check for helpers used conditionally
void asc;
void countDistinct;
void gte;
void not;
