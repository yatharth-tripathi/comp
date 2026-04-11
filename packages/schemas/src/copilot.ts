import { z } from "zod";

export const copilotModeSchema = z.enum([
  "pre_meeting",
  "during_meeting",
  "post_meeting",
  "manager",
  "adhoc",
]);
export type CopilotMode = z.infer<typeof copilotModeSchema>;

export const startCopilotSessionSchema = z.object({
  mode: copilotModeSchema,
  customerName: z.string().min(1).max(120).optional(),
  customerContext: z
    .object({
      age: z.number().int().optional(),
      profession: z.string().optional(),
      income: z.string().optional(),
      lifeStage: z.string().optional(),
      existingProducts: z.array(z.string()).optional(),
    })
    .optional(),
  productFocus: z.string().max(120).optional(),
  leadId: z.string().uuid().optional(),
});
export type StartCopilotSessionInput = z.infer<typeof startCopilotSessionSchema>;

export const copilotQuerySchema = z.object({
  sessionId: z.string().uuid(),
  content: z.string().min(1).max(8000),
  // Allow client to force a fast model for low-complexity asks
  preferFastModel: z.boolean().default(false),
});
export type CopilotQueryInput = z.infer<typeof copilotQuerySchema>;

export const endCopilotSessionSchema = z.object({
  sessionId: z.string().uuid(),
  summary: z.string().max(4000).optional(),
});
export type EndCopilotSessionInput = z.infer<typeof endCopilotSessionSchema>;
