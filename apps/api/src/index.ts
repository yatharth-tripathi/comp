import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { compress } from "hono/compress";
import { secureHeaders } from "hono/secure-headers";
import { env } from "./lib/env.js";
import { logger } from "./lib/logger.js";
import { auditMiddleware } from "./middleware/audit.js";
import { contextMiddleware } from "./middleware/context.js";
import { errorHandler } from "./middleware/error-handler.js";
import { rateLimitMiddleware } from "./middleware/rate-limit.js";
import { clerkWebhookRoutes } from "./routes/clerk-webhook.js";
import { contentRoutes } from "./routes/content.js";
import { contentTagsRoutes } from "./routes/content-tags.js";
import { copilotRoutes } from "./routes/copilot.js";
import { healthRoutes } from "./routes/health.js";
import { illustrationRoutes } from "./routes/illustrations.js";
import { leadRoutes } from "./routes/leads.js";
import { learningRoutes } from "./routes/learning.js";
import { muxWebhookRoutes } from "./routes/mux-webhook.js";
import { onboardingRoutes } from "./routes/onboarding.js";
import { publicIllustrationRoutes } from "./routes/public-illustrations.js";
import { publicShareRoutes } from "./routes/public-shares.js";
import { reelRoutes } from "./routes/reels.js";
import { rolePlayRoutes } from "./routes/role-play.js";
import { tenantRoutes } from "./routes/tenants.js";
import { userRoutes } from "./routes/users.js";

const config = env();

const app = new Hono();

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------
app.use("*", contextMiddleware);
app.use("*", compress());
app.use("*", secureHeaders());
app.use(
  "*",
  cors({
    origin: (origin) => {
      // Allow same-origin + the configured web URL in dev; in production the
      // frontend domain list should be set via ALLOWED_ORIGINS.
      const allowed = (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000").split(",");
      return allowed.includes(origin) ? origin : allowed[0] ?? null;
    },
    credentials: true,
    allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["authorization", "content-type", "x-request-id"],
    exposeHeaders: ["x-request-id", "x-ratelimit-remaining", "x-ratelimit-reset"],
    maxAge: 600,
  }),
);
app.use("/api/*", rateLimitMiddleware);
app.use("/api/*", auditMiddleware);
app.onError(errorHandler);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
// Public
app.route("/health", healthRoutes);
app.route("/public/shares", publicShareRoutes);
app.route("/public/illustrations", publicIllustrationRoutes);

// Webhooks — NOT behind auth, but signature-verified inside the route
app.route("/webhooks/clerk", clerkWebhookRoutes);
app.route("/webhooks/mux", muxWebhookRoutes);

// Onboarding — NOT behind authMiddleware because the user row doesn't exist
// yet; the handler verifies the Clerk JWT directly.
app.route("/api/onboarding", onboardingRoutes);

// Authed API surface
app.route("/api/tenants", tenantRoutes);
app.route("/api/users", userRoutes);
app.route("/api/content", contentRoutes);
app.route("/api/content-tags", contentTagsRoutes);
app.route("/api/reels", reelRoutes);
app.route("/api/illustrations", illustrationRoutes);
app.route("/api/role-play", rolePlayRoutes);
app.route("/api/copilot", copilotRoutes);
app.route("/api/leads", leadRoutes);
app.route("/api/learning", learningRoutes);

// Root
app.get("/", (c) =>
  c.json({
    data: {
      service: "salescontent-api",
      version: "0.1.0",
      docs: "https://github.com/yatharth-tripathi/comp#readme",
    },
  }),
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
const port = config.PORT;
serve({ fetch: app.fetch, port }, (info) => {
  logger.info({ port: info.port, env: config.NODE_ENV }, "api.listening");
});

// Graceful shutdown
const shutdown = (signal: string): void => {
  logger.info({ signal }, "api.shutdown");
  process.exit(0);
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

export default app;
