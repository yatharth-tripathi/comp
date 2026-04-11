import Mux from "@mux/mux-node";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../lib/env.js";

/**
 * Mux service — handles video asset lifecycle.
 *
 * Architecture note: the browser uploads directly to Mux via a direct-upload
 * URL. The API never proxies video bytes. Mux does transcoding; we only
 * store playback IDs and react to webhooks.
 *
 * Playback policy: all SalesContent AI reels are PUBLIC (no signed URLs)
 * because the value is in the tracking layer around playback, not the video
 * bytes themselves. Compliance overlays are baked in by Mux's MP4 rendition
 * plus frontend-rendered disclaimer layers.
 */

const config = env();

export const mux = new Mux({
  tokenId: config.MUX_TOKEN_ID,
  tokenSecret: config.MUX_TOKEN_SECRET,
});

export interface DirectUploadResult {
  uploadId: string;
  uploadUrl: string;
  expiresAtIso: string;
}

/**
 * Create a Mux Direct Upload. The returned URL is a single-use upload target;
 * the browser PUTs the video bytes straight to Mux. The upload becomes an
 * Asset after transcoding; we hear about that via webhook.
 */
export async function createDirectUpload(params: {
  corsOrigin?: string;
  newAssetSettings?: {
    maxResolutionTier?: "1080p" | "1440p" | "2160p";
    mp4Support?: "none" | "capped-1080p" | "audio-only";
    normalizeAudio?: boolean;
    playbackPolicy?: ("public" | "signed")[];
  };
}): Promise<DirectUploadResult> {
  const upload = await mux.video.uploads.create({
    cors_origin: params.corsOrigin ?? "*",
    new_asset_settings: {
      playback_policy: params.newAssetSettings?.playbackPolicy ?? ["public"],
      mp4_support: params.newAssetSettings?.mp4Support ?? "capped-1080p",
      max_resolution_tier: params.newAssetSettings?.maxResolutionTier ?? "1080p",
      normalize_audio: params.newAssetSettings?.normalizeAudio ?? true,
    },
    test: config.NODE_ENV !== "production" ? true : undefined,
  });

  if (!upload.url) throw new Error("Mux did not return an upload URL");

  // Mux uploads expire 24 hours after creation
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return {
    uploadId: upload.id,
    uploadUrl: upload.url,
    expiresAtIso: expiresAt.toISOString(),
  };
}

/**
 * Fetch upload state by id. Used to resolve which asset an upload turned into.
 */
export async function getUpload(uploadId: string): Promise<{
  id: string;
  status: string;
  assetId?: string | null;
}> {
  const upload = await mux.video.uploads.retrieve(uploadId);
  return {
    id: upload.id,
    status: upload.status,
    assetId: upload.asset_id ?? null,
  };
}

/**
 * Fetch asset details by asset id. Returns playback id, duration, aspect
 * ratio, and status so we can update the reels row.
 */
export async function getAsset(assetId: string): Promise<{
  id: string;
  status: string;
  playbackId: string | null;
  durationSeconds: number;
  aspectRatio: string | null;
  maxStoredResolution: string | null;
}> {
  const asset = await mux.video.assets.retrieve(assetId);
  const publicPlayback =
    asset.playback_ids?.find((p) => p.policy === "public") ?? asset.playback_ids?.[0];
  return {
    id: asset.id,
    status: asset.status,
    playbackId: publicPlayback?.id ?? null,
    durationSeconds: Math.round(asset.duration ?? 0),
    aspectRatio: asset.aspect_ratio ?? null,
    maxStoredResolution: asset.max_stored_resolution ?? null,
  };
}

export async function deleteAsset(assetId: string): Promise<void> {
  await mux.video.assets.delete(assetId);
}

/**
 * Build the HLS playback URL for a given playback id.
 * This is what the frontend <video> element / hls.js feeds on.
 */
export function buildHlsUrl(playbackId: string): string {
  return `https://stream.mux.com/${playbackId}.m3u8`;
}

/**
 * Build the capped-1080p MP4 URL — used as a fallback when hls.js is not
 * available, and for on-device download.
 */
export function buildMp4Url(playbackId: string, quality: "high" | "medium" | "low" = "high"): string {
  return `https://stream.mux.com/${playbackId}/${quality}.mp4`;
}

/**
 * Build the thumbnail URL (JPEG frame at a given timestamp).
 */
export function buildThumbnailUrl(
  playbackId: string,
  opts?: { time?: number; width?: number; height?: number; fitMode?: "preserve" | "crop" | "smartcrop" | "pad" },
): string {
  const params = new URLSearchParams();
  if (opts?.time !== undefined) params.set("time", opts.time.toString());
  if (opts?.width) params.set("width", opts.width.toString());
  if (opts?.height) params.set("height", opts.height.toString());
  if (opts?.fitMode) params.set("fit_mode", opts.fitMode);
  const qs = params.toString();
  return `https://image.mux.com/${playbackId}/thumbnail.jpg${qs ? `?${qs}` : ""}`;
}

/**
 * Verify a Mux webhook signature.
 *
 * Mux sends `mux-signature: t=<unix_ts>,v1=<hex_hmac>`.
 * The HMAC is computed as `HMAC_SHA256(secret, `${timestamp}.${rawBody}`)`.
 *
 * We enforce a 5-minute timestamp skew window to make replay attacks hard.
 */
export function verifyMuxWebhook(params: {
  header: string | undefined;
  rawBody: string;
  secret: string;
  toleranceSeconds?: number;
}): boolean {
  if (!params.header) return false;
  const parts = params.header.split(",").reduce<Record<string, string>>((acc, part) => {
    const [key, value] = part.split("=");
    if (key && value) acc[key.trim()] = value.trim();
    return acc;
  }, {});

  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) return false;

  const tolerance = params.toleranceSeconds ?? 300;
  const age = Math.abs(Math.floor(Date.now() / 1000) - parseInt(timestamp, 10));
  if (Number.isNaN(age) || age > tolerance) return false;

  const expected = createHmac("sha256", params.secret)
    .update(`${timestamp}.${params.rawBody}`)
    .digest("hex");

  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}
