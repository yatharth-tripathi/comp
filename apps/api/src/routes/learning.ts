import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { and, asc, db, desc, eq, schema, sql } from "@salescontent/db";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { NotFoundError } from "../lib/errors.js";

export const learningRoutes = new Hono();

// ---------------------------------------------------------------------------
// GET /api/learning/journeys — list available journeys for the user
// ---------------------------------------------------------------------------
learningRoutes.get("/journeys", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId");
  const userId = c.get("userId");

  const journeys = await db.query.learningJourneys.findMany({
    where: eq(schema.learningJourneys.tenantId, tenantId),
    orderBy: [asc(schema.learningJourneys.createdAt)],
    with: {
      modules: {
        orderBy: [asc(schema.learningModules.sortOrder)],
        columns: { id: true, title: true, format: true, durationMinutes: true, xpReward: true },
      },
    },
  });

  // Fetch progress for this user across all modules
  const allModuleIds = journeys.flatMap((j) => j.modules.map((m) => m.id));
  const progress =
    allModuleIds.length > 0
      ? await db.query.learningProgress.findMany({
          where: and(
            eq(schema.learningProgress.userId, userId),
          ),
          columns: { moduleId: true, completedAt: true, score: true },
        })
      : [];
  const progressMap = new Map(progress.map((p) => [p.moduleId, p]));

  const enriched = journeys.map((j) => {
    const total = j.modules.length;
    const completed = j.modules.filter(
      (m) => progressMap.get(m.id)?.completedAt !== null && progressMap.get(m.id)?.completedAt !== undefined,
    ).length;
    return {
      ...j,
      totalModules: total,
      completedModules: completed,
      progressPct: total > 0 ? Math.round((completed / total) * 100) : 0,
      modules: j.modules.map((m) => ({
        ...m,
        completed: Boolean(progressMap.get(m.id)?.completedAt),
        score: progressMap.get(m.id)?.score ?? null,
      })),
    };
  });

  return c.json({ data: enriched });
});

// ---------------------------------------------------------------------------
// GET /api/learning/journeys/:id — single journey with module detail
// ---------------------------------------------------------------------------
learningRoutes.get("/journeys/:id", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId");
  const id = c.req.param("id");
  const journey = await db.query.learningJourneys.findFirst({
    where: and(
      eq(schema.learningJourneys.id, id),
      eq(schema.learningJourneys.tenantId, tenantId),
    ),
    with: {
      modules: {
        orderBy: [asc(schema.learningModules.sortOrder)],
      },
    },
  });
  if (!journey) throw new NotFoundError("Journey");
  return c.json({ data: journey });
});

// ---------------------------------------------------------------------------
// POST /api/learning/journeys — create (admin only)
// ---------------------------------------------------------------------------
const createJourneySchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
  journeyType: z.enum(["onboarding", "product", "skill", "certification", "campaign"]),
  targetRoles: z.array(z.string()).default([]),
  durationDays: z.number().int().min(1).max(365).default(30),
  isSequential: z.boolean().default(true),
  isMandatory: z.boolean().default(false),
});

learningRoutes.post(
  "/journeys",
  authMiddleware,
  requireRole("enterprise_admin", "content_manager"),
  zValidator("json", createJourneySchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const userId = c.get("userId");
    const body = c.req.valid("json");
    const [journey] = await db
      .insert(schema.learningJourneys)
      .values({
        tenantId,
        createdById: userId,
        ...body,
      })
      .returning();
    if (!journey) throw new Error("Failed to create journey");
    await c.var.audit({
      action: "create",
      resourceType: "learning_journey",
      resourceId: journey.id,
    });
    return c.json({ data: journey }, 201);
  },
);

// ---------------------------------------------------------------------------
// POST /api/learning/modules — add a module to a journey (admin only)
// ---------------------------------------------------------------------------
const createModuleSchema = z.object({
  journeyId: z.string().uuid(),
  title: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
  format: z.enum([
    "video_lesson",
    "audio_clip",
    "flashcards",
    "quiz",
    "scenario_case_study",
    "ai_role_play",
    "infographic",
    "webinar",
  ]),
  durationMinutes: z.number().int().min(1).max(120).default(5),
  sortOrder: z.number().int().min(0).default(0),
  contentJson: z.record(z.string(), z.unknown()).default({}),
  contentAssetId: z.string().uuid().optional(),
  rolePlayScenarioId: z.string().uuid().optional(),
  minPassingScore: z.number().int().min(0).max(100).default(70),
  xpReward: z.number().int().min(0).max(1000).default(20),
});

learningRoutes.post(
  "/modules",
  authMiddleware,
  requireRole("enterprise_admin", "content_manager"),
  zValidator("json", createModuleSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const body = c.req.valid("json");
    const [module] = await db
      .insert(schema.learningModules)
      .values({ tenantId, ...body })
      .returning();
    if (!module) throw new Error("Failed to create module");
    await c.var.audit({
      action: "create",
      resourceType: "learning_module",
      resourceId: module.id,
    });
    return c.json({ data: module }, 201);
  },
);

// ---------------------------------------------------------------------------
// POST /api/learning/modules/:id/complete — mark a module as done
// ---------------------------------------------------------------------------
const completeModuleSchema = z.object({
  score: z.number().int().min(0).max(100).optional(),
  timeSpentSeconds: z.number().int().min(0).optional(),
});

learningRoutes.post(
  "/modules/:id/complete",
  authMiddleware,
  zValidator("json", completeModuleSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const userId = c.get("userId");
    const moduleId = c.req.param("id");
    const body = c.req.valid("json");

    const module = await db.query.learningModules.findFirst({
      where: and(
        eq(schema.learningModules.id, moduleId),
        eq(schema.learningModules.tenantId, tenantId),
      ),
      columns: { id: true, journeyId: true, xpReward: true, minPassingScore: true },
    });
    if (!module) throw new NotFoundError("Module");

    const passed = body.score !== undefined ? body.score >= module.minPassingScore : true;

    await db
      .insert(schema.learningProgress)
      .values({
        userId,
        moduleId,
        tenantId,
        journeyId: module.journeyId,
        completedAt: passed ? new Date() : null,
        score: body.score,
        timeSpentSeconds: body.timeSpentSeconds ?? 0,
        attempts: 1,
      })
      .onConflictDoUpdate({
        target: [schema.learningProgress.userId, schema.learningProgress.moduleId],
        set: {
          completedAt: passed ? new Date() : null,
          score: body.score,
          timeSpentSeconds: sql`${schema.learningProgress.timeSpentSeconds} + ${body.timeSpentSeconds ?? 0}`,
          attempts: sql`${schema.learningProgress.attempts} + 1`,
        },
      });

    // Award XP if passed
    if (passed) {
      await db
        .update(schema.userXp)
        .set({
          totalXp: sql`${schema.userXp.totalXp} + ${module.xpReward}`,
          modulesCompleted: sql`${schema.userXp.modulesCompleted} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(schema.userXp.userId, userId));
    }

    await c.var.audit({
      action: "update",
      resourceType: "learning_progress",
      resourceId: moduleId,
      metadata: { passed, score: body.score },
    });

    return c.json({
      data: {
        passed,
        score: body.score,
        xpAwarded: passed ? module.xpReward : 0,
      },
    });
  },
);

// ---------------------------------------------------------------------------
// POST /api/learning/modules/:id/quiz-submit — grade a quiz
// ---------------------------------------------------------------------------
const quizSubmitSchema = z.object({
  answers: z.array(z.number().int().nonnegative()),
});

learningRoutes.post(
  "/modules/:id/quiz-submit",
  authMiddleware,
  zValidator("json", quizSubmitSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const userId = c.get("userId");
    const moduleId = c.req.param("id");
    const { answers } = c.req.valid("json");

    const module = await db.query.learningModules.findFirst({
      where: and(
        eq(schema.learningModules.id, moduleId),
        eq(schema.learningModules.tenantId, tenantId),
      ),
    });
    if (!module) throw new NotFoundError("Module");
    if (module.format !== "quiz") {
      throw new Error("Module is not a quiz");
    }

    const questions = (module.contentJson as Record<string, unknown>).questions as
      | Array<{ correctIndex: number; prompt: string; options: string[]; explanation?: string }>
      | undefined;
    if (!questions || !Array.isArray(questions)) {
      throw new Error("Quiz has no questions configured");
    }

    // Grade
    let correct = 0;
    const results = questions.map((q, i) => {
      const isCorrect = answers[i] === q.correctIndex;
      if (isCorrect) correct += 1;
      return {
        questionIndex: i,
        prompt: q.prompt,
        selectedIndex: answers[i] ?? -1,
        correctIndex: q.correctIndex,
        isCorrect,
        explanation: q.explanation ?? null,
      };
    });

    const score = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;
    const passed = score >= module.minPassingScore;

    // Persist progress
    await db
      .insert(schema.learningProgress)
      .values({
        userId,
        moduleId,
        tenantId,
        journeyId: module.journeyId,
        completedAt: passed ? new Date() : null,
        score,
        attempts: 1,
      })
      .onConflictDoUpdate({
        target: [schema.learningProgress.userId, schema.learningProgress.moduleId],
        set: {
          completedAt: passed ? new Date() : null,
          score,
          attempts: sql`${schema.learningProgress.attempts} + 1`,
        },
      });

    if (passed) {
      await db
        .update(schema.userXp)
        .set({
          totalXp: sql`${schema.userXp.totalXp} + ${module.xpReward}`,
          modulesCompleted: sql`${schema.userXp.modulesCompleted} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(schema.userXp.userId, userId));
    }

    return c.json({
      data: {
        score,
        passed,
        correct,
        total: questions.length,
        xpAwarded: passed ? module.xpReward : 0,
        results,
      },
    });
  },
);

// Keep used imports
void desc;
