import { Hono } from "hono";
import { db, sql } from "@salescontent/db";
import { redis } from "../lib/redis.js";

export const healthRoutes = new Hono();

healthRoutes.get("/", (c) => {
  return c.json({
    data: {
      service: "salescontent-api",
      status: "ok",
      timestamp: new Date().toISOString(),
    },
  });
});

healthRoutes.get("/deep", async (c) => {
  const checks: Record<string, { ok: boolean; latencyMs?: number; error?: string }> = {};

  // Database probe
  const dbStart = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    checks.database = { ok: true, latencyMs: Date.now() - dbStart };
  } catch (error) {
    checks.database = {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  // Redis probe
  const redisStart = Date.now();
  try {
    await redis.ping();
    checks.redis = { ok: true, latencyMs: Date.now() - redisStart };
  } catch (error) {
    checks.redis = {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const allOk = Object.values(checks).every((v) => v.ok);
  return c.json(
    {
      data: {
        service: "salescontent-api",
        status: allOk ? "ok" : "degraded",
        checks,
        timestamp: new Date().toISOString(),
      },
    },
    allOk ? 200 : 503,
  );
});
