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
  uuid,
} from "drizzle-orm/pg-core";
import { contentAssets } from "./content.js";
import { reelCreatorEnum, reelReviewEnum } from "./enums.js";
import { tenantOrgUnits, tenants } from "./tenants.js";
import { users } from "./users.js";

// ---------------------------------------------------------------------------
// Reels (PRD §5) — short vertical video content.
// A reel is stored as a content_asset under the hood (contentType = 'reel'),
// but we keep a reels row for everything reel-specific (mandatory training,
// creator type, per-reel playback metrics).
// ---------------------------------------------------------------------------
export const reels = pgTable(
  "reels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    contentAssetId: uuid("content_asset_id")
      .notNull()
      .references(() => contentAssets.id, { onDelete: "cascade" }),

    creatorType: reelCreatorEnum("creator_type").notNull().default("admin"),
    creatorId: uuid("creator_id").references(() => users.id, { onDelete: "set null" }),

    // Mux-backed playback (redundant with content_assets but kept for the
    // reels feed hot path)
    muxAssetId: text("mux_asset_id"),
    muxPlaybackId: text("mux_playback_id"),
    durationSeconds: integer("duration_seconds").notNull().default(0),
    aspectRatio: text("aspect_ratio").notNull().default("9:16"),

    // Captions (PRD §5.1.3 auto-generated captions)
    captionsByLanguage: jsonb("captions_by_language")
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'::jsonb`),

    // Creation details for teleprompter (PRD §5.2.2)
    teleprompterScript: text("teleprompter_script"),
    teleprompterScenario: text("teleprompter_scenario"),

    // Review state for agent-created reels (PRD §5.2.1 step 18)
    reviewState: reelReviewEnum("review_state").notNull().default("team_published"),
    reviewedById: uuid("reviewed_by_id").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),

    // Engagement rollups
    totalViews: integer("total_views").notNull().default(0),
    uniqueViewers: integer("unique_viewers").notNull().default(0),
    totalShares: integer("total_shares").notNull().default(0),
    completionRateBps: integer("completion_rate_bps").notNull().default(0), // basis points

    // Mandatory training toggles (PRD §5.4)
    isMandatory: boolean("is_mandatory").notNull().default(false),
    mandatoryForRoles: jsonb("mandatory_for_roles")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    mandatoryForTeamIds: jsonb("mandatory_for_team_ids")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    mandatoryDueDate: timestamp("mandatory_due_date", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index("reels_tenant_idx").on(table.tenantId),
    creatorIdx: index("reels_creator_idx").on(table.creatorId),
    mandatoryIdx: index("reels_mandatory_idx").on(table.tenantId, table.isMandatory),
    contentAssetIdx: index("reels_content_asset_idx").on(table.contentAssetId),
  }),
);

// ---------------------------------------------------------------------------
// Reel views — one row per view attempt, with dropoff data for PRD §5.3.2
// completion funnels.
// ---------------------------------------------------------------------------
export const reelViews = pgTable(
  "reel_views",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reelId: uuid("reel_id")
      .notNull()
      .references(() => reels.id, { onDelete: "cascade" }),
    viewerId: uuid("viewer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    lastPositionSec: integer("last_position_sec").notNull().default(0),
    completionPctBps: integer("completion_pct_bps").notNull().default(0),
    deviceKind: text("device_kind"), // mobile | desktop | tablet
  },
  (table) => ({
    reelIdx: index("reel_views_reel_idx").on(table.reelId),
    viewerIdx: index("reel_views_viewer_idx").on(table.viewerId),
    reelViewerUnique: index("reel_views_reel_viewer_idx").on(table.reelId, table.viewerId),
  }),
);

// ---------------------------------------------------------------------------
// Mandatory training assignments (PRD §5.4)
// Who has been assigned this reel, and whether they've watched it.
// ---------------------------------------------------------------------------
export const reelMandatoryAssignments = pgTable(
  "reel_mandatory_assignments",
  {
    reelId: uuid("reel_id")
      .notNull()
      .references(() => reels.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    remindersSent: integer("reminders_sent").notNull().default(0),
    dueDate: timestamp("due_date", { withTimezone: true }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.reelId, table.userId] }),
    userIdx: index("reel_mandatory_assignments_user_idx").on(table.userId),
    tenantIncompleteIdx: index("reel_mandatory_assignments_tenant_incomplete_idx").on(
      table.tenantId,
      table.completedAt,
    ),
  }),
);

export const reelsRelations = relations(reels, ({ one, many }) => ({
  tenant: one(tenants, { fields: [reels.tenantId], references: [tenants.id] }),
  contentAsset: one(contentAssets, {
    fields: [reels.contentAssetId],
    references: [contentAssets.id],
  }),
  creator: one(users, { fields: [reels.creatorId], references: [users.id] }),
  views: many(reelViews),
  mandatoryAssignments: many(reelMandatoryAssignments),
}));

export const reelViewsRelations = relations(reelViews, ({ one }) => ({
  reel: one(reels, { fields: [reelViews.reelId], references: [reels.id] }),
  viewer: one(users, { fields: [reelViews.viewerId], references: [users.id] }),
  tenant: one(tenants, { fields: [reelViews.tenantId], references: [tenants.id] }),
}));

export const reelMandatoryAssignmentsRelations = relations(
  reelMandatoryAssignments,
  ({ one }) => ({
    reel: one(reels, { fields: [reelMandatoryAssignments.reelId], references: [reels.id] }),
    user: one(users, {
      fields: [reelMandatoryAssignments.userId],
      references: [users.id],
    }),
    tenant: one(tenants, {
      fields: [reelMandatoryAssignments.tenantId],
      references: [tenants.id],
    }),
  }),
);

// Convenience — keep linter happy about unused import when this file is processed in isolation
export type TenantOrgUnitRef = typeof tenantOrgUnits.$inferSelect;

export type Reel = typeof reels.$inferSelect;
export type NewReel = typeof reels.$inferInsert;
export type ReelView = typeof reelViews.$inferSelect;
export type ReelMandatoryAssignment = typeof reelMandatoryAssignments.$inferSelect;
