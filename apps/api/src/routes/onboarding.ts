import { zValidator } from "@hono/zod-validator";
import { createClerkClient, verifyToken } from "@clerk/backend";
import { Hono } from "hono";
import { and, db, eq, schema } from "@salescontent/db";
import { completeOnboardingSchema } from "@salescontent/schemas";
import { env } from "../lib/env.js";
import { ConflictError, ForbiddenError, UnauthorizedError } from "../lib/errors.js";
import { writeAudit } from "../middleware/audit.js";

/**
 * Onboarding route.
 *
 * Called once, by a newly signed-up Clerk user who either:
 *   a) has just created a Clerk organization (they become enterprise_admin
 *      and we provision the tenant row + settings + org units + their user row), or
 *   b) accepted an invite to an existing org (tenant row already exists,
 *      we only write their local user row — though this normally happens
 *      automatically via the Clerk webhook).
 *
 * This route is NOT behind `authMiddleware` because the user row does not
 * exist yet — authMiddleware would reject them. We verify the Clerk JWT
 * directly here, then trust the claims.
 */

const config = env();
const clerk = createClerkClient({ secretKey: config.CLERK_SECRET_KEY });

export const onboardingRoutes = new Hono();

onboardingRoutes.post("/", zValidator("json", completeOnboardingSchema), async (c) => {
  const authHeader = c.req.header("authorization");
  const bearer = authHeader?.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : undefined;
  if (!bearer) throw new UnauthorizedError("Missing bearer token");

  // Verify the Clerk JWT directly
  let clerkUserId: string;
  let clerkOrgId: string | undefined;
  let claimedRole: string | undefined;
  try {
    const payload = await verifyToken(bearer, { secretKey: config.CLERK_SECRET_KEY });
    clerkUserId = payload.sub;
    const raw = payload as unknown as Record<string, unknown>;
    clerkOrgId = typeof raw.org_id === "string" ? raw.org_id : undefined;
    claimedRole = typeof raw.org_role === "string" ? raw.org_role : undefined;
  } catch {
    throw new UnauthorizedError("Invalid session token");
  }

  if (!clerkOrgId) {
    throw new ForbiddenError(
      "Select or create an organization in Clerk before completing onboarding",
    );
  }

  // Load the Clerk user + org for canonical data
  const [clerkUser, clerkOrg] = await Promise.all([
    clerk.users.getUser(clerkUserId),
    clerk.organizations.getOrganization({ organizationId: clerkOrgId }),
  ]);

  const body = c.req.valid("json");
  const now = new Date();

  // Transactional-ish upsert: tenant first, then user, then XP, then audit.
  // Neon HTTP driver doesn't support multi-statement transactions over the
  // wire, so we do ordered inserts and rely on idempotent upserts.

  // -------- Tenant --------
  let tenant = await db.query.tenants.findFirst({
    where: eq(schema.tenants.clerkOrgId, clerkOrgId),
    columns: { id: true, name: true, slug: true },
  });

  if (!tenant) {
    if (!body.company) {
      throw new ConflictError(
        "Tenant does not exist yet for this organization. Include `company` in the onboarding payload.",
      );
    }
    const insertedTenants = await db
      .insert(schema.tenants)
      .values({
        clerkOrgId,
        slug: clerkOrg.slug ?? clerkOrgId.slice(0, 20).toLowerCase(),
        name: body.company.name,
        legalName: body.company.legalName,
        planTier: body.company.planTier,
        seatsPurchased: body.company.seatsPurchased,
        primaryColor: body.company.primaryColor,
        logoUrl: clerkOrg.imageUrl ?? undefined,
      })
      .onConflictDoNothing({ target: schema.tenants.clerkOrgId })
      .returning();
    // If the upsert conflicted because another request landed first, fall back to a read
    tenant =
      insertedTenants[0] ??
      (await db.query.tenants.findFirst({
        where: eq(schema.tenants.clerkOrgId, clerkOrgId),
        columns: { id: true, name: true, slug: true },
      })) ??
      undefined;
    if (!tenant) throw new Error("Tenant upsert failed");

    await db
      .insert(schema.tenantSettings)
      .values({ tenantId: tenant.id })
      .onConflictDoNothing();
  }

  // -------- Optional branch --------
  let branchId: string | undefined;
  if (body.work.branchName) {
    const [unit] = await db
      .insert(schema.tenantOrgUnits)
      .values({
        tenantId: tenant.id,
        kind: "branch",
        name: body.work.branchName,
      })
      .returning({ id: schema.tenantOrgUnits.id });
    branchId = unit?.id;
  }

  // -------- User row --------
  // The Clerk webhook may have already created a stub user row. Upsert by
  // (tenantId, clerkUserId).
  const primaryEmail = clerkUser.emailAddresses.find(
    (e) => e.id === clerkUser.primaryEmailAddressId,
  )?.emailAddress;
  const primaryPhone = clerkUser.phoneNumbers.find(
    (p) => p.id === clerkUser.primaryPhoneNumberId,
  )?.phoneNumber;

  const mappedRole =
    claimedRole === "org:admin" || claimedRole === "admin"
      ? "enterprise_admin"
      : "sales_agent";

  const upsertedUsers = await db
    .insert(schema.users)
    .values({
      tenantId: tenant.id,
      clerkUserId,
      firstName: body.profile.firstName,
      lastName: body.profile.lastName,
      email: primaryEmail ?? undefined,
      phone: body.profile.phone ?? primaryPhone ?? undefined,
      avatarUrl: clerkUser.imageUrl ?? undefined,
      employeeCode: body.profile.employeeCode,
      designation: body.profile.designation,
      branchId,
      role: mappedRole,
      preferredLanguages: body.profile.preferredLanguages,
      assignedProducts: body.work.assignedProducts,
      assignedGeographies: body.work.assignedGeographies,
      active: true,
      onboardingCompleted: true,
      onboardingCompletedAt: now,
      personalizationDefaults: {
        displayName: `${body.profile.firstName}${body.profile.lastName ? ` ${body.profile.lastName}` : ""}`,
        displayEmail: primaryEmail ?? undefined,
        displayPhone: body.profile.phone ?? primaryPhone ?? undefined,
        photoUrl: clerkUser.imageUrl ?? undefined,
        branchLabel: body.work.branchName,
      },
    })
    .onConflictDoUpdate({
      target: [schema.users.tenantId, schema.users.clerkUserId],
      set: {
        firstName: body.profile.firstName,
        lastName: body.profile.lastName,
        phone: body.profile.phone ?? undefined,
        employeeCode: body.profile.employeeCode,
        designation: body.profile.designation,
        branchId: branchId ?? undefined,
        role: mappedRole,
        preferredLanguages: body.profile.preferredLanguages,
        assignedProducts: body.work.assignedProducts,
        assignedGeographies: body.work.assignedGeographies,
        active: true,
        onboardingCompleted: true,
        onboardingCompletedAt: now,
        updatedAt: now,
      },
    })
    .returning({ id: schema.users.id });
  const userId = upsertedUsers[0]?.id;
  if (!userId) throw new Error("User upsert failed");

  await db
    .insert(schema.userXp)
    .values({ userId, tenantId: tenant.id })
    .onConflictDoNothing();

  await writeAudit({
    tenantId: tenant.id,
    actorId: userId,
    action: "create",
    resourceType: "onboarding",
    resourceId: userId,
    metadata: {
      role: mappedRole,
      branchCreated: Boolean(branchId),
      tenantCreated: Boolean(body.company),
    },
  });

  return c.json(
    {
      data: {
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
        userId,
        role: mappedRole,
      },
    },
    201,
  );
});

// Keep `and` reference so future expansion (branch lookup by name) is a tiny diff
void and;
