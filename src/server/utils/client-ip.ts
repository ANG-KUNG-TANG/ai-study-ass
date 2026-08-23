import { isIP } from "node:net";

import { env } from "@/server/config/env";

export interface ClientIpOptions {
  trustCloudflareProxy: boolean;
  nodeEnv: "development" | "test" | "production";
}

function normaliseIp(value: string | null): string | null {
  const candidate = value?.trim();

  if (!candidate || isIP(candidate) === 0) {
    return null;
  }

  return candidate;
}

/**
 * Resolve a stable client identity without trusting caller-controlled proxy
 * headers in production.
 */
export function resolveClientIp(
  headers: Headers,
  options: ClientIpOptions,
): string {
  if (options.trustCloudflareProxy) {
    const cloudflareIp = normaliseIp(
      headers.get("cf-connecting-ip"),
    );

    if (cloudflareIp) {
      return cloudflareIp;
    }

    return "cloudflare-ip-missing";
  }

  if (options.nodeEnv !== "production") {
    const forwarded = headers
      .get("x-forwarded-for")
      ?.split(",")[0];

    return (
      normaliseIp(forwarded ?? null) ??
      normaliseIp(headers.get("x-real-ip")) ??
      "dev-local"
    );
  }

  return "direct-origin";
}

export function getClientIp(
  request: Pick<Request, "headers">,
): string {
  return resolveClientIp(
    request.headers,
    {
      trustCloudflareProxy: env.TRUST_CLOUDFLARE_PROXY,
      nodeEnv: env.NODE_ENV,
    },
  );
}
