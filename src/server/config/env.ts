import {z} from 'zod';

//Schema
const envSchema = z.object({

    NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
    PORT: z.string().default('3000'),
    
    // Database
    MONGODB_URI: z.string().url("MONGODB_URI must be a valid URL"),

    //Auth
    JWT_ACCESS_SECRET: z.
    string()
    .min(32, "JWT_ACCESS_SECRET is required"),

    JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_REFRESH_SECRET must be at least 32 characters long"),
    JWT_EXPIRES_IN: z.string().default('1d'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

    // Third-party API keys
    GEMINI_API_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    AI_PROVIDER: z.enum(['openai', 'gemini']).default('gemini'),

    //cors
    CORS_ORIGIN: z.string().default('http://localhost:3000'),

    //Cookies
    COOKIE_DOMAIN: z
    .string()
    .min(32, "COOKIE_DOMAIN must be at least 32 characters long")

});

//Validation

function validateEnv() {
    const parsedEnv = envSchema.safeParse(process.env);

    if (!parsedEnv.success) {
        const formatted = parsedEnv.error.issues
        .map((issue) => `${issue.path.join('.')} - ${issue.message}`)
        .join('\n');
        console.error('Invalid environment variables:', formatted);
        process.exit(1);
    }
    const env = parsedEnv.data;


    const hasOpenAIKey = Boolean(env.OPENAI_API_KEY);
    const hasGeminiKey = Boolean(env.GEMINI_API_KEY);

    if (!hasOpenAIKey && !hasGeminiKey) {
        console.error('At least one API key (OPENAI_API_KEY or GEMINI_API_KEY) must be provided.');
        process.exit(1);
    }

    if (env.AI_PROVIDER === 'openai' && !hasOpenAIKey) {
        console.error('AI_PROVIDER is set to "openai", but OPENAI_API_KEY is not provided.');
        process.exit(1);
    }

    if (env.AI_PROVIDER === 'gemini' && !hasGeminiKey) {
        console.error('AI_PROVIDER is set to "gemini", but GEMINI_API_KEY is not provided.');
        process.exit(1);
    }

    return env;
}

//export validated environment variables

export const env = validateEnv();

//convenience function to check if the current environment is development
export const isDevelopment = env.NODE_ENV === 'development';
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
