import { relations, sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { auditActionEnum } from "./enums.js";
import { tenants } from "./tenants.js";
import { users } from "./users.js";

// ---------------------------------------------------------------------------
// Audit logs (PRD §13.3 audit logging)
// Every mutation, approval, share, login, and export hits this table.
// Immutable append-only. Never delete rows from here — archive instead.
// ---------------------------------------------------------------------------
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),

    action: auditActionEnum("action").notNull(),
    resourceType: text("resource_type").notNull(), // 'content_asset' | 'reel' | 'lead' | ...
    resourceId: text("resource_id"),

    // Free-form metadata — before/after snapshot for updates, scope for reads
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),

    // Request-time context
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    requestId: text("request_id"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index("audit_logs_tenant_idx").on(table.tenantId),
    actorIdx: index("audit_logs_actor_idx").on(table.actorId),
    resourceIdx: index("audit_logs_resource_idx").on(table.resourceType, table.resourceId),
    createdAtIdx: index("audit_logs_created_at_idx").on(table.createdAt),
  }),
);

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  tenant: one(tenants, { fields: [auditLogs.tenantId], references: [tenants.id] }),
  actor: one(users, { fields: [auditLogs.actorId], references: [users.id] }),
}));

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
