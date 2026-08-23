import { env } from "@/server/config/env";

type LogLevel = "debug" | "info" | "warn" | "error";
type LogContext = Record<string, unknown>;

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
}

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LEVEL: LogLevel = env.NODE_ENV === "production" ? "info" : "debug";
const COLOURS: Record<LogLevel, string> = {
  debug: "\x1b[36m",
  info: "\x1b[32m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
};
const RESET = "\x1b[0m";
const DIM = "\x1b[2m";

const REDACTED = "[REDACTED]";

function isSensitiveLogKey(key: string): boolean {
  const normalised = key.toLowerCase().replace(/[^a-z0-9]/g, "");

  return (
    normalised === "authorization" ||
    normalised === "cookie" ||
    normalised === "cookies" ||
    normalised === "setcookie" ||
    normalised.endsWith("password") ||
    normalised.endsWith("passwordhash") ||
    normalised.endsWith("token") ||
    normalised.endsWith("tokenid") ||
    normalised.endsWith("tokenhash") ||
    normalised.endsWith("secret") ||
    normalised.endsWith("apikey")
  );
}

function redactSensitiveString(value: string): string {
  return value
    .replace(
      /Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi,
      `Bearer ${REDACTED}`,
    )
    .replace(
      /(\b(?:token|access_token|refresh_token|verification_token|reset_token|api[_-]?key|key)=)[^&#\s]+/gi,
      `$1${REDACTED}`,
    );
}

function sanitizeLogValue(
  value: unknown,
  key?: string,
  seen: WeakSet<object> = new WeakSet<object>(),
): unknown {
  if (key && isSensitiveLogKey(key)) {
    return REDACTED;
  }

  if (
    value === null ||
    value === undefined ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "string") {
    return redactSensitiveString(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return {
      name: redactSensitiveString(value.name),
      message: redactSensitiveString(value.message),
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogValue(item, undefined, seen));
  }

  if (typeof value === "object") {
    const objectValue = value as Record<string, unknown>;

    if (seen.has(objectValue)) {
      return "[circular]";
    }

    seen.add(objectValue);

    const sanitized = Object.fromEntries(
      Object.entries(objectValue).map(([childKey, childValue]) => [
        childKey,
        sanitizeLogValue(childValue, childKey, seen),
      ]),
    );

    seen.delete(objectValue);
    return sanitized;
  }

  return redactSensitiveString(String(value));
}

export function sanitizeLogContext(context: LogContext): LogContext {
  return sanitizeLogValue(context) as LogContext;
}

function shouldLog(level: LogLevel): boolean {
  if (env.NODE_ENV === "test") return false;
  return LEVELS[level] >= LEVELS[MIN_LEVEL];
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '"[unserializable]"';
  }
}

function formatDev(entry: LogEntry): string {
  const label = entry.level.toUpperCase().padEnd(5);
  const time = `${DIM}${entry.timestamp.split("T")[1]?.slice(0, 12) ?? entry.timestamp}${RESET}`;
  const context = entry.context && Object.keys(entry.context).length > 0
    ? ` ${DIM}${safeJson(entry.context)}${RESET}`
    : "";
  return `${time} ${COLOURS[entry.level]}${label}${RESET} ${entry.message}${context}`;
}

function write(level: LogLevel, message: string, context?: LogContext): void {
  if (!shouldLog(level)) return;

  const sanitizedContext =
    context && Object.keys(context).length > 0
      ? sanitizeLogContext(context)
      : undefined;

  const entry: LogEntry = {
    level,
    message: redactSensitiveString(message),
    timestamp: new Date().toISOString(),
    ...(sanitizedContext ? { context: sanitizedContext } : {}),
  };

  const output = env.NODE_ENV === "production" ? safeJson(entry) : formatDev(entry);

  if (level === "error") console.error(output);
  else if (level === "warn") console.warn(output);
  else console.log(output);
}

export const logger = {
  debug: (message: string, context?: LogContext) => write("debug", message, context),
  info: (message: string, context?: LogContext) => write("info", message, context),
  warn: (message: string, context?: LogContext) => write("warn", message, context),
  error: (message: string, context?: LogContext) => write("error", message, context),
};
