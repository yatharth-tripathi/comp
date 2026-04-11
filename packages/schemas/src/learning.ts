import { z } from "zod";

export const journeyTypeSchema = z.enum([
  "onboarding",
  "product",
  "skill",
  "certification",
  "campaign",
]);

export const moduleFormatSchema = z.enum([
  "video_lesson",
  "audio_clip",
  "flashcards",
  "quiz",
  "scenario_case_study",
  "ai_role_play",
  "infographic",
  "webinar",
]);

export const createJourneySchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
  journeyType: journeyTypeSchema,
  targetRoles: z.array(z.string()).default([]),
  durationDays: z.number().int().min(1).max(365).default(30),
  isSequential: z.boolean().default(true),
  isMandatory: z.boolean().default(false),
});
export type CreateJourneyInput = z.infer<typeof createJourneySchema>;

export const createModuleSchema = z.object({
  journeyId: z.string().uuid(),
  title: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
  format: moduleFormatSchema,
  durationMinutes: z.number().int().min(1).max(120).default(5),
  sortOrder: z.number().int().min(0).default(0),
  contentJson: z.record(z.string(), z.unknown()).default({}),
  contentAssetId: z.string().uuid().optional(),
  rolePlayScenarioId: z.string().uuid().optional(),
  minPassingScore: z.number().int().min(0).max(100).default(70),
  xpReward: z.number().int().min(0).max(1000).default(20),
});
export type CreateModuleInput = z.infer<typeof createModuleSchema>;

export const quizQuestionSchema = z.object({
  id: z.string(),
  prompt: z.string().min(1).max(2000),
  options: z.array(z.string().min(1).max(500)).min(2).max(6),
  correctIndex: z.number().int().min(0).max(5),
  explanation: z.string().max(2000).optional(),
});

export const submitQuizSchema = z.object({
  moduleId: z.string().uuid(),
  answers: z.array(z.number().int().nonnegative()),
});
export type SubmitQuizInput = z.infer<typeof submitQuizSchema>;

export const rolePlayStartSchema = z.object({
  scenarioId: z.string().uuid(),
});

export const rolePlayResponseSchema = z.object({
  sessionId: z.string().uuid(),
  response: z.string().min(1).max(4000),
});
export type RolePlayResponseInput = z.infer<typeof rolePlayResponseSchema>;

export const rolePlayEvaluateSchema = z.object({
  sessionId: z.string().uuid(),
});
