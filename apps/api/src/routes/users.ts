import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { and, db, desc, eq, schema } from "@salescontent/db";
import {
  assignRoleSchema,
  inviteUserSchema,
  updateUserProfileSchema,
} from "@salescontent/schemas";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { ConflictError, NotFoundError } from "../lib/errors.js";
import { hashPassword } from "../lib/session.js";

export const userRoutes = new Hono();

// ---------------------------------------------------------------------------
// GET /users/me — current user profile + xp
// ---------------------------------------------------------------------------
userRoutes.get("/me", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    with: { xp: true, badges: true, branch: true, team: true },
  });
  if (!user) throw new NotFoundError("User");
  return c.json({ data: user });
});

// ---------------------------------------------------------------------------
// PATCH /users/me — update own profile
// ---------------------------------------------------------------------------
userRoutes.patch(
  "/me",
  authMiddleware,
  zValidator("json", updateUserProfileSchema),
  async (c) => {
    const userId = c.get("userId");
    const body = c.req.valid("json");

    const [updated] = await db
      .update(schema.users)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(schema.users.id, userId))
      .returning();

    if (!updated) throw new NotFoundError("User");
    await c.var.audit({
      action: "update",
      resourceType: "user",
      resourceId: userId,
      metadata: { fields: Object.keys(body) },
    });
    return c.json({ data: updated });
  },
);

// ---------------------------------------------------------------------------
// GET /users — list tenant members (admins + branch managers only)
// ---------------------------------------------------------------------------
userRoutes.get(
  "/",
  authMiddleware,
  requireRole("enterprise_admin", "content_manager", "branch_manager"),
  async (c) => {
    const tenantId = c.get("tenantId");
    const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query("pageSize") ?? "20", 10)));
    const role = c.req.query("role");
    const branchId = c.req.query("branchId");

    const conditions = [eq(schema.users.tenantId, tenantId)];
    if (role) {
      conditions.push(eq(schema.users.role, role as "sales_agent"));
    }
    if (branchId) {
      conditions.push(eq(schema.users.branchId, branchId));
    }

    const rows = await db.query.users.findMany({
      where: and(...conditions),
      limit: pageSize,
      offset: (page - 1) * pageSize,
      orderBy: [desc(schema.users.createdAt)],
      with: { xp: true },
    });

    return c.json({ data: rows, meta: { page, pageSize } });
  },
);

// ---------------------------------------------------------------------------
// POST /users/invite — create a teammate with an initial password that the
// admin communicates out-of-band. The invitee can sign in with it immediately.
// ---------------------------------------------------------------------------
userRoutes.post(
  "/invite",
  authMiddleware,
  requireRole("enterprise_admin", "branch_manager"),
  zValidator("json", inviteUserSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const body = c.req.valid("json");

    const existing = await db.query.users.findFirst({
      where: and(eq(schema.users.tenantId, tenantId), eq(schema.users.email, body.email)),
      columns: { id: true },
    });
    if (existing) {
      throw new ConflictError("A user with this email already exists in the tenant");
    }

    const passwordHash = await hashPassword(body.initialPassword);

    const [user] = await db
      .insert(schema.users)
      .values({
        tenantId,
        email: body.email,
        passwordHash,
        firstName: body.firstName,
        lastName: body.lastName,
        phone: body.phone,
        role: body.role,
        branchId: body.branchId,
        teamId: body.teamId,
        employeeCode: body.employeeCode,
        designation: body.designation,
        preferredLanguages: body.preferredLanguages,
        assignedProducts: body.assignedProducts,
        assignedGeographies: body.assignedGeographies,
        active: true,
      })
      .returning();

    if (!user) throw new Error("Failed to create user row");

    await db.insert(schema.userXp).values({ userId: user.id, tenantId });
    await c.var.audit({
      action: "create",
      resourceType: "user",
      resourceId: user.id,
      metadata: { email: body.email, phone: body.phone, role: body.role },
    });

    const { passwordHash: _hidden, ...safeUser } = user;
    void _hidden;
    return c.json({ data: safeUser }, 201);
  },
);

// ---------------------------------------------------------------------------
// PATCH /users/:id/role — reassign (enterprise_admin only)
// ---------------------------------------------------------------------------
userRoutes.patch(
  "/:id/role",
  authMiddleware,
  requireRole("enterprise_admin"),
  zValidator("json", assignRoleSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const targetId = c.req.param("id");
    const { role } = c.req.valid("json");

    const [updated] = await db
      .update(schema.users)
      .set({ role, updatedAt: new Date() })
      .where(and(eq(schema.users.id, targetId), eq(schema.users.tenantId, tenantId)))
      .returning();

    if (!updated) throw new NotFoundError("User");
    await c.var.audit({
      action: "update",
      resourceType: "user",
      resourceId: targetId,
      metadata: { role },
    });
    return c.json({ data: updated });
  },
);
