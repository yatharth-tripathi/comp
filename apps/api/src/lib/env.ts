import { z } from "zod";

/**
 * Validated environment contract for apps/api.
 * Startup fails loud if any required var is missing. This is intentional —
 * we do not want a half-configured production service limping along.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error"]).default("info"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(8787),

  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Auth
  CLERK_SECRET_KEY: z.string().min(1, "CLERK_SECRET_KEY is required"),
  CLERK_PUBLISHABLE_KEY: z.string().min(1, "CLERK_PUBLISHABLE_KEY is required"),
  CLERK_WEBHOOK_SECRET: z.string().optional(),

  // AI
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),
  ANTHROPIC_MODEL_DEFAULT: z.string().default("claude-sonnet-4-5"),
  ANTHROPIC_MODEL_FAST: z.string().default("claude-haiku-4-5"),
  CLAUDE_DAILY_CAP_USD: z.coerce.number().min(0).default(25),

  // Cache + queue
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  QSTASH_TOKEN: z.string().min(1),
  QSTASH_CURRENT_SIGNING_KEY: z.string().min(1),
  QSTASH_NEXT_SIGNING_KEY: z.string().min(1),

  // Storage
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
  R2_PUBLIC_BASE_URL: z.string().url(),

  // Video
  MUX_TOKEN_ID: z.string().min(1),
  MUX_TOKEN_SECRET: z.string().min(1),
  MUX_WEBHOOK_SECRET: z.string().min(1),

  // Search
  TYPESENSE_HOST: z.string().min(1),
  TYPESENSE_PORT: z.coerce.number().int().default(443),
  TYPESENSE_PROTOCOL: z.enum(["http", "https"]).default("https"),
  TYPESENSE_API_KEY: z.string().min(1),
  TYPESENSE_SEARCH_ONLY_KEY: z.string().min(1),

  // WhatsApp
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(1),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().min(1),
  WHATSAPP_ACCESS_TOKEN: z.string().min(1),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().min(1),
  WHATSAPP_APP_SECRET: z.string().min(1),

  // Rate limit
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(1).default(60),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).default(120),

  // Internal
  API_INTERNAL_SECRET: z.string().min(16),
  SENTRY_DSN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const lines = Object.entries(flat).map(
      ([key, errs]) => `  ${key}: ${(errs ?? []).join(", ")}`,
    );
    console.error(
      `\n[env] Invalid environment configuration. Copy .env.example to .env and set:\n${lines.join("\n")}\n`,
    );
    process.exit(1);
  }
  cached = parsed.data;
  return cached;
}
