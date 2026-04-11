import { z } from "zod";
import { indianPhoneSchema } from "./common.js";

export const whatsappWebhookPayloadSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(
    z.object({
      id: z.string(),
      changes: z.array(
        z.object({
          value: z.object({
            messaging_product: z.literal("whatsapp").optional(),
            metadata: z
              .object({
                display_phone_number: z.string().optional(),
                phone_number_id: z.string(),
              })
              .optional(),
            contacts: z
              .array(
                z.object({
                  wa_id: z.string(),
                  profile: z.object({ name: z.string().optional() }).optional(),
                }),
              )
              .optional(),
            messages: z
              .array(
                z.object({
                  id: z.string(),
                  from: z.string(),
                  timestamp: z.string(),
                  type: z.string(),
                  text: z.object({ body: z.string() }).optional(),
                  image: z
                    .object({
                      id: z.string(),
                      mime_type: z.string().optional(),
                      caption: z.string().optional(),
                    })
                    .optional(),
                  interactive: z.unknown().optional(),
                  button: z.unknown().optional(),
                }),
              )
              .optional(),
            statuses: z
              .array(
                z.object({
                  id: z.string(),
                  status: z.enum(["sent", "delivered", "read", "failed"]),
                  timestamp: z.string(),
                  recipient_id: z.string(),
                  conversation: z
                    .object({ id: z.string(), origin: z.object({ type: z.string() }).optional() })
                    .optional(),
                  errors: z
                    .array(
                      z.object({
                        code: z.number(),
                        title: z.string(),
                        message: z.string().optional(),
                      }),
                    )
                    .optional(),
                }),
              )
              .optional(),
          }),
          field: z.string(),
        }),
      ),
    }),
  ),
});
export type WhatsappWebhookPayload = z.infer<typeof whatsappWebhookPayloadSchema>;

export const sendTemplateMessageSchema = z.object({
  toPhone: indianPhoneSchema,
  templateId: z.string().uuid(),
  variables: z.record(z.string(), z.string()).default({}),
  relatedLeadId: z.string().uuid().optional(),
});
export type SendTemplateMessageInput = z.infer<typeof sendTemplateMessageSchema>;

export const sendTextMessageSchema = z.object({
  toPhone: indianPhoneSchema,
  text: z.string().min(1).max(4096),
  relatedLeadId: z.string().uuid().optional(),
});
export type SendTextMessageInput = z.infer<typeof sendTextMessageSchema>;

export const broadcastSchema = z.object({
  templateId: z.string().uuid(),
  targetRoles: z.array(z.string()).default([]),
  targetTeamIds: z.array(z.string().uuid()).default([]),
  variables: z.record(z.string(), z.string()).default({}),
});
