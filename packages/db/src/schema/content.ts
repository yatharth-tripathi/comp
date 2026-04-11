import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
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
import {
  approvalStatusEnum,
  complianceRegimeEnum,
  contentTypeEnum,
  personalizationZoneEnum,
  tagDimensionEnum,
} from "./enums.js";
import { tenantOrgUnits, tenants } from "./tenants.js";
import { users } from "./users.js";

// ---------------------------------------------------------------------------
// Content assets — the single heart of the library (PRD §4)
// ---------------------------------------------------------------------------
export const contentAssets = pgTable(
  "content_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    title: text("title").notNull(),
    description: text("description"),
    contentType: contentTypeEnum("content_type").notNull(),

    // Storage pointers — PRD §13.4 (R2)
    fileUrl: text("file_url"), // canonical URL
    fileBytes: bigint("file_bytes", { mode: "number" }),
    mimeType: text("mime_type"),
    thumbnailUrl: text("thumbnail_url"),

    // Video-specific (Mux) — §5.1.3
    muxAssetId: text("mux_asset_id"),
    muxPlaybackId: text("mux_playback_id"),
    durationSeconds: integer("duration_seconds"),

    // Ownership + authorship
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),

    // Visibility scoping (PRD §4.3.1 step 5)
    visibilityScope: jsonb("visibility_scope")
      .$type<{
        allAgents?: boolean;
        teamIds?: string[];
        branchIds?: string[];
        regionIds?: string[];
        roleLevels?: string[];
      }>()
      .notNull()
      .default(sql`'{"allAgents": true}'::jsonb`),

    // Compliance (PRD §4.3.1 steps 6–7)
    complianceRegime: complianceRegimeEnum("compliance_regime").notNull().default("none"),
    requiresExternalApproval: boolean("requires_external_approval").notNull().default(false),
    mandatoryDisclaimers: jsonb("mandatory_disclaimers")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),

    // Lifecycle (PRD §4.6)
    approvalStatus: approvalStatusEnum("approval_status").notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    expiryDate: date("expiry_date"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),

    // Engagement rollups — keep hot counters locally for cheap dashboards
    viewCount: integer("view_count").notNull().default(0),
    shareCount: integer("share_count").notNull().default(0),
    uniqueSharerCount: integer("unique_sharer_count").notNull().default(0),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),

    // AI generation metadata (PRD §4.3.2)
    aiGenerated: boolean("ai_generated").notNull().default(false),
    aiPrompt: text("ai_prompt"),
    aiModel: text("ai_model"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index("content_assets_tenant_idx").on(table.tenantId),
    tenantTypeIdx: index("content_assets_tenant_type_idx").on(table.tenantId, table.contentType),
    approvalIdx: index("content_assets_tenant_approval_idx").on(
      table.tenantId,
      table.approvalStatus,
    ),
    expiryIdx: index("content_assets_expiry_idx").on(table.expiryDate),
    lastUsedIdx: index("content_assets_last_used_idx").on(table.tenantId, table.lastUsedAt),
  }),
);

// ---------------------------------------------------------------------------
// Tags — one row per (dimension, value) per tenant
// ---------------------------------------------------------------------------
export const contentTags = pgTable(
  "content_tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    dimension: tagDimensionEnum("dimension").notNull(),
    value: text("value").notNull(),
    displayLabel: text("display_label").notNull(),
    parentTagId: uuid("parent_tag_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantDimensionValueUnique: uniqueIndex("content_tags_tenant_dim_value_unique").on(
      table.tenantId,
      table.dimension,
      table.value,
    ),
    tenantDimensionIdx: index("content_tags_tenant_dim_idx").on(table.tenantId, table.dimension),
  }),
);

// Many-to-many content ↔ tags
export const contentAssetTags = pgTable(
  "content_asset_tags",
  {
    contentAssetId: uuid("content_asset_id")
      .notNull()
      .references(() => contentAssets.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => contentTags.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.contentAssetId, table.tagId] }),
    tagIdx: index("content_asset_tags_tag_idx").on(table.tagId),
  }),
);

// ---------------------------------------------------------------------------
// Collections (PRD §4.4.3) — curated playlists of content
// ---------------------------------------------------------------------------
export const contentCollections = pgTable(
  "content_collections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    coverImageUrl: text("cover_image_url"),
    isFeatured: boolean("is_featured").notNull().default(false),
    visibilityScope: jsonb("visibility_scope")
      .$type<{
        allAgents?: boolean;
        teamIds?: string[];
        branchIds?: string[];
      }>()
      .notNull()
      .default(sql`'{"allAgents": true}'::jsonb`),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index("content_collections_tenant_idx").on(table.tenantId),
    featuredIdx: index("content_collections_featured_idx").on(table.tenantId, table.isFeatured),
  }),
);

export const contentCollectionItems = pgTable(
  "content_collection_items",
  {
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => contentCollections.id, { onDelete: "cascade" }),
    contentAssetId: uuid("content_asset_id")
      .notNull()
      .references(() => contentAssets.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.collectionId, table.contentAssetId] }),
    collectionOrderIdx: index("content_collection_items_order_idx").on(
      table.collectionId,
      table.sortOrder,
    ),
  }),
);

// ---------------------------------------------------------------------------
// Approval workflow log (PRD §4.6)
// ---------------------------------------------------------------------------
export const contentApprovalEvents = pgTable(
  "content_approval_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contentAssetId: uuid("content_asset_id")
      .notNull()
      .references(() => contentAssets.id, { onDelete: "cascade" }),
    stepName: text("step_name").notNull(), // internal_review | compliance_review | legal_review | approval
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    status: approvalStatusEnum("status").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    assetIdx: index("content_approval_events_asset_idx").on(table.contentAssetId),
  }),
);

// ---------------------------------------------------------------------------
// Personalization zones (PRD §4.5.2)
// Defines which regions of a content asset are fixed, personalizable, or data-input.
// ---------------------------------------------------------------------------
export const contentPersonalizationZones = pgTable(
  "content_personalization_zones",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contentAssetId: uuid("content_asset_id")
      .notNull()
      .references(() => contentAssets.id, { onDelete: "cascade" }),
    zoneKey: text("zone_key").notNull(), // e.g. 'agent_name' | 'customer_age'
    zoneType: personalizationZoneEnum("zone_type").notNull(),
    label: text("label").notNull(),
    defaultValue: text("default_value"),
    coordinates: jsonb("coordinates")
      .$type<{ x: number; y: number; width: number; height: number }>()
      .notNull()
      .default(sql`'{"x":0,"y":0,"width":0,"height":0}'::jsonb`),
    fontSize: integer("font_size"),
    fontColor: text("font_color"),
    fontFamily: text("font_family"),
  },
  (table) => ({
    assetIdx: index("content_personalization_zones_asset_idx").on(table.contentAssetId),
    assetKeyUnique: uniqueIndex("content_personalization_zones_asset_key_unique").on(
      table.contentAssetId,
      table.zoneKey,
    ),
  }),
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------
export const contentAssetsRelations = relations(contentAssets, ({ one, many }) => ({
  tenant: one(tenants, { fields: [contentAssets.tenantId], references: [tenants.id] }),
  createdBy: one(users, {
    fields: [contentAssets.createdById],
    references: [users.id],
  }),
  tags: many(contentAssetTags),
  approvalEvents: many(contentApprovalEvents),
  personalizationZones: many(contentPersonalizationZones),
}));

export const contentTagsRelations = relations(contentTags, ({ one, many }) => ({
  tenant: one(tenants, { fields: [contentTags.tenantId], references: [tenants.id] }),
  parent: one(contentTags, {
    fields: [contentTags.parentTagId],
    references: [contentTags.id],
    relationName: "tag_parent_child",
  }),
  children: many(contentTags, { relationName: "tag_parent_child" }),
  assets: many(contentAssetTags),
}));

export const contentAssetTagsRelations = relations(contentAssetTags, ({ one }) => ({
  asset: one(contentAssets, {
    fields: [contentAssetTags.contentAssetId],
    references: [contentAssets.id],
  }),
  tag: one(contentTags, {
    fields: [contentAssetTags.tagId],
    references: [contentTags.id],
  }),
}));

export const contentCollectionsRelations = relations(contentCollections, ({ one, many }) => ({
  tenant: one(tenants, { fields: [contentCollections.tenantId], references: [tenants.id] }),
  createdBy: one(users, {
    fields: [contentCollections.createdById],
    references: [users.id],
  }),
  items: many(contentCollectionItems),
}));

export const contentCollectionItemsRelations = relations(contentCollectionItems, ({ one }) => ({
  collection: one(contentCollections, {
    fields: [contentCollectionItems.collectionId],
    references: [contentCollections.id],
  }),
  asset: one(contentAssets, {
    fields: [contentCollectionItems.contentAssetId],
    references: [contentAssets.id],
  }),
}));

export const contentApprovalEventsRelations = relations(contentApprovalEvents, ({ one }) => ({
  asset: one(contentAssets, {
    fields: [contentApprovalEvents.contentAssetId],
    references: [contentAssets.id],
  }),
  actor: one(users, {
    fields: [contentApprovalEvents.actorId],
    references: [users.id],
  }),
}));

export const contentPersonalizationZonesRelations = relations(
  contentPersonalizationZones,
  ({ one }) => ({
    asset: one(contentAssets, {
      fields: [contentPersonalizationZones.contentAssetId],
      references: [contentAssets.id],
    }),
  }),
);

export type ContentAsset = typeof contentAssets.$inferSelect;
export type NewContentAsset = typeof contentAssets.$inferInsert;
export type ContentTag = typeof contentTags.$inferSelect;
export type ContentCollection = typeof contentCollections.$inferSelect;
export type ContentApprovalEvent = typeof contentApprovalEvents.$inferSelect;
export type ContentPersonalizationZone = typeof contentPersonalizationZones.$inferSelect;
