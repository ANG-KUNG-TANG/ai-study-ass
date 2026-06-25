import { env } from "@/server/config/env";
import { object } from "zod";
import { en } from "zod/locales";

//Types

type Loglevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
    [keyof: string] : unknown;
}

interface LogEntry {
    level: Loglevel;
    message: string;
    timestamp: string;
    context?: LogContext;
}

//level priority (higher= more servere)

const LEVELS: Record<Loglevel, number > = {
    debug: 0,
    info:1,
    warn: 2,
    error: 3,
};

//minimum level to output (suppress debug logs in production)
const MIN_LEVEL: Loglevel = env.NODE_ENV === "production" ? "info" : "debug";


//dev COLOURS:

const COLOURS: Record<Loglevel,string> ={
    debug: "\x1b[36m", //cyan
    info: '\x1b[32m', //green
    warn: '\x1b[33m', //yellow
    error: '\x1b[31m', //red
};

const RESET = '\x1b[0m';
const DIM = '\x1b[2m';

//core output

function shouldLog(level: Loglevel): boolean {
    if (env.NODE_ENV === 'test') return false;
    return LEVELS[level] >= LEVELS[MIN_LEVEL];
}

function formatDev(entry: LogEntry): string {
    const colour = COLOURS[entry.level];
    const label = entry.level.toUpperCase().padEnd(5);
    const time = DIM + entry.timestamp.split("T")[1].slice(0,12) + RESET;
    const context = 
        entry.context && Object.keys(entry.context).length >0
        ? ' ' + DIM + JSON.stringify(entry.context) + RESET
        : '';

    return `${time} ${colour} ${label} ${RESET} ${entry.message} ${context}`;
}

function formatProd(entry: LogEntry) : string {
    return JSON.stringify(entry);
}

function write(level: Loglevel, message: string, context?: LogContext): void {
    if (!shouldLog(level)) return;

    const entry: LogEntry = {
        level,
        message,
        timestamp: new Date().toISOString(),
        ...(context && Object.keys(context).length > 0 ? { context } : { }),
    };
    
    const output = 
        env.NODE_ENV === "production" ? formatProd(entry) : formatDev(entry);

    if (level === 'error'){
        console.error(output);
    } else if (level === 'warn'){
        console.warn(output)
    }else {
        console.log(output);
    }
}


//public api

export const logger = {
    debug: (message: string, context?: LogContext) =>
        write("debug", message, context),

    info: (message: string, context?: LogContext) =>
        write("info", message, context),
    
    warn: (message: string, context?: LogContext) =>
        write("warn", message, context),

    error: (message: string, context?: LogContext) =>
        write("error", message, context),
}