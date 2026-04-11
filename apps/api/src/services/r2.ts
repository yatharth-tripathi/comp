import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../lib/env.js";

/**
 * Cloudflare R2 client — S3-compatible. Every request is routed to
 * https://<account>.r2.cloudflarestorage.com. Region is always "auto".
 *
 * We do NOT upload from the API. The API issues presigned PUT URLs; the
 * browser uploads straight to R2. This keeps our Railway egress near zero
 * and scales with R2's bandwidth, which is free.
 */

const config = env();

const endpoint = `https://${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

export const r2Client = new S3Client({
  region: "auto",
  endpoint,
  credentials: {
    accessKeyId: config.R2_ACCESS_KEY_ID,
    secretAccessKey: config.R2_SECRET_ACCESS_KEY,
  },
  // R2 requires this explicit override for presigned URL signing to match
  forcePathStyle: false,
});

/**
 * Build a tenant-scoped object key.
 * Every asset lives at `tenants/<tenantId>/content/<contentId>/<filename>`.
 * This naming makes it trivial to scope a purge or a per-tenant lifecycle.
 */
export function buildContentObjectKey(params: {
  tenantId: string;
  contentId: string;
  filename: string;
}): string {
  const safeName = params.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `tenants/${params.tenantId}/content/${params.contentId}/${safeName}`;
}

/**
 * Build the public URL for an asset bound to the custom R2 domain.
 * R2_PUBLIC_BASE_URL is expected to already include the scheme.
 */
export function buildPublicUrl(objectKey: string): string {
  const base = config.R2_PUBLIC_BASE_URL.replace(/\/+$/, "");
  return `${base}/${objectKey}`;
}

/**
 * Generate a presigned PUT URL. Valid for 15 minutes.
 * The client uploads with the exact Content-Type and Content-Length it
 * advertised here — any mismatch fails the signature check on R2.
 */
export async function presignPutUrl(params: {
  objectKey: string;
  contentType: string;
  contentLength: number;
  maxAgeSeconds?: number;
}): Promise<{ url: string; expiresAt: Date }> {
  const command = new PutObjectCommand({
    Bucket: config.R2_BUCKET,
    Key: params.objectKey,
    ContentType: params.contentType,
    ContentLength: params.contentLength,
  });
  const expiresIn = params.maxAgeSeconds ?? 900;
  const url = await getSignedUrl(r2Client, command, { expiresIn });
  return { url, expiresAt: new Date(Date.now() + expiresIn * 1000) };
}

/**
 * Presigned GET for private reads (used for previews before publish).
 */
export async function presignGetUrl(params: {
  objectKey: string;
  maxAgeSeconds?: number;
}): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: config.R2_BUCKET,
    Key: params.objectKey,
  });
  return getSignedUrl(r2Client, command, { expiresIn: params.maxAgeSeconds ?? 600 });
}

export async function objectExists(objectKey: string): Promise<boolean> {
  try {
    await r2Client.send(new HeadObjectCommand({ Bucket: config.R2_BUCKET, Key: objectKey }));
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "name" in error && error.name === "NotFound") {
      return false;
    }
    throw error;
  }
}

export async function deleteObject(objectKey: string): Promise<void> {
  await r2Client.send(new DeleteObjectCommand({ Bucket: config.R2_BUCKET, Key: objectKey }));
}
