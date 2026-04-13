import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { copilotMessageRoleEnum, copilotModeEnum } from "./enums";
import { tenants } from "./tenants";
import { users } from "./users";

// ---------------------------------------------------------------------------
// Copilot sessions (PRD §7)
// A session is a conversation with the AI Copilot in one mode (pre/during/post
// meeting, or manager, or adhoc).
// ---------------------------------------------------------------------------
export const copilotSessions = pgTable(
  "copilot_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    mode: copilotModeEnum("mode").notNull(),

    // Meeting context (PRD §7.2 pre-meeting inputs)
    customerName: text("customer_name"),
    customerContextJson: jsonb("customer_context_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    productFocus: text("product_focus"),
    // Related lead if the session is anchored to a CRM lead
    leadId: uuid("lead_id"),

    // Usage rollups for per-session cost/latency visibility
    totalInputTokens: integer("total_input_tokens").notNull().default(0),
    totalCachedTokens: integer("total_cached_tokens").notNull().default(0),
    totalOutputTokens: integer("total_output_tokens").notNull().default(0),
    costUsd: numeric("cost_usd", { precision: 10, scale: 6 }).notNull().default("0"),

    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    summary: text("summary"), // end-of-meeting summary (§7.4)
  },
  (table) => ({
    tenantUserIdx: index("copilot_sessions_tenant_user_idx").on(table.tenantId, table.userId),
    modeIdx: index("copilot_sessions_mode_idx").on(table.mode),
  }),
);

// ---------------------------------------------------------------------------
// Copilot messages — the turn-by-turn record of a session.
// ---------------------------------------------------------------------------
export const copilotMessages = pgTable(
  "copilot_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => copilotSessions.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    role: copilotMessageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    // When the assistant uses tools, we store the tool calls and their results
    toolCalls: jsonb("tool_calls")
      .$type<Array<{ name: string; input: Record<string, unknown>; output?: unknown }>>()
      .notNull()
      .default(sql`'[]'::jsonb`),

    // LLM call metadata
    model: text("model"), // e.g. claude-sonnet-4-5 / claude-haiku-4-5
    inputTokens: integer("input_tokens").notNull().default(0),
    cachedTokens: integer("cached_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    latencyMs: integer("latency_ms").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionIdx: index("copilot_messages_session_idx").on(table.sessionId),
    tenantIdx: index("copilot_messages_tenant_idx").on(table.tenantId),
  }),
);

// ---------------------------------------------------------------------------
// Per-tenant daily Claude usage ledger — feeds the cost cap enforcement
// middleware that refuses calls once the daily USD cap is hit.
// ---------------------------------------------------------------------------
export const claudeUsageDaily = pgTable(
  "claude_usage_daily",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    usageDate: text("usage_date").notNull(), // 'YYYY-MM-DD'
    inputTokens: integer("input_tokens").notNull().default(0),
    cachedTokens: integer("cached_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costUsd: numeric("cost_usd", { precision: 10, scale: 6 }).notNull().default("0"),
    requestCount: integer("request_count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantDateIdx: index("claude_usage_daily_tenant_date_idx").on(table.tenantId, table.usageDate),
  }),
);

export const copilotSessionsRelations = relations(copilotSessions, ({ one, many }) => ({
  tenant: one(tenants, { fields: [copilotSessions.tenantId], references: [tenants.id] }),
  user: one(users, { fields: [copilotSessions.userId], references: [users.id] }),
  messages: many(copilotMessages),
}));

export const copilotMessagesRelations = relations(copilotMessages, ({ one }) => ({
  session: one(copilotSessions, {
    fields: [copilotMessages.sessionId],
    references: [copilotSessions.id],
  }),
  tenant: one(tenants, { fields: [copilotMessages.tenantId], references: [tenants.id] }),
}));

export const claudeUsageDailyRelations = relations(claudeUsageDaily, ({ one }) => ({
  tenant: one(tenants, { fields: [claudeUsageDaily.tenantId], references: [tenants.id] }),
}));

export type CopilotSession = typeof copilotSessions.$inferSelect;
export type NewCopilotSession = typeof copilotSessions.$inferInsert;
export type CopilotMessage = typeof copilotMessages.$inferSelect;
export type ClaudeUsageDaily = typeof claudeUsageDaily.$inferSelect;
