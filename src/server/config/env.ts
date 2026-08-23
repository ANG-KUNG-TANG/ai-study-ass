import { z } from "zod";

// Central environment contract. Core application settings fail fast, while AI
// credentials remain optional because the symbolic pipeline must work without
// a provider account or when provider quota is exhausted.
const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    MONGODB_URI: z
      .string()
      .min(1, "MONGODB_URI is required")
      .refine(
        (uri) => uri.startsWith("mongodb://") || uri.startsWith("mongodb+srv://"),
        "MONGODB_URI must start with mongodb:// or mongodb+srv://",
      ),

    JWT_ACCESS_SECRET: z
      .string()
      .min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
    JWT_REFRESH_SECRET: z
      .string()
      .min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
    JWT_ACCESS_EXPIRY: z.string().default("15m"),
    JWT_REFRESH_EXPIRY: z.string().default("30d"),

    BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),

    AI_PROVIDER: z.enum(["openai", "gemini"]).default("openai"),
    OPENAI_API_KEY: z.string().optional(),
    OPENAI_MODEL: z.string().default("gpt-4o-mini"),
    GEMINI_API_KEY: z.string().optional(),
    GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
    AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
    AI_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),

    TRUST_CLOUDFLARE_PROXY: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),

    COOKIE_DOMAIN: z.string().optional(),

    EMAIL_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z
      .string()
      .min(1, "EMAIL_FROM cannot be empty")
      .default("AI Study Assistant <onboarding@resend.dev>"),
    EMAIL_REPLY_TO: z.string().email().optional().or(z.literal("")),
    APP_URL: z.string().url().default("http://localhost:3000"),
  })
  .superRefine((data, ctx) => {
    if (data.JWT_ACCESS_SECRET === data.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["JWT_REFRESH_SECRET"],
        message: "JWT_REFRESH_SECRET must differ from JWT_ACCESS_SECRET",
      });
    }

    if (data.EMAIL_ENABLED && !data.RESEND_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["RESEND_API_KEY"],
        message: "RESEND_API_KEY is required when EMAIL_ENABLED is true",
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  throw new Error(
    "Invalid environment variables — check .env against .env.example.",
  );
}

export const env = parsed.data;
export type Env = typeof env;
