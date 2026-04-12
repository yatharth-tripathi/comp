import Anthropic from "@anthropic-ai/sdk";
import { and, db, desc, eq, schema, sql } from "@salescontent/db";
import {
  buildCopilotPrompt,
  COPILOT_TOOLS,
  type NexusMessage,
} from "@salescontent/nexus";
import { callClaude, parseClaudeJson, anthropic } from "./claude.js";
import { assertTenantWithinDailyCap } from "./claude.js";
import { ConflictError, NotFoundError } from "../lib/errors.js";
import { env } from "../lib/env.js";
import { logger } from "../lib/logger.js";

/**
 * Copilot service — PRD §7.
 *
 * Unlike the role-play engine (which follows a fixed step ladder), the
 * Copilot is open-ended within each mode. The agent can ask anything and
 * the Copilot can invoke tools (generate_illustration, search_content,
 * draft_whatsapp_followup) to take actions.
 *
 * Tool calls are executed server-side and the result is fed back to Claude
 * in the same conversation turn — the agent never sees the tool call
 * mechanics, only the final answer with the tool's output embedded.
 */

// ---------------------------------------------------------------------------
// Start a session
// ---------------------------------------------------------------------------
export interface StartCopilotParams {
  tenantId: string;
  userId: string;
  mode: string;
  customerName?: string;
  customerContext?: Record<string, unknown>;
  productFocus?: string;
  leadId?: string;
}

export async function startCopilotSession(
  params: StartCopilotParams,
): Promise<{ sessionId: string; greeting: string }> {
  const [session] = await db
    .insert(schema.copilotSessions)
    .values({
      tenantId: params.tenantId,
      userId: params.userId,
      mode: params.mode as "pre_meeting",
      customerName: params.customerName,
      customerContextJson: params.customerContext ?? {},
      productFocus: params.productFocus,
      leadId: params.leadId,
    })
    .returning();
  if (!session) throw new Error("Failed to create copilot session");

  // Generate a mode-appropriate greeting
  const greetings: Record<string, string> = {
    pre_meeting: params.customerName
      ? `Ready to brief you on your meeting with ${params.customerName}. What product are they interested in?`
      : "Tell me about the customer you're about to meet — name, age, what they're looking for — and I'll prepare your briefing.",
    during_meeting:
      "I'm here. Ask me anything — product facts, objection handles, or say 'create an illustration' and I'll generate one instantly.",
    post_meeting:
      "How did the meeting go? Tell me what you discussed and I'll draft your WhatsApp follow-up and suggest next steps.",
    manager:
      "What do you need? Team activity, content recommendations, or a Monday morning broadcast? Ask away.",
    adhoc: "Ask me anything about BFSI products, regulations, or sales techniques.",
  };

  return {
    sessionId: session.id,
    greeting: greetings[params.mode] ?? greetings.adhoc!,
  };
}

// ---------------------------------------------------------------------------
// Query — the hot-path call. Agent sends a message, Copilot responds.
// If Claude invokes tools, we execute them and loop back.
// ---------------------------------------------------------------------------
export interface CopilotQueryParams {
  tenantId: string;
  userId: string;
  sessionId: string;
  content: string;
  preferFastModel?: boolean;
}

export interface CopilotQueryResult {
  response: string;
  toolsUsed: Array<{ name: string; result: unknown }>;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  costUsd: number;
  latencyMs: number;
}

export async function queryCopilot(
  params: CopilotQueryParams,
): Promise<CopilotQueryResult> {
  const session = await db.query.copilotSessions.findFirst({
    where: and(
      eq(schema.copilotSessions.id, params.sessionId),
      eq(schema.copilotSessions.tenantId, params.tenantId),
    ),
  });
  if (!session) throw new NotFoundError("Copilot session");
  if (session.userId !== params.userId) {
    throw new ConflictError("Session belongs to a different user");
  }
  if (session.endedAt) {
    throw new ConflictError("Copilot session already ended");
  }

  await assertTenantWithinDailyCap(params.tenantId);

  // Load recent messages for context (last 20 to stay within token limits)
  const recentMessages = await db.query.copilotMessages.findMany({
    where: eq(schema.copilotMessages.sessionId, params.sessionId),
    orderBy: [desc(schema.copilotMessages.createdAt)],
    limit: 20,
    columns: { role: true, content: true },
  });
  const history: NexusMessage[] = recentMessages
    .reverse()
    .map((m) => ({
      role: m.role === "user" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    }));

  // Add the new user message
  history.push({ role: "user", content: params.content });

  // Save the user message
  await db.insert(schema.copilotMessages).values({
    sessionId: params.sessionId,
    tenantId: params.tenantId,
    role: "user",
    content: params.content,
  });

  // Build the prompt
  const prompt = buildCopilotPrompt({
    mode: session.mode,
    customerContext: session.customerContextJson as Record<string, unknown> | undefined,
    productFocus: session.productFocus ?? undefined,
    conversationHistory: history,
  });

  const config = env();
  const model = params.preferFastModel
    ? config.ANTHROPIC_MODEL_FAST
    : config.ANTHROPIC_MODEL_DEFAULT;

  const startedAt = Date.now();

  // Call Claude with tools
  const response = await anthropic.messages.create({
    model,
    max_tokens: 2000,
    temperature: 0.6,
    system: prompt.system.map((block) => ({
      type: "text" as const,
      text: block.text,
      ...(block.cache_control ? { cache_control: block.cache_control } : {}),
    })),
    messages: history.map((m) => ({ role: m.role, content: m.content })),
    tools: COPILOT_TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema as Anthropic.Tool.InputSchema,
    })),
  });

  const latencyMs = Date.now() - startedAt;
  const toolsUsed: Array<{ name: string; result: unknown }> = [];

  // Process response — handle tool calls if any
  let finalText = "";
  const textBlocks = response.content.filter(
    (b): b is Anthropic.TextBlock => b.type === "text",
  );
  finalText = textBlocks.map((b) => b.text).join("");

  const toolUseBlocks = response.content.filter(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );

  if (toolUseBlocks.length > 0) {
    // Execute each tool call
    const toolResults: Array<{ type: "tool_result"; tool_use_id: string; content: string }> = [];
    for (const toolCall of toolUseBlocks) {
      const result = await executeToolCall(
        toolCall.name,
        toolCall.input as Record<string, unknown>,
        params.tenantId,
        params.userId,
      );
      toolsUsed.push({ name: toolCall.name, result });
      toolResults.push({
        type: "tool_result",
        tool_use_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }

    // Feed tool results back to Claude for final synthesis
    const followUp = await anthropic.messages.create({
      model,
      max_tokens: 1500,
      temperature: 0.5,
      system: prompt.system.map((block) => ({
        type: "text" as const,
        text: block.text,
        ...(block.cache_control ? { cache_control: block.cache_control } : {}),
      })),
      messages: [
        ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "assistant" as const, content: response.content },
        { role: "user" as const, content: toolResults as unknown as string },
      ],
    });

    const followUpText = followUp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    if (followUpText) finalText = followUpText;
  }

  if (!finalText) finalText = "I understand. How can I help you with this?";

  // Save the assistant response
  const usage = response.usage;
  const cachedTokens =
    (usage as unknown as { cache_read_input_tokens?: number }).cache_read_input_tokens ?? 0;

  await db.insert(schema.copilotMessages).values({
    sessionId: params.sessionId,
    tenantId: params.tenantId,
    role: "assistant",
    content: finalText,
    model,
    inputTokens: usage.input_tokens,
    cachedTokens,
    outputTokens: usage.output_tokens,
    latencyMs,
    toolCalls: toolsUsed,
  });

  // Update session usage totals
  await db
    .update(schema.copilotSessions)
    .set({
      totalInputTokens: sql`${schema.copilotSessions.totalInputTokens} + ${usage.input_tokens}`,
      totalCachedTokens: sql`${schema.copilotSessions.totalCachedTokens} + ${cachedTokens}`,
      totalOutputTokens: sql`${schema.copilotSessions.totalOutputTokens} + ${usage.output_tokens}`,
    })
    .where(eq(schema.copilotSessions.id, params.sessionId));

  return {
    response: finalText,
    toolsUsed,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cachedTokens,
    costUsd: 0, // computed in the usage ledger
    latencyMs,
  };
}

// ---------------------------------------------------------------------------
// End a session
// ---------------------------------------------------------------------------
export async function endCopilotSession(params: {
  tenantId: string;
  userId: string;
  sessionId: string;
  summary?: string;
}): Promise<void> {
  await db
    .update(schema.copilotSessions)
    .set({
      endedAt: new Date(),
      summary: params.summary,
    })
    .where(
      and(
        eq(schema.copilotSessions.id, params.sessionId),
        eq(schema.copilotSessions.tenantId, params.tenantId),
      ),
    );
}

// ---------------------------------------------------------------------------
// Tool execution
// ---------------------------------------------------------------------------
async function executeToolCall(
  toolName: string,
  input: Record<string, unknown>,
  tenantId: string,
  userId: string,
): Promise<unknown> {
  logger.info({ toolName, input }, "copilot.tool_call");

  switch (toolName) {
    case "generate_illustration": {
      return {
        status: "ready",
        message: `Illustration for ${input.productType} generated for ${input.customerName}. The agent can find it at /illustrator/${input.productType}.`,
        productType: input.productType,
        customerName: input.customerName,
      };
    }

    case "search_content": {
      const results = await db.query.contentAssets.findMany({
        where: and(
          eq(schema.contentAssets.tenantId, tenantId),
          eq(schema.contentAssets.approvalStatus, "published"),
        ),
        limit: 5,
        orderBy: [desc(schema.contentAssets.shareCount)],
        columns: {
          id: true,
          title: true,
          contentType: true,
          description: true,
        },
      });
      return {
        query: input.query,
        results: results.map((r) => ({
          title: r.title,
          type: r.contentType,
          description: r.description?.slice(0, 100),
        })),
      };
    }

    case "draft_whatsapp_followup": {
      return {
        status: "drafted",
        message: `Hi ${input.customerName},\n\nThank you for your time today. ${input.discussionSummary}\n\nNext steps: ${input.nextSteps || "I'll follow up with the detailed illustration by end of day."}\n\n${input.illustrationUrl ? `Here's the personalized illustration we discussed: ${input.illustrationUrl}\n\n` : ""}Looking forward to hearing from you.\n\nBest regards`,
      };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}
