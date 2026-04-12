import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import {
  copilotQuerySchema,
  endCopilotSessionSchema,
  startCopilotSessionSchema,
} from "@salescontent/schemas";
import { authMiddleware } from "../middleware/auth.js";
import { routeLimiter } from "../middleware/rate-limit.js";
import {
  endCopilotSession,
  queryCopilot,
  startCopilotSession,
} from "../services/copilot.js";

export const copilotRoutes = new Hono();

// ---------------------------------------------------------------------------
// POST /api/copilot/start — start a new copilot session
// ---------------------------------------------------------------------------
copilotRoutes.post(
  "/start",
  authMiddleware,
  routeLimiter({ key: "copilot-start", max: 20, windowSeconds: 60 }),
  zValidator("json", startCopilotSessionSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const userId = c.get("userId");
    const body = c.req.valid("json");

    const result = await startCopilotSession({
      tenantId,
      userId,
      mode: body.mode,
      customerName: body.customerName,
      customerContext: body.customerContext as Record<string, unknown> | undefined,
      productFocus: body.productFocus,
      leadId: body.leadId,
    });

    await c.var.audit({
      action: "create",
      resourceType: "copilot_session",
      resourceId: result.sessionId,
      metadata: { mode: body.mode },
    });

    return c.json({ data: result }, 201);
  },
);

// ---------------------------------------------------------------------------
// POST /api/copilot/query — send a message to the copilot
// ---------------------------------------------------------------------------
copilotRoutes.post(
  "/query",
  authMiddleware,
  routeLimiter({ key: "copilot-query", max: 40, windowSeconds: 60 }),
  zValidator("json", copilotQuerySchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const userId = c.get("userId");
    const body = c.req.valid("json");

    const result = await queryCopilot({
      tenantId,
      userId,
      sessionId: body.sessionId,
      content: body.content,
      preferFastModel: body.preferFastModel,
    });

    return c.json({ data: result });
  },
);

// ---------------------------------------------------------------------------
// POST /api/copilot/end — end the session with optional summary
// ---------------------------------------------------------------------------
copilotRoutes.post(
  "/end",
  authMiddleware,
  zValidator("json", endCopilotSessionSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const userId = c.get("userId");
    const body = c.req.valid("json");

    await endCopilotSession({
      tenantId,
      userId,
      sessionId: body.sessionId,
      summary: body.summary,
    });

    await c.var.audit({
      action: "update",
      resourceType: "copilot_session",
      resourceId: body.sessionId,
      metadata: { stage: "ended" },
    });

    return c.json({ data: { ok: true } });
  },
);
