import { z } from "zod";
import { indianPhoneSchema, languageSchema } from "./common.js";

export const roleSchema = z.enum([
  "super_admin",
  "enterprise_admin",
  "content_manager",
  "branch_manager",
  "senior_agent",
  "sales_agent",
  "trainee",
]);
export type Role = z.infer<typeof roleSchema>;

export const inviteUserSchema = z.object({
  email: z.string().email().max(254).toLowerCase().trim(),
  initialPassword: z.string().min(8).max(128),
  phone: indianPhoneSchema.optional(),
  firstName: z.string().min(1).max(60),
  lastName: z.string().max(60).optional(),
  role: roleSchema.default("sales_agent"),
  branchId: z.string().uuid().optional(),
  teamId: z.string().uuid().optional(),
  employeeCode: z.string().max(40).optional(),
  designation: z.string().max(80).optional(),
  preferredLanguages: z.array(languageSchema).default(["en"]),
  assignedProducts: z.array(z.string().min(1)).default([]),
  assignedGeographies: z.array(z.string().min(1)).default([]),
});
export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const bulkInviteSchema = z.object({
  rows: z
    .array(inviteUserSchema)
    .min(1)
    .max(1000, "Bulk imports are capped at 1,000 users per call"),
});
export type BulkInviteInput = z.infer<typeof bulkInviteSchema>;

export const updateUserProfileSchema = z.object({
  firstName: z.string().max(60).optional(),
  lastName: z.string().max(60).optional(),
  avatarUrl: z.string().url().optional(),
  personalizationDefaults: z
    .object({
      displayName: z.string().optional(),
      displayPhone: z.string().optional(),
      displayEmail: z.string().optional(),
      photoUrl: z.string().url().optional(),
      branchLabel: z.string().optional(),
    })
    .optional(),
  preferredLanguages: z.array(languageSchema).optional(),
});
export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;

export const assignRoleSchema = z.object({
  role: roleSchema,
});
export type AssignRoleInput = z.infer<typeof assignRoleSchema>;
