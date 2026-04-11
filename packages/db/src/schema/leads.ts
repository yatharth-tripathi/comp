import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { leadActivityKindEnum, leadStageEnum } from "./enums.js";
import { tenants } from "./tenants.js";
import { users } from "./users.js";

// ---------------------------------------------------------------------------
// Leads (PRD §9) — lightweight CRM scoped per tenant + per agent
// ---------------------------------------------------------------------------
export const leads = pgTable(
  "leads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Basic identity
    fullName: text("full_name").notNull(),
    phone: text("phone"),
    email: text("email"),
    age: integer("age"),
    gender: text("gender"),
    city: text("city"),
    state: text("state"),
    profession: text("profession"),

    // Financial profile (PRD §9.3)
    incomeRange: text("income_range"),
    existingInvestments: jsonb("existing_investments")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    dependents: integer("dependents"),
    riskAppetite: text("risk_appetite"), // low | moderate | high

    stage: leadStageEnum("stage").notNull().default("new"),
    source: text("source"), // manual | card_scan | wa_import | web_form | campaign | qr
    sourceMetadata: jsonb("source_metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),

    // Derived fields for dashboards
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),
    nextFollowUpAt: timestamp("next_follow_up_at", { withTimezone: true }),
    aiSuggestedNextAction: text("ai_suggested_next_action"),

    // Outcome tracking
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closedReason: text("closed_reason"),
    policyNumber: text("policy_number"), // when closed_won
    premiumValue: integer("premium_value_inr"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantAgentIdx: index("leads_tenant_agent_idx").on(table.tenantId, table.agentId),
    stageIdx: index("leads_stage_idx").on(table.stage),
    nextFollowUpIdx: index("leads_next_follow_up_idx").on(table.nextFollowUpAt),
    phoneIdx: index("leads_phone_idx").on(table.phone),
  }),
);

// ---------------------------------------------------------------------------
// Lead activities — the full timeline (PRD §9.3 interaction timeline)
// ---------------------------------------------------------------------------
export const leadActivities = pgTable(
  "lead_activities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    kind: leadActivityKindEnum("kind").notNull(),
    notes: text("notes"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),

    // Cross-links to content / illustration shares
    contentShareEventId: uuid("content_share_event_id"),
    illustrationId: uuid("illustration_id"),

    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    leadIdx: index("lead_activities_lead_idx").on(table.leadId),
    tenantIdx: index("lead_activities_tenant_idx").on(table.tenantId),
    scheduledIdx: index("lead_activities_scheduled_idx").on(table.scheduledFor),
  }),
);

export const leadsRelations = relations(leads, ({ one, many }) => ({
  tenant: one(tenants, { fields: [leads.tenantId], references: [tenants.id] }),
  agent: one(users, { fields: [leads.agentId], references: [users.id] }),
  activities: many(leadActivities),
}));

export const leadActivitiesRelations = relations(leadActivities, ({ one }) => ({
  tenant: one(tenants, { fields: [leadActivities.tenantId], references: [tenants.id] }),
  lead: one(leads, { fields: [leadActivities.leadId], references: [leads.id] }),
  actor: one(users, { fields: [leadActivities.actorId], references: [users.id] }),
}));

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type LeadActivity = typeof leadActivities.$inferSelect;
