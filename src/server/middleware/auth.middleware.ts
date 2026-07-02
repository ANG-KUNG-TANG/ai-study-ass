import { NextResponse } from "next/server";
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

type RouteContext = { params: Promise<Record<string, string>> };

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