import { Hono } from "hono";
import { db, eq, schema, sql } from "@salescontent/db";
import { NotFoundError } from "../lib/errors.js";

export const publicIllustrationRoutes = new Hono();

/**
 * GET /public/illustrations/:shortCode
 *
 * The single public endpoint that hydrates the customer-facing illustration
 * view. Called server-side by the Next.js /i/[shortCode] page.
 *
 * Side-effect: increments the open counter atomically, records
 * firstOpenedAt via COALESCE, bumps lastOpenedAt. No auth — tenant is
 * inferred from the illustration row.
 *
 * Returns the full outputJson + agent card (displayName, phone, email,
 * designation, photo) so the customer sees who sent them this plan.
 */
publicIllustrationRoutes.get("/:shortCode", async (c) => {
  const shortCode = c.req.param("shortCode");

  const illustration = await db.query.illustrations.findFirst({
    where: eq(schema.illustrations.shortCode, shortCode),
    columns: {
      id: true,
      productType: true,
      customerName: true,
      outputJson: true,
      agentId: true,
      tenantId: true,
    },
  });
  if (!illustration) throw new NotFoundError("Illustration");

  // Log the open atomically
  const now = new Date();
  await db
    .update(schema.illustrations)
    .set({
      openCount: sql`${schema.illustrations.openCount} + 1`,
      lastOpenedAt: now,
      firstOpenedAt: sql`COALESCE(${schema.illustrations.firstOpenedAt}, ${now})`,
    })
    .where(eq(schema.illustrations.id, illustration.id));

  // Hydrate the agent card
  const agent = await db.query.users.findFirst({
    where: eq(schema.users.id, illustration.agentId),
    columns: {
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      designation: true,
      avatarUrl: true,
      personalizationDefaults: true,
    },
  });

  return c.json({
    data: {
      id: illustration.id,
      productType: illustration.productType,
      customerName: illustration.customerName,
      outputJson: illustration.outputJson,
      agent: agent
        ? {
            displayName:
              agent.personalizationDefaults?.displayName ??
              `${agent.firstName ?? ""} ${agent.lastName ?? ""}`.trim() ||
              "Your advisor",
            displayPhone: agent.personalizationDefaults?.displayPhone ?? agent.phone,
            displayEmail: agent.personalizationDefaults?.displayEmail ?? agent.email,
            designation: agent.designation,
            photoUrl: agent.personalizationDefaults?.photoUrl ?? agent.avatarUrl,
          }
        : {
            displayName: "Your advisor",
            displayPhone: null,
            displayEmail: null,
            designation: null,
            photoUrl: null,
          },
    },
  });
});
