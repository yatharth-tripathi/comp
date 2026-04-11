import { Ratelimit } from "@upstash/ratelimit";
import type { MiddlewareHandler } from "hono";
import { env } from "../lib/env.js";
import { RateLimitError } from "../lib/errors.js";
import { redis } from "../lib/redis.js";

const config = env();

const globalLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(config.RATE_LIMIT_MAX_REQUESTS, `${config.RATE_LIMIT_WINDOW_SECONDS} s`),
  analytics: true,
  prefix: "ratelimit:api:global",
});

/**
 * Global per-IP + per-user rate limit. Stricter limits are applied per-route
 * (e.g. copilot) by wrapping this and composing with routeLimiter().
 */
export const rateLimitMiddleware: MiddlewareHandler = async (c, next) => {
  const userId = c.get("userId");
  const forwardedFor = c.req.header("x-forwarded-for") ?? "";
  const ip = forwardedFor.split(",")[0]?.trim() ?? c.req.header("x-real-ip") ?? "unknown";
  const identifier = userId ? `user:${userId}` : `ip:${ip}`;

  const result = await globalLimiter.limit(identifier);
  c.res.headers.set("x-ratelimit-limit", result.limit.toString());
  c.res.headers.set("x-ratelimit-remaining", result.remaining.toString());
  c.res.headers.set("x-ratelimit-reset", Math.ceil(result.reset / 1000).toString());

  if (!result.success) {
    const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
    throw new RateLimitError(retryAfter);
  }
  await next();
};

/**
 * Per-route custom limiter. Use like:
 *   const copilotLimiter = routeLimiter({ key: "copilot", max: 30, windowSeconds: 60 });
 *   app.post("/copilot/query", copilotLimiter, authMiddleware, ...);
 */
export function routeLimiter(opts: {
  key: string;
  max: number;
  windowSeconds: number;
}): MiddlewareHandler {
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(opts.max, `${opts.windowSeconds} s`),
    analytics: true,
    prefix: `ratelimit:api:${opts.key}`,
  });
  return async (c, next) => {
    const userId = c.get("userId") ?? "anonymous";
    const result = await limiter.limit(userId);
    if (!result.success) {
      const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
      throw new RateLimitError(retryAfter);
    }
    await next();
  };
}
