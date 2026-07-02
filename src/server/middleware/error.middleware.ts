import { NextResponse } from "next/server";
import { isAppError } from "../utils/errors";
import { logger } from "../utils/logger";
import type { ApiError } from "@/server/utils/response";
import { connectDb } from "@/server/config/database";
//central error handler
/**
 * single place that converts Any thrown value into a standaredised error response
 * called by withErrorHandler HOF and auth middleware
 */
export function handleError(err: unknown): NextResponse<ApiError>{
    //known opeartional errors
    if (isAppError(err)){
        if (!err.isOperatinal){
            logger.error("Noon-operational error", {
                name: err.name,
                message: err.message,
                stack: err.stack
            });
        } else {
            logger.warn("Operational error",{
                code: err.code,
                statusCode: err.statusCode,
                messagge: err.message
            });
        }

        const body: ApiError = {
            success: false,
            error: {
                code: err.code,
                message: err.message,
                ...("fields" in err && err.fields
                    ? { fields: err.fields as Record<string, string>}
                    : {}
                ),
            }
        };

        return NextResponse.json(body, { status: err.statusCode});
    }

    //Mongoose duplicate key E11000
    if (
        err instanceof Error && 
        "code" in err && 
        (err as { code: number}).code === 11000
    ) {
        return NextResponse.json(
            {success: false, error: { code: "CONFLICT", message: "Resource already exist"}},
            {status: 409}
        );
    }

    //Mongoose CastError - invalid Objet in URl param
    if (err instanceof Error && err.name === "CastError"){
        return NextResponse.json(
            {success: false, error: { code : "BAD_REQUEST", message: "Invalid ID format"}},
            {status: 400}
        )
    };

    //Zod errors surfaced outside validatedBody
    if (err instanceof Error && "issues" in err) {
        const issues = (err as { issues: Array<{path: string[]; message: string | string[]}>}).issues;
        const fields = Object.fromEntries(
            issues.map((i) => [
                i.path.join('.'),
                Array.isArray(i.message) ? i.message.join(', ') : i.message,
            ])
        );
        return NextResponse.json(
            {success: false, error: { code : "VALIDATION_ERROR", message: "Validation failed", fields}},
            {status: 422}
        )
    }

    //Truley unknown log full details, retun generic 500
    logger.error("Unhandeled error", {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
    });

    return NextResponse.json(
        { success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong"}},
        {status : 500}
    )
}

//withErrorHandler Hof
/**
 * wraps any route handler - no try/catch needed in route files
 * Also guarantees a live DB connection before the handler runs, so no
 * individual route/controller/service/repo needs to remember to call
 * connectDb() itself. connectDb() is idempotent (cached conn / in-flight
 * promise), so this is cheap on every request.
 *
 * Usage:
 * export const GET = withErrorHandler(async (req) => {
 * return successResponse(data)})
 */

type RouteContext = { params: Promise<Record<string, string>>};
type RouteHandler<T = unknown> = ( req : Request, context: RouteContext) => 
    Promise<NextResponse<T>>;

export function withErrorHandler<T>(
    handler: RouteHandler<T>
): RouteHandler<T | ApiError> {
    return async (req, context) => {
        try { 
            await connectDb();
            return await handler(req, context);
        } catch (err) {
            return handleError(err);
        }
    }
}