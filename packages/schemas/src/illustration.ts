import { z } from "zod";

export const illustrationProductSchema = z.enum([
  "term_plan",
  "ulip",
  "health_insurance",
  "home_loan",
  "sip",
  "mutual_fund",
  "credit_card",
  "auto_loan",
  "personal_loan",
]);
export type IllustrationProduct = z.infer<typeof illustrationProductSchema>;

export const termPlanInputSchema = z.object({
  customerName: z.string().min(1).max(120),
  customerAge: z.number().int().min(18).max(75),
  customerGender: z.enum(["male", "female", "other"]),
  smoker: z.boolean().default(false),
  sumAssured: z.number().int().min(500_000).max(500_000_000), // ₹5L–₹50Cr
  policyTermYears: z.number().int().min(5).max(40),
  premiumPaymentTermYears: z.number().int().min(5).max(40),
  riders: z
    .object({
      accidentalDeath: z.boolean().default(false),
      criticalIllness: z.boolean().default(false),
      waiverOfPremium: z.boolean().default(false),
    })
    .default({}),
});
export type TermPlanInput = z.infer<typeof termPlanInputSchema>;

export const healthInsuranceInputSchema = z.object({
  customerName: z.string().min(1).max(120),
  policyType: z.enum(["individual", "floater"]),
  family: z
    .array(
      z.object({
        relation: z.enum(["self", "spouse", "child", "parent"]),
        age: z.number().int().min(0).max(100),
      }),
    )
    .min(1)
    .max(12),
  sumInsured: z.number().int().min(100_000).max(50_000_000),
  addons: z
    .object({
      opd: z.boolean().default(false),
      maternity: z.boolean().default(false),
      criticalIllness: z.boolean().default(false),
      roomUpgrade: z.boolean().default(false),
    })
    .default({}),
});
export type HealthInsuranceInput = z.infer<typeof healthInsuranceInputSchema>;

export const sipInputSchema = z.object({
  customerName: z.string().min(1).max(120),
  monthlyAmount: z.number().int().min(500).max(10_000_000),
  durationYears: z.number().int().min(1).max(40),
  expectedReturnPct: z.number().min(1).max(25),
  goalLabel: z.string().max(120).optional(),
});
export type SipInput = z.infer<typeof sipInputSchema>;

export const homeLoanInputSchema = z.object({
  customerName: z.string().min(1).max(120),
  propertyValue: z.number().int().min(500_000),
  loanAmount: z.number().int().min(100_000),
  tenureYears: z.number().int().min(1).max(30),
  interestRatePct: z.number().min(5).max(20),
  processingFeePct: z.number().min(0).max(5).default(0.5),
});
export type HomeLoanInput = z.infer<typeof homeLoanInputSchema>;

export const createIllustrationSchema = z.discriminatedUnion("productType", [
  z.object({ productType: z.literal("term_plan"), input: termPlanInputSchema }),
  z.object({ productType: z.literal("health_insurance"), input: healthInsuranceInputSchema }),
  z.object({ productType: z.literal("sip"), input: sipInputSchema }),
  z.object({ productType: z.literal("home_loan"), input: homeLoanInputSchema }),
]);
export type CreateIllustrationInput = z.infer<typeof createIllustrationSchema>;
