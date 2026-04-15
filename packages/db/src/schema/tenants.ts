import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { planTierEnum } from "./enums";

// ---------------------------------------------------------------------------
// Tenants (PRD §3.3 Multi-tenancy model)
// One row per enterprise client (LIC, HDFC Life, Bajaj Finserv, etc).
// ---------------------------------------------------------------------------
export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    slug: text("slug").notNull(), // `hdfc-life`
    name: text("name").notNull(),
    legalName: text("legal_name"),

    // Branding — PRD §3.3
    logoUrl: text("logo_url"),
    primaryColor: text("primary_color").default("#2D5BD2"),
    secondaryColor: text("secondary_color").default("#0EA5E9"),
    fontFamily: text("font_family").default("Inter"),
    customDomain: text("custom_domain"), // hdfc.salescontent.ai OR hdfcsales.com

    // Commercial
    planTier: planTierEnum("plan_tier").notNull().default("starter"),
    seatsPurchased: integer("seats_purchased").notNull().default(50),

    // Data residency and compliance
    dataResidencyRegion: text("data_residency_region").notNull().default("ap-south-1"),
    requiresComplianceApproval: boolean("requires_compliance_approval").notNull().default(true),

    // Feature flags — per tenant kill switches
    featureFlags: jsonb("feature_flags")
      .$type<{
        copilotEnabled?: boolean;
        whatsappBotEnabled?: boolean;
        reelsCreationEnabled?: boolean;
        learningJourneysEnabled?: boolean;
        illustratorsEnabled?: boolean;
      }>()
      .notNull()
      .default(sql`'{}'::jsonb`),

    // Claude usage controls — per tenant daily spend cap in USD (PRD risk mitigation)
    claudeDailyCapUsd: integer("claude_daily_cap_usd").notNull().default(25),

    suspended: boolean("suspended").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    slugUnique: uniqueIndex("tenants_slug_unique").on(table.slug),
    customDomainUnique: uniqueIndex("tenants_custom_domain_unique").on(table.customDomain),
    suspendedIdx: index("tenants_suspended_idx").on(table.suspended),
  }),
);

// ---------------------------------------------------------------------------
// Tenant settings — isolated from the core tenants row because these change more
// frequently and are more likely to blow up in size.
// ---------------------------------------------------------------------------
export const tenantSettings = pgTable("tenant_settings", {
  tenantId: uuid("tenant_id")
    .primaryKey()
    .references(() => tenants.id, { onDelete: "cascade" }),

  // PRD §12.1 — configurable approval workflow
  approvalWorkflow: jsonb("approval_workflow")
    .$type<{
      steps: Array<{
        stepName: string;
        actorRole: string;
        slaHours: number;
        isRequired: boolean;
      }>;
      autoPublishThreshold?: number; // if the asset is simple, auto-approve
    }>()
    .notNull()
    .default(sql`'{"steps": []}'::jsonb`),

  // PRD §12.1 — notification preferences per role
  notificationPreferences: jsonb("notification_preferences")
    .$type<{
      push: Record<string, boolean>;
      email: Record<string, boolean>;
      whatsapp: Record<string, boolean>;
    }>()
    .notNull()
    .default(sql`'{"push": {}, "email": {}, "whatsapp": {}}'::jsonb`),

  // Brand tokens reusable across templates (PRD §4.5.2 brand_locked zones)
  brandTokens: jsonb("brand_tokens")
    .$type<Record<string, string>>()
    .notNull()
    .default(sql`'{}'::jsonb`),

  // Mandatory disclaimers (auto-appended to outbound content per regime)
  mandatoryDisclaimers: jsonb("mandatory_disclaimers")
    .$type<Array<{ regime: string; text: string; languages: string[] }>>()
    .notNull()
    .default(sql`'[]'::jsonb`),

  // Default content expiry in days — auto-archive after this unless overridden
  defaultContentExpiryDays: integer("default_content_expiry_days").notNull().default(90),

  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Tenant organizational hierarchy — regions → zones → branches → teams
// (PRD §3.4 user roles and hierarchy; §11.1 regional heatmap)
// ---------------------------------------------------------------------------
export const tenantOrgUnits = pgTable(
  "tenant_org_units",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),

    kind: text("kind").notNull(), // 'region' | 'zone' | 'branch' | 'team'
    name: text("name").notNull(),
    code: text("code"), // e.g. `MUMBAI_WEST_01`

    // Geographic metadata for heatmap (PRD §11.1)
    state: text("state"),
    city: text("city"),
    latitude: text("latitude"),
    longitude: text("longitude"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index("tenant_org_units_tenant_idx").on(table.tenantId),
    parentIdx: index("tenant_org_units_parent_idx").on(table.parentId),
    tenantCodeUnique: uniqueIndex("tenant_org_units_tenant_code_unique").on(
      table.tenantId,
      table.code,
    ),
  }),
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------
export const tenantsRelations = relations(tenants, ({ one, many }) => ({
  settings: one(tenantSettings, {
    fields: [tenants.id],
    references: [tenantSettings.tenantId],
  }),
  orgUnits: many(tenantOrgUnits),
}));

export const tenantSettingsRelations = relations(tenantSettings, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantSettings.tenantId],
    references: [tenants.id],
  }),
}));

export const tenantOrgUnitsRelations = relations(tenantOrgUnits, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [tenantOrgUnits.tenantId],
    references: [tenants.id],
  }),
  parent: one(tenantOrgUnits, {
    fields: [tenantOrgUnits.parentId],
    references: [tenantOrgUnits.id],
    relationName: "parent_child",
  }),
  children: many(tenantOrgUnits, { relationName: "parent_child" }),
}));

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type TenantSettings = typeof tenantSettings.$inferSelect;
export type TenantOrgUnit = typeof tenantOrgUnits.$inferSelect;
