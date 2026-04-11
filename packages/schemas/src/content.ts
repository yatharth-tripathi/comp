import { z } from "zod";
import { isoDateSchema, languageSchema } from "./common.js";

export const contentTypeSchema = z.enum([
  "reel",
  "poster",
  "presentation",
  "document",
  "illustration",
  "battle_card",
  "audio",
  "infographic",
  "email_template",
  "whatsapp_template",
  "gif",
  "certificate",
]);

export const complianceRegimeSchema = z.enum([
  "irdai",
  "sebi",
  "rbi",
  "amfi",
  "pfrda",
  "dpdp",
  "trai",
  "none",
]);

export const tagDimensionSchema = z.enum([
  "industry",
  "product_category",
  "specific_product",
  "sales_stage",
  "customer_persona",
  "language",
  "campaign",
  "geography",
  "channel",
  "compliance_status",
  "difficulty",
]);

export const visibilityScopeSchema = z.object({
  allAgents: z.boolean().optional(),
  teamIds: z.array(z.string().uuid()).optional(),
  branchIds: z.array(z.string().uuid()).optional(),
  regionIds: z.array(z.string().uuid()).optional(),
  roleLevels: z.array(z.string()).optional(),
});

export const createContentAssetSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
  contentType: contentTypeSchema,
  mimeType: z.string().optional(),
  fileBytes: z.number().int().min(0).optional(),
  thumbnailUrl: z.string().url().optional(),
  fileUrl: z.string().url().optional(),

  visibilityScope: visibilityScopeSchema.default({ allAgents: true }),
  complianceRegime: complianceRegimeSchema.default("none"),
  requiresExternalApproval: z.boolean().default(false),
  mandatoryDisclaimers: z.array(z.string()).default([]),
  expiryDate: isoDateSchema.optional(),

  tagIds: z.array(z.string().uuid()).default([]),
});
export type CreateContentAssetInput = z.infer<typeof createContentAssetSchema>;

export const updateContentAssetSchema = createContentAssetSchema.partial();
export type UpdateContentAssetInput = z.infer<typeof updateContentAssetSchema>;

export const contentListQuerySchema = z.object({
  q: z.string().optional(),
  contentType: contentTypeSchema.optional(),
  language: languageSchema.optional(),
  tagIds: z.array(z.string().uuid()).optional(),
  approvalStatus: z
    .enum([
      "draft",
      "pending_internal",
      "pending_compliance",
      "pending_legal",
      "approved",
      "rejected",
      "published",
      "archived",
      "expired",
    ])
    .optional(),
  teamId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ContentListQuery = z.infer<typeof contentListQuerySchema>;

export const presignUploadSchema = z.object({
  filename: z.string().min(1).max(260),
  mimeType: z.string().min(1).max(120),
  sizeBytes: z.number().int().min(1).max(500 * 1024 * 1024), // 500 MB max per PRD §4.1
});
export type PresignUploadInput = z.infer<typeof presignUploadSchema>;

export const shareContentSchema = z.object({
  contentAssetId: z.string().uuid(),
  channel: z.enum(["whatsapp", "email", "sms", "copy_link", "in_app"]),
  recipientName: z.string().min(1).max(120),
  recipientPhone: z.string().optional(),
  relatedLeadId: z.string().uuid().optional(),
  personalizationSnapshot: z.record(z.string(), z.string()).default({}),
});
export type ShareContentInput = z.infer<typeof shareContentSchema>;

export const approveContentSchema = z.object({
  contentAssetId: z.string().uuid(),
  stepName: z.enum(["internal_review", "compliance_review", "legal_review"]),
  decision: z.enum(["approve", "reject"]),
  notes: z.string().max(2000).optional(),
});
export type ApproveContentInput = z.infer<typeof approveContentSchema>;

export const createTagSchema = z.object({
  dimension: tagDimensionSchema,
  value: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Tag values must be lowercase kebab-case"),
  displayLabel: z.string().min(1).max(120),
  parentTagId: z.string().uuid().optional(),
});
export type CreateTagInput = z.infer<typeof createTagSchema>;
