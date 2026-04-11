import { Hono } from "hono";
import { db, eq, schema, sql } from "@salescontent/db";
import { NotFoundError } from "../lib/errors.js";
import { resolveShortCode } from "../services/short-link.js";
import { buildPublicUrl } from "../services/r2.js";

export const publicShareRoutes = new Hono();

// ---------------------------------------------------------------------------
// GET /public/shares/:shortCode/resolve
//
// Public endpoint — NO auth required. Used by the Next.js public /s/:shortCode
// page to render a customer-facing view of whatever was shared.
//
// The route also logs an open event:
//  - increments content_share_events.openCount
//  - upserts lastOpenedAt / firstOpenedAt
//  - inserts a content_share_event_opens row with IP + UA for timing data
// ---------------------------------------------------------------------------
publicShareRoutes.get("/:shortCode/resolve", async (c) => {
  const shortCode = c.req.param("shortCode");
  const resolved = await resolveShortCode(shortCode);
  if (!resolved) throw new NotFoundError("Share");

  const ipAddress =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip") ??
    null;
  const userAgent = c.req.header("user-agent") ?? null;
  const referrer = c.req.header("referer") ?? null;

  if (resolved.kind === "content_share") {
    const now = new Date();
    // Increment open count + update timestamps atomically
    const [updatedShare] = await db
      .update(schema.contentShareEvents)
      .set({
        openCount: sql`${schema.contentShareEvents.openCount} + 1`,
        lastOpenedAt: now,
        firstOpenedAt: sql`COALESCE(${schema.contentShareEvents.firstOpenedAt}, ${now})`,
      })
      .where(eq(schema.contentShareEvents.id, resolved.shareEventId))
      .returning({
        id: schema.contentShareEvents.id,
        resourceKind: schema.contentShareEvents.resourceKind,
        resourceTitle: schema.contentShareEvents.resourceTitle,
        sharedById: schema.contentShareEvents.sharedById,
        personalizationSnapshot: schema.contentShareEvents.personalizationSnapshot,
      });

    await db.insert(schema.contentShareEventOpens).values({
      shareEventId: resolved.shareEventId,
      openedAt: now,
      ipAddress,
      userAgent,
      referrer,
    });

    // Fetch the content asset for the preview + the agent for the badge
    let assetPayload: {
      id: string;
      title: string;
      contentType: string;
      fileUrl: string | null;
      thumbnailUrl: string | null;
      description: string | null;
    } | null = null;

    if (resolved.contentAssetId) {
      const asset = await db.query.contentAssets.findFirst({
        where: eq(schema.contentAssets.id, resolved.contentAssetId),
        columns: {
          id: true,
          title: true,
          contentType: true,
          fileUrl: true,
          thumbnailUrl: true,
          description: true,
        },
      });
      assetPayload = asset ?? null;
    }

    const agent = await db.query.users.findFirst({
      where: eq(schema.users.id, updatedShare?.sharedById ?? ""),
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
        kind: "content_share",
        title: updatedShare?.resourceTitle ?? "",
        asset: assetPayload,
        agent: agent
          ? {
              displayName:
                agent.personalizationDefaults?.displayName ??
                `${agent.firstName ?? ""} ${agent.lastName ?? ""}`.trim(),
              displayPhone:
                agent.personalizationDefaults?.displayPhone ?? agent.phone ?? null,
              displayEmail:
                agent.personalizationDefaults?.displayEmail ?? agent.email ?? null,
              designation: agent.designation,
              photoUrl: agent.personalizationDefaults?.photoUrl ?? agent.avatarUrl,
            }
          : null,
        personalization: updatedShare?.personalizationSnapshot ?? {},
      },
    });
  }

  if (resolved.kind === "illustration") {
    const now = new Date();
    await db
      .update(schema.illustrations)
      .set({
        openCount: sql`${schema.illustrations.openCount} + 1`,
        lastOpenedAt: now,
        firstOpenedAt: sql`COALESCE(${schema.illustrations.firstOpenedAt}, ${now})`,
      })
      .where(eq(schema.illustrations.id, resolved.illustrationId));

    return c.json({
      data: {
        kind: "illustration",
        productType: resolved.productType,
        renderedUrl: resolved.renderedUrl
          ? resolved.renderedUrl.startsWith("http")
            ? resolved.renderedUrl
            : buildPublicUrl(resolved.renderedUrl)
          : null,
      },
    });
  }

  throw new NotFoundError("Share");
});

// ---------------------------------------------------------------------------
// POST /public/shares/:shortCode/callback-request
// A customer viewing a shared illustration/content taps "Request callback".
// We stamp callbackRequestedAt on the share event and (future) enqueue a
// notification to the agent.
// ---------------------------------------------------------------------------
publicShareRoutes.post("/:shortCode/callback-request", async (c) => {
  const shortCode = c.req.param("shortCode");
  const resolved = await resolveShortCode(shortCode);
  if (!resolved) throw new NotFoundError("Share");

  const now = new Date();
  if (resolved.kind === "content_share") {
    await db
      .update(schema.contentShareEvents)
      .set({ callbackRequestedAt: now })
      .where(eq(schema.contentShareEvents.id, resolved.shareEventId));
  } else {
    await db
      .update(schema.illustrations)
      .set({ callbackRequestedAt: now })
      .where(eq(schema.illustrations.id, resolved.illustrationId));
  }
  return c.json({ data: { ok: true } });
});
