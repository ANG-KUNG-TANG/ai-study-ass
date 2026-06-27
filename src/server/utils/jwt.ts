import jwt from "jsonwebtoken";
import { env } from "@/server/config/env";
import { UnauthorizedError } from "./errors";
import { randomUUID } from "crypto";
import { RevokedToken } from "@/server/models/RevokedToken";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TokenPayload {
  userId: string;
  email: string;
  jti: string;
  iat?: number;
  exp?: number;
}

// TokenPair returns refreshTokenId explicitly so auth service can
// persist it directly without decoding the token again
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  refreshTokenId: string;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function generateTokenId(): string {
  return randomUUID();
}

function parseDurationMs(duration: string): number {
  const units: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`Invalid duration format: ${duration}`);
  return parseInt(match[1]) * units[match[2]];
}

// ─── Sign ─────────────────────────────────────────────────────────────────────

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(
    { userId: payload.userId, email: payload.email },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions["expiresIn"],
      jwtid: generateTokenId(), // jwtid is the JWT spec field — sets the jti claim
    }
  );
}

export function signRefreshToken(payload: TokenPayload): {
  token: string;
  tokenId: string;
} {
  const tokenId = generateTokenId();
  const token = jwt.sign(
    { userId: payload.userId, email: payload.email },
    env.JWT_REFRESH_SECRET,
    {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions["expiresIn"],
      jwtid: tokenId,
    }
  );
  return { token, tokenId };
}

/**
 * Issues both tokens in one call — use this in login and refresh routes.
 * Returns refreshTokenId so auth service can persist it without re-decoding.
 *
 * @example
 * const { accessToken, refreshToken, refreshTokenId } = signTokenPair(payload);
 * await userRepository.storeRefreshToken(userId, refreshTokenId, expiresAt);
 */
export function signTokenPair(payload: TokenPayload): TokenPair {
  const accessToken = signAccessToken(payload);
  const { token: refreshToken, tokenId: refreshTokenId } =
    signRefreshToken(payload);

  return { accessToken, refreshToken, refreshTokenId };
}

// ─── Verify (signature only — no DB) ─────────────────────────────────────────

/**
 * Verifies an access token and returns the full payload including jti.
 * Throws UnauthorizedError on any failure.
 * Fast path — no DB call. Use in middleware for most requests.
 */
export function verifyAccessToken(token: string): TokenPayload {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError("Access token expired");
    }
    throw new UnauthorizedError("Invalid access token");
  }
}

/**
 * Verifies a refresh token and returns the full payload including jti.
 *
 * After calling this, auth service must:
 * 1. Look up the jti in DB — if not found → reuse detected → revoke all tokens
 * 2. Delete the old jti from DB
 * 3. Issue a new token pair and store the new jti
 *
 * This implements "refresh token rotation with reuse detection".
 */
export function verifyRefreshToken(token: string): TokenPayload {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError("Refresh token expired — please log in again");
    }
    throw new UnauthorizedError("Invalid refresh token");
  }
}

/**
 * Verifies access token signature + checks the DB revocation blocklist.
 * Use this in auth middleware — the authoritative trust check.
 * Checks two things:
 *   1. Was this specific token (jti) explicitly revoked?
 *   2. Were ALL tokens for this user revoked (e.g. after password change)?
 */
export async function verifyAccessTokenFull(token: string): Promise<TokenPayload> {
  const payload = verifyAccessToken(token); // throws if invalid/expired

  const [specificRevoked, allRevoked] = await Promise.all([
    RevokedToken.exists({ jti: payload.jti }),
    RevokedToken.exists({ jti: `all:${payload.userId}` }),
  ]);

  if (specificRevoked) throw new UnauthorizedError("Token has been revoked");
  if (allRevoked) throw new UnauthorizedError("Session expired — please log in again");

  return payload;
}

// ─── Extract ──────────────────────────────────────────────────────────────────

// Pulls the raw token string out of "Authorization: Bearer <token>"
// Throws UnauthorizedError if the header is missing or malformed
export function extractBearerToken(authHeader: string | null): string {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing or malformed Authorization header");
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    throw new UnauthorizedError("Token is empty");
  }
  return token;
}

// ─── Decode without verify ────────────────────────────────────────────────────

// Only use when you need the payload from an EXPIRED token (e.g. to identify
// the user before telling them their token expired). Never trust the payload
// for authorization decisions.
export function decodeToken(token: string): TokenPayload | null {
  try {
    return jwt.decode(token) as TokenPayload | null;
  } catch {
    return null;
  }
}

// ─── Revoke single token ──────────────────────────────────────────────────────

// Use on logout to immediately invalidate the current access token.
// The refresh token is handled separately — deleted from User.refreshToken in auth.service.
export async function revokeToken(token: string, secret: string): Promise<void> {
  let payload: TokenPayload;
  try {
    payload = jwt.verify(token, secret) as TokenPayload;
  } catch (err) {
    // Already expired — no need to blocklist, jwt.verify rejects it anyway
    if (err instanceof jwt.TokenExpiredError) return;
    throw new UnauthorizedError("Cannot revoke invalid token");
  }

  const expiresAt = new Date((payload.exp ?? 0) * 1000);

  // upsert: true — idempotent, safe to call twice on the same token
  await RevokedToken.findOneAndUpdate(
    { jti: payload.jti },
    { jti: payload.jti, userId: payload.userId, expiresAt },
    { upsert: true }
  );
}

// ─── Revoke ALL tokens for a user ─────────────────────────────────────────────

/**
 * Use on: password change, account compromise, forced logout from all devices.
 * Works by storing a sentinel doc with jti = "all:<userId>".
 * verifyAccessTokenFull checks for this sentinel on every request.
 * TTL: 30 days (max refresh token lifetime) — after that, all old tokens are
 * naturally expired anyway so the sentinel is no longer needed.
 */
export async function revokeAllUserTokens(userId: string): Promise<void> {
  const expiresAt = new Date(
    Date.now() + parseDurationMs(env.JWT_REFRESH_EXPIRES_IN)
  );

  await RevokedToken.findOneAndUpdate(
    { jti: `all:${userId}` },
    { jti: `all:${userId}`, userId, expiresAt },
    { upsert: true }
  );
}

// ─── Clear all-user revocation ────────────────────────────────────────────────

/**
 * Call this after issuing a fresh token pair post-revocation
 * (e.g. successful login after password change).
 * Without this, the user can never log back in.
 */
export async function clearUserRevocation(userId: string): Promise<void> {
  await RevokedToken.deleteOne({ jti: `all:${userId}` });
}

// ─── Check all-user revocation ────────────────────────────────────────────────

export async function areAllUserTokensRevoked(userId: string): Promise<boolean> {
  return Boolean(await RevokedToken.exists({ jti: `all:${userId}` }));
}