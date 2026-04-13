import { relations, sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { leads } from "./leads";
import {
  whatsappDirectionEnum,
  whatsappMessageTypeEnum,
  whatsappStatusEnum,
} from "./enums";
import { tenants } from "./tenants";
import { users } from "./users";

// ---------------------------------------------------------------------------
// WhatsApp templates (PRD §10) — pre-approved message templates at Meta
// Every template must be synced via `whatsapp.templates.fetch()` and stored
// here so we can reference them at send time.
// ---------------------------------------------------------------------------
export const whatsappTemplates = pgTable(
  "whatsapp_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    metaTemplateId: text("meta_template_id").notNull(),
    name: text("name").notNull(),
    language: text("language").notNull().default("en"),
    category: text("category").notNull(), // MARKETING | UTILITY | AUTHENTICATION
    status: text("status").notNull(), // APPROVED | PENDING | REJECTED | DISABLED
    bodyText: text("body_text").notNull(),
    headerJson: jsonb("header_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    footerText: text("footer_text"),
    buttonsJson: jsonb("buttons_json")
      .$type<Array<Record<string, unknown>>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    variablesCount: jsonb("variables_count")
      .$type<{ body?: number; header?: number }>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index("whatsapp_templates_tenant_idx").on(table.tenantId),
    tenantNameLanguageUnique: uniqueIndex("whatsapp_templates_tenant_name_lang_unique").on(
      table.tenantId,
      table.name,
      table.language,
    ),
  }),
);

// ---------------------------------------------------------------------------
// WhatsApp messages — every inbound + outbound message flowing through the
// Meta Cloud API. Used by both the agent-share pipeline and the agent bot.
// ---------------------------------------------------------------------------
export const whatsappMessages = pgTable(
  "whatsapp_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    direction: whatsappDirectionEnum("direction").notNull(),
    messageType: whatsappMessageTypeEnum("message_type").notNull(),
    status: whatsappStatusEnum("status").notNull().default("queued"),

    // Peers
    fromPhone: text("from_phone").notNull(),
    toPhone: text("to_phone").notNull(),

    // Meta correlation ids
    waMessageId: text("wa_message_id"), // wamid:HBgLMTE...
    waConversationId: text("wa_conversation_id"),

    // Content (flattened for search)
    bodyText: text("body_text"),
    mediaUrl: text("media_url"),
    mediaMimeType: text("media_mime_type"),
    rawPayload: jsonb("raw_payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),

    // Template usage (for outbound template messages)
    templateId: uuid("template_id").references(() => whatsappTemplates.id, { onDelete: "set null" }),
    templateVariables: jsonb("template_variables")
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'::jsonb`),

    // Attribution
    senderUserId: uuid("sender_user_id").references(() => users.id, { onDelete: "set null" }),
    relatedLeadId: uuid("related_lead_id").references(() => leads.id, { onDelete: "set null" }),
    relatedShareEventId: uuid("related_share_event_id"),

    errorCode: text("error_code"),
    errorMessage: text("error_message"),

    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index("whatsapp_messages_tenant_idx").on(table.tenantId),
    waMessageIdIdx: index("whatsapp_messages_wa_message_id_idx").on(table.waMessageId),
    tenantTimestampIdx: index("whatsapp_messages_tenant_created_idx").on(
      table.tenantId,
      table.createdAt,
    ),
    leadIdx: index("whatsapp_messages_lead_idx").on(table.relatedLeadId),
  }),
);

// ---------------------------------------------------------------------------
// Bot conversation state — tracks the state machine for the WhatsApp bot
// (PRD §10.3). Each row is one active conversation with an agent.
// ---------------------------------------------------------------------------
export const whatsappBotSessions = pgTable(
  "whatsapp_bot_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    lastIntent: text("last_intent"),
    state: text("state").notNull().default("idle"), // idle | awaiting_clarification | executing
    contextJson: jsonb("context_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantAgentIdx: index("whatsapp_bot_sessions_tenant_agent_idx").on(
      table.tenantId,
      table.agentId,
    ),
  }),
);

export const whatsappTemplatesRelations = relations(whatsappTemplates, ({ one, many }) => ({
  tenant: one(tenants, { fields: [whatsappTemplates.tenantId], references: [tenants.id] }),
  messages: many(whatsappMessages),
}));

export const whatsappMessagesRelations = relations(whatsappMessages, ({ one }) => ({
  tenant: one(tenants, { fields: [whatsappMessages.tenantId], references: [tenants.id] }),
  template: one(whatsappTemplates, {
    fields: [whatsappMessages.templateId],
    references: [whatsappTemplates.id],
  }),
  sender: one(users, {
    fields: [whatsappMessages.senderUserId],
    references: [users.id],
  }),
  lead: one(leads, {
    fields: [whatsappMessages.relatedLeadId],
    references: [leads.id],
  }),
}));

export const whatsappBotSessionsRelations = relations(whatsappBotSessions, ({ one }) => ({
  tenant: one(tenants, { fields: [whatsappBotSessions.tenantId], references: [tenants.id] }),
  agent: one(users, { fields: [whatsappBotSessions.agentId], references: [users.id] }),
}));

export type WhatsappTemplate = typeof whatsappTemplates.$inferSelect;
export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
export type NewWhatsappMessage = typeof whatsappMessages.$inferInsert;
export type WhatsappBotSession = typeof whatsappBotSessions.$inferSelect;
