import { z } from "zod";

// ---------------------------------------------------------------------------
// Common primitives
// ---------------------------------------------------------------------------
export const uuidSchema = z.string().uuid();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortDir: z.enum(["asc", "desc"]).optional().default("desc"),
});
export type Pagination = z.infer<typeof paginationSchema>;

export const indianPhoneSchema = z
  .string()
  .regex(
    /^(\+?91)?[6-9]\d{9}$/,
    "Must be a valid Indian mobile number (10 digits starting 6–9, optional +91)",
  );

export const languageSchema = z.enum([
  "en",
  "hi",
  "mr",
  "ta",
  "te",
  "gu",
  "bn",
  "kn",
  "ml",
  "pa",
]);
export type Language = z.infer<typeof languageSchema>;

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD date");

// ---------------------------------------------------------------------------
// Envelope used by every API response
// ---------------------------------------------------------------------------
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
    requestId: z.string().optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export function okEnvelope<T extends z.ZodTypeAny>(data: T) {
  return z.object({
    data,
    meta: z
      .object({
        requestId: z.string().optional(),
        tookMs: z.number().optional(),
      })
      .optional(),
  });
}
