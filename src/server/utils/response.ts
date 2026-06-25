import { NextResponse } from "next/server";
import { isAppError } from "./errors";
import { logger } from "./logger";

//Types 
export interface AapiSuccess<T=unknown>{
    success: true;
    data: T,
    message?: string;
}

export interface ApiError{
    success:false;
    error: {
        code: string;
        message: string;
        fields?: Record<string, string>;
    };
}

export interface PaginatinMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
}

export interface ApiPaginated<T = unknown> extends AapiSuccess<T[]>{
    meta: PaginatinMeta;
}

//200 ok

export function successResponse<T>(
    data: T,
    message?: string,
    status = 200
): NextResponse<AapiSuccess<T>>{
    return NextResponse.json(
        {success:  true, data, ...(message ? { message} : {})},
        {status}
    )
}

//201 created
export function createResponse<T>(
    data:T,
    message?: string
): NextResponse<AapiSuccess<T>>{
    return successResponse(data, message, 201)
}

//204 no content
export function noContentResponse(): NextResponse{
    return new NextResponse(null, { status: 204});
}

//paginated 200
export function paginaitedResponse<T>(
    data: T[],
    meta: PaginatinMeta,
    message?: string
): NextResponse<ApiPaginated<T>>{
    return NextResponse.json(
        {success: true, data, meta, ...(message ? {message} : {})},
        {status: 200}
    )
}

//Error Response
export function errorResponse(
    code: string,
    message: string,
    status: number,
    fields?: Record<string, string>
):NextResponse<ApiError>{
    return NextResponse.json(
        {
            success: false,
            error: {
                code,
                message,
                ...(fields? { fields} : {}),
            }
        },
        {status}
    )
}

//central error handler
//converts any throw into a standardised error response.
//used inside withErrorHandleer HOF (below) and can be called directlsy

export function handleError(err: unknown): NextResponse<ApiError>{
    //know operational error -map directlry to response
    if (isAppError(err)){
        if (!err.isOperatinal){
            logger.error("Unexpected applicaiton error", {
                name: err.name,
                message: err.message,
                stack: err.stack,
            });
        } else {
            logger.warn("Operational error", {
                code: err.code,
                message: err.message,
                statusCode: err.statusCode,
            })
        }

    //validationError - include field map if present
    if (err.name === "ValidationError" && 'fields' in err){
        return errorResponse(
            err.code,
            err.message,
            err.statusCode,
            (err as { fields?: Record<string, string>}).fields
        )
    }

    return errorResponse(err.code, err.message, err.statusCode);
    }
    
    //Zod parse error surface outside of validated Body middleware
    if (
        err instanceof Error && 
        err.constructor.name === 'ZodError' && 
        "issues" in err
    ){
        const issues= (err as { issues: Array<{paht: string[]; message: string }>}).issues;
        const fields = Object.fromEntries(
            issues.map((i) => [i.path.join("."), i.message])
        );
        return errorResponse("VALIDATION_ERRR", 'Validaiton failed', 422, fields);
    }

    //mongoose duplicate key( E11000)
    if (
        err instanceof Error && 
        "code" in err &&
        (err as { code: number}).code === 1100
    ){
        return errorResponse("CONFLICT", "Resource already exists", 409);
    }

    //Mongoose CastError - Usully invalid ObjectId in URL param
    if (err instanceof Error && err.name === 'CastError'){
        return errorResponse("BAD_REQUEST", "Invalid ID format", 400);
    }

    //Truly unknown -log and return generic 500
    logger.error("Unhandled error", {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined
    });
    return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
    
}


/**
 * HOF wrapper
 * wraps a route hanler so you never need try/ catch in router files
 * 
 * usage:
 *  export const GET = withErrorHandler(async (req) =>{
 * await connectDB()
 * donst notes = await noteService.findall()
 * return successResponse(note)})
 */

type RouteHandler<T = unknown >=(
    req: Request,
    context: { params: Promise<Record<string, string>>}
) => Promise<NextResponse<T>>;

export function withErrorHandler<T>(
    handler: RouteHandler<T>
): RouteHandler<T | ApiError> {
    return async (req, context) => {
        try {
            return await handler(req, context);
        } catch (err){
            return handleError(err);
        }
    }
}

//Paginaitn helper
//Builds the metat object from raw values -use in servides or route handlers

export function buildPaginaitonMeta(
    total:number,
    page:number,
    limit: number
): PaginatinMeta {
    const totalPages = Math.ceil(total/ limit);
    return {
        page,
        limit,
        total,
        totalPages,
        hasNext: page <totalPages,
        hasPrev: page> 1,
    }
}