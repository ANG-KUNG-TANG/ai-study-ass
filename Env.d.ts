// Argument NodeJS.Process so process.env keys are typed throughout the project.
// Actual runtime validation happens in src/server/config/env.ts — this is IDE
// support only. Prefer importing the validated `env` object over raw
// process.env wherever possible; these types exist for the rare cases that
// read process.env directly before validation runs.

declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: "development" | "production" | "test";
    MONGODB_URI: string;

    JWT_ACCESS_SECRET: string;
    JWT_REFRESH_SECRET: string;
    JWT_ACCESS_EXPIRY?: string;
    JWT_REFRESH_EXPIRY?: string;

    AI_PROVIDER?: "openai" | "gemini";
    OPENAI_API_KEY?: string;
    GEMINI_API_KEY?: string;
    INTELLIGENCE_V2_ENABLED?: string;

    COOKIE_DOMAIN?: string;
  }
}