import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { and, db, desc, eq, schema } from "@salescontent/db";
import {
  sendTemplateMessageSchema,
  sendTextMessageSchema,
} from "@salescontent/schemas";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { NotFoundError } from "../lib/errors.js";
import { normalizePhone, sendTemplateMessage, sendTextMessage } from "../services/whatsapp.js";

export const whatsappSendRoutes = new Hono();

// ---------------------------------------------------------------------------
// POST /api/whatsapp/send-text — agent sends a plain text message
// ---------------------------------------------------------------------------
whatsappSendRoutes.post(
  "/send-text",
  authMiddleware,
  zValidator("json", sendTextMessageSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const userId = c.get("userId");
    const body = c.req.valid("json");

    const { waMessageId } = await sendTextMessage({
      to: body.toPhone,
      text: body.text,
    });

    // Persist outbound message
    await db.insert(schema.whatsappMessages).values({
      tenantId,
      direction: "outbound",
      messageType: "text",
      status: "sent",
      fromPhone: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
      toPhone: normalizePhone(body.toPhone),
      waMessageId,
      bodyText: body.text,
      senderUserId: userId,
      relatedLeadId: body.relatedLeadId,
      sentAt: new Date(),
    });

    await c.var.audit({
      action: "create",
      resourceType: "whatsapp_message",
      metadata: { direction: "outbound", type: "text", to: body.toPhone },
    });

    return c.json({ data: { waMessageId } });
  },
);

// ---------------------------------------------------------------------------
// POST /api/whatsapp/send-template — agent sends a pre-approved template
// ---------------------------------------------------------------------------
whatsappSendRoutes.post(
  "/send-template",
  authMiddleware,
  zValidator("json", sendTemplateMessageSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const userId = c.get("userId");
    const body = c.req.valid("json");

    // Look up the template
    const template = await db.query.whatsappTemplates.findFirst({
      where: and(
        eq(schema.whatsappTemplates.id, body.templateId),
        eq(schema.whatsappTemplates.tenantId, tenantId),
      ),
    });
    if (!template) throw new NotFoundError("Template");

    const { waMessageId } = await sendTemplateMessage({
      to: body.toPhone,
      templateName: template.name,
      languageCode: template.language,
      bodyVariables: Object.values(body.variables),
    });

    await db.insert(schema.whatsappMessages).values({
      tenantId,
      direction: "outbound",
      messageType: "template",
      status: "sent",
      fromPhone: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
      toPhone: normalizePhone(body.toPhone),
      waMessageId,
      bodyText: template.bodyText,
      templateId: template.id,
      templateVariables: body.variables,
      senderUserId: userId,
      relatedLeadId: body.relatedLeadId,
      sentAt: new Date(),
    });

    await c.var.audit({
      action: "create",
      resourceType: "whatsapp_message",
      metadata: { direction: "outbound", type: "template", templateName: template.name },
    });

    return c.json({ data: { waMessageId } });
  },
);

// ---------------------------------------------------------------------------
// GET /api/whatsapp/templates — list templates for the tenant
// ---------------------------------------------------------------------------
whatsappSendRoutes.get("/templates", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId");
  const templates = await db.query.whatsappTemplates.findMany({
    where: eq(schema.whatsappTemplates.tenantId, tenantId),
  });
  return c.json({ data: templates });
});

// ---------------------------------------------------------------------------
// POST /api/whatsapp/templates — sync a template from Meta (admin)
// ---------------------------------------------------------------------------
const syncTemplateSchema = z.object({
  metaTemplateId: z.string().min(1),
  name: z.string().min(1),
  language: z.string().default("en"),
  category: z.string(),
  status: z.string(),
  bodyText: z.string().min(1),
  headerJson: z.record(z.string(), z.unknown()).default({}),
  footerText: z.string().optional(),
  buttonsJson: z.array(z.record(z.string(), z.unknown())).default([]),
});

whatsappSendRoutes.post(
  "/templates",
  authMiddleware,
  requireRole("enterprise_admin"),
  zValidator("json", syncTemplateSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const body = c.req.valid("json");

    const [template] = await db
      .insert(schema.whatsappTemplates)
      .values({ tenantId, ...body })
      .onConflictDoUpdate({
        target: [
          schema.whatsappTemplates.tenantId,
          schema.whatsappTemplates.name,
          schema.whatsappTemplates.language,
        ],
        set: {
          status: body.status,
          bodyText: body.bodyText,
          headerJson: body.headerJson,
          footerText: body.footerText,
          buttonsJson: body.buttonsJson,
          updatedAt: new Date(),
        },
      })
      .returning();

    await c.var.audit({
      action: "create",
      resourceType: "whatsapp_template",
      resourceId: template?.id,
      metadata: { name: body.name },
    });

    return c.json({ data: template }, 201);
  },
);

// ---------------------------------------------------------------------------
// GET /api/whatsapp/messages — conversation history for a lead
// ---------------------------------------------------------------------------
whatsappSendRoutes.get("/messages", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId");
  const leadId = c.req.query("leadId");
  const phone = c.req.query("phone");

  const conditions = [eq(schema.whatsappMessages.tenantId, tenantId)];
  if (leadId) conditions.push(eq(schema.whatsappMessages.relatedLeadId, leadId));
  else if (phone) {
    const normalized = normalizePhone(phone);
    conditions.push(
      eq(schema.whatsappMessages.toPhone, normalized),
    );
  }

  const messages = await db.query.whatsappMessages.findMany({
    where: and(...conditions),
    orderBy: [desc(schema.whatsappMessages.createdAt)],
    limit: 50,
    columns: {
      id: true,
      direction: true,
      messageType: true,
      status: true,
      fromPhone: true,
      toPhone: true,
      bodyText: true,
      sentAt: true,
      deliveredAt: true,
      readAt: true,
      errorMessage: true,
      createdAt: true,
    },
  });

  return c.json({ data: messages });
});

// ---------------------------------------------------------------------------
// POST /api/whatsapp/broadcast — send a template to multiple recipients (admin/manager)
// ---------------------------------------------------------------------------
const broadcastSchema = z.object({
  templateId: z.string().uuid(),
  recipientPhones: z.array(z.string().min(1)).min(1).max(500),
  variables: z.record(z.string(), z.string()).default({}),
});

whatsappSendRoutes.post(
  "/broadcast",
  authMiddleware,
  requireRole("enterprise_admin", "content_manager", "branch_manager"),
  zValidator("json", broadcastSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const userId = c.get("userId");
    const body = c.req.valid("json");

    const template = await db.query.whatsappTemplates.findFirst({
      where: and(
        eq(schema.whatsappTemplates.id, body.templateId),
        eq(schema.whatsappTemplates.tenantId, tenantId),
      ),
    });
    if (!template) throw new NotFoundError("Template");

    let sent = 0;
    let failed = 0;

    for (const phone of body.recipientPhones) {
      try {
        const { waMessageId } = await sendTemplateMessage({
          to: phone,
          templateName: template.name,
          languageCode: template.language,
          bodyVariables: Object.values(body.variables),
        });

        await db.insert(schema.whatsappMessages).values({
          tenantId,
          direction: "outbound",
          messageType: "template",
          status: "sent",
          fromPhone: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
          toPhone: normalizePhone(phone),
          waMessageId,
          bodyText: template.bodyText,
          templateId: template.id,
          templateVariables: body.variables,
          senderUserId: userId,
          sentAt: new Date(),
        });
        sent += 1;
      } catch {
        failed += 1;
      }
    }

    await c.var.audit({
      action: "create",
      resourceType: "whatsapp_broadcast",
      metadata: {
        templateName: template.name,
        total: body.recipientPhones.length,
        sent,
        failed,
      },
    });

    return c.json({ data: { sent, failed, total: body.recipientPhones.length } });
  },
);
