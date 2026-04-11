import Anthropic from "@anthropic-ai/sdk";
import { and, db, eq, schema, sql } from "@salescontent/db";
import type { NexusPrompt } from "@salescontent/nexus";
import { env } from "../lib/env.js";
import { ClaudeBudgetExceededError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

/**
 * Claude service — the single path every Anthropic API call flows through.
 *
 * Responsibilities:
 *   1. Own the Anthropic SDK client.
 *   2. Apply per-tenant daily USD cap (refuses calls over budget).
 *   3. Record every call in `claude_usage_daily` with token + cost breakdown.
 *   4. Consume NexusPrompt blocks, including the cache_control markers
 *      set by the NEXUS package.
 *   5. Surface typed results (JSON parsing + strict errors) to callers.
 *
 * Model selection:
 *   - `fast`  → claude-haiku-4-5   (customer turns, quick copilot queries)
 *   - `smart` → claude-sonnet-4-5  (evaluator, show-me, deep analysis)
 *   - Callers pick explicitly. No auto-route — it hides cost bugs.
 */

const config = env();

export const anthropic = new Anthropic({
  apiKey: config.ANTHROPIC_API_KEY,
});

// ---------------------------------------------------------------------------
// Pricing — USD per 1M tokens. Keep in sync with anthropic.com/pricing.
// Cached input reads are billed at 0.1× of base input.
// Cache writes are billed at 1.25× of base input.
// ---------------------------------------------------------------------------
const PRICING: Record<
  string,
  { inputUsdPerMTok: number; outputUsdPerMTok: number }
> = {
  "claude-sonnet-4-5": { inputUsdPerMTok: 3, outputUsdPerMTok: 15 },
  "claude-haiku-4-5": { inputUsdPerMTok: 1, outputUsdPerMTok: 5 },
  "claude-opus-4-6": { inputUsdPerMTok: 15, outputUsdPerMTok: 75 },
};

function estimateCostUsd(
  model: string,
  tokens: { input: number; cacheRead: number; cacheWrite: number; output: number },
): number {
  const p = PRICING[model] ?? PRICING["claude-sonnet-4-5"]!;
  const base = p.inputUsdPerMTok / 1_000_000;
  const out = p.outputUsdPerMTok / 1_000_000;
  return (
    tokens.input * base +
    tokens.cacheRead * base * 0.1 +
    tokens.cacheWrite * base * 1.25 +
    tokens.output * out
  );
}

// ---------------------------------------------------------------------------
// Budget check — BEFORE every call. If the tenant has already hit their
// daily cap, throw ClaudeBudgetExceededError and let the API layer turn
// it into a 429. No exceptions.
// ---------------------------------------------------------------------------
export async function assertTenantWithinDailyCap(tenantId: string): Promise<void> {
  const tenant = await db.query.tenants.findFirst({
    where: eq(schema.tenants.id, tenantId),
    columns: { claudeDailyCapUsd: true },
  });
  if (!tenant) throw new Error(`Tenant ${tenantId} not found for budget check`);

  const today = new Date().toISOString().slice(0, 10);
  const ledger = await db.query.claudeUsageDaily.findFirst({
    where: and(
      eq(schema.claudeUsageDaily.tenantId, tenantId),
      eq(schema.claudeUsageDaily.usageDate, today),
    ),
    columns: { costUsd: true },
  });
  const spent = Number(ledger?.costUsd ?? 0);
  if (spent >= tenant.claudeDailyCapUsd) {
    throw new ClaudeBudgetExceededError(tenantId, spent, tenant.claudeDailyCapUsd);
  }
}

// ---------------------------------------------------------------------------
// Usage ledger — bump AFTER every successful call. Atomic via SQL.
// ---------------------------------------------------------------------------
async function recordUsage(params: {
  tenantId: string;
  model: string;
  inputTokens: number;
  cachedTokens: number;
  outputTokens: number;
  costUsd: number;
}): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const existing = await db.query.claudeUsageDaily.findFirst({
    where: and(
      eq(schema.claudeUsageDaily.tenantId, params.tenantId),
      eq(schema.claudeUsageDaily.usageDate, today),
    ),
    columns: { id: true },
  });
  if (existing) {
    await db
      .update(schema.claudeUsageDaily)
      .set({
        inputTokens: sql`${schema.claudeUsageDaily.inputTokens} + ${params.inputTokens}`,
        cachedTokens: sql`${schema.claudeUsageDaily.cachedTokens} + ${params.cachedTokens}`,
        outputTokens: sql`${schema.claudeUsageDaily.outputTokens} + ${params.outputTokens}`,
        costUsd: sql`${schema.claudeUsageDaily.costUsd} + ${params.costUsd}`,
        requestCount: sql`${schema.claudeUsageDaily.requestCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(schema.claudeUsageDaily.id, existing.id));
  } else {
    await db.insert(schema.claudeUsageDaily).values({
      tenantId: params.tenantId,
      usageDate: today,
      inputTokens: params.inputTokens,
      cachedTokens: params.cachedTokens,
      outputTokens: params.outputTokens,
      costUsd: params.costUsd.toFixed(6),
      requestCount: 1,
    });
  }
}

// ---------------------------------------------------------------------------
// The wrapper — call this, not anthropic.messages.create directly.
// ---------------------------------------------------------------------------
export interface ClaudeCallOptions {
  tenantId: string;
  prompt: NexusPrompt;
  model: "fast" | "smart";
  maxTokens?: number;
  temperature?: number;
}

export interface ClaudeCallResult {
  text: string;
  inputTokens: number;
  cachedTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
  model: string;
  latencyMs: number;
  stopReason: string | null;
}

export async function callClaude(opts: ClaudeCallOptions): Promise<ClaudeCallResult> {
  await assertTenantWithinDailyCap(opts.tenantId);

  const model = opts.model === "fast" ? config.ANTHROPIC_MODEL_FAST : config.ANTHROPIC_MODEL_DEFAULT;
  const startedAt = Date.now();

  const response = await anthropic.messages.create({
    model,
    max_tokens: opts.maxTokens ?? 1500,
    temperature: opts.temperature ?? 0.7,
    system: opts.prompt.system.map((block) => ({
      type: "text" as const,
      text: block.text,
      ...(block.cache_control ? { cache_control: block.cache_control } : {}),
    })),
    messages: opts.prompt.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });

  const latencyMs = Date.now() - startedAt;
  const usage = response.usage;
  const inputTokens = usage.input_tokens;
  // Anthropic SDK returns cached tokens in `cache_read_input_tokens` and
  // cache writes in `cache_creation_input_tokens` when caching is used.
  const cachedTokens =
    (usage as unknown as { cache_read_input_tokens?: number }).cache_read_input_tokens ?? 0;
  const cacheWriteTokens =
    (usage as unknown as { cache_creation_input_tokens?: number }).cache_creation_input_tokens ?? 0;
  const outputTokens = usage.output_tokens;

  const costUsd = estimateCostUsd(model, {
    input: inputTokens,
    cacheRead: cachedTokens,
    cacheWrite: cacheWriteTokens,
    output: outputTokens,
  });

  // Extract text content from the first content block
  const text =
    response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("") || "";

  logger.debug(
    {
      tenantId: opts.tenantId,
      model,
      latencyMs,
      inputTokens,
      cachedTokens,
      cacheWriteTokens,
      outputTokens,
      costUsd: costUsd.toFixed(6),
    },
    "claude.call",
  );

  // Fire-and-forget ledger update — we do not want to fail the user request
  // because usage recording blipped.
  void recordUsage({
    tenantId: opts.tenantId,
    model,
    inputTokens,
    cachedTokens,
    outputTokens,
    costUsd,
  }).catch((err) => logger.warn({ err }, "claude.ledger.failed"));

  return {
    text,
    inputTokens,
    cachedTokens,
    outputTokens,
    cacheWriteTokens,
    costUsd,
    model,
    latencyMs,
    stopReason: response.stop_reason,
  };
}

// ---------------------------------------------------------------------------
// JSON helper — for evaluator + show-me responses which must parse.
// Strips markdown code fences Claude sometimes adds and extracts the outer
// JSON object.
// ---------------------------------------------------------------------------
export function parseClaudeJson<T>(text: string): T {
  let clean = text.trim();
  clean = clean.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
  if (!clean.startsWith("{") && !clean.startsWith("[")) {
    const match = clean.match(/[{[][\s\S]*[}\]]/);
    if (match) clean = match[0];
  }
  return JSON.parse(clean) as T;
}
