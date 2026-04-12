import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { and, db, desc, eq, schema } from "@salescontent/db";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { generateApiKey } from "../middleware/api-key-auth.js";
import { NotFoundError } from "../lib/errors.js";

export const apiKeyRoutes = new Hono();

// ---------------------------------------------------------------------------
// POST /api/api-keys — create a new API key (enterprise_admin only)
// The raw key is returned ONCE in the response. It can never be retrieved
// again — only the prefix + last 4 are stored for display.
// ---------------------------------------------------------------------------
const createKeySchema = z.object({
  name: z.string().min(1).max(120),
  scopes: z.array(z.string()).default([]),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

apiKeyRoutes.post(
  "/",
  authMiddleware,
  requireRole("enterprise_admin"),
  zValidator("json", createKeySchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const userId = c.get("userId");
    const body = c.req.valid("json");

    const { rawKey, keyHash, keyPrefix, lastFour } = generateApiKey();

    const expiresAt = body.expiresInDays
      ? new Date(Date.now() + body.expiresInDays * 86_400_000)
      : null;

    const [row] = await db
      .insert(schema.apiKeys)
      .values({
        tenantId,
        createdById: userId,
        name: body.name,
        keyPrefix,
        keyHash,
        lastFour,
        scopes: body.scopes,
        expiresAt,
      })
      .returning();
    if (!row) throw new Error("Failed to create API key");

    await c.var.audit({
      action: "create",
      resourceType: "api_key",
      resourceId: row.id,
      metadata: { name: body.name },
    });

    return c.json({
      data: {
        id: row.id,
        name: row.name,
        rawKey, // shown ONCE — never stored, never retrievable again
        keyPrefix: row.keyPrefix,
        lastFour: row.lastFour,
        scopes: row.scopes,
        expiresAt: row.expiresAt,
        createdAt: row.createdAt,
      },
    }, 201);
  },
);

// ---------------------------------------------------------------------------
// GET /api/api-keys — list (masks the key, shows prefix + last4 only)
// ---------------------------------------------------------------------------
apiKeyRoutes.get(
  "/",
  authMiddleware,
  requireRole("enterprise_admin"),
  async (c) => {
    const tenantId = c.get("tenantId");
    const keys = await db.query.apiKeys.findMany({
      where: eq(schema.apiKeys.tenantId, tenantId),
      orderBy: [desc(schema.apiKeys.createdAt)],
      columns: {
        id: true,
        name: true,
        keyPrefix: true,
        lastFour: true,
        scopes: true,
        revoked: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });
    return c.json({ data: keys });
  },
);

// ---------------------------------------------------------------------------
// DELETE /api/api-keys/:id — revoke (soft delete)
// ---------------------------------------------------------------------------
apiKeyRoutes.delete(
  "/:id",
  authMiddleware,
  requireRole("enterprise_admin"),
  async (c) => {
    const tenantId = c.get("tenantId");
    const userId = c.get("userId");
    const id = c.req.param("id");

    const [revoked] = await db
      .update(schema.apiKeys)
      .set({
        revoked: true,
        revokedAt: new Date(),
        revokedById: userId,
      })
      .where(
        and(eq(schema.apiKeys.id, id), eq(schema.apiKeys.tenantId, tenantId)),
      )
      .returning();
    if (!revoked) throw new NotFoundError("API key");

    await c.var.audit({
      action: "delete",
      resourceType: "api_key",
      resourceId: id,
    });

    return c.json({ data: { id, revoked: true } });
  },
);
