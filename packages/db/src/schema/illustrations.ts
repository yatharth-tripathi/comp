import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { illustrationProductEnum } from "./enums";
import { tenants } from "./tenants";
import { users } from "./users";

// ---------------------------------------------------------------------------
// Illustrations (PRD §6 PitchWiz)
// Generated artifacts from the product illustrator — term plan, ULIP, health,
// home loan, SIP. One row per illustration; input captured for audit + re-render.
// ---------------------------------------------------------------------------
export const illustrations = pgTable(
  "illustrations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    productType: illustrationProductEnum("product_type").notNull(),

    // ---------- Inputs (PRD §6.1.1–§6.2.2) ----------
    // Kept typed per product kind for query-ability; full form stored in inputJson.
    customerName: text("customer_name"),
    customerAge: integer("customer_age"),
    customerGender: text("customer_gender"),
    customerCity: text("customer_city"),

    // Financial inputs (integer rupees to avoid float drift)
    sumAssured: integer("sum_assured_inr"),
    policyTermYears: integer("policy_term_years"),
    premiumPaymentTermYears: integer("premium_payment_term_years"),
    annualPremium: integer("annual_premium_inr"),
    monthlyPremium: integer("monthly_premium_inr"),
    loanAmount: integer("loan_amount_inr"),
    loanTenureYears: integer("loan_tenure_years"),
    interestRatePct: numeric("interest_rate_pct", { precision: 5, scale: 2 }),
    investmentHorizonYears: integer("investment_horizon_years"),
    monthlySipAmount: integer("monthly_sip_amount_inr"),
    expectedReturnPct: numeric("expected_return_pct", { precision: 5, scale: 2 }),

    // Free-form bag for everything product-specific that doesn't fit above
    inputJson: jsonb("input_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),

    // ---------- Outputs ----------
    outputJson: jsonb("output_json")
      .$type<{
        sections: Array<{ heading: string; rows: Array<{ label: string; value: string }> }>;
        chartData?: Array<{ year: number; paid: number; value: number }>;
        comparisons?: Array<{ product: string; returns: string }>;
      }>()
      .notNull()
      .default(sql`'{"sections":[]}'::jsonb`),

    // Rendered PDF/image URL (pre-signed R2 or public R2)
    renderedUrl: text("rendered_url"),
    thumbnailUrl: text("thumbnail_url"),

    // Share tracking — unique short code so the customer open event flows back
    shortCode: text("short_code").notNull(),
    openCount: integer("open_count").notNull().default(0),
    firstOpenedAt: timestamp("first_opened_at", { withTimezone: true }),
    lastOpenedAt: timestamp("last_opened_at", { withTimezone: true }),
    callbackRequestedAt: timestamp("callback_requested_at", { withTimezone: true }),

    // Compliance: was the mandatory disclosure shown?
    disclaimerVersion: text("disclaimer_version"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index("illustrations_tenant_idx").on(table.tenantId),
    agentIdx: index("illustrations_agent_idx").on(table.agentId),
    productIdx: index("illustrations_product_idx").on(table.productType),
    shortCodeUnique: uniqueIndex("illustrations_short_code_unique").on(table.shortCode),
  }),
);

export const illustrationsRelations = relations(illustrations, ({ one }) => ({
  tenant: one(tenants, { fields: [illustrations.tenantId], references: [tenants.id] }),
  agent: one(users, { fields: [illustrations.agentId], references: [users.id] }),
}));

export type Illustration = typeof illustrations.$inferSelect;
export type NewIllustration = typeof illustrations.$inferInsert;
