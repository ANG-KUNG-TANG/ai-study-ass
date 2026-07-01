import { NextResponse } from "next/server";
import { isAppError } from "./errors";
import { logger } from "./logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiPaginated<T = unknown> extends ApiSuccess<T[]> {
  meta: PaginationMeta;
}

// ─── 200 OK ───────────────────────────────────────────────────────────────────

export function successResponse<T>(
  data: T,
  message?: string,
  status = 200
): NextResponse<ApiSuccess<T>> {
  return NextResponse.json(
    { success: true, data, ...(message ? { message } : {}) },
    { status }
  );
}

// ─── 201 Created ──────────────────────────────────────────────────────────────

export function createdResponse<T>(
  data: T,
  message?: string
): NextResponse<ApiSuccess<T>> {
  return successResponse(data, message, 201);
}

// ─── 204 No Content ───────────────────────────────────────────────────────────

export function noContentResponse(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

// ─── Paginated 200 ────────────────────────────────────────────────────────────

export function paginatedResponse<T>(
  data: T[],
  meta: PaginationMeta,
  message?: string
): NextResponse<ApiPaginated<T>> {
  return NextResponse.json(
    { success: true, data, meta, ...(message ? { message } : {}) },
    { status: 200 }
  );
}

// ─── Error response ───────────────────────────────────────────────────────────

export function errorResponse(
  code: string,
  message: string,
  status: number,
  fields?: Record<string, string>
): NextResponse<ApiError> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(fields ? { fields } : {}),
      },
    },
    { status }
  );
}

// ─── Central error handler ────────────────────────────────────────────────────
// Converts any throw into a standardised error response.
// Used inside withErrorHandler HOF (below) and can be called directly.

export function handleError(err: unknown): NextResponse<ApiError> {
  // Known operational error — map directly to response
  if (isAppError(err)) {
    if (!err.isOperatinal) {
      logger.error("Unexpected application error", {
        name: err.name,
        message: err.message,
        stack: err.stack,
      });
    } else {
      logger.warn("Operational error", {
        code: err.code,
        message: err.message,
        statusCode: err.statusCode,
      });
    }

    // ValidationError — include field map if present
    if (err.name === "ValidationError" && "fields" in err) {
      return errorResponse(
        err.code,
        err.message,
        err.statusCode,
        (err as { fields?: Record<string, string> }).fields
      );
    }

    return errorResponse(err.code, err.message, err.statusCode);
  }

  // Zod parse error surfaced outside of validateBody middleware
  if (
    err instanceof Error &&
    err.constructor.name === "ZodError" &&
    "issues" in err
  ) {
    const issues = (err as { issues: Array<{ path: (string | number)[]; message: string }> }).issues;
    const fields = Object.fromEntries(
      issues.map((i) => [i.path.join("."), i.message])
    );
    return errorResponse("VALIDATION_ERROR", "Validation failed", 422, fields);
  }

  // Mongoose duplicate key (E11000)
  if (
    err instanceof Error &&
    "code" in err &&
    (err as { code: number }).code === 11000
  ) {
    return errorResponse("CONFLICT", "Resource already exists", 409);
  }

  // Mongoose CastError — usually invalid ObjectId in URL param
  if (err instanceof Error && err.name === "CastError") {
    return errorResponse("BAD_REQUEST", "Invalid ID format", 400);
  }

  // Truly unknown — log and return generic 500
  logger.error("Unhandled error", {
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
}

/**
 * HOF wrapper.
 * Wraps a route handler so you never need try/catch in route files.
 *
 * usage:
 *   export const GET = withErrorHandler(async (req) => {
 *     await connectDB();
 *     const notes = await noteService.findAll();
 *     return successResponse(notes);
 *   });
 */

type RouteHandler<T = unknown> = (
  req: Request,
  context: { params: Promise<Record<string, string>> }
) => Promise<NextResponse<T>>;

export function withErrorHandler<T>(
  handler: RouteHandler<T>
): RouteHandler<T | ApiError> {
  return async (req, context) => {
    try {
      return await handler(req, context);
    } catch (err) {
      return handleError(err);
    }
  };
}

// ─── Pagination helper ────────────────────────────────────────────────────────
// Builds the meta object from raw values — use in services or route handlers.

export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}