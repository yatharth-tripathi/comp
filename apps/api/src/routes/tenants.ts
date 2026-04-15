import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { db, eq, schema } from "@salescontent/db";
import {
  createOrgUnitSchema,
  createTenantSchema,
  updateTenantSchema,
} from "@salescontent/schemas";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { NotFoundError } from "../lib/errors.js";

export const tenantRoutes = new Hono();

// ---------------------------------------------------------------------------
// GET /tenants/me — return the caller's tenant, hydrated with settings
// ---------------------------------------------------------------------------
tenantRoutes.get("/me", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId");
  const tenant = await db.query.tenants.findFirst({
    where: eq(schema.tenants.id, tenantId),
    with: { settings: true },
  });
  if (!tenant) throw new NotFoundError("Tenant");
  return c.json({ data: tenant });
});

// ---------------------------------------------------------------------------
// PATCH /tenants/me — update branding / settings (enterprise_admin only)
// ---------------------------------------------------------------------------
tenantRoutes.patch(
  "/me",
  authMiddleware,
  requireRole("enterprise_admin"),
  zValidator("json", updateTenantSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const body = c.req.valid("json");

    const [updated] = await db
      .update(schema.tenants)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(eq(schema.tenants.id, tenantId))
      .returning();

    if (!updated) throw new NotFoundError("Tenant");
    await c.var.audit({
      action: "update",
      resourceType: "tenant",
      resourceId: tenantId,
      metadata: { fields: Object.keys(body) },
    });
    return c.json({ data: updated });
  },
);

// ---------------------------------------------------------------------------
// POST /tenants — super_admin only. Manual tenant provisioning. Normal
// tenant creation happens at /auth/signup.
// ---------------------------------------------------------------------------
tenantRoutes.post(
  "/",
  authMiddleware,
  requireRole("super_admin"),
  zValidator("json", createTenantSchema),
  async (c) => {
    const body = c.req.valid("json");

    const [tenant] = await db
      .insert(schema.tenants)
      .values({
        slug: body.slug,
        name: body.name,
        legalName: body.legalName,
        planTier: body.planTier,
        seatsPurchased: body.seatsPurchased,
        primaryColor: body.primaryColor,
        secondaryColor: body.secondaryColor,
        customDomain: body.customDomain,
      })
      .returning();

    if (!tenant) {
      throw new Error("Failed to create tenant");
    }

    await db.insert(schema.tenantSettings).values({ tenantId: tenant.id });
    await c.var.audit({
      action: "create",
      resourceType: "tenant",
      resourceId: tenant.id,
      metadata: { slug: tenant.slug },
    });
    return c.json({ data: tenant }, 201);
  },
);

// ---------------------------------------------------------------------------
// Org units (regions / zones / branches / teams)
// ---------------------------------------------------------------------------
tenantRoutes.get("/me/org-units", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId");
  const units = await db.query.tenantOrgUnits.findMany({
    where: eq(schema.tenantOrgUnits.tenantId, tenantId),
  });
  return c.json({ data: units });
});

tenantRoutes.post(
  "/me/org-units",
  authMiddleware,
  requireRole("enterprise_admin", "branch_manager"),
  zValidator("json", createOrgUnitSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const body = c.req.valid("json");

    const [unit] = await db
      .insert(schema.tenantOrgUnits)
      .values({
        tenantId,
        parentId: body.parentId,
        kind: body.kind,
        name: body.name,
        code: body.code,
        state: body.state,
        city: body.city,
        latitude: body.latitude,
        longitude: body.longitude,
      })
      .returning();

    if (!unit) throw new Error("Failed to create org unit");
    await c.var.audit({
      action: "create",
      resourceType: "tenant_org_unit",
      resourceId: unit.id,
      metadata: { kind: unit.kind, name: unit.name },
    });
    return c.json({ data: unit }, 201);
  },
);
