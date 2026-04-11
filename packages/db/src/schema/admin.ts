import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { campaignStatusEnum } from "./enums.js";
import { tenants } from "./tenants.js";
import { users } from "./users.js";

// ---------------------------------------------------------------------------
// Announcements (PRD §12.3) — banner / push / WA broadcasts from admins
// ---------------------------------------------------------------------------
export const announcements = pgTable(
  "announcements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    title: text("title").notNull(),
    bodyMarkdown: text("body_markdown").notNull(),
    bannerImageUrl: text("banner_image_url"),

    // Delivery channels
    channels: jsonb("channels")
      .$type<Array<"in_app_banner" | "push" | "whatsapp" | "email">>()
      .notNull()
      .default(sql`'["in_app_banner"]'::jsonb`),

    // Targeting
    targetRoles: jsonb("target_roles")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    targetTeamIds: jsonb("target_team_ids")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),

    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    isEmergency: boolean("is_emergency").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index("announcements_tenant_idx").on(table.tenantId),
    scheduledIdx: index("announcements_scheduled_idx").on(table.scheduledFor),
  }),
);

// ---------------------------------------------------------------------------
// Campaigns (PRD §12.3) — multi-day coordinated content push
// ---------------------------------------------------------------------------
export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    description: text("description"),
    status: campaignStatusEnum("status").notNull().default("draft"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),

    // Daily content plan (PRD §12.3 campaign management)
    scheduleJson: jsonb("schedule_json")
      .$type<
        Array<{
          dayOffset: number;
          contentAssetIds: string[];
          reelIds: string[];
          broadcastMessage?: string;
        }>
      >()
      .notNull()
      .default(sql`'[]'::jsonb`),

    // Rollups
    totalParticipants: integer("total_participants").notNull().default(0),
    totalSharesGenerated: integer("total_shares_generated").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index("campaigns_tenant_idx").on(table.tenantId),
    statusIdx: index("campaigns_status_idx").on(table.status),
  }),
);

export const announcementsRelations = relations(announcements, ({ one }) => ({
  tenant: one(tenants, { fields: [announcements.tenantId], references: [tenants.id] }),
  createdBy: one(users, { fields: [announcements.createdById], references: [users.id] }),
}));

export const campaignsRelations = relations(campaigns, ({ one }) => ({
  tenant: one(tenants, { fields: [campaigns.tenantId], references: [tenants.id] }),
  createdBy: one(users, { fields: [campaigns.createdById], references: [users.id] }),
}));

export type Announcement = typeof announcements.$inferSelect;
export type NewAnnouncement = typeof announcements.$inferInsert;
export type Campaign = typeof campaigns.$inferSelect;
