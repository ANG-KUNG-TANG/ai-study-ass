import type { NextResponse } from "next/server";
import { connectDb } from "@/server/config/database";
import {
  handleError as canonicalHandleError,
  type ApiError,
} from "@/server/utils/response";

export const handleError = canonicalHandleError;

type RouteContext = {
  params: Promise<Record<string, string>>;
};

type RouteHandler<T = unknown> = (
  req: Request,
  context: RouteContext,
) => Promise<NextResponse<T>>;

/** Ensures a live database connection and converts thrown values consistently. */
export function withErrorHandler<T>(
  handler: RouteHandler<T>,
): RouteHandler<T | ApiError> {
  return async (req, context) => {
    try {
      await connectDb();
      return await handler(req, context);
    } catch (error) {
      return canonicalHandleError(error);
    }
  };
}
