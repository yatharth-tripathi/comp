import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { db, eq, schema } from "@salescontent/db";
import { completeOnboardingSchema } from "@salescontent/schemas";
import { NotFoundError } from "../lib/errors.js";
import { authMiddleware } from "../middleware/auth.js";

/**
 * Onboarding route — finalises a signed-up user's profile and optionally
 * creates their primary branch. Runs after /auth/signup, so the tenant and
 * user rows already exist.
 */
export const onboardingRoutes = new Hono();

onboardingRoutes.post(
  "/",
  authMiddleware,
  zValidator("json", completeOnboardingSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const userId = c.get("userId");
    const body = c.req.valid("json");
    const now = new Date();

    let branchId: string | undefined;
    if (body.work.branchName) {
      const [unit] = await db
        .insert(schema.tenantOrgUnits)
        .values({
          tenantId,
          kind: "branch",
          name: body.work.branchName,
        })
        .returning({ id: schema.tenantOrgUnits.id });
      branchId = unit?.id;
    }

    const [updatedUser] = await db
      .update(schema.users)
      .set({
        firstName: body.profile.firstName,
        lastName: body.profile.lastName ?? null,
        phone: body.profile.phone ?? null,
        employeeCode: body.profile.employeeCode ?? null,
        designation: body.profile.designation ?? null,
        branchId: branchId ?? null,
        preferredLanguages: body.profile.preferredLanguages,
        assignedProducts: body.work.assignedProducts,
        assignedGeographies: body.work.assignedGeographies,
        onboardingCompleted: true,
        onboardingCompletedAt: now,
        updatedAt: now,
        personalizationDefaults: {
          displayName: `${body.profile.firstName}${body.profile.lastName ? ` ${body.profile.lastName}` : ""}`,
          displayPhone: body.profile.phone,
          branchLabel: body.work.branchName,
        },
      })
      .where(eq(schema.users.id, userId))
      .returning({ id: schema.users.id });
    if (!updatedUser) throw new NotFoundError("User");

    const tenant = await db.query.tenants.findFirst({
      where: eq(schema.tenants.id, tenantId),
      columns: { id: true, name: true, slug: true },
    });
    if (!tenant) throw new NotFoundError("Tenant");

    await c.var.audit({
      action: "update",
      resourceType: "onboarding",
      resourceId: userId,
      metadata: { branchCreated: Boolean(branchId) },
    });

    return c.json({
      data: {
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
        userId,
        role: c.get("role"),
      },
    });
  },
);
