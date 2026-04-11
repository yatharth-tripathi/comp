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
import { tenants } from "./tenants.js";
import { users } from "./users.js";

// ---------------------------------------------------------------------------
// API keys (PRD §13.1 API-first, §11.4 API access)
// Tenant-scoped API keys used to authenticate the public REST API. The secret
// is stored as a sha256 hash — we never see it again after issuance.
// ---------------------------------------------------------------------------
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    keyPrefix: text("key_prefix").notNull(), // first 8 chars for lookup — `sk_live_`
    keyHash: text("key_hash").notNull(), // sha256 of the full secret
    lastFour: text("last_four").notNull(), // last 4 for UI display

    // Scope — what this key can do
    scopes: jsonb("scopes")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),

    // Per-key rate limits (requests per minute)
    rateLimitPerMinute: integer("rate_limit_per_minute").notNull().default(60),

    revoked: boolean("revoked").notNull().default(false),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedById: uuid("revoked_by_id").references(() => users.id, { onDelete: "set null" }),

    expiresAt: timestamp("expires_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index("api_keys_tenant_idx").on(table.tenantId),
    keyHashUnique: uniqueIndex("api_keys_key_hash_unique").on(table.keyHash),
    keyPrefixIdx: index("api_keys_key_prefix_idx").on(table.keyPrefix),
  }),
);

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  tenant: one(tenants, { fields: [apiKeys.tenantId], references: [tenants.id] }),
  createdBy: one(users, { fields: [apiKeys.createdById], references: [users.id] }),
}));

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
