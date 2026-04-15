import type { MiddlewareHandler } from "hono";
import { db, eq, schema } from "@salescontent/db";
import { verifySessionToken } from "../lib/session.js";
import { ForbiddenError, UnauthorizedError } from "../lib/errors.js";

/**
 * Auth middleware — verifies the HS256 session JWT and loads the local user
 * row so downstream routes can read tenant/role without hitting the DB again.
 *
 * Accepts the JWT via `Authorization: Bearer <token>` (the only transport —
 * the API is stateless and does not set cookies).
 */
export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header("authorization");
  const token = authHeader?.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : undefined;
  if (!token) throw new UnauthorizedError("Missing session token");

  let session: Awaited<ReturnType<typeof verifySessionToken>>;
  try {
    session = await verifySessionToken(token);
  } catch {
    throw new UnauthorizedError("Invalid or expired session token");
  }

  const tenant = await db.query.tenants.findFirst({
    where: eq(schema.tenants.id, session.tenantId),
    columns: { id: true, suspended: true },
  });
  if (!tenant) throw new ForbiddenError("Tenant not found");
  if (tenant.suspended) throw new ForbiddenError("Tenant is suspended");

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, session.userId),
    columns: { id: true, tenantId: true, role: true, active: true },
  });
  if (!user || !user.active) {
    throw new ForbiddenError("User not active");
  }
  if (user.tenantId !== tenant.id) {
    throw new ForbiddenError("User does not belong to this tenant");
  }

  c.set("tenantId", tenant.id);
  c.set("userId", user.id);
  c.set("role", user.role);

  await next();
};

/**
 * Role guard — use via `requireRole('enterprise_admin', 'content_manager')`.
 * super_admin bypasses all role checks.
 */
export function requireRole(...allowed: string[]): MiddlewareHandler {
  const set = new Set(allowed);
  return async (c, next) => {
    const role = c.get("role");
    if (role === "super_admin" || set.has(role)) {
      await next();
      return;
    }
    throw new ForbiddenError(`Role '${role}' is not permitted for this operation`);
  };
}
