import { env } from "@/server/config/env";

export function publicAppUrl(pathname: string): URL {
  const baseUrl = process.env.APP_PUBLIC_URL?.trim() || env.APP_URL;
  const url = new URL(pathname, baseUrl);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("APP_PUBLIC_URL must use HTTP or HTTPS");
  }

  return url;
}
