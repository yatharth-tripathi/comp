import { relations, sql } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { contentAssets } from "./content";
import { shareChannelEnum } from "./enums";
import { tenants } from "./tenants";
import { users } from "./users";

// ---------------------------------------------------------------------------
// Share events — one row per content share (PRD §4.5.1 step 7, §10.1, §6.3)
// Every agent share gets a unique trackable link so we can log customer opens.
// This is the single source of truth for "who shared what with whom and did
// the customer open it".
// ---------------------------------------------------------------------------
export const contentShareEvents = pgTable(
  "content_share_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    contentAssetId: uuid("content_asset_id").references(() => contentAssets.id, {
      onDelete: "set null",
    }),
    // Denormalized: some shares are of illustrations/reels, not content_assets.
    // We always snapshot the title to keep the audit trail intact even if the asset is deleted.
    resourceKind: text("resource_kind").notNull(), // 'content' | 'reel' | 'illustration'
    resourceId: uuid("resource_id").notNull(),
    resourceTitle: text("resource_title").notNull(),

    sharedById: uuid("shared_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    channel: shareChannelEnum("channel").notNull(),

    // Unique short link — the trackable redirect target.
    shortCode: text("short_code").notNull(),

    // Denormalized customer snapshot — these are the values the agent filled in
    // at share time, so we can show "you shared this with Rohit at 3pm".
    recipientName: text("recipient_name"),
    recipientPhone: text("recipient_phone"),
    recipientLeadId: uuid("recipient_lead_id"), // FK added in leads.ts to avoid circular dep

    // Personalization snapshot — what the agent overlaid on the content
    personalizationSnapshot: jsonb("personalization_snapshot")
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'::jsonb`),

    sharedAt: timestamp("shared_at", { withTimezone: true }).notNull().defaultNow(),

    // Delivery + open tracking
    whatsappMessageId: text("whatsapp_message_id"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    firstOpenedAt: timestamp("first_opened_at", { withTimezone: true }),
    lastOpenedAt: timestamp("last_opened_at", { withTimezone: true }),
    openCount: integer("open_count").notNull().default(0),
    callbackRequestedAt: timestamp("callback_requested_at", { withTimezone: true }),
  },
  (table) => ({
    tenantIdx: index("content_share_events_tenant_idx").on(table.tenantId),
    sharedByIdx: index("content_share_events_shared_by_idx").on(table.sharedById),
    resourceIdx: index("content_share_events_resource_idx").on(table.resourceKind, table.resourceId),
    shortCodeUnique: uniqueIndex("content_share_events_short_code_unique").on(table.shortCode),
    sharedAtIdx: index("content_share_events_shared_at_idx").on(table.sharedAt),
  }),
);

// Track every open hit separately so we can draw a real open-rate curve later.
export const contentShareEventOpens = pgTable(
  "content_share_event_opens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shareEventId: uuid("share_event_id")
      .notNull()
      .references(() => contentShareEvents.id, { onDelete: "cascade" }),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    referrer: text("referrer"),
    durationMs: bigint("duration_ms", { mode: "number" }),
  },
  (table) => ({
    shareIdx: index("content_share_event_opens_share_idx").on(table.shareEventId),
  }),
);

export const contentShareEventsRelations = relations(contentShareEvents, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [contentShareEvents.tenantId],
    references: [tenants.id],
  }),
  contentAsset: one(contentAssets, {
    fields: [contentShareEvents.contentAssetId],
    references: [contentAssets.id],
  }),
  sharedBy: one(users, {
    fields: [contentShareEvents.sharedById],
    references: [users.id],
  }),
  opens: many(contentShareEventOpens),
}));

export const contentShareEventOpensRelations = relations(contentShareEventOpens, ({ one }) => ({
  shareEvent: one(contentShareEvents, {
    fields: [contentShareEventOpens.shareEventId],
    references: [contentShareEvents.id],
  }),
}));

export type ContentShareEvent = typeof contentShareEvents.$inferSelect;
export type NewContentShareEvent = typeof contentShareEvents.$inferInsert;
export type ContentShareEventOpen = typeof contentShareEventOpens.$inferSelect;
