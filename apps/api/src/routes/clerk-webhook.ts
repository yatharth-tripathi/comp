import { Hono } from "hono";
import { Webhook } from "svix";
import { db, eq, schema } from "@salescontent/db";
import { env } from "../lib/env.js";
import { logger } from "../lib/logger.js";

/**
 * Clerk webhook handler — reconciles Clerk organizations/users with our
 * local tenants + users tables. This is how tenants get provisioned in the
 * self-serve flow described in PRD §14.2 Phase 2.
 *
 * Events handled:
 *   - organization.created  → create tenant row + tenant_settings row
 *   - organization.updated  → update branding if Clerk slug/name changed
 *   - organization.deleted  → soft delete tenant
 *   - user.created          → no-op (we wait for organizationMembership.created)
 *   - organizationMembership.created → upsert user row under the tenant
 *   - organizationMembership.deleted → deactivate user row
 *
 * Verification: the webhook body is HMAC-signed by Clerk via Svix; we verify
 * before parsing JSON.
 */

type ClerkEvent =
  | {
      type: "organization.created" | "organization.updated";
      data: {
        id: string;
        slug: string;
        name: string;
        image_url?: string;
      };
    }
  | {
      type: "organization.deleted";
      data: { id: string; deleted: boolean };
    }
  | {
      type: "organizationMembership.created";
      data: {
        organization: { id: string };
        public_user_data: {
          user_id: string;
          first_name?: string | null;
          last_name?: string | null;
          identifier: string;
          image_url?: string | null;
        };
        role: string;
      };
    }
  | {
      type: "organizationMembership.deleted";
      data: {
        organization: { id: string };
        public_user_data: { user_id: string };
      };
    }
  | { type: string; data: Record<string, unknown> };

function mapClerkRole(role: string): "enterprise_admin" | "sales_agent" {
  if (role === "org:admin" || role === "admin") return "enterprise_admin";
  return "sales_agent";
}

export const clerkWebhookRoutes = new Hono();

clerkWebhookRoutes.post("/", async (c) => {
  const config = env();
  const secret = config.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    logger.warn("Clerk webhook hit with no CLERK_WEBHOOK_SECRET configured");
    return c.json({ ok: false, error: "webhook not configured" }, 500);
  }

  const svixId = c.req.header("svix-id");
  const svixTimestamp = c.req.header("svix-timestamp");
  const svixSignature = c.req.header("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return c.json({ ok: false, error: "missing svix headers" }, 400);
  }

  const rawBody = await c.req.text();
  const webhook = new Webhook(secret);
  let event: ClerkEvent;
  try {
    event = webhook.verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkEvent;
  } catch (error) {
    logger.warn({ err: error }, "clerk webhook signature verification failed");
    return c.json({ ok: false, error: "invalid signature" }, 401);
  }

  logger.info({ type: event.type }, "clerk.webhook");

  switch (event.type) {
    case "organization.created":
    case "organization.updated": {
      const data = event.data as {
        id: string;
        slug: string;
        name: string;
        image_url?: string;
      };
      await db
        .insert(schema.tenants)
        .values({
          clerkOrgId: data.id,
          slug: data.slug,
          name: data.name,
          logoUrl: data.image_url,
        })
        .onConflictDoUpdate({
          target: schema.tenants.clerkOrgId,
          set: { slug: data.slug, name: data.name, logoUrl: data.image_url, updatedAt: new Date() },
        });

      // Ensure tenant_settings row exists
      const tenant = await db.query.tenants.findFirst({
        where: eq(schema.tenants.clerkOrgId, data.id),
      });
      if (tenant) {
        await db
          .insert(schema.tenantSettings)
          .values({ tenantId: tenant.id })
          .onConflictDoNothing();
      }
      break;
    }

    case "organization.deleted": {
      const data = event.data as { id: string };
      await db
        .update(schema.tenants)
        .set({ suspended: true, deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.tenants.clerkOrgId, data.id));
      break;
    }

    case "organizationMembership.created": {
      const data = event.data as {
        organization: { id: string };
        public_user_data: {
          user_id: string;
          first_name?: string | null;
          last_name?: string | null;
          identifier: string;
          image_url?: string | null;
        };
        role: string;
      };
      const tenant = await db.query.tenants.findFirst({
        where: eq(schema.tenants.clerkOrgId, data.organization.id),
      });
      if (!tenant) {
        logger.warn(
          { orgId: data.organization.id },
          "organizationMembership.created for unknown tenant",
        );
        break;
      }

      const identifier = data.public_user_data.identifier;
      const isEmail = identifier.includes("@");
      const [user] = await db
        .insert(schema.users)
        .values({
          tenantId: tenant.id,
          clerkUserId: data.public_user_data.user_id,
          firstName: data.public_user_data.first_name ?? undefined,
          lastName: data.public_user_data.last_name ?? undefined,
          email: isEmail ? identifier : undefined,
          phone: isEmail ? undefined : identifier,
          avatarUrl: data.public_user_data.image_url ?? undefined,
          role: mapClerkRole(data.role),
          active: true,
        })
        .onConflictDoUpdate({
          target: [schema.users.tenantId, schema.users.clerkUserId],
          set: {
            firstName: data.public_user_data.first_name ?? undefined,
            lastName: data.public_user_data.last_name ?? undefined,
            avatarUrl: data.public_user_data.image_url ?? undefined,
            active: true,
            updatedAt: new Date(),
          },
        })
        .returning();
      if (user) {
        await db.insert(schema.userXp).values({ userId: user.id, tenantId: tenant.id }).onConflictDoNothing();
      }
      break;
    }

    case "organizationMembership.deleted": {
      const data = event.data as {
        organization: { id: string };
        public_user_data: { user_id: string };
      };
      const tenant = await db.query.tenants.findFirst({
        where: eq(schema.tenants.clerkOrgId, data.organization.id),
      });
      if (tenant) {
        await db
          .update(schema.users)
          .set({ active: false, updatedAt: new Date() })
          .where(eq(schema.users.tenantId, tenant.id));
      }
      break;
    }

    default:
      logger.debug({ type: event.type }, "clerk webhook ignored");
  }

  return c.json({ ok: true });
});
