import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { and, asc, db, eq, schema } from "@salescontent/db";
import { authMiddleware } from "../middleware/auth.js";
import { routeLimiter } from "../middleware/rate-limit.js";
import { NotFoundError } from "../lib/errors.js";
import {
  customerTurn,
  ensureSeedScenariosForTenant,
  evaluateSession,
  listSessionsForUser,
  showMe,
  startSession,
} from "../services/role-play-engine.js";

export const rolePlayRoutes = new Hono();

// ---------------------------------------------------------------------------
// GET /api/role-play/scenarios
// Lists the tenant's scenarios. Seeds from the package on first access.
// ---------------------------------------------------------------------------
rolePlayRoutes.get("/scenarios", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId");
  await ensureSeedScenariosForTenant(tenantId);
  const scenarios = await db.query.rolePlayScenarios.findMany({
    where: eq(schema.rolePlayScenarios.tenantId, tenantId),
    orderBy: [asc(schema.rolePlayScenarios.difficulty), asc(schema.rolePlayScenarios.title)],
    columns: {
      id: true,
      title: true,
      description: true,
      category: true,
      difficulty: true,
      language: true,
      xpReward: true,
      tags: true,
    },
  });
  return c.json({ data: scenarios });
});

// ---------------------------------------------------------------------------
// GET /api/role-play/scenarios/:id — full detail (including persona + rules)
// ---------------------------------------------------------------------------
rolePlayRoutes.get("/scenarios/:id", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId");
  const id = c.req.param("id");
  const scenario = await db.query.rolePlayScenarios.findFirst({
    where: and(
      eq(schema.rolePlayScenarios.id, id),
      eq(schema.rolePlayScenarios.tenantId, tenantId),
    ),
  });
  if (!scenario) throw new NotFoundError("Scenario");
  return c.json({ data: scenario });
});

// ---------------------------------------------------------------------------
// POST /api/role-play/sessions/start — begin a new session
// ---------------------------------------------------------------------------
const startSchema = z.object({
  scenarioId: z.string().uuid(),
});

rolePlayRoutes.post(
  "/sessions/start",
  authMiddleware,
  routeLimiter({ key: "role-play-start", max: 20, windowSeconds: 60 }),
  zValidator("json", startSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const userId = c.get("userId");
    const { scenarioId } = c.req.valid("json");
    const result = await startSession({ tenantId, userId, scenarioId });
    await c.var.audit({
      action: "create",
      resourceType: "role_play_session",
      resourceId: result.sessionId,
      metadata: { scenarioId },
    });
    return c.json({ data: result }, 201);
  },
);

// ---------------------------------------------------------------------------
// POST /api/role-play/sessions/:id/respond — trainee submits a response
// ---------------------------------------------------------------------------
const respondSchema = z.object({
  response: z.string().min(1).max(4000),
});

rolePlayRoutes.post(
  "/sessions/:id/respond",
  authMiddleware,
  routeLimiter({ key: "role-play-respond", max: 60, windowSeconds: 60 }),
  zValidator("json", respondSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const userId = c.get("userId");
    const id = c.req.param("id");
    const { response } = c.req.valid("json");

    const result = await customerTurn({
      tenantId,
      userId,
      sessionId: id,
      traineeResponse: response,
    });

    return c.json({ data: result });
  },
);

// ---------------------------------------------------------------------------
// POST /api/role-play/sessions/:id/evaluate — end session, score it
// ---------------------------------------------------------------------------
rolePlayRoutes.post(
  "/sessions/:id/evaluate",
  authMiddleware,
  routeLimiter({ key: "role-play-evaluate", max: 20, windowSeconds: 60 }),
  async (c) => {
    const tenantId = c.get("tenantId");
    const userId = c.get("userId");
    const id = c.req.param("id");
    const evaluation = await evaluateSession({ tenantId, userId, sessionId: id });
    await c.var.audit({
      action: "update",
      resourceType: "role_play_session",
      resourceId: id,
      metadata: {
        stage: "evaluated",
        percentage: evaluation.percentage,
        grade: evaluation.grade,
      },
    });
    return c.json({ data: evaluation });
  },
);

// ---------------------------------------------------------------------------
// GET /api/role-play/sessions/:id — read a session back (including eval)
// ---------------------------------------------------------------------------
rolePlayRoutes.get("/sessions/:id", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId");
  const id = c.req.param("id");
  const session = await db.query.rolePlaySessions.findFirst({
    where: and(
      eq(schema.rolePlaySessions.id, id),
      eq(schema.rolePlaySessions.tenantId, tenantId),
    ),
    with: {
      scenario: {
        columns: { id: true, title: true, category: true, difficulty: true, personaJson: true },
      },
    },
  });
  if (!session) throw new NotFoundError("Session");
  return c.json({ data: session });
});

// ---------------------------------------------------------------------------
// GET /api/role-play/sessions — list the caller's recent sessions
// ---------------------------------------------------------------------------
rolePlayRoutes.get("/sessions", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId");
  const userId = c.get("userId");
  const sessions = await listSessionsForUser({ tenantId, userId, limit: 20 });
  return c.json({ data: sessions });
});

// ---------------------------------------------------------------------------
// POST /api/role-play/scenarios/:id/show-me
// Generates a masterclass conversation with Claude Sonnet. Heavy call —
// rate-limited harder than the others.
// ---------------------------------------------------------------------------
rolePlayRoutes.post(
  "/scenarios/:id/show-me",
  authMiddleware,
  routeLimiter({ key: "role-play-show-me", max: 6, windowSeconds: 60 }),
  async (c) => {
    const tenantId = c.get("tenantId");
    const id = c.req.param("id");
    const result = await showMe({ tenantId, scenarioId: id });
    await c.var.audit({
      action: "read",
      resourceType: "role_play_scenario",
      resourceId: id,
      metadata: { mode: "show_me" },
    });
    return c.json({ data: result });
  },
);
