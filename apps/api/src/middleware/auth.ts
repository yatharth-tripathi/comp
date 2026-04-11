import { createClerkClient, verifyToken } from "@clerk/backend";
import type { MiddlewareHandler } from "hono";
import { db, eq, schema } from "@salescontent/db";
import { env } from "../lib/env.js";
import { ForbiddenError, UnauthorizedError } from "../lib/errors.js";

const config = env();
const clerk = createClerkClient({ secretKey: config.CLERK_SECRET_KEY });

/**
 * Auth middleware — verifies the Clerk session JWT and loads the local user
 * row so downstream routes can read tenant/role without hitting the DB again.
 *
 * Accepts:
 *   - `Authorization: Bearer <jwt>` (preferred, works for mobile + server-to-server)
 *   - `__session` cookie (set by Clerk on the web)
 *
 * Sets on context: clerkUserId, tenantId, userId, role.
 */
export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header("authorization");
  const bearer = authHeader?.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : undefined;

  const cookieHeader = c.req.header("cookie") ?? "";
  const sessionCookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("__session="))
    ?.split("=")[1];

  const token = bearer ?? sessionCookie;
  if (!token) throw new UnauthorizedError("Missing session token");

  let clerkUserId: string;
  let clerkOrgId: string | undefined;
  try {
    const payload = await verifyToken(token, {
      secretKey: config.CLERK_SECRET_KEY,
    });
    clerkUserId = payload.sub;
    clerkOrgId =
      typeof payload.org_id === "string"
        ? payload.org_id
        : typeof (payload as Record<string, unknown>).org_id === "string"
          ? ((payload as Record<string, unknown>).org_id as string)
          : undefined;
  } catch (error) {
    throw new UnauthorizedError("Invalid or expired session token");
  }

  if (!clerkOrgId) {
    // The user is authenticated but has not selected an organization.
    // Fall back to looking up the active org via Clerk for non-browser flows.
    const memberships = await clerk.users.getOrganizationMembershipList({
      userId: clerkUserId,
    });
    const firstOrg = memberships.data[0]?.organization.id;
    if (!firstOrg) {
      throw new ForbiddenError("User is not a member of any organization");
    }
    clerkOrgId = firstOrg;
  }

  // Resolve the tenant row
  const tenant = await db.query.tenants.findFirst({
    where: eq(schema.tenants.clerkOrgId, clerkOrgId),
    columns: { id: true, suspended: true },
  });
  if (!tenant) throw new ForbiddenError("Tenant not provisioned for this organization");
  if (tenant.suspended) throw new ForbiddenError("Tenant is suspended");

  // Resolve the local user row
  const user = await db.query.users.findFirst({
    where: (users, { and, eq: e }) =>
      and(e(users.tenantId, tenant.id), e(users.clerkUserId, clerkUserId)),
    columns: { id: true, role: true, active: true },
  });
  if (!user || !user.active) {
    throw new ForbiddenError("User not active in this tenant");
  }

  c.set("clerkUserId", clerkUserId);
  c.set("tenantId", tenant.id);
  c.set("userId", user.id);
  c.set("role", user.role);

  await next();
};

/**
 * Role guard — use via `requireRole('enterprise_admin', 'content_manager')`.
 * Roles are ordered hierarchically for super_admin fast-path.
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
