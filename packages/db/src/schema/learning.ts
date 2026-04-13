import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { journeyTypeEnum, moduleFormatEnum } from "./enums";
import { tenants } from "./tenants";
import { users } from "./users";

// ---------------------------------------------------------------------------
// Learning journeys (PRD §8.1.1)
// ---------------------------------------------------------------------------
export const learningJourneys = pgTable(
  "learning_journeys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    title: text("title").notNull(),
    description: text("description"),
    journeyType: journeyTypeEnum("journey_type").notNull(),
    targetRoles: jsonb("target_roles")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    durationDays: integer("duration_days").notNull().default(30),

    // Policy: can the agent skip modules? Must they complete in order?
    isSequential: boolean("is_sequential").notNull().default(true),
    isMandatory: boolean("is_mandatory").notNull().default(false),

    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index("learning_journeys_tenant_idx").on(table.tenantId),
    typeIdx: index("learning_journeys_type_idx").on(table.journeyType),
  }),
);

// ---------------------------------------------------------------------------
// Modules — a step inside a journey.
// ---------------------------------------------------------------------------
export const learningModules = pgTable(
  "learning_modules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    journeyId: uuid("journey_id")
      .notNull()
      .references(() => learningJourneys.id, { onDelete: "cascade" }),

    title: text("title").notNull(),
    description: text("description"),
    format: moduleFormatEnum("format").notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(5),

    sortOrder: integer("sort_order").notNull().default(0),

    // Format-specific content blob (video URL, flashcards, quiz questions, etc.)
    contentJson: jsonb("content_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),

    // For video / audio / document modules — pointer to the backing content asset
    contentAssetId: uuid("content_asset_id"),
    // For role-play modules — pointer to the scenario
    rolePlayScenarioId: uuid("role_play_scenario_id"),

    minPassingScore: integer("min_passing_score").notNull().default(70),
    xpReward: integer("xp_reward").notNull().default(20),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    journeyOrderIdx: index("learning_modules_journey_order_idx").on(
      table.journeyId,
      table.sortOrder,
    ),
    tenantIdx: index("learning_modules_tenant_idx").on(table.tenantId),
  }),
);

// ---------------------------------------------------------------------------
// Progress — one row per (user, module). Updates on every completion.
// ---------------------------------------------------------------------------
export const learningProgress = pgTable(
  "learning_progress",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => learningModules.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    journeyId: uuid("journey_id")
      .notNull()
      .references(() => learningJourneys.id, { onDelete: "cascade" }),

    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    score: integer("score"),
    attempts: integer("attempts").notNull().default(0),
    timeSpentSeconds: integer("time_spent_seconds").notNull().default(0),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.moduleId] }),
    userIdx: index("learning_progress_user_idx").on(table.userId),
    journeyIdx: index("learning_progress_journey_idx").on(table.journeyId),
  }),
);

// ---------------------------------------------------------------------------
// Role-play scenarios (PRD §8.2) — typed version of the "scenario" concept
// from the WISDORA simulator. Built for Copilot-adjacent use.
// ---------------------------------------------------------------------------
export const rolePlayScenarios = pgTable(
  "role_play_scenarios",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    title: text("title").notNull(),
    description: text("description"),
    category: text("category").notNull(), // sales | compliance | customer_service | fraud | operations
    difficulty: text("difficulty").notNull().default("medium"), // easy|medium|hard|expert
    language: text("language").notNull().default("en"),
    xpReward: integer("xp_reward").notNull().default(50),
    tags: jsonb("tags")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),

    // Customer persona + opening statement + conversation scaffold
    personaJson: jsonb("persona_json")
      .$type<{
        name: string;
        age: number;
        profession: string;
        city: string;
        personality: string;
        goal: string;
        archetype: string;
        moodInitial: number;
        hotButtons: string[];
        aiPersonaPrompt: string;
      }>()
      .notNull()
      .default(
        sql`'{"name":"","age":0,"profession":"","city":"","personality":"","goal":"","archetype":"","moodInitial":5,"hotButtons":[],"aiPersonaPrompt":""}'::jsonb`,
      ),

    openingStatement: text("opening_statement").notNull(),

    // The step ladder — customer lines and the objectives the agent must hit
    stepsJson: jsonb("steps_json")
      .$type<
        Array<{
          speaker: "customer" | "system";
          text: string;
          expectedAction?: string;
          hints?: string[];
          idealKeywords?: string[];
          bannedPhrases?: string[];
          scoring?: Record<string, number>;
        }>
      >()
      .notNull()
      .default(sql`'[]'::jsonb`),

    // Scoring and compliance rules
    evaluationRulesJson: jsonb("evaluation_rules_json")
      .$type<Array<{ skill: string; keywords: string[]; weight: number }>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    complianceRulesJson: jsonb("compliance_rules_json")
      .$type<{ hardBanned: string[]; violationPenalty: number; violationMessage: string }>()
      .notNull()
      .default(
        sql`'{"hardBanned":[],"violationPenalty":0,"violationMessage":""}'::jsonb`,
      ),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index("role_play_scenarios_tenant_idx").on(table.tenantId),
    categoryIdx: index("role_play_scenarios_category_idx").on(table.category),
  }),
);

// Actual play sessions + evaluation results
export const rolePlaySessions = pgTable(
  "role_play_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    scenarioId: uuid("scenario_id")
      .notNull()
      .references(() => rolePlayScenarios.id, { onDelete: "cascade" }),

    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),

    conversationJson: jsonb("conversation_json")
      .$type<Array<{ role: string; content: string; timestamp: number }>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    userResponses: jsonb("user_responses")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    moodTrajectory: jsonb("mood_trajectory")
      .$type<number[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),

    score: integer("score"),
    maxScore: integer("max_score"),
    percentage: integer("percentage"),
    grade: text("grade"),
    xpAwarded: integer("xp_awarded").notNull().default(0),

    evaluationJson: jsonb("evaluation_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),

    complianceViolations: jsonb("compliance_violations")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
  },
  (table) => ({
    tenantUserIdx: index("role_play_sessions_tenant_user_idx").on(table.tenantId, table.userId),
    scenarioIdx: index("role_play_sessions_scenario_idx").on(table.scenarioId),
    percentageIdx: index("role_play_sessions_percentage_idx").on(table.percentage),
  }),
);

// ---------------------------------------------------------------------------
// Certificates — awarded when an agent completes a certification journey or
// clears N scenarios in a category (PRD §4.1 certificates).
// ---------------------------------------------------------------------------
export const certificates = pgTable(
  "certificates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    kind: text("kind").notNull(), // journey | category | custom
    title: text("title").notNull(),
    journeyId: uuid("journey_id").references(() => learningJourneys.id, { onDelete: "set null" }),
    category: text("category"),
    percentage: integer("percentage").notNull(),

    pdfUrl: text("pdf_url"),
    verifyCode: text("verify_code").notNull(),

    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (table) => ({
    userIdx: index("certificates_user_idx").on(table.userId),
    verifyCodeUnique: uniqueIndex("certificates_verify_code_unique").on(table.verifyCode),
  }),
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------
export const learningJourneysRelations = relations(learningJourneys, ({ one, many }) => ({
  tenant: one(tenants, { fields: [learningJourneys.tenantId], references: [tenants.id] }),
  modules: many(learningModules),
}));

export const learningModulesRelations = relations(learningModules, ({ one, many }) => ({
  tenant: one(tenants, { fields: [learningModules.tenantId], references: [tenants.id] }),
  journey: one(learningJourneys, {
    fields: [learningModules.journeyId],
    references: [learningJourneys.id],
  }),
  progress: many(learningProgress),
}));

export const learningProgressRelations = relations(learningProgress, ({ one }) => ({
  user: one(users, { fields: [learningProgress.userId], references: [users.id] }),
  module: one(learningModules, {
    fields: [learningProgress.moduleId],
    references: [learningModules.id],
  }),
  journey: one(learningJourneys, {
    fields: [learningProgress.journeyId],
    references: [learningJourneys.id],
  }),
}));

export const rolePlayScenariosRelations = relations(rolePlayScenarios, ({ one, many }) => ({
  tenant: one(tenants, { fields: [rolePlayScenarios.tenantId], references: [tenants.id] }),
  sessions: many(rolePlaySessions),
}));

export const rolePlaySessionsRelations = relations(rolePlaySessions, ({ one }) => ({
  tenant: one(tenants, { fields: [rolePlaySessions.tenantId], references: [tenants.id] }),
  user: one(users, { fields: [rolePlaySessions.userId], references: [users.id] }),
  scenario: one(rolePlayScenarios, {
    fields: [rolePlaySessions.scenarioId],
    references: [rolePlayScenarios.id],
  }),
}));

export const certificatesRelations = relations(certificates, ({ one }) => ({
  user: one(users, { fields: [certificates.userId], references: [users.id] }),
  tenant: one(tenants, { fields: [certificates.tenantId], references: [tenants.id] }),
  journey: one(learningJourneys, {
    fields: [certificates.journeyId],
    references: [learningJourneys.id],
  }),
}));

export type LearningJourney = typeof learningJourneys.$inferSelect;
export type LearningModule = typeof learningModules.$inferSelect;
export type LearningProgress = typeof learningProgress.$inferSelect;
export type RolePlayScenario = typeof rolePlayScenarios.$inferSelect;
export type RolePlaySession = typeof rolePlaySessions.$inferSelect;
export type Certificate = typeof certificates.$inferSelect;
