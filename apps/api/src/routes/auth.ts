import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { and, db, eq, schema } from "@salescontent/db";
import { loginSchema, signUpSchema } from "@salescontent/schemas";
import { authMiddleware } from "../middleware/auth.js";
import { writeAudit } from "../middleware/audit.js";
import { env } from "../lib/env.js";
import { ConflictError, NotFoundError, UnauthorizedError } from "../lib/errors.js";
import { hashPassword, issueSessionToken, verifyPassword } from "../lib/session.js";

export const authRoutes = new Hono();

function makeSlug(name: string, fallback: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
  return base.length >= 3 ? base : fallback;
}

async function uniqueSlug(base: string): Promise<string> {
  let candidate = base;
  let suffix = 0;
  while (
    await db.query.tenants.findFirst({
      where: eq(schema.tenants.slug, candidate),
      columns: { id: true },
    })
  ) {
    suffix += 1;
    candidate = `${base}-${suffix}`.slice(0, 60);
    if (suffix > 50) throw new Error("Could not generate a unique tenant slug");
  }
  return candidate;
}

function buildSessionResponse(
  token: string,
  expiresAt: Date,
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
  },
  tenant: { id: string; slug: string; name: string },
): {
  token: string;
  expiresAt: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
    tenantId: string;
    tenantSlug: string;
    tenantName: string;
  };
} {
  return {
    token,
    expiresAt: expiresAt.toISOString(),
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      tenantName: tenant.name,
    },
  };
}

// ---------------------------------------------------------------------------
// POST /auth/signup — creates a new tenant and its first enterprise_admin user.
// ---------------------------------------------------------------------------
authRoutes.post("/signup", zValidator("json", signUpSchema), async (c) => {
  const body = c.req.valid("json");
  const baseSlug = makeSlug(body.company.name, `tenant-${Date.now().toString(36)}`);
  const slug = await uniqueSlug(baseSlug);

  const [tenant] = await db
    .insert(schema.tenants)
    .values({
      slug,
      name: body.company.name,
      legalName: body.company.legalName,
      planTier: body.company.planTier,
      seatsPurchased: body.company.seatsPurchased,
      primaryColor: body.company.primaryColor,
    })
    .returning({ id: schema.tenants.id, slug: schema.tenants.slug, name: schema.tenants.name });
  if (!tenant) throw new Error("Failed to create tenant");

  await db.insert(schema.tenantSettings).values({ tenantId: tenant.id });

  const passwordHash = await hashPassword(body.password);

  let insertedUser: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
  };
  try {
    const [row] = await db
      .insert(schema.users)
      .values({
        tenantId: tenant.id,
        email: body.email,
        passwordHash,
        firstName: body.firstName,
        lastName: body.lastName ?? null,
        phone: body.phone,
        role: "enterprise_admin",
        preferredLanguages: body.preferredLanguages,
        active: true,
        personalizationDefaults: {
          displayName: `${body.firstName}${body.lastName ? ` ${body.lastName}` : ""}`,
          displayEmail: body.email,
          displayPhone: body.phone,
        },
      })
      .returning({
        id: schema.users.id,
        email: schema.users.email,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        role: schema.users.role,
      });
    if (!row) throw new Error("Failed to create user");
    insertedUser = row;
  } catch (error) {
    // Roll back the tenant if user creation fails — keeps the table clean.
    await db.delete(schema.tenants).where(eq(schema.tenants.id, tenant.id));
    if (error instanceof Error && /duplicate|unique/i.test(error.message)) {
      throw new ConflictError("An account with this email already exists");
    }
    throw error;
  }

  await db.insert(schema.userXp).values({ userId: insertedUser.id, tenantId: tenant.id });

  const token = await issueSessionToken({
    userId: insertedUser.id,
    tenantId: tenant.id,
    role: insertedUser.role,
  });
  const expiresAt = new Date(Date.now() + env().JWT_EXPIRES_IN_SECONDS * 1000);

  await writeAudit({
    tenantId: tenant.id,
    actorId: insertedUser.id,
    action: "create",
    resourceType: "tenant",
    resourceId: tenant.id,
    metadata: { via: "signup", email: body.email },
  });

  return c.json({ data: buildSessionResponse(token, expiresAt, insertedUser, tenant) }, 201);
});

// ---------------------------------------------------------------------------
// POST /auth/login — returns a fresh JWT for the matched user.
// ---------------------------------------------------------------------------
authRoutes.post("/login", zValidator("json", loginSchema), async (c) => {
  const body = c.req.valid("json");

  const candidates = await db.query.users.findMany({
    where: eq(schema.users.email, body.email),
    columns: {
      id: true,
      email: true,
      passwordHash: true,
      firstName: true,
      lastName: true,
      role: true,
      active: true,
      tenantId: true,
    },
  });

  let matchedUser: (typeof candidates)[number] | undefined;
  if (body.tenantSlug) {
    const tenantRow = await db.query.tenants.findFirst({
      where: eq(schema.tenants.slug, body.tenantSlug),
      columns: { id: true },
    });
    if (!tenantRow) throw new UnauthorizedError("Invalid email or password");
    matchedUser = candidates.find((u) => u.tenantId === tenantRow.id);
  } else if (candidates.length === 1) {
    matchedUser = candidates[0];
  } else if (candidates.length > 1) {
    throw new ConflictError(
      "Multiple accounts share this email. Include tenantSlug in the request to pick one.",
    );
  }

  if (!matchedUser) throw new UnauthorizedError("Invalid email or password");
  const ok = await verifyPassword(body.password, matchedUser.passwordHash);
  if (!ok) throw new UnauthorizedError("Invalid email or password");
  if (!matchedUser.active) throw new UnauthorizedError("Account is not active");

  const tenant = await db.query.tenants.findFirst({
    where: eq(schema.tenants.id, matchedUser.tenantId),
    columns: { id: true, slug: true, name: true, suspended: true },
  });
  if (!tenant) throw new NotFoundError("Tenant");
  if (tenant.suspended) throw new UnauthorizedError("Tenant is suspended");

  const token = await issueSessionToken({
    userId: matchedUser.id,
    tenantId: tenant.id,
    role: matchedUser.role,
  });
  const expiresAt = new Date(Date.now() + env().JWT_EXPIRES_IN_SECONDS * 1000);

  await db
    .update(schema.users)
    .set({ lastActiveAt: new Date() })
    .where(eq(schema.users.id, matchedUser.id));

  await writeAudit({
    tenantId: tenant.id,
    actorId: matchedUser.id,
    action: "login",
    resourceType: "session",
    resourceId: matchedUser.id,
  });

  return c.json({
    data: buildSessionResponse(token, expiresAt, matchedUser, tenant),
  });
});

// ---------------------------------------------------------------------------
// POST /auth/logout — stateless; we just record the event for audit purposes.
// The frontend discards the cookie/token.
// ---------------------------------------------------------------------------
authRoutes.post("/logout", authMiddleware, async (c) => {
  await writeAudit({
    tenantId: c.get("tenantId"),
    actorId: c.get("userId"),
    action: "logout",
    resourceType: "session",
    resourceId: c.get("userId"),
  });
  return c.json({ data: { ok: true } });
});

// ---------------------------------------------------------------------------
// GET /auth/me — hydrate the authenticated user + tenant (for the web bootstrap).
// ---------------------------------------------------------------------------
authRoutes.get("/me", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const tenantId = c.get("tenantId");

  const user = await db.query.users.findFirst({
    where: and(eq(schema.users.id, userId), eq(schema.users.tenantId, tenantId)),
    columns: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      onboardingCompleted: true,
      avatarUrl: true,
    },
  });
  const tenant = await db.query.tenants.findFirst({
    where: eq(schema.tenants.id, tenantId),
    columns: { id: true, slug: true, name: true },
  });
  if (!user || !tenant) throw new NotFoundError("User");

  return c.json({ data: { user, tenant } });
});
