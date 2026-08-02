import { NextResponse } from "next/server";
import { connectDb } from "@/server/config/database";
import { extractBearerToken, verifyAccessTokenFull } from "@/server/utils/jwt";
import { handleError } from "@/server/utils/response";
import { ForbiddenError } from "@/server/utils/errors";
import type { ApiError } from "@/server/utils/response";
import type { UserRole } from "@/server/entities/user.entity";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthContext {
  userId: string;
  email: string;
  role: UserRole;
}

export type RouteContext = { params: Promise<Record<string, string>> };

// Handler order is (req, context, auth) — this is the real, established
// convention across the codebase (chat/flashcard/intelligence/knowledge/
// note/quiz/summary controllers all depend on it). Do NOT flip this: an
// earlier attempt to "fix" this to (req, auth, context) broke every one of
// those controllers, because JS won't error on the mismatch — it just
// silently hands the wrong object into whichever slot a controller reads
// `auth.userId` from.
type AuthedHandler<T = unknown> = (
  req: Request,
  context: RouteContext,
  auth: AuthContext
) => Promise<NextResponse<T>>;

type OptionalAuthHandler<T = unknown> = (
  req: Request,
  context: RouteContext,
  auth: AuthContext | null
) => Promise<NextResponse<T>>;

// ─── withAuth ─────────────────────────────────────────────────────────────────
// Requires a valid Bearer token.
// Uses verifyAccessTokenFull — checks signature + DB revocation blocklist.
// Injects { userId, email, role } as third argument to the handler.

export function withAuth<T>(handler: AuthedHandler<T>) {
  return async (
    req: Request,
    context: RouteContext
  ): Promise<NextResponse<T | ApiError>> => {
    try {
      await connectDb();
      const token = extractBearerToken(req.headers.get("Authorization"));
      const payload = await verifyAccessTokenFull(token);

      const auth: AuthContext = {
        userId: payload.userId,
        email: payload.email,
        role: payload.role as UserRole,
      };

      return await handler(req, context, auth);
    } catch (err) {
      return handleError(err);
    }
  };
}

// ─── withRole ─────────────────────────────────────────────────────────────────
// Extends withAuth — requires a valid token AND a specific role.
// Use for admin-only routes.
//
// Usage:
//   export const GET = withRole("admin")(async (req, ctx, auth) => {
//     const users = await adminService.listUsers({})
//     return successResponse(users)
//   })

export function withRole<T>(role: UserRole) {
  return (handler: AuthedHandler<T>) => {
    return withAuth<T>(async (req, context, auth) => {
      if (auth.role !== role) {
        throw new ForbiddenError("You do not have permission to access this resource");
      }
      return handler(req, context, auth);
    });
  };
}

// ─── withOptionalAuth ─────────────────────────────────────────────────────────
// Token is optional. Injects AuthContext if valid, null if absent/invalid.

export function withOptionalAuth<T>(handler: OptionalAuthHandler<T>) {
  return async (
    req: Request,
    context: RouteContext
  ): Promise<NextResponse<T | ApiError>> => {
    try {
      await connectDb();
      let auth: AuthContext | null = null;

      const authHeader = req.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        try {
          const token = extractBearerToken(authHeader);
          const payload = await verifyAccessTokenFull(token);
          auth = {
            userId: payload.userId,
            email: payload.email,
            role: payload.role as UserRole,
          };
        } catch {
          auth = null;
        }
      }

      return await handler(req, context, auth);
    } catch (err) {
      return handleError(err);
    }
  };
}