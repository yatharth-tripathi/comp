import {
  and,
  db,
  desc,
  eq,
  schema,
  sql,
} from "@salescontent/db";
import {
  buildCustomerTurnPrompt,
  buildEvaluatorPrompt,
  buildShowMePrompt,
  type ComplianceRules,
  type NexusMessage,
  type ScenarioPersona,
  type ScoringRule,
} from "@salescontent/nexus";
import { SEED_SCENARIOS, type SeedScenario } from "@salescontent/role-play-scenarios";
import { callClaude, parseClaudeJson } from "./claude.js";
import { ConflictError, NotFoundError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

/**
 * Role-play engine — the domain service that orchestrates a role-play
 * session lifecycle. Called by the routes layer with a tenant + user
 * context; handles all DB writes and Claude calls.
 *
 * Lifecycle:
 *   1. ensureSeedScenariosForTenant — on first access, copy SEED_SCENARIOS
 *      into the tenant's role_play_scenarios table
 *   2. startSession — creates a role_play_sessions row, returns the
 *      scenario + the opening customer line (from the hand-authored step
 *      ladder, not Claude — we want deterministic openings)
 *   3. customerTurn — called when the trainee submits a response. Runs
 *      compliance regex BEFORE Claude (cheap), then calls Claude Haiku to
 *      generate the customer reply + mood delta. Updates session state.
 *   4. evaluate — called when the trainee ends the session. Calls Claude
 *      Sonnet with the evaluator prompt, parses JSON, writes back to
 *      role_play_sessions.
 *   5. showMe — generates the masterclass conversation on demand.
 */

// ---------------------------------------------------------------------------
// Seed scenarios into a tenant on first access. Idempotent.
// ---------------------------------------------------------------------------
export async function ensureSeedScenariosForTenant(tenantId: string): Promise<void> {
  const existing = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.rolePlayScenarios)
    .where(eq(schema.rolePlayScenarios.tenantId, tenantId));
  const count = existing[0]?.count ?? 0;
  if (count >= SEED_SCENARIOS.length) return;

  logger.info({ tenantId, count }, "role-play.seed");

  // Upsert by (tenantId, title) — we don't have a slug column, so title
  // acts as the natural key here. Seed scenarios have stable titles.
  for (const seed of SEED_SCENARIOS) {
    const already = await db.query.rolePlayScenarios.findFirst({
      where: and(
        eq(schema.rolePlayScenarios.tenantId, tenantId),
        eq(schema.rolePlayScenarios.title, seed.title),
      ),
      columns: { id: true },
    });
    if (already) continue;

    await db.insert(schema.rolePlayScenarios).values({
      tenantId,
      title: seed.title,
      description: seed.description,
      category: seed.category,
      difficulty: seed.difficulty,
      language: seed.language,
      xpReward: seed.xpReward,
      tags: seed.tags,
      personaJson: seed.persona,
      openingStatement: seed.openingStatement,
      stepsJson: seed.steps,
      evaluationRulesJson: seed.evaluationRules,
      complianceRulesJson: seed.complianceRules,
    });
  }
}

// ---------------------------------------------------------------------------
// Typed helpers for the columns that store rich JSON
// ---------------------------------------------------------------------------
function personaFromScenario(
  scenario: typeof schema.rolePlayScenarios.$inferSelect,
): ScenarioPersona {
  return scenario.personaJson as unknown as ScenarioPersona;
}

function rulesFromScenario(
  scenario: typeof schema.rolePlayScenarios.$inferSelect,
): ScoringRule[] {
  return scenario.evaluationRulesJson as unknown as ScoringRule[];
}

function complianceFromScenario(
  scenario: typeof schema.rolePlayScenarios.$inferSelect,
): ComplianceRules {
  return scenario.complianceRulesJson as unknown as ComplianceRules;
}

// ---------------------------------------------------------------------------
// Cheap client-side compliance regex — runs BEFORE Claude so we catch
// fatal phrases without spending tokens. Case-insensitive, whole-phrase.
// ---------------------------------------------------------------------------
export function detectComplianceViolations(
  response: string,
  bannedPhrases: string[],
): string[] {
  const hits: string[] = [];
  const lower = response.toLowerCase();
  for (const phrase of bannedPhrases) {
    const p = phrase.toLowerCase().trim();
    if (!p) continue;
    if (lower.includes(p)) hits.push(phrase);
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Extract MOOD_DELTA from the customer turn response and return the
// cleaned text + delta. Delta is clamped to [-3, 3].
// ---------------------------------------------------------------------------
function splitMoodDelta(raw: string): { text: string; moodDelta: number } {
  const lines = raw.trim().split("\n");
  let moodDelta = 0;
  const kept: string[] = [];
  for (const line of lines) {
    const match = line.match(/^\s*MOOD[_\s]?DELTA\s*:\s*(-?\d+)\s*$/i);
    if (match) {
      moodDelta = Math.max(-3, Math.min(3, parseInt(match[1] ?? "0", 10)));
    } else {
      kept.push(line);
    }
  }
  return { text: kept.join("\n").trim(), moodDelta };
}

// ---------------------------------------------------------------------------
// START SESSION
// ---------------------------------------------------------------------------
export interface StartSessionParams {
  tenantId: string;
  userId: string;
  scenarioId: string;
}

export interface StartSessionResult {
  sessionId: string;
  scenario: {
    id: string;
    title: string;
    description: string | null;
    category: string;
    difficulty: string;
    persona: ScenarioPersona;
    openingStatement: string;
    evaluationRules: ScoringRule[];
    complianceRules: ComplianceRules;
    steps: Array<{
      speaker: string;
      text: string;
      expectedAction?: string;
      hints?: string[];
    }>;
  };
  firstCustomerMessage: string;
  initialMood: number;
}

export async function startSession(
  params: StartSessionParams,
): Promise<StartSessionResult> {
  const scenario = await db.query.rolePlayScenarios.findFirst({
    where: and(
      eq(schema.rolePlayScenarios.id, params.scenarioId),
      eq(schema.rolePlayScenarios.tenantId, params.tenantId),
    ),
  });
  if (!scenario) throw new NotFoundError("Scenario");

  const persona = personaFromScenario(scenario);

  const [session] = await db
    .insert(schema.rolePlaySessions)
    .values({
      tenantId: params.tenantId,
      userId: params.userId,
      scenarioId: params.scenarioId,
      conversationJson: [
        {
          role: "user",
          content: scenario.openingStatement,
          timestamp: Date.now(),
        },
      ],
      userResponses: [],
      moodTrajectory: [persona.moodInitial],
    })
    .returning();
  if (!session) throw new Error("Failed to create role-play session");

  return {
    sessionId: session.id,
    scenario: {
      id: scenario.id,
      title: scenario.title,
      description: scenario.description,
      category: scenario.category,
      difficulty: scenario.difficulty,
      persona,
      openingStatement: scenario.openingStatement,
      evaluationRules: rulesFromScenario(scenario),
      complianceRules: complianceFromScenario(scenario),
      steps: (scenario.stepsJson as unknown as Array<Record<string, unknown>>).map((s) => ({
        speaker: String(s.speaker ?? ""),
        text: String(s.text ?? ""),
        expectedAction:
          typeof s.expectedAction === "string" ? s.expectedAction : undefined,
        hints: Array.isArray(s.hints) ? (s.hints as string[]) : undefined,
      })),
    },
    firstCustomerMessage: scenario.openingStatement,
    initialMood: persona.moodInitial,
  };
}

// ---------------------------------------------------------------------------
// CUSTOMER TURN
// ---------------------------------------------------------------------------
export interface CustomerTurnParams {
  tenantId: string;
  userId: string;
  sessionId: string;
  traineeResponse: string;
}

export interface CustomerTurnResult {
  customerMessage: string;
  currentMood: number;
  moodDelta: number;
  violations: string[];
  turnIndex: number;
  isFinalTurn: boolean;
}

export async function customerTurn(
  params: CustomerTurnParams,
): Promise<CustomerTurnResult> {
  const session = await db.query.rolePlaySessions.findFirst({
    where: and(
      eq(schema.rolePlaySessions.id, params.sessionId),
      eq(schema.rolePlaySessions.tenantId, params.tenantId),
    ),
    with: { scenario: true },
  });
  if (!session) throw new NotFoundError("Session");
  if (session.userId !== params.userId) {
    throw new ConflictError("Session belongs to a different user");
  }
  if (session.completedAt) {
    throw new ConflictError("Session already completed");
  }

  const scenario = session.scenario;
  const persona = personaFromScenario(scenario);
  const compliance = complianceFromScenario(scenario);

  // 1. Cheap compliance check BEFORE Claude
  const violations = detectComplianceViolations(
    params.traineeResponse,
    compliance.hardBanned,
  );

  // 2. Build updated conversation state
  const existingConversation = (session.conversationJson as unknown as Array<{
    role: "user" | "assistant";
    content: string;
    timestamp: number;
  }>) ?? [];

  const nexusHistory: NexusMessage[] = existingConversation.map((m) => ({
    role: m.role === "user" ? "assistant" : "user",
    // Customer lines (stored as role=user from the schema's perspective because
    // the schema treats the agent as the "user" of the system, but for Claude
    // the CUSTOMER is the assistant and the RM trainee is the user)
    content: m.content,
  }));

  // The trainee's latest response is the new user message in Claude terms
  nexusHistory.push({
    role: "user",
    content: params.traineeResponse,
  });

  const currentMood = (session.moodTrajectory as unknown as number[])?.slice(-1)[0] ?? persona.moodInitial;

  // 3. Pick the current step from the step ladder for context hinting
  const steps = (scenario.stepsJson as unknown as Array<{
    speaker: string;
    expectedAction?: string;
  }>) ?? [];
  const turnIndex = (session.userResponses as unknown as string[])?.length ?? 0;
  const currentStep = steps.find(
    (s, i) => s.speaker === "system" && Math.floor(i / 2) === turnIndex,
  );

  // 4. Call Claude Haiku for the customer reply
  const prompt = buildCustomerTurnPrompt({
    persona,
    currentMood,
    conversationHistory: nexusHistory,
    stepContext: currentStep?.expectedAction,
    complianceRules: compliance,
  });
  const result = await callClaude({
    tenantId: params.tenantId,
    prompt,
    model: "fast",
    maxTokens: 220,
    temperature: 0.75,
  });

  const { text: customerText, moodDelta: claudeMoodDelta } = splitMoodDelta(result.text);

  // If a compliance violation was detected regex-side, force a negative mood hit
  // and prepend a customer reaction
  let finalText = customerText || "I see... go on.";
  let finalDelta = claudeMoodDelta;
  if (violations.length > 0) {
    finalDelta = Math.min(finalDelta, -2);
  }

  const newMood = Math.max(1, Math.min(10, currentMood + finalDelta));

  // 5. Persist — append both the trainee's response and the customer's reply
  const newConversation = [
    ...existingConversation,
    {
      role: "assistant" as const, // RM trainee message (from schema's perspective)
      content: params.traineeResponse,
      timestamp: Date.now(),
    },
    {
      role: "user" as const, // Customer reply
      content: finalText,
      timestamp: Date.now(),
    },
  ];

  const newResponses = [
    ...((session.userResponses as unknown as string[]) ?? []),
    params.traineeResponse,
  ];
  const newMoodTrajectory = [
    ...((session.moodTrajectory as unknown as number[]) ?? []),
    newMood,
  ];
  const newViolations = [
    ...((session.complianceViolations as unknown as string[]) ?? []),
    ...violations,
  ];

  await db
    .update(schema.rolePlaySessions)
    .set({
      conversationJson: newConversation,
      userResponses: newResponses,
      moodTrajectory: newMoodTrajectory,
      complianceViolations: newViolations,
    })
    .where(eq(schema.rolePlaySessions.id, params.sessionId));

  // 6. Is this the final turn? Count "customer" steps in the ladder
  const customerSteps = steps.filter((s) => s.speaker === "customer").length;
  const isFinalTurn = newResponses.length >= customerSteps;

  return {
    customerMessage: finalText,
    currentMood: newMood,
    moodDelta: finalDelta,
    violations,
    turnIndex: newResponses.length,
    isFinalTurn,
  };
}

// ---------------------------------------------------------------------------
// EVALUATE — end of session scoring
// ---------------------------------------------------------------------------
export interface EvaluateParams {
  tenantId: string;
  userId: string;
  sessionId: string;
}

export interface EvaluationPayload {
  skills: Array<{
    skill: string;
    score: number;
    maxScore: number;
    feedback: string;
    evidence: string;
  }>;
  totalScore: number;
  maxScore: number;
  percentage: number;
  grade: string;
  overallFeedback: string;
  strengths: Array<{ technique: string; quote: string; whyItWorked: string }>;
  improvements: Array<{
    moment: string;
    whatTheySaid: string;
    whatIdealRmWouldSay: string;
    technique: string;
  }>;
  bestMoment: { quote: string; whyItWorked: string };
  worstMoment: { quote: string; whatShouldHaveBeenSaid: string };
  ghostResponses: Array<{
    round: number;
    actualResponse: string;
    idealResponse: string;
    techniqueUsedByIdeal: string;
  }>;
  complianceViolations: Array<{
    regulator: string;
    rule: string;
    quote: string;
    severity: "WARNING" | "MAJOR" | "FATAL";
  }>;
  moodAnalysis: string;
  nextRecommendation: {
    weakestSkill: string;
    suggestedScenarioCategory: string;
    rationale: string;
  };
  xpAwarded: number;
}

export async function evaluateSession(
  params: EvaluateParams,
): Promise<EvaluationPayload> {
  const session = await db.query.rolePlaySessions.findFirst({
    where: and(
      eq(schema.rolePlaySessions.id, params.sessionId),
      eq(schema.rolePlaySessions.tenantId, params.tenantId),
    ),
    with: { scenario: true },
  });
  if (!session) throw new NotFoundError("Session");
  if (session.userId !== params.userId) {
    throw new ConflictError("Session belongs to a different user");
  }

  const scenario = session.scenario;
  const persona = personaFromScenario(scenario);
  const rules = rulesFromScenario(scenario);
  const compliance = complianceFromScenario(scenario);

  const conversation = (session.conversationJson as unknown as Array<{
    role: "user" | "assistant";
    content: string;
    timestamp: number;
  }>) ?? [];
  const userResponses =
    (session.userResponses as unknown as string[]) ?? [];
  const moodTrajectory =
    (session.moodTrajectory as unknown as number[]) ?? [];

  const nexusHistory: NexusMessage[] = conversation.map((m) => ({
    role: m.role === "user" ? "assistant" : "user",
    content: m.content,
  }));

  const prompt = buildEvaluatorPrompt({
    scenarioTitle: scenario.title,
    scenarioCategory: scenario.category,
    difficulty: scenario.difficulty,
    persona,
    evaluationRules: rules,
    complianceRules: compliance,
    conversationHistory: nexusHistory,
    userResponses,
    moodTrajectory,
  });

  const result = await callClaude({
    tenantId: params.tenantId,
    prompt,
    model: "smart",
    maxTokens: 3500,
    temperature: 0.2,
  });

  const evaluation = parseClaudeJson<EvaluationPayload>(result.text);

  // Clamp scores to the declared max per rule
  if (Array.isArray(evaluation.skills)) {
    for (const skill of evaluation.skills) {
      const rule = rules.find((r) => r.skill === skill.skill);
      if (rule) {
        skill.maxScore = rule.weight;
        skill.score = Math.max(0, Math.min(rule.weight, Math.round(skill.score)));
      }
    }
    evaluation.totalScore = evaluation.skills.reduce((sum, s) => sum + s.score, 0);
    evaluation.maxScore = evaluation.skills.reduce((sum, s) => sum + s.maxScore, 0);
    evaluation.percentage =
      evaluation.maxScore > 0
        ? Math.round((evaluation.totalScore / evaluation.maxScore) * 100)
        : 0;
  }

  // Deterministic grade mapping
  const pct = evaluation.percentage;
  evaluation.grade =
    pct >= 95 ? "S" : pct >= 85 ? "A" : pct >= 70 ? "B" : pct >= 55 ? "C" : pct >= 40 ? "D" : "F";

  evaluation.xpAwarded =
    pct >= 90 ? 100 : pct >= 70 ? 70 : pct >= 50 ? 40 : 20;

  // Persist the evaluation
  await db
    .update(schema.rolePlaySessions)
    .set({
      completedAt: new Date(),
      score: evaluation.totalScore,
      maxScore: evaluation.maxScore,
      percentage: evaluation.percentage,
      grade: evaluation.grade,
      xpAwarded: evaluation.xpAwarded,
      evaluationJson: evaluation as unknown as Record<string, unknown>,
    })
    .where(eq(schema.rolePlaySessions.id, params.sessionId));

  // Award XP to the user
  await db
    .update(schema.userXp)
    .set({
      totalXp: sql`${schema.userXp.totalXp} + ${evaluation.xpAwarded}`,
      rolePlaysCompleted: sql`${schema.userXp.rolePlaysCompleted} + 1`,
      casesCompleted: sql`${schema.userXp.casesCompleted} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(schema.userXp.userId, params.userId));

  return evaluation;
}

// ---------------------------------------------------------------------------
// SHOW ME — generate an ideal masterclass conversation
// ---------------------------------------------------------------------------
export interface ShowMeResult {
  title: string;
  customerProfile: string;
  objective: string;
  complianceWatch: string;
  exchanges: Array<{
    speaker: "customer" | "rm";
    text: string;
    technique: string | null;
  }>;
  debrief: Array<{ skill: string; demonstrated: boolean; where: string }>;
}

export async function showMe(params: {
  tenantId: string;
  scenarioId: string;
}): Promise<ShowMeResult> {
  const scenario = await db.query.rolePlayScenarios.findFirst({
    where: and(
      eq(schema.rolePlayScenarios.id, params.scenarioId),
      eq(schema.rolePlayScenarios.tenantId, params.tenantId),
    ),
  });
  if (!scenario) throw new NotFoundError("Scenario");

  const prompt = buildShowMePrompt({
    scenarioTitle: scenario.title,
    scenarioCategory: scenario.category,
    difficulty: scenario.difficulty,
    persona: personaFromScenario(scenario),
    evaluationRules: rulesFromScenario(scenario),
    complianceRules: complianceFromScenario(scenario),
    openingStatement: scenario.openingStatement,
  });

  const result = await callClaude({
    tenantId: params.tenantId,
    prompt,
    model: "smart",
    maxTokens: 6000,
    temperature: 0.6,
  });

  return parseClaudeJson<ShowMeResult>(result.text);
}

// ---------------------------------------------------------------------------
// LIST sessions for a user
// ---------------------------------------------------------------------------
export async function listSessionsForUser(params: {
  tenantId: string;
  userId: string;
  limit?: number;
}) {
  return db.query.rolePlaySessions.findMany({
    where: and(
      eq(schema.rolePlaySessions.tenantId, params.tenantId),
      eq(schema.rolePlaySessions.userId, params.userId),
    ),
    orderBy: [desc(schema.rolePlaySessions.startedAt)],
    limit: params.limit ?? 20,
    with: {
      scenario: {
        columns: { id: true, title: true, category: true, difficulty: true },
      },
    },
  });
}
