import { z } from "zod";

// ─── Schema ───────────────────────────────────────────────────────────────────
// Every env var the app depends on is declared here. Missing or malformed
// values crash the process on startup (fail fast) rather than surfacing as a
// confusing runtime error three requests later.

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    // ── Database ────────────────────────────────────────────────────────────
    MONGODB_URI: z
      .string()
      .min(1, "MONGODB_URI is required")
      .refine(
        (uri) => uri.startsWith("mongodb://") || uri.startsWith("mongodb+srv://"),
        "MONGODB_URI must start with mongodb:// or mongodb+srv://"
      ),

    // ── JWT ─────────────────────────────────────────────────────────────────
    JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
    JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
    JWT_ACCESS_EXPIRY: z.string().default("7d"),
    JWT_REFRESH_EXPIRY: z.string().default("30d"),

    // ── Auth ────────────────────────────────────────────────────────────────
    BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),

    // ── AI provider ─────────────────────────────────────────────────────────
    AI_PROVIDER: z.enum(["openai", "gemini"]).default("openai"),
    OPENAI_API_KEY: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),

    // ── Cookies ─────────────────────────────────────────────────────────────
    COOKIE_DOMAIN: z.string().optional(),

    // ── Email (Resend) ──────────────────────────────────────────────────────
    RESEND_API_KEY: z.string().optional(), // optional so dev works without it (mailer.ts logs instead of sending)
    EMAIL_FROM: z.string().default("AI Study Assistant <onboarding@resend.dev>"),
    APP_URL: z.string().url().default("http://localhost:3000"),
  })
  .superRefine((data, ctx) => {
    // Cross-field validation: the active provider's key must be present.
    if (data.AI_PROVIDER === "openai" && !data.OPENAI_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["OPENAI_API_KEY"],
        message: "OPENAI_API_KEY is required when AI_PROVIDER=openai",
      });
    }
    if (data.AI_PROVIDER === "gemini" && !data.GEMINI_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["GEMINI_API_KEY"],
        message: "GEMINI_API_KEY is required when AI_PROVIDER=gemini",
      });
    }
    if (data.JWT_ACCESS_SECRET === data.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["JWT_REFRESH_SECRET"],
        message: "JWT_REFRESH_SECRET must differ from JWT_ACCESS_SECRET",
      });
    }
  });

// ─── Parse + fail fast ──────────────────────────────────────────────────────

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("❌ Invalid environment variables:");
  // eslint-disable-next-line no-console
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  throw new Error("Invalid environment variables — see errors above. Check .env against .env.example.");
}

// ─── Typed, exported env object ────────────────────────────────────────────

export const env = parsed.data;
export type Env = typeof env;