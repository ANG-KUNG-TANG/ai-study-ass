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

  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context && Object.keys(context).length > 0 ? { context } : {}),
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
