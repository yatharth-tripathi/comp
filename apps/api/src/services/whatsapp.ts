import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../lib/env.js";
import { logger } from "../lib/logger.js";

/**
 * Meta Cloud API client for WhatsApp Business.
 *
 * All outbound messages flow through this service. It handles:
 *   - Text messages (agent → customer)
 *   - Template messages (pre-approved marketing/utility templates)
 *   - Media messages (image/video/document with a URL)
 *   - Webhook signature verification
 *
 * Rate limits: Meta enforces per-WABA limits (typically 1,000 business-
 * initiated conversations per 24h for a new number, scaling to 100k+
 * at Tier 4). We do NOT add our own rate limiting on sends because Meta's
 * limits are authoritative and the error codes tell us exactly when to back
 * off.
 *
 * All sends return the Meta `wamid:` message ID which we persist in
 * `whatsapp_messages.waMessageId` for status correlation later.
 */

const config = env();

const WA_API_BASE = "https://graph.facebook.com/v21.0";

// ---------------------------------------------------------------------------
// Low-level fetch wrapper
// ---------------------------------------------------------------------------
interface MetaApiResponse {
  messages?: Array<{ id: string }>;
  contacts?: Array<{ input: string; wa_id: string }>;
  error?: { message: string; type: string; code: number; error_subcode?: number };
}

async function metaSend(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<{ waMessageId: string; waContactId: string }> {
  const url = `${WA_API_BASE}/${config.WHATSAPP_PHONE_NUMBER_ID}/${endpoint}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as MetaApiResponse;

  if (!res.ok || data.error) {
    const errMsg = data.error?.message ?? `Meta API ${res.status}`;
    logger.error(
      { status: res.status, code: data.error?.code, subcode: data.error?.error_subcode },
      `whatsapp.send.failed: ${errMsg}`,
    );
    throw new Error(`WhatsApp send failed: ${errMsg}`);
  }

  return {
    waMessageId: data.messages?.[0]?.id ?? "",
    waContactId: data.contacts?.[0]?.wa_id ?? "",
  };
}

// ---------------------------------------------------------------------------
// Send text message
// ---------------------------------------------------------------------------
export async function sendTextMessage(params: {
  to: string;
  text: string;
}): Promise<{ waMessageId: string }> {
  const result = await metaSend("messages", {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalizePhone(params.to),
    type: "text",
    text: { body: params.text },
  });
  return { waMessageId: result.waMessageId };
}

// ---------------------------------------------------------------------------
// Send template message
// ---------------------------------------------------------------------------
export async function sendTemplateMessage(params: {
  to: string;
  templateName: string;
  languageCode: string;
  headerVariables?: string[];
  bodyVariables?: string[];
  mediaUrl?: string;
}): Promise<{ waMessageId: string }> {
  const components: Array<Record<string, unknown>> = [];

  if (params.headerVariables?.length || params.mediaUrl) {
    const headerParams: Array<Record<string, unknown>> = [];
    if (params.mediaUrl) {
      headerParams.push({ type: "image", image: { link: params.mediaUrl } });
    }
    if (params.headerVariables) {
      for (const v of params.headerVariables) {
        headerParams.push({ type: "text", text: v });
      }
    }
    components.push({ type: "header", parameters: headerParams });
  }

  if (params.bodyVariables?.length) {
    components.push({
      type: "body",
      parameters: params.bodyVariables.map((v) => ({ type: "text", text: v })),
    });
  }

  const result = await metaSend("messages", {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalizePhone(params.to),
    type: "template",
    template: {
      name: params.templateName,
      language: { code: params.languageCode },
      components: components.length > 0 ? components : undefined,
    },
  });
  return { waMessageId: result.waMessageId };
}

// ---------------------------------------------------------------------------
// Send media (image, video, document) with a URL
// ---------------------------------------------------------------------------
export async function sendMediaMessage(params: {
  to: string;
  mediaType: "image" | "video" | "document" | "audio";
  mediaUrl: string;
  caption?: string;
  filename?: string;
}): Promise<{ waMessageId: string }> {
  const mediaPayload: Record<string, unknown> = {
    link: params.mediaUrl,
  };
  if (params.caption) mediaPayload.caption = params.caption;
  if (params.filename) mediaPayload.filename = params.filename;

  const result = await metaSend("messages", {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalizePhone(params.to),
    type: params.mediaType,
    [params.mediaType]: mediaPayload,
  });
  return { waMessageId: result.waMessageId };
}

// ---------------------------------------------------------------------------
// Mark message as read (optional — sets double blue ticks)
// ---------------------------------------------------------------------------
export async function markAsRead(waMessageId: string): Promise<void> {
  await metaSend("messages", {
    messaging_product: "whatsapp",
    status: "read",
    message_id: waMessageId,
  });
}

// ---------------------------------------------------------------------------
// Webhook signature verification
//
// Meta signs the POST body with HMAC-SHA256 using the App Secret.
// Header: X-Hub-Signature-256: sha256=<hex>
// ---------------------------------------------------------------------------
export function verifyWebhookSignature(params: {
  signature: string | undefined;
  rawBody: string;
}): boolean {
  if (!params.signature) return false;
  const expected = createHmac("sha256", config.WHATSAPP_APP_SECRET)
    .update(params.rawBody)
    .digest("hex");
  const provided = params.signature.replace("sha256=", "");
  try {
    return timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(provided, "hex"),
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Phone normalization — strip spaces, dashes, leading + except for
// country code. Meta expects: 919876543210 (no +, no spaces).
// ---------------------------------------------------------------------------
function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-()]/g, "");
  if (cleaned.startsWith("+")) cleaned = cleaned.slice(1);
  // Indian numbers: if starts with 6-9 and is 10 digits, prefix 91
  if (/^[6-9]\d{9}$/.test(cleaned)) cleaned = `91${cleaned}`;
  return cleaned;
}

export { normalizePhone };
