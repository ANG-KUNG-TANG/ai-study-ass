import { connectDb } from "@/server/config/database";
import type { UserRole } from "@/server/entities/user.entity";
import * as userRepo from "@/server/repositories/user.repo";
import {
  areAllUserTokensRevoked,
  verifyRefreshToken,
} from "@/server/utils/jwt";

export interface BrowserSession {
  userId: string;
  email: string;
  role: UserRole;
}

/**
 * Authoritative read-only check for the HttpOnly refresh cookie used by
 * Next.js page routing.
 *
 * Unlike a signature-only JWT check, this confirms that:
 * - the user still exists and is active;
 * - the refresh-token jti is still the current stored session id;
 * - all sessions have not been revoked;
 * - the role/email come from current database state, not stale token claims.
 *
 * Invalid sessions return null because Proxy uses this only for redirect
 * decisions. API authorization remains enforced independently by withAuth().
 */
export async function verifyBrowserSession(
  token: string | undefined,
): Promise<BrowserSession | null> {
  if (!token) return null;

  try {
    const payload = verifyRefreshToken(token);

    if (!payload.userId || !payload.jti) {
      return null;
    }

    await connectDb();

    const [user, allRevoked] = await Promise.all([
      userRepo.findById(payload.userId, {
        withRefreshTokenId: true,
      }),
      areAllUserTokensRevoked(payload.userId),
    ]);

    if (
      !user ||
      !user.isActive ||
      allRevoked ||
      user.refreshTokenId !== payload.jti
    ) {
      return null;
    }

    return {
      userId: user.id,
      email: user.email,
      role: user.role,
    };
  } catch {
    return null;
  }
}
