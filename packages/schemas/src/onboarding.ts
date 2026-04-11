import { z } from "zod";
import { indianPhoneSchema, languageSchema } from "./common.js";
import { planTierSchema } from "./tenant.js";

/**
 * Onboarding — a single POST that both a) creates the tenant if the caller
 * is the first admin and b) writes the local user row with full profile.
 *
 * Called after the user has signed up with Clerk AND selected/created a
 * Clerk organization on the frontend.
 */
export const completeOnboardingSchema = z.object({
  // Company — only required if the tenant row does not yet exist for this
  // Clerk organization. The API infers this from the Clerk org id.
  company: z
    .object({
      name: z.string().min(2).max(120),
      legalName: z.string().max(200).optional(),
      planTier: planTierSchema.default("growth"),
      primaryColor: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/)
        .optional(),
      seatsPurchased: z.number().int().min(1).max(200_000).default(50),
    })
    .optional(),

  // Personal profile
  profile: z.object({
    firstName: z.string().min(1).max(60),
    lastName: z.string().max(60).optional(),
    phone: indianPhoneSchema.optional(),
    employeeCode: z.string().max(40).optional(),
    designation: z.string().max(80).optional(),
    preferredLanguages: z.array(languageSchema).min(1).default(["en"]),
  }),

  // Agent work assignments
  work: z
    .object({
      assignedProducts: z.array(z.string().min(1).max(80)).default([]),
      assignedGeographies: z.array(z.string().min(1).max(80)).default([]),
      branchName: z.string().max(120).optional(), // creates a tenant_org_unit if given
    })
    .default({}),
});
export type CompleteOnboardingInput = z.infer<typeof completeOnboardingSchema>;
