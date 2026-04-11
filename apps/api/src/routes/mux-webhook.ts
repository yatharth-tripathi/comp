import { Hono } from "hono";
import { db, eq, schema, sql } from "@salescontent/db";
import { env } from "../lib/env.js";
import { logger } from "../lib/logger.js";
import { buildThumbnailUrl, getAsset, verifyMuxWebhook } from "../services/mux.js";

/**
 * Mux webhook receiver.
 *
 * We subscribe to:
 *   - video.upload.asset_created  → link upload → asset
 *   - video.asset.ready           → publish the reel with playback id + duration
 *   - video.asset.errored         → mark the reel as errored
 *   - video.asset.deleted         → soft-delete the content asset
 *
 * Signature verification uses the MUX_WEBHOOK_SECRET env var.
 */

interface MuxEvent {
  type: string;
  object?: { type: string; id: string };
  data?: {
    id?: string;
    upload_id?: string;
    asset_id?: string;
    status?: string;
    playback_ids?: Array<{ id: string; policy: string }>;
    duration?: number;
    aspect_ratio?: string;
    errors?: { type: string; messages: string[] };
  };
}

export const muxWebhookRoutes = new Hono();

muxWebhookRoutes.post("/", async (c) => {
  const config = env();
  const rawBody = await c.req.text();
  const signatureHeader = c.req.header("mux-signature");

  const valid = verifyMuxWebhook({
    header: signatureHeader,
    rawBody,
    secret: config.MUX_WEBHOOK_SECRET,
  });
  if (!valid) {
    logger.warn({ signatureHeader }, "mux webhook rejected: bad signature");
    return c.json({ ok: false, error: "invalid signature" }, 401);
  }

  let event: MuxEvent;
  try {
    event = JSON.parse(rawBody) as MuxEvent;
  } catch {
    return c.json({ ok: false, error: "invalid json" }, 400);
  }

  logger.info({ type: event.type, objectId: event.object?.id }, "mux.webhook");

  switch (event.type) {
    case "video.upload.asset_created": {
      // Data shape: { id (upload_id), asset_id, ... }
      const uploadId = event.data?.id;
      const assetId = event.data?.asset_id;
      if (!uploadId || !assetId) break;

      // Find the reel row that reserved this upload
      const reel = await db.query.reels.findFirst({
        where: eq(schema.reels.muxAssetId, uploadId), // we stash upload id in muxAssetId temporarily
        columns: { id: true, tenantId: true, contentAssetId: true },
      });
      if (!reel) {
        logger.warn({ uploadId, assetId }, "mux asset_created for unknown reel");
        break;
      }

      // Swap upload id → real asset id. Asset isn't ready yet; we'll update
      // playback id + duration on video.asset.ready.
      await db
        .update(schema.reels)
        .set({ muxAssetId: assetId, updatedAt: new Date() })
        .where(eq(schema.reels.id, reel.id));
      break;
    }

    case "video.asset.ready": {
      const assetId = event.data?.id;
      if (!assetId) break;

      // Hit Mux for canonical state (the webhook payload has everything but
      // we want to be resilient to payload drift).
      const asset = await getAsset(assetId);
      if (!asset.playbackId) {
        logger.warn({ assetId }, "asset.ready but no public playback id");
        break;
      }

      const reel = await db.query.reels.findFirst({
        where: eq(schema.reels.muxAssetId, assetId),
        columns: { id: true, tenantId: true, contentAssetId: true },
      });
      if (!reel) {
        logger.warn({ assetId }, "asset.ready for unknown reel");
        break;
      }

      await db
        .update(schema.reels)
        .set({
          muxPlaybackId: asset.playbackId,
          durationSeconds: asset.durationSeconds,
          aspectRatio: asset.aspectRatio ?? "9:16",
          updatedAt: new Date(),
        })
        .where(eq(schema.reels.id, reel.id));

      // Also update the backing content_assets row so it passes approval-
      // workflow gating and shows in the content library.
      if (reel.contentAssetId) {
        await db
          .update(schema.contentAssets)
          .set({
            muxAssetId: asset.id,
            muxPlaybackId: asset.playbackId,
            durationSeconds: asset.durationSeconds,
            thumbnailUrl: buildThumbnailUrl(asset.playbackId, {
              time: 1,
              width: 720,
              height: 1280,
              fitMode: "smartcrop",
            }),
            fileUrl: `https://stream.mux.com/${asset.playbackId}.m3u8`,
            approvalStatus: sql`CASE WHEN ${schema.contentAssets.approvalStatus} = 'draft' THEN 'draft'::approval_status ELSE ${schema.contentAssets.approvalStatus} END`,
            updatedAt: new Date(),
          })
          .where(eq(schema.contentAssets.id, reel.contentAssetId));
      }
      break;
    }

    case "video.asset.errored": {
      const assetId = event.data?.id;
      if (!assetId) break;
      logger.error({ assetId, errors: event.data?.errors }, "mux asset errored");
      await db
        .update(schema.reels)
        .set({ updatedAt: new Date() })
        .where(eq(schema.reels.muxAssetId, assetId));
      break;
    }

    case "video.asset.deleted": {
      const assetId = event.data?.id;
      if (!assetId) break;
      const reel = await db.query.reels.findFirst({
        where: eq(schema.reels.muxAssetId, assetId),
        columns: { id: true, contentAssetId: true },
      });
      if (reel?.contentAssetId) {
        await db
          .update(schema.contentAssets)
          .set({ archivedAt: new Date(), approvalStatus: "archived", updatedAt: new Date() })
          .where(eq(schema.contentAssets.id, reel.contentAssetId));
      }
      break;
    }

    default:
      logger.debug({ type: event.type }, "mux webhook ignored");
  }

  return c.json({ ok: true });
});
