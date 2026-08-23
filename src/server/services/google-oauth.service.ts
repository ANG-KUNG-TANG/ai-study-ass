import { randomBytes } from "crypto";
import { CodeChallengeMethod, OAuth2Client } from "google-auth-library";

import { env } from "@/server/config/env";
import {
  ServiceUnavailableError,
  UnauthorizedError,
} from "@/server/utils/errors";
import { logger } from "@/server/utils/logger";

const GOOGLE_SCOPES = ["openid", "email", "profile"];

export interface GoogleAuthorizationRequest {
  authorizationUrl: string;
  state: string;
  nonce: string;
  codeVerifier: string;
}

export interface GoogleIdentity {
  subject: string;
  email: string;
  name: string;
  emailVerified: true;
  hostedDomain: string | null;
}

function requireGoogleConfig(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = env.GOOGLE_REDIRECT_URI?.trim();

  if (!clientId || !clientSecret || !redirectUri) {
    throw new ServiceUnavailableError("Google sign-in is not configured");
  }

  return { clientId, clientSecret, redirectUri };
}

function createClient(): { client: OAuth2Client; clientId: string } {
  const { clientId, clientSecret, redirectUri } = requireGoogleConfig();
  return {
    clientId,
    client: new OAuth2Client({ clientId, clientSecret, redirectUri }),
  };
}

export async function createGoogleAuthorizationRequest(): Promise<GoogleAuthorizationRequest> {
  const { client } = createClient();
  const state = randomBytes(32).toString("base64url");
  const nonce = randomBytes(32).toString("base64url");
  const { codeVerifier, codeChallenge } =
    await client.generateCodeVerifierAsync();

  const authorizationUrl = client.generateAuthUrl({
    access_type: "online",
    scope: GOOGLE_SCOPES,
    state,
    nonce,
    prompt: "select_account",
    code_challenge: codeChallenge,
    code_challenge_method: CodeChallengeMethod.S256,
  });

  return { authorizationUrl, state, nonce, codeVerifier };
}

export async function verifyGoogleAuthorizationCode(input: {
  code: string;
  codeVerifier: string;
  expectedNonce: string;
}): Promise<GoogleIdentity> {
  const { client, clientId } = createClient();

  try {
    const { tokens } = await client.getToken({
      code: input.code,
      codeVerifier: input.codeVerifier,
    });

    if (!tokens.id_token) {
      throw new UnauthorizedError("Google did not return an identity token");
    }

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: clientId,
    });
    const payload = ticket.getPayload();

    if (
      !payload ||
      !payload.sub ||
      !payload.email ||
      payload.email_verified !== true ||
      payload.nonce !== input.expectedNonce
    ) {
      throw new UnauthorizedError("Google identity could not be verified");
    }

    const email = payload.email.toLowerCase().trim();
    const emailName = email.split("@")[0] || "";
    const providerName = payload.name?.trim() || "";
    const name =
      providerName.length >= 2
        ? providerName
        : emailName.length >= 2
          ? emailName
          : "Google User";

    return {
      subject: payload.sub,
      email,
      name: name.slice(0, 100),
      emailVerified: true,
      hostedDomain: payload.hd?.trim() || null,
    };
  } catch (unknownError) {
    logger.warn("Google OAuth verification failed", {
      error:
        unknownError instanceof Error
          ? unknownError.message
          : String(unknownError),
    });

    if (unknownError instanceof UnauthorizedError) {
      throw unknownError;
    }

    throw new UnauthorizedError("Google sign-in could not be verified");
  }
}
