import type { Context, MiddlewareHandler } from "hono";
import { randomUUID } from "node:crypto";
import { logger } from "../lib/logger.js";

/**
 * Request context — a per-request identifier and a child logger so every log
 * line carries the request id. Attached to the Hono context as `c.var.ctx`.
 */
export interface RequestContext {
  requestId: string;
  startedAtMs: number;
  log: typeof logger;
}

declare module "hono" {
  interface ContextVariableMap {
    ctx: RequestContext;
    tenantId: string;
    userId: string;
    role: string;
  }
}

export const contextMiddleware: MiddlewareHandler = async (c, next) => {
  const requestId = c.req.header("x-request-id") ?? randomUUID();
  const log = logger.child({
    requestId,
    method: c.req.method,
    path: new URL(c.req.url).pathname,
  });

  const ctx: RequestContext = {
    requestId,
    startedAtMs: Date.now(),
    log,
  };
  c.set("ctx", ctx);
  c.res.headers.set("x-request-id", requestId);

  try {
    await next();
  } finally {
    const tookMs = Date.now() - ctx.startedAtMs;
    log.info({ status: c.res.status, tookMs }, "request.complete");
  }
};

export function getCtx(c: Context): RequestContext {
  return c.get("ctx");
}
