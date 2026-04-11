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
  ilike,
  inArray,
  isNull,
  or,
  schema,
  sql,
} from "@salescontent/db";
import {
  approveContentSchema,
  contentListQuerySchema,
  createContentAssetSchema,
  presignUploadSchema,
  shareContentSchema,
  updateContentAssetSchema,
} from "@salescontent/schemas";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../lib/errors.js";
import {
  buildContentObjectKey,
  buildPublicUrl,
  deleteObject,
  presignPutUrl,
} from "../services/r2.js";
import { generateUniqueShortCode } from "../services/short-link.js";

// ---------------------------------------------------------------------------
// Max size table per content type (PRD §4.1)
// ---------------------------------------------------------------------------
const MAX_BYTES_BY_TYPE: Record<string, number> = {
  reel: 500 * 1024 * 1024,
  poster: 25 * 1024 * 1024,
  presentation: 100 * 1024 * 1024,
  document: 50 * 1024 * 1024,
  audio: 50 * 1024 * 1024,
  infographic: 25 * 1024 * 1024,
  gif: 15 * 1024 * 1024,
  email_template: 5 * 1024 * 1024,
  illustration: 25 * 1024 * 1024,
  battle_card: 25 * 1024 * 1024,
  whatsapp_template: 1 * 1024 * 1024,
  certificate: 5 * 1024 * 1024,
};

// ---------------------------------------------------------------------------
// MIME allowlist per content type — prevents "upload a 500MB exe as a reel"
// ---------------------------------------------------------------------------
const ALLOWED_MIME_BY_TYPE: Record<string, RegExp[]> = {
  reel: [/^video\/(mp4|quicktime|webm)$/],
  poster: [/^image\/(jpeg|png|webp)$/],
  presentation: [
    /^application\/vnd\.openxmlformats-officedocument\.presentationml\.presentation$/,
    /^application\/vnd\.ms-powerpoint$/,
    /^application\/pdf$/,
  ],
  document: [
    /^application\/pdf$/,
    /^application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document$/,
    /^application\/msword$/,
  ],
  audio: [/^audio\/(mpeg|mp4|aac|webm)$/],
  infographic: [/^image\/(jpeg|png|webp|svg\+xml)$/],
  gif: [/^image\/(gif|webp)$/],
  email_template: [/^text\/html$/],
  illustration: [/^image\/(jpeg|png|webp)$/],
  battle_card: [/^image\/(jpeg|png|webp)$/, /^application\/pdf$/],
  whatsapp_template: [/^text\/plain$/],
  certificate: [/^application\/pdf$/, /^image\/(jpeg|png)$/],
};

function validateFileForContentType(
  contentType: string,
  mimeType: string,
  sizeBytes: number,
): void {
  const maxBytes = MAX_BYTES_BY_TYPE[contentType];
  if (maxBytes === undefined) {
    throw new ValidationError(`Unknown content type: ${contentType}`);
  }
  if (sizeBytes > maxBytes) {
    throw new ValidationError(
      `File too large for ${contentType}: ${sizeBytes} bytes exceeds limit of ${maxBytes}`,
    );
  }
  const allowed = ALLOWED_MIME_BY_TYPE[contentType] ?? [];
  if (!allowed.some((pattern) => pattern.test(mimeType))) {
    throw new ValidationError(
      `MIME type ${mimeType} not allowed for ${contentType}. Accepted: ${allowed.map((p) => p.source).join(", ")}`,
    );
  }
}

export const contentRoutes = new Hono();

// ---------------------------------------------------------------------------
// POST /api/content/upload-url
// Returns a presigned R2 PUT URL scoped to the tenant's folder. The client
// uploads directly to R2, then calls POST /api/content to persist metadata.
// ---------------------------------------------------------------------------
const uploadUrlInputSchema = presignUploadSchema.extend({
  contentType: z.enum([
    "reel",
    "poster",
    "presentation",
    "document",
    "audio",
    "infographic",
    "gif",
    "email_template",
    "illustration",
    "battle_card",
    "whatsapp_template",
    "certificate",
  ]),
});

contentRoutes.post(
  "/upload-url",
  authMiddleware,
  requireRole("enterprise_admin", "content_manager"),
  zValidator("json", uploadUrlInputSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const body = c.req.valid("json");

    validateFileForContentType(body.contentType, body.mimeType, body.sizeBytes);

    // Reserve a content_asset id before signing so the object key is stable.
    // We insert a placeholder row; it gets its real fields on POST /content.
    const [placeholder] = await db
      .insert(schema.contentAssets)
      .values({
        tenantId,
        title: body.filename,
        contentType: body.contentType,
        mimeType: body.mimeType,
        fileBytes: body.sizeBytes,
        createdById: c.get("userId"),
        approvalStatus: "draft",
      })
      .returning({ id: schema.contentAssets.id });
    if (!placeholder) throw new Error("Failed to create placeholder asset");

    const objectKey = buildContentObjectKey({
      tenantId,
      contentId: placeholder.id,
      filename: body.filename,
    });
    const { url, expiresAt } = await presignPutUrl({
      objectKey,
      contentType: body.mimeType,
      contentLength: body.sizeBytes,
    });

    await c.var.audit({
      action: "create",
      resourceType: "content_asset",
      resourceId: placeholder.id,
      metadata: { stage: "upload-url-issued", contentType: body.contentType },
    });

    return c.json({
      data: {
        contentAssetId: placeholder.id,
        uploadUrl: url,
        expiresAt: expiresAt.toISOString(),
        objectKey,
        publicUrl: buildPublicUrl(objectKey),
        requiredHeaders: {
          "Content-Type": body.mimeType,
          "Content-Length": body.sizeBytes.toString(),
        },
      },
    });
  },
);

// ---------------------------------------------------------------------------
// POST /api/content
// Persist metadata for an already-uploaded asset. Client passes the
// contentAssetId returned by /upload-url.
// ---------------------------------------------------------------------------
const persistInputSchema = createContentAssetSchema.extend({
  contentAssetId: z.string().uuid(),
});

contentRoutes.post(
  "/",
  authMiddleware,
  requireRole("enterprise_admin", "content_manager"),
  zValidator("json", persistInputSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const userId = c.get("userId");
    const body = c.req.valid("json");

    const existing = await db.query.contentAssets.findFirst({
      where: and(
        eq(schema.contentAssets.id, body.contentAssetId),
        eq(schema.contentAssets.tenantId, tenantId),
      ),
      columns: { id: true, approvalStatus: true, createdById: true, mimeType: true },
    });
    if (!existing) throw new NotFoundError("Content asset");
    if (existing.approvalStatus !== "draft") {
      throw new ConflictError(
        "Content asset already persisted. Use PATCH to modify after the draft state.",
      );
    }
    if (existing.createdById !== userId) {
      throw new ForbiddenError("Only the uploader can persist the draft");
    }

    // Validate tag ids all belong to this tenant
    if (body.tagIds.length > 0) {
      const tags = await db.query.contentTags.findMany({
        where: and(
          inArray(schema.contentTags.id, body.tagIds),
          eq(schema.contentTags.tenantId, tenantId),
        ),
        columns: { id: true },
      });
      if (tags.length !== body.tagIds.length) {
        throw new ValidationError("One or more tag ids are invalid for this tenant");
      }
    }

    const [updated] = await db
      .update(schema.contentAssets)
      .set({
        title: body.title,
        description: body.description,
        contentType: body.contentType,
        fileUrl: body.fileUrl,
        fileBytes: body.fileBytes,
        mimeType: body.mimeType ?? existing.mimeType,
        thumbnailUrl: body.thumbnailUrl,
        visibilityScope: body.visibilityScope,
        complianceRegime: body.complianceRegime,
        requiresExternalApproval: body.requiresExternalApproval,
        mandatoryDisclaimers: body.mandatoryDisclaimers,
        expiryDate: body.expiryDate ?? null,
        updatedAt: new Date(),
      })
      .where(eq(schema.contentAssets.id, body.contentAssetId))
      .returning();
    if (!updated) throw new Error("Failed to persist content asset");

    // Attach tags
    if (body.tagIds.length > 0) {
      await db.insert(schema.contentAssetTags).values(
        body.tagIds.map((tagId) => ({
          contentAssetId: updated.id,
          tagId,
        })),
      );
    }

    await c.var.audit({
      action: "create",
      resourceType: "content_asset",
      resourceId: updated.id,
      metadata: { stage: "persisted", tagCount: body.tagIds.length },
    });

    return c.json({ data: updated }, 201);
  },
);

// ---------------------------------------------------------------------------
// GET /api/content
// List content with filters. Tenant-scoped; visibility further restricted
// by role (agents only see approved/published content they're entitled to).
// ---------------------------------------------------------------------------
contentRoutes.get(
  "/",
  authMiddleware,
  zValidator("query", contentListQuerySchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const role = c.get("role");
    const query = c.req.valid("query");

    const conditions = [
      eq(schema.contentAssets.tenantId, tenantId),
      isNull(schema.contentAssets.archivedAt),
    ];

    // Non-admin roles only see published content
    if (role !== "super_admin" && role !== "enterprise_admin" && role !== "content_manager") {
      conditions.push(eq(schema.contentAssets.approvalStatus, "published"));
    } else if (query.approvalStatus) {
      conditions.push(eq(schema.contentAssets.approvalStatus, query.approvalStatus));
    }

    if (query.contentType) {
      conditions.push(eq(schema.contentAssets.contentType, query.contentType));
    }
    if (query.q) {
      const pattern = `%${query.q.replace(/[%_]/g, "\\$&")}%`;
      const titleMatch = ilike(schema.contentAssets.title, pattern);
      const descMatch = ilike(schema.contentAssets.description, pattern);
      conditions.push(or(titleMatch, descMatch)!);
    }

    let assetIdFilter: string[] | null = null;
    if (query.tagIds && query.tagIds.length > 0) {
      const rows = await db
        .select({ assetId: schema.contentAssetTags.contentAssetId })
        .from(schema.contentAssetTags)
        .where(inArray(schema.contentAssetTags.tagId, query.tagIds));
      assetIdFilter = Array.from(new Set(rows.map((r) => r.assetId)));
      if (assetIdFilter.length === 0) {
        return c.json({
          data: [],
          meta: { page: query.page, pageSize: query.pageSize, total: 0 },
        });
      }
      conditions.push(inArray(schema.contentAssets.id, assetIdFilter));
    }

    const [rows, totalRows] = await Promise.all([
      db.query.contentAssets.findMany({
        where: and(...conditions),
        orderBy: [desc(schema.contentAssets.publishedAt), desc(schema.contentAssets.createdAt)],
        limit: query.pageSize,
        offset: (query.page - 1) * query.pageSize,
        with: {
          tags: { with: { tag: true } },
        },
      }),
      db
        .select({ total: count() })
        .from(schema.contentAssets)
        .where(and(...conditions)),
    ]);

    return c.json({
      data: rows,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total: Number(totalRows[0]?.total ?? 0),
      },
    });
  },
);

// ---------------------------------------------------------------------------
// GET /api/content/:id
// ---------------------------------------------------------------------------
contentRoutes.get("/:id", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId");
  const id = c.req.param("id");
  const asset = await db.query.contentAssets.findFirst({
    where: and(eq(schema.contentAssets.id, id), eq(schema.contentAssets.tenantId, tenantId)),
    with: {
      tags: { with: { tag: true } },
      approvalEvents: { orderBy: [asc(schema.contentApprovalEvents.createdAt)] },
      personalizationZones: true,
    },
  });
  if (!asset) throw new NotFoundError("Content asset");
  return c.json({ data: asset });
});

// ---------------------------------------------------------------------------
// PATCH /api/content/:id
// ---------------------------------------------------------------------------
contentRoutes.patch(
  "/:id",
  authMiddleware,
  requireRole("enterprise_admin", "content_manager"),
  zValidator("json", updateContentAssetSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const id = c.req.param("id");
    const body = c.req.valid("json");

    const existing = await db.query.contentAssets.findFirst({
      where: and(eq(schema.contentAssets.id, id), eq(schema.contentAssets.tenantId, tenantId)),
      columns: { id: true, approvalStatus: true },
    });
    if (!existing) throw new NotFoundError("Content asset");
    if (existing.approvalStatus === "archived" || existing.approvalStatus === "expired") {
      throw new ConflictError(`Cannot modify content in state ${existing.approvalStatus}`);
    }

    const [updated] = await db
      .update(schema.contentAssets)
      .set({
        title: body.title,
        description: body.description,
        visibilityScope: body.visibilityScope,
        complianceRegime: body.complianceRegime,
        requiresExternalApproval: body.requiresExternalApproval,
        mandatoryDisclaimers: body.mandatoryDisclaimers,
        expiryDate: body.expiryDate ?? null,
        thumbnailUrl: body.thumbnailUrl,
        updatedAt: new Date(),
      })
      .where(eq(schema.contentAssets.id, id))
      .returning();

    // Tag reconciliation — the client always sends the full desired set
    if (body.tagIds) {
      const current = await db.query.contentAssetTags.findMany({
        where: eq(schema.contentAssetTags.contentAssetId, id),
        columns: { tagId: true },
      });
      const currentIds = new Set(current.map((row) => row.tagId));
      const desired = new Set(body.tagIds);
      const toAdd = [...desired].filter((t) => !currentIds.has(t));
      const toRemove = [...currentIds].filter((t) => !desired.has(t));

      if (toRemove.length > 0) {
        await db
          .delete(schema.contentAssetTags)
          .where(
            and(
              eq(schema.contentAssetTags.contentAssetId, id),
              inArray(schema.contentAssetTags.tagId, toRemove),
            ),
          );
      }
      if (toAdd.length > 0) {
        await db
          .insert(schema.contentAssetTags)
          .values(toAdd.map((tagId) => ({ contentAssetId: id, tagId })));
      }
    }

    await c.var.audit({
      action: "update",
      resourceType: "content_asset",
      resourceId: id,
      metadata: { fields: Object.keys(body) },
    });

    return c.json({ data: updated });
  },
);

// ---------------------------------------------------------------------------
// POST /api/content/:id/archive — soft delete
// ---------------------------------------------------------------------------
contentRoutes.post(
  "/:id/archive",
  authMiddleware,
  requireRole("enterprise_admin", "content_manager"),
  async (c) => {
    const tenantId = c.get("tenantId");
    const id = c.req.param("id");
    const [updated] = await db
      .update(schema.contentAssets)
      .set({
        archivedAt: new Date(),
        approvalStatus: "archived",
        updatedAt: new Date(),
      })
      .where(
        and(eq(schema.contentAssets.id, id), eq(schema.contentAssets.tenantId, tenantId)),
      )
      .returning();
    if (!updated) throw new NotFoundError("Content asset");
    await c.var.audit({ action: "archive", resourceType: "content_asset", resourceId: id });
    return c.json({ data: updated });
  },
);

// ---------------------------------------------------------------------------
// DELETE /api/content/:id — hard delete. Only for draft state.
// ---------------------------------------------------------------------------
contentRoutes.delete(
  "/:id",
  authMiddleware,
  requireRole("enterprise_admin", "content_manager"),
  async (c) => {
    const tenantId = c.get("tenantId");
    const id = c.req.param("id");
    const existing = await db.query.contentAssets.findFirst({
      where: and(
        eq(schema.contentAssets.id, id),
        eq(schema.contentAssets.tenantId, tenantId),
      ),
      columns: { id: true, approvalStatus: true, fileUrl: true, thumbnailUrl: true },
    });
    if (!existing) throw new NotFoundError("Content asset");
    if (existing.approvalStatus !== "draft") {
      throw new ConflictError(
        "Only draft content can be hard deleted. Use archive for published content.",
      );
    }

    // Best effort R2 cleanup — extract the object key from the public URL
    if (existing.fileUrl) {
      try {
        const prefix = new URL(existing.fileUrl).pathname.replace(/^\/+/, "");
        if (prefix) await deleteObject(prefix);
      } catch {
        // Ignore cleanup errors — row delete still succeeds
      }
    }

    await db.delete(schema.contentAssets).where(eq(schema.contentAssets.id, id));
    await c.var.audit({ action: "delete", resourceType: "content_asset", resourceId: id });
    return c.json({ data: { id } });
  },
);

// ---------------------------------------------------------------------------
// POST /api/content/:id/submit — kick off approval workflow
// ---------------------------------------------------------------------------
contentRoutes.post(
  "/:id/submit",
  authMiddleware,
  requireRole("enterprise_admin", "content_manager"),
  async (c) => {
    const tenantId = c.get("tenantId");
    const userId = c.get("userId");
    const id = c.req.param("id");

    const asset = await db.query.contentAssets.findFirst({
      where: and(
        eq(schema.contentAssets.id, id),
        eq(schema.contentAssets.tenantId, tenantId),
      ),
      columns: {
        id: true,
        approvalStatus: true,
        requiresExternalApproval: true,
        complianceRegime: true,
      },
    });
    if (!asset) throw new NotFoundError("Content asset");
    if (asset.approvalStatus !== "draft" && asset.approvalStatus !== "rejected") {
      throw new ConflictError(`Cannot submit content in state ${asset.approvalStatus}`);
    }

    // Determine first step: if the tenant requires compliance, start there.
    // Otherwise jump to internal_review.
    const tenant = await db.query.tenants.findFirst({
      where: eq(schema.tenants.id, tenantId),
      columns: { requiresComplianceApproval: true },
    });
    const firstStatus =
      tenant?.requiresComplianceApproval && asset.complianceRegime !== "none"
        ? "pending_compliance"
        : "pending_internal";

    const [updated] = await db
      .update(schema.contentAssets)
      .set({ approvalStatus: firstStatus, updatedAt: new Date() })
      .where(eq(schema.contentAssets.id, id))
      .returning();

    await db.insert(schema.contentApprovalEvents).values({
      contentAssetId: id,
      stepName: "submission",
      actorId: userId,
      status: firstStatus,
      notes: null,
    });
    await c.var.audit({
      action: "update",
      resourceType: "content_asset",
      resourceId: id,
      metadata: { transition: `draft → ${firstStatus}` },
    });
    return c.json({ data: updated });
  },
);

// ---------------------------------------------------------------------------
// POST /api/content/:id/approve — content_manager approves
// ---------------------------------------------------------------------------
contentRoutes.post(
  "/:id/approve",
  authMiddleware,
  requireRole("enterprise_admin", "content_manager"),
  zValidator("json", approveContentSchema.pick({ stepName: true, notes: true })),
  async (c) => {
    const tenantId = c.get("tenantId");
    const userId = c.get("userId");
    const id = c.req.param("id");
    const { stepName, notes } = c.req.valid("json");

    const asset = await db.query.contentAssets.findFirst({
      where: and(
        eq(schema.contentAssets.id, id),
        eq(schema.contentAssets.tenantId, tenantId),
      ),
      columns: { id: true, approvalStatus: true },
    });
    if (!asset) throw new NotFoundError("Content asset");

    // Compute next state based on current state + step
    let nextStatus: typeof asset.approvalStatus = "approved";
    if (stepName === "compliance_review") nextStatus = "pending_internal";
    else if (stepName === "internal_review") nextStatus = "approved";
    else if (stepName === "legal_review") nextStatus = "approved";

    const publishedAt = nextStatus === "approved" ? new Date() : null;
    const finalStatus = nextStatus === "approved" ? "published" : nextStatus;

    const [updated] = await db
      .update(schema.contentAssets)
      .set({
        approvalStatus: finalStatus,
        publishedAt,
        updatedAt: new Date(),
      })
      .where(eq(schema.contentAssets.id, id))
      .returning();

    await db.insert(schema.contentApprovalEvents).values({
      contentAssetId: id,
      stepName,
      actorId: userId,
      status: finalStatus,
      notes: notes ?? null,
    });
    await c.var.audit({
      action: "approve",
      resourceType: "content_asset",
      resourceId: id,
      metadata: { stepName, newStatus: finalStatus },
    });
    return c.json({ data: updated });
  },
);

// ---------------------------------------------------------------------------
// POST /api/content/:id/reject
// ---------------------------------------------------------------------------
contentRoutes.post(
  "/:id/reject",
  authMiddleware,
  requireRole("enterprise_admin", "content_manager"),
  zValidator("json", approveContentSchema.pick({ stepName: true, notes: true })),
  async (c) => {
    const tenantId = c.get("tenantId");
    const userId = c.get("userId");
    const id = c.req.param("id");
    const { stepName, notes } = c.req.valid("json");

    const [updated] = await db
      .update(schema.contentAssets)
      .set({ approvalStatus: "rejected", updatedAt: new Date() })
      .where(
        and(
          eq(schema.contentAssets.id, id),
          eq(schema.contentAssets.tenantId, tenantId),
        ),
      )
      .returning();
    if (!updated) throw new NotFoundError("Content asset");

    await db.insert(schema.contentApprovalEvents).values({
      contentAssetId: id,
      stepName,
      actorId: userId,
      status: "rejected",
      notes: notes ?? null,
    });
    await c.var.audit({
      action: "reject",
      resourceType: "content_asset",
      resourceId: id,
      metadata: { stepName, reason: notes },
    });
    return c.json({ data: updated });
  },
);

// ---------------------------------------------------------------------------
// POST /api/content/:id/share — create a share event with a trackable code
// ---------------------------------------------------------------------------
contentRoutes.post(
  "/:id/share",
  authMiddleware,
  zValidator("json", shareContentSchema.omit({ contentAssetId: true })),
  async (c) => {
    const tenantId = c.get("tenantId");
    const userId = c.get("userId");
    const id = c.req.param("id");
    const body = c.req.valid("json");

    // Agents can only share published content
    const asset = await db.query.contentAssets.findFirst({
      where: and(
        eq(schema.contentAssets.id, id),
        eq(schema.contentAssets.tenantId, tenantId),
      ),
      columns: { id: true, title: true, approvalStatus: true },
    });
    if (!asset) throw new NotFoundError("Content asset");
    if (asset.approvalStatus !== "published") {
      throw new ConflictError(
        `Cannot share content in state ${asset.approvalStatus}. Only published content is shareable.`,
      );
    }

    const shortCode = await generateUniqueShortCode();
    const [share] = await db
      .insert(schema.contentShareEvents)
      .values({
        tenantId,
        contentAssetId: id,
        resourceKind: "content",
        resourceId: id,
        resourceTitle: asset.title,
        sharedById: userId,
        channel: body.channel,
        shortCode,
        recipientName: body.recipientName,
        recipientPhone: body.recipientPhone,
        recipientLeadId: body.relatedLeadId,
        personalizationSnapshot: body.personalizationSnapshot,
      })
      .returning();
    if (!share) throw new Error("Failed to create share event");

    // Bump hot counter on the asset atomically
    await db
      .update(schema.contentAssets)
      .set({
        shareCount: sql`${schema.contentAssets.shareCount} + 1`,
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.contentAssets.id, id));

    await c.var.audit({
      action: "share",
      resourceType: "content_asset",
      resourceId: id,
      metadata: { shortCode, channel: body.channel, recipientName: body.recipientName },
    });

    // Build the public redirect URL — the frontend uses this to open
    // wa.me with a pre-filled message.
    const publicBase = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const redirectUrl = `${publicBase}/s/${shortCode}`;

    return c.json(
      {
        data: {
          shareEventId: share.id,
          shortCode,
          redirectUrl,
        },
      },
      201,
    );
  },
);
