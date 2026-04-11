import { z } from "zod";
import { indianPhoneSchema } from "./common.js";

export const leadStageSchema = z.enum([
  "new",
  "contacted",
  "interested",
  "meeting_scheduled",
  "proposal_sent",
  "under_consideration",
  "closed_won",
  "closed_lost",
  "dormant",
]);
export type LeadStage = z.infer<typeof leadStageSchema>;

export const createLeadSchema = z.object({
  fullName: z.string().min(2).max(120),
  phone: indianPhoneSchema.optional(),
  email: z.string().email().optional(),
  age: z.number().int().min(16).max(100).optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  city: z.string().max(80).optional(),
  state: z.string().max(60).optional(),
  profession: z.string().max(120).optional(),
  incomeRange: z.string().max(60).optional(),
  existingInvestments: z.array(z.string()).default([]),
  dependents: z.number().int().min(0).max(20).optional(),
  riskAppetite: z.enum(["low", "moderate", "high"]).optional(),
  stage: leadStageSchema.default("new"),
  source: z
    .enum(["manual", "card_scan", "wa_import", "web_form", "campaign", "qr"])
    .default("manual"),
  sourceMetadata: z.record(z.string(), z.unknown()).default({}),
});
export type CreateLeadInput = z.infer<typeof createLeadSchema>;

export const updateLeadSchema = createLeadSchema.partial();
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;

export const leadActivitySchema = z.object({
  kind: z.enum([
    "call",
    "whatsapp",
    "sms",
    "email",
    "meeting",
    "content_share",
    "illustration_share",
    "note",
    "follow_up",
    "stage_change",
  ]),
  notes: z.string().max(4000).optional(),
  scheduledFor: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  contentShareEventId: z.string().uuid().optional(),
  illustrationId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type LeadActivityInput = z.infer<typeof leadActivitySchema>;

export const leadListQuerySchema = z.object({
  stage: leadStageSchema.optional(),
  q: z.string().optional(),
  assignedTo: z.string().uuid().optional(),
  nextFollowUpBefore: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type LeadListQuery = z.infer<typeof leadListQuerySchema>;
