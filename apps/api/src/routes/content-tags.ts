import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { and, asc, db, eq, schema } from "@salescontent/db";
import { createTagSchema } from "@salescontent/schemas";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { ConflictError, NotFoundError } from "../lib/errors.js";

export const contentTagsRoutes = new Hono();

// ---------------------------------------------------------------------------
// GET /api/content-tags — list tags for the tenant, optionally filtered by dimension
// ---------------------------------------------------------------------------
const listQuerySchema = z.object({
  dimension: z
    .enum([
      "industry",
      "product_category",
      "specific_product",
      "sales_stage",
      "customer_persona",
      "language",
      "campaign",
      "geography",
      "channel",
      "compliance_status",
      "difficulty",
    ])
    .optional(),
});

contentTagsRoutes.get("/", authMiddleware, zValidator("query", listQuerySchema), async (c) => {
  const tenantId = c.get("tenantId");
  const { dimension } = c.req.valid("query");

  const conditions = [eq(schema.contentTags.tenantId, tenantId)];
  if (dimension) conditions.push(eq(schema.contentTags.dimension, dimension));

  const tags = await db.query.contentTags.findMany({
    where: and(...conditions),
    orderBy: [asc(schema.contentTags.dimension), asc(schema.contentTags.displayLabel)],
  });
  return c.json({ data: tags });
});

// ---------------------------------------------------------------------------
// POST /api/content-tags
// ---------------------------------------------------------------------------
contentTagsRoutes.post(
  "/",
  authMiddleware,
  requireRole("enterprise_admin", "content_manager"),
  zValidator("json", createTagSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const body = c.req.valid("json");

    // Enforce tenant + dimension + value uniqueness
    const existing = await db.query.contentTags.findFirst({
      where: and(
        eq(schema.contentTags.tenantId, tenantId),
        eq(schema.contentTags.dimension, body.dimension),
        eq(schema.contentTags.value, body.value),
      ),
      columns: { id: true },
    });
    if (existing) {
      throw new ConflictError(
        `Tag already exists for dimension ${body.dimension} and value ${body.value}`,
      );
    }

    if (body.parentTagId) {
      const parent = await db.query.contentTags.findFirst({
        where: and(
          eq(schema.contentTags.id, body.parentTagId),
          eq(schema.contentTags.tenantId, tenantId),
        ),
        columns: { id: true },
      });
      if (!parent) throw new NotFoundError("Parent tag");
    }

    const [tag] = await db
      .insert(schema.contentTags)
      .values({
        tenantId,
        dimension: body.dimension,
        value: body.value,
        displayLabel: body.displayLabel,
        parentTagId: body.parentTagId,
      })
      .returning();
    if (!tag) throw new Error("Failed to create tag");

    await c.var.audit({
      action: "create",
      resourceType: "content_tag",
      resourceId: tag.id,
      metadata: { dimension: body.dimension, value: body.value },
    });
    return c.json({ data: tag }, 201);
  },
);

// ---------------------------------------------------------------------------
// DELETE /api/content-tags/:id
// ---------------------------------------------------------------------------
contentTagsRoutes.delete(
  "/:id",
  authMiddleware,
  requireRole("enterprise_admin", "content_manager"),
  async (c) => {
    const tenantId = c.get("tenantId");
    const id = c.req.param("id");

    const [deleted] = await db
      .delete(schema.contentTags)
      .where(
        and(eq(schema.contentTags.id, id), eq(schema.contentTags.tenantId, tenantId)),
      )
      .returning();
    if (!deleted) throw new NotFoundError("Tag");
    await c.var.audit({ action: "delete", resourceType: "content_tag", resourceId: id });
    return c.json({ data: { id } });
  },
);
