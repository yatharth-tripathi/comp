import { Hono } from "hono";
import { and, db, eq, schema } from "@salescontent/db";
import { env } from "../lib/env.js";
import { logger } from "../lib/logger.js";
import { verifyWebhookSignature, markAsRead } from "../services/whatsapp.js";
import { handleAgentMessage } from "../services/whatsapp-bot.js";

/**
 * WhatsApp webhook receiver (PRD §10).
 *
 * Two endpoints:
 *   GET  /webhooks/whatsapp — Meta verification challenge
 *   POST /webhooks/whatsapp — inbound messages + status updates
 *
 * Every inbound message is:
 *   1. Signature-verified using the App Secret
 *   2. Persisted to `whatsapp_messages` (both inbound and status updates)
 *   3. If it's a text message from a registered agent → routed to the bot
 *   4. If it's a status update (sent/delivered/read/failed) → updates the
 *      original outbound message row
 */

export const whatsappWebhookRoutes = new Hono();

// ---------------------------------------------------------------------------
// GET — Meta webhook verification challenge.
// Meta sends: hub.mode=subscribe, hub.verify_token=<our token>, hub.challenge=<random>
// We respond with the challenge if the token matches.
// ---------------------------------------------------------------------------
whatsappWebhookRoutes.get("/", (c) => {
  const config = env();
  const mode = c.req.query("hub.mode");
  const token = c.req.query("hub.verify_token");
  const challenge = c.req.query("hub.challenge");

  if (mode === "subscribe" && token === config.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    logger.info("whatsapp.webhook.verified");
    return c.text(challenge ?? "", 200);
  }
  logger.warn({ mode, token }, "whatsapp.webhook.verification.failed");
  return c.text("Forbidden", 403);
});

// ---------------------------------------------------------------------------
// POST — inbound messages + delivery status updates.
// ---------------------------------------------------------------------------
whatsappWebhookRoutes.post("/", async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header("x-hub-signature-256");

  // Verify signature
  const valid = verifyWebhookSignature({ signature, rawBody });
  if (!valid) {
    logger.warn("whatsapp.webhook.bad_signature");
    return c.json({ error: "invalid signature" }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return c.json({ error: "invalid json" }, 400);
  }

  const entries = (payload.entry as Array<Record<string, unknown>>) ?? [];

  for (const entry of entries) {
    const changes = (entry.changes as Array<Record<string, unknown>>) ?? [];
    for (const change of changes) {
      const value = change.value as Record<string, unknown>;
      if (!value) continue;

      const metadata = value.metadata as { phone_number_id?: string } | undefined;
      const phoneNumberId = metadata?.phone_number_id;

      // ─── Inbound messages ───
      const messages = (value.messages as Array<Record<string, unknown>>) ?? [];
      for (const msg of messages) {
        const fromPhone = String(msg.from ?? "");
        const waMessageId = String(msg.id ?? "");
        const msgType = String(msg.type ?? "text");
        const timestamp = String(msg.timestamp ?? "");

        // Extract text body
        let bodyText = "";
        if (msgType === "text") {
          bodyText = String((msg.text as Record<string, unknown>)?.body ?? "");
        } else if (msgType === "interactive") {
          const interactive = msg.interactive as Record<string, unknown>;
          const buttonReply = interactive?.button_reply as Record<string, unknown>;
          bodyText = String(buttonReply?.title ?? "");
        }

        // Contacts info
        const contacts = (value.contacts as Array<Record<string, unknown>>) ?? [];
        const contactProfile = contacts[0]?.profile as Record<string, unknown> | undefined;
        const contactName = String(contactProfile?.name ?? fromPhone);

        logger.info(
          { from: fromPhone, type: msgType, waMessageId },
          "whatsapp.inbound",
        );

        // Resolve the sender to a tenant + user (if they're a registered agent)
        const agent = await db.query.users.findFirst({
          where: eq(schema.users.phone, `+${fromPhone}`),
          columns: { id: true, tenantId: true },
        });

        // Fallback: try without the + prefix
        const agentFallback = agent
          ? null
          : await db.query.users.findFirst({
              where: eq(schema.users.phone, fromPhone),
              columns: { id: true, tenantId: true },
            });

        const resolvedAgent = agent ?? agentFallback;

        // Persist inbound message
        await db.insert(schema.whatsappMessages).values({
          tenantId: resolvedAgent?.tenantId ?? undefined,
          direction: "inbound",
          messageType: msgType as "text",
          status: "received",
          fromPhone,
          toPhone: phoneNumberId ?? "",
          waMessageId,
          bodyText,
          rawPayload: msg as Record<string, unknown>,
          senderUserId: resolvedAgent?.id ?? undefined,
          sentAt: timestamp
            ? new Date(parseInt(timestamp, 10) * 1000)
            : new Date(),
        });

        // Mark as read (double blue ticks)
        void markAsRead(waMessageId).catch(() => undefined);

        // Route to bot if the sender is a registered agent
        if (resolvedAgent && bodyText.trim()) {
          try {
            await handleAgentMessage({
              tenantId: resolvedAgent.tenantId,
              agentId: resolvedAgent.id,
              agentPhone: fromPhone,
              messageText: bodyText,
            });
          } catch (err) {
            logger.error({ err, agentId: resolvedAgent.id }, "whatsapp-bot.handler.failed");
          }
        }
      }

      // ─── Status updates ───
      const statuses =
        (value.statuses as Array<Record<string, unknown>>) ?? [];
      for (const status of statuses) {
        const waMessageId = String(status.id ?? "");
        const statusValue = String(status.status ?? "");
        const statusTimestamp = String(status.timestamp ?? "");
        const recipientId = String(status.recipient_id ?? "");

        // Update the outbound message row
        if (waMessageId) {
          const statusDate = statusTimestamp
            ? new Date(parseInt(statusTimestamp, 10) * 1000)
            : new Date();

          const updates: Record<string, unknown> = {
            status: statusValue as "sent",
          };
          if (statusValue === "sent") updates.sentAt = statusDate;
          else if (statusValue === "delivered") updates.deliveredAt = statusDate;
          else if (statusValue === "read") updates.readAt = statusDate;
          else if (statusValue === "failed") {
            const errors = (status.errors as Array<Record<string, unknown>>) ?? [];
            const firstError = errors[0];
            updates.errorCode = String(firstError?.code ?? "");
            updates.errorMessage = String(firstError?.title ?? firstError?.message ?? "");
          }

          await db
            .update(schema.whatsappMessages)
            .set(updates)
            .where(eq(schema.whatsappMessages.waMessageId, waMessageId));
        }

        logger.debug(
          { waMessageId, status: statusValue, recipient: recipientId },
          "whatsapp.status",
        );
      }
    }
  }

  // Meta expects a 200 within 20 seconds or it retries
  return c.json({ ok: true });
});
