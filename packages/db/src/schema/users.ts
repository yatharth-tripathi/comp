import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { roleEnum } from "./enums.js";
import { tenantOrgUnits, tenants } from "./tenants.js";

// ---------------------------------------------------------------------------
// Users — one row per Clerk user, scoped by tenant.
// A single Clerk user CAN belong to multiple tenants (multi-org) via
// tenant_memberships; this row holds tenant-local agent data like XP and roles.
// ---------------------------------------------------------------------------
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    clerkUserId: text("clerk_user_id").notNull(),

    // Profile (mirrored from Clerk; Clerk is source of truth)
    firstName: text("first_name"),
    lastName: text("last_name"),
    email: text("email"),
    phone: text("phone"),
    avatarUrl: text("avatar_url"),

    // Agent metadata (PRD §3.4 + §4.5 personalization layer)
    employeeCode: text("employee_code"),
    designation: text("designation"),
    branchId: uuid("branch_id").references(() => tenantOrgUnits.id, { onDelete: "set null" }),
    teamId: uuid("team_id").references(() => tenantOrgUnits.id, { onDelete: "set null" }),

    role: roleEnum("role").notNull().default("sales_agent"),

    // Personalization defaults — auto-populated into shared content (PRD §4.5.1)
    personalizationDefaults: jsonb("personalization_defaults")
      .$type<{
        displayName?: string;
        displayPhone?: string;
        displayEmail?: string;
        photoUrl?: string;
        branchLabel?: string;
      }>()
      .notNull()
      .default(sql`'{}'::jsonb`),

    // Product/geography assignments (feeds the home feed recommendation engine §4.4.1)
    assignedProducts: jsonb("assigned_products")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    assignedGeographies: jsonb("assigned_geographies")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    preferredLanguages: jsonb("preferred_languages")
      .$type<string[]>()
      .notNull()
      .default(sql`'["en"]'::jsonb`),

    // Onboarding state
    onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
    onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),

    active: boolean("active").notNull().default(true),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    tenantClerkUnique: uniqueIndex("users_tenant_clerk_unique").on(
      table.tenantId,
      table.clerkUserId,
    ),
    tenantIdx: index("users_tenant_idx").on(table.tenantId),
    roleIdx: index("users_tenant_role_idx").on(table.tenantId, table.role),
    branchIdx: index("users_branch_idx").on(table.branchId),
  }),
);

// ---------------------------------------------------------------------------
// XP, streak, gamification state (PRD §8.3)
// Split from users because it updates on every game; keeps the hot row small.
// ---------------------------------------------------------------------------
export const userXp = pgTable(
  "user_xp",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    totalXp: integer("total_xp").notNull().default(0),
    level: integer("level").notNull().default(1),
    streakDays: integer("streak_days").notNull().default(0),
    lastActiveDate: date("last_active_date"),

    casesCompleted: integer("cases_completed").notNull().default(0),
    rolePlaysCompleted: integer("role_plays_completed").notNull().default(0),
    modulesCompleted: integer("modules_completed").notNull().default(0),
    contentShared: integer("content_shared").notNull().default(0),

    // Category performance rollups — seeds Manager Dashboard bottom-performers view
    weakestSkill: text("weakest_skill"),
    strongestSkill: text("strongest_skill"),

    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index("user_xp_tenant_idx").on(table.tenantId),
    xpRankIdx: index("user_xp_tenant_rank_idx").on(table.tenantId, table.totalXp),
  }),
);

// ---------------------------------------------------------------------------
// Badges — achievements earned by the user (PRD §8.3)
// ---------------------------------------------------------------------------
export const userBadges = pgTable(
  "user_badges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    badgeKey: text("badge_key").notNull(),
    badgeName: text("badge_name").notNull(),
    iconUrl: text("icon_url"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    earnedAt: timestamp("earned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("user_badges_user_idx").on(table.userId),
    uniqueBadge: uniqueIndex("user_badges_user_badge_unique").on(table.userId, table.badgeKey),
  }),
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------
export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, { fields: [users.tenantId], references: [tenants.id] }),
  branch: one(tenantOrgUnits, {
    fields: [users.branchId],
    references: [tenantOrgUnits.id],
    relationName: "user_branch",
  }),
  team: one(tenantOrgUnits, {
    fields: [users.teamId],
    references: [tenantOrgUnits.id],
    relationName: "user_team",
  }),
  xp: one(userXp, { fields: [users.id], references: [userXp.userId] }),
  badges: many(userBadges),
}));

export const userXpRelations = relations(userXp, ({ one }) => ({
  user: one(users, { fields: [userXp.userId], references: [users.id] }),
  tenant: one(tenants, { fields: [userXp.tenantId], references: [tenants.id] }),
}));

export const userBadgesRelations = relations(userBadges, ({ one }) => ({
  user: one(users, { fields: [userBadges.userId], references: [users.id] }),
  tenant: one(tenants, { fields: [userBadges.tenantId], references: [tenants.id] }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserXp = typeof userXp.$inferSelect;
export type UserBadge = typeof userBadges.$inferSelect;
