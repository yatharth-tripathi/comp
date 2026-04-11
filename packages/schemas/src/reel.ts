import { z } from "zod";
import { languageSchema } from "./common.js";

export const createReelSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
  language: languageSchema.default("en"),
  teleprompterScript: z.string().max(5000).optional(),
  teleprompterScenario: z.string().max(500).optional(),
  tagIds: z.array(z.string().uuid()).default([]),
  isMandatory: z.boolean().default(false),
  mandatoryForRoles: z.array(z.string()).default([]),
  mandatoryForTeamIds: z.array(z.string().uuid()).default([]),
  mandatoryDueDate: z.string().datetime().optional(),
});
export type CreateReelInput = z.infer<typeof createReelSchema>;

export const muxDirectUploadSchema = z.object({
  corsOrigin: z.string().url().optional(),
});
export type MuxDirectUploadInput = z.infer<typeof muxDirectUploadSchema>;

export const reelPlaybackEventSchema = z.object({
  reelId: z.string().uuid(),
  startedAtMs: z.number().int().nonnegative(),
  lastPositionSec: z.number().int().nonnegative(),
  completionPctBps: z.number().int().min(0).max(10_000),
  deviceKind: z.enum(["mobile", "tablet", "desktop"]).optional(),
});
export type ReelPlaybackEvent = z.infer<typeof reelPlaybackEventSchema>;

export const teleprompterScriptRequestSchema = z.object({
  productName: z.string().min(1).max(200),
  customerPersona: z.string().min(1).max(200),
  language: languageSchema.default("en"),
  durationSeconds: z.number().int().min(15).max(120).default(60),
});
export type TeleprompterScriptRequest = z.infer<typeof teleprompterScriptRequestSchema>;
