//fle upload

export const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformts-officedocument.workprocessingml.document',
] as const;

export const ALLOWED_EXTENSIONS = ['.pdf', '.docx'] as const;

//10 mb in bytes
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

//max characters extracted from a document before turncating
//-75k chars = -18k tokens -safe for most AI context windows

export const MAX_CONTENT_LENGTH = 75_000;


//pagination
export const DEFAULT_PAGE=1;
export const DEFAULt_LIMIT = 10;
export const MAX_LIMIT = 50;

//ai generation limits

export const MAX_QUIZ_QUESTIONS = 20;
export const DEFAULT_QUIZ_QUESTIONS = 10;


export const MAX_FLASHCARDS = 30;
export const DEFAULT_FLASHCARDS = 15;


//number of past chat messages to include as context
export const CHAT_HISTORY_LIMIT = 10;

//Auth
export const BCRYPT_ROUNDS = 12;

//cookies

export const COOKIE_REFRESH_TOKEN = "refresh_token";

//30days in milliseconds
export const COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 1000;

//Rate Limits


//These mirror the Rate Limiter Block ()
export const RATE_LIMIT_AUTH = {max: 10, windwMs: 15 * 60 * 1000}
export const RATE_LIMIT_API = {max: 100, windowMs: 60 * 1000}
export const RATE_LIMIT_AI = {max: 20, windowMS: 60 * 1000} 


//AI retry

export const AI_MAX_RETRIES = 3;
export const AI_TIMEOUT_MS = 30_000;