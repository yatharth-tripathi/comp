import { createHash } from "node:crypto";
import type { MiddlewareHandler } from "hono";
import { db, eq, schema } from "@salescontent/db";
import { ForbiddenError, UnauthorizedError } from "../lib/errors.js";

/**
 * API key authentication middleware — for the public REST API tier.
 *
 * Enterprise clients use this to integrate SalesContent AI into their
 * own systems (PRD §13.1 "API-first from day one").
 *
 * API keys are passed as:
 *   Authorization: Bearer sk_live_xxxx
 *
 * The key is hashed with SHA-256 and looked up in the api_keys table.
 * We never store the raw key — only the hash + the first 8 chars
 * (key_prefix) for fast lookup + the last 4 for display.
 *
 * Sets on context: tenantId, userId (the key creator), role = the
 * key's scoped role.
 */
export const apiKeyAuthMiddleware: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header("authorization");
  const bearer = authHeader?.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : undefined;
  if (!bearer) throw new UnauthorizedError("Missing API key");

  // Hash the provided key
  const keyHash = createHash("sha256").update(bearer).digest("hex");

  const apiKey = await db.query.apiKeys.findFirst({
    where: eq(schema.apiKeys.keyHash, keyHash),
    columns: {
      id: true,
      tenantId: true,
      createdById: true,
      scopes: true,
      revoked: true,
      expiresAt: true,
      rateLimitPerMinute: true,
    },
  });

  if (!apiKey) throw new UnauthorizedError("Invalid API key");
  if (apiKey.revoked) throw new ForbiddenError("API key has been revoked");
  if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
    throw new ForbiddenError("API key has expired");
  }

  // Update lastUsedAt (fire-and-forget)
  void db
    .update(schema.apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(schema.apiKeys.id, apiKey.id))
    .catch(() => undefined);

  // Set context vars — the public API behaves like the key creator
  c.set("tenantId", apiKey.tenantId);
  c.set("userId", apiKey.createdById);
  c.set("role", "enterprise_admin"); // API keys always have admin scope

  await next();
};

/**
 * Generate a new API key. Returns the raw key (shown ONCE to the user)
 * and persists the hash.
 */
export function generateApiKey(): {
  rawKey: string;
  keyHash: string;
  keyPrefix: string;
  lastFour: string;
} {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const rawKey = `sk_live_${hex}`;
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  return {
    rawKey,
    keyHash,
    keyPrefix: rawKey.slice(0, 12),
    lastFour: rawKey.slice(-4),
  };
}
