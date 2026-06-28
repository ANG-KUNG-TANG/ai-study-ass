import { NextRequest, NextResponse } from "next/server";
import { RateLImitError } from "../utils/errors";
import { RATE_LIMIT_AUTH, RATE_LIMIT_AI, RATE_LIMIT_API } from "../utils/constants";


//store
/**
 * sliding window log -stores every request timestamp per key.
 * More accurate than fixed window: not boundy bypass attaxk possible
 * dev/single-insame only - replac with uptash redis in produciton
 * 
 */

const store = new Map<string, number[]>();

//cleanup
/**
 * Runs every 60s, revmoves stale timestamps empty kesys.
 * without this, the amp grwow unbounded- memory leaks in long-running processed
 * 
 */

const CLEANUP_INTERVAL_MS = 60_000;
const MAX_WINDOW_MS = Math.max(
    RATE_LIMIT_AUTH.windowMs,
    RATE_LIMIT_API.windowMs,
    RATE_LIMIT_AI.windowMS
);

setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of store.entries()) {
        const valid = timestamps.filter((ts) => ts > now - MAX_WINDOW_MS);
    if (valid.length === 0){
        store.delete(key);
    } else {
        store.set(key, valid);
    }
    }
}, CLEANUP_INTERVAL_MS
);

//core 
function getIP(req: NextRequest | Request): string {
    //NextRequest has req.ip (vercel/next.js set this)
    if ("ip" in req && req.ip) return req.ip;
    return (
        req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
        req.headers.get("x-real-ip")??
        "anonymous"
    );
}

function slidingWindowCheck(
    key: string,
    limit: number,
    windowMs: number
): { allowed: boolean; remaining: number; retryAfterMs: number} {
    const now = Date.now();
    const windowStart = now - MAX_WINDOW_MS;

    //Get timestamps withing the current window only
    const timestamps = (store.get(key) ?? []).filter((ts) => ts > windowStart);

    if (timestamps.length >= limit){
        //Time until oldest request in window expires
        const retryAfterMs = timestamps[0] + windowMs - now;
        return { allowed: false, remaining: 0, retryAfterMs};
    }

    //record this request
    timestamps.push(now);
    store.set(key, timestamps);

    return {
        allowed: true,
        remaining: limit - timestamps.length,
        retryAfterMs: 0,
    };
}

//Limiter factory
/**
 * Returns a function that enforces the limit for a given route/identifier
 * call at the top of any route handler -throws rateliitError if exceeded.
 * usage: 
 * export const POST = withErrorHandler(async(req) => {
 * authLimiter(req) <- throw if over limit
 * await connectDB()
 * ..
 * })
 */

function createLimiter(limit: number, windowMs: number){
    return function applyLimit(req: NextRequest | Request, identifier?: string): void{
        const ip = getIP(req);
        const key = `${identifier ?? 'default'}: ${ip}`;

        const { allowed, remaining, retryAfterMs} = slidingWindowCheck(key, limit, windowMs);
        if (!allowed) {
            throw new RateLImitError(
                `Too many requests - please try agaiin in ${Math.ceil(retryAfterMs/ 1000)} seconds`,
                retryAfterMs
            )
        }
    
    }
}

//Named limiters
/**
 * auth routes: 10 re1 /15 min -brute force protection
 */
export const authLimiter = createLimiter(
    RATE_LIMIT_AUTH.max,
    RATE_LIMIT_AUTH.windowMs
);

//general api routes: 100 req /min
export const apiLimiter = createLimiter(
    RATE_LIMIT_API.max,
    RATE_LIMIT_API.windowMs
);

//AI routes: 20 req / min -expensive operations
export const aiLimiter = createLimiter(
    RATE_LIMIT_AI.max,
    RATE_LIMIT_AI.windowMS
);