import { z } from "zod";

export const planTierSchema = z.enum(["starter", "growth", "professional", "enterprise"]);

export const createTenantSchema = z.object({
  slug: z
    .string()
    .min(3)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, digits and hyphens"),
  name: z.string().min(2).max(120),
  legalName: z.string().max(200).optional(),
  planTier: planTierSchema.default("starter"),
  seatsPurchased: z.number().int().min(1).max(200_000).default(50),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  secondaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  customDomain: z
    .string()
    .regex(
      /^(?=.{1,253}$)((?!-)[A-Za-z0-9-]{1,63}(?<!-)\.)+[A-Za-z]{2,}$/,
      "Must be a valid domain name",
    )
    .optional(),
});
export type CreateTenantInput = z.infer<typeof createTenantSchema>;

export const updateTenantSchema = createTenantSchema.partial().extend({
  logoUrl: z.string().url().optional(),
  fontFamily: z.string().optional(),
  requiresComplianceApproval: z.boolean().optional(),
});
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;

export const createOrgUnitSchema = z.object({
  parentId: z.string().uuid().optional(),
  kind: z.enum(["region", "zone", "branch", "team"]),
  name: z.string().min(2).max(120),
  code: z.string().min(1).max(40).optional(),
  state: z.string().max(60).optional(),
  city: z.string().max(80).optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
});
export type CreateOrgUnitInput = z.infer<typeof createOrgUnitSchema>;
