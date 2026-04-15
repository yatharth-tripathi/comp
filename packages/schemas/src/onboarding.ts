import { z } from "zod";
import { indianPhoneSchema, languageSchema } from "./common.js";

/**
 * Onboarding — called by an authenticated user to complete their profile and
 * optionally create a branch inside their tenant. The tenant and the user row
 * itself are provisioned at sign-up.
 */
export const completeOnboardingSchema = z.object({
  profile: z.object({
    firstName: z.string().min(1).max(60),
    lastName: z.string().max(60).optional(),
    phone: indianPhoneSchema.optional(),
    employeeCode: z.string().max(40).optional(),
    designation: z.string().max(80).optional(),
    preferredLanguages: z.array(languageSchema).min(1).default(["en"]),
  }),

  work: z
    .object({
      assignedProducts: z.array(z.string().min(1).max(80)).default([]),
      assignedGeographies: z.array(z.string().min(1).max(80)).default([]),
      branchName: z.string().max(120).optional(),
    })
    .default({}),
});
export type CompleteOnboardingInput = z.infer<typeof completeOnboardingSchema>;
