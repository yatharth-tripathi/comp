import type { MiddlewareHandler } from "hono";
import { db, schema } from "@salescontent/db";
import type { AuditAction } from "../lib/types.js";

/**
 * Audit write helper — call from inside a route after a mutation succeeds.
 * Intentionally synchronous-safe: if the audit write fails, we log but do not
 * fail the user's request (the primary mutation has already committed).
 */
export async function writeAudit(params: {
  tenantId: string | null;
  actorId: string | null;
  action: AuditAction;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}): Promise<void> {
  try {
    await db.insert(schema.auditLogs).values({
      tenantId: params.tenantId ?? undefined,
      actorId: params.actorId ?? undefined,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId ?? undefined,
      metadata: params.metadata ?? {},
      ipAddress: params.ipAddress ?? undefined,
      userAgent: params.userAgent ?? undefined,
      requestId: params.requestId ?? undefined,
    });
  } catch (error) {
    // Audit write is best-effort. We never fail the primary request because
    // the log couldn't be written — but we do warn loudly.
    console.error("[audit] failed to write audit log", error);
  }
}

/**
 * Middleware that attaches a convenience `c.var.audit(...)` function closed
 * over request-time metadata. Routes call it like:
 *   await c.var.audit({ action: 'create', resourceType: 'content_asset', resourceId: id });
 */
declare module "hono" {
  interface ContextVariableMap {
    audit: (opts: {
      action: AuditAction;
      resourceType: string;
      resourceId?: string | null;
      metadata?: Record<string, unknown>;
    }) => Promise<void>;
  }
}

export const auditMiddleware: MiddlewareHandler = async (c, next) => {
  const ipAddress = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = c.req.header("user-agent") ?? null;
  const requestId = c.res.headers.get("x-request-id");

  c.set("audit", async (opts) =>
    writeAudit({
      tenantId: c.get("tenantId") ?? null,
      actorId: c.get("userId") ?? null,
      ipAddress,
      userAgent,
      requestId,
      ...opts,
    }),
  );
  await next();
};
