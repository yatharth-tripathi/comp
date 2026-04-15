import { z } from "zod";
import { indianPhoneSchema, languageSchema } from "./common.js";
import { planTierSchema } from "./tenant.js";

// ---------------------------------------------------------------------------
// Auth — email + password. Sign-up provisions a new tenant + admin user.
// ---------------------------------------------------------------------------
export const emailSchema = z.string().email().max(254).toLowerCase().trim();
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters");

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string().min(1).max(60),
  lastName: z.string().max(60).optional(),
  phone: indianPhoneSchema.optional(),
  preferredLanguages: z.array(languageSchema).min(1).default(["en"]),

  company: z.object({
    name: z.string().min(2).max(120),
    legalName: z.string().max(200).optional(),
    planTier: planTierSchema.default("growth"),
    seatsPurchased: z.number().int().min(1).max(200_000).default(50),
    primaryColor: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .optional(),
  }),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
  tenantSlug: z
    .string()
    .min(3)
    .max(60)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const authResponseSchema = z.object({
  token: z.string(),
  expiresAt: z.string().datetime(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    role: z.string(),
    tenantId: z.string().uuid(),
    tenantSlug: z.string(),
    tenantName: z.string(),
  }),
});
export type AuthResponse = z.infer<typeof authResponseSchema>;
