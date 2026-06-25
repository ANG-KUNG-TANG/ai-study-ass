//Argument Nodejs.Process so process.env keys are typed throughout the project
//Actual runtime validaiton happens in src/server/config/env.ts - this is IDE support only


declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    MONGODB_URI: string;
    GEMINI_API_KEY: string;
    OPENAI_API_KEY: string;
    AI_PROVIDER: 'openai' | 'gemini';
    CORS_ORIGIN: string;
    COOKIE_DOMAIN: string;

    JWT_ACCESS_SECRET:string;
    JWT_REFRESH_SECRET:string;
    JWT_ACCESS_EXPIRES_IN?:string;
    JWT_REFRESH_EXPIRES_IN?:string;

    OPENAI_API_KEY?: string;
    GEMINI_API_KEY?: string;
    AI_PROVIDER?: "openai" | "gemini";

    CORS_ORIGIN?: string;
    COOKIE_SECRET: string;
  }
}