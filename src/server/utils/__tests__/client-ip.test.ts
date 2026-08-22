import { resolveClientIp } from "@/server/utils/client-ip";

describe("resolveClientIp", () => {
  it("uses CF-Connecting-IP when Cloudflare trust is enabled", () => {
    const headers = new Headers({
      "cf-connecting-ip": "203.0.113.10",
      "x-forwarded-for": "198.51.100.20",
    });

    expect(
      resolveClientIp(headers, {
        trustCloudflareProxy: true,
        nodeEnv: "production",
      }),
    ).toBe("203.0.113.10");
  });

  it("does not fall back to spoofable forwarding headers in trusted Cloudflare mode", () => {
    const headers = new Headers({
      "cf-connecting-ip": "not-an-ip",
      "x-forwarded-for": "198.51.100.20",
      "x-real-ip": "198.51.100.21",
    });

    expect(
      resolveClientIp(headers, {
        trustCloudflareProxy: true,
        nodeEnv: "production",
      }),
    ).toBe("cloudflare-ip-missing");
  });

  it("ignores forwarding headers at a direct production origin", () => {
    const headers = new Headers({
      "x-forwarded-for": "198.51.100.20",
      "x-real-ip": "198.51.100.21",
    });

    expect(
      resolveClientIp(headers, {
        trustCloudflareProxy: false,
        nodeEnv: "production",
      }),
    ).toBe("direct-origin");
  });

  it("permits local forwarding headers outside production", () => {
    const headers = new Headers({
      "x-forwarded-for": "198.51.100.20, 10.0.0.1",
    });

    expect(
      resolveClientIp(headers, {
        trustCloudflareProxy: false,
        nodeEnv: "development",
      }),
    ).toBe("198.51.100.20");
  });

  it("falls back to a stable development bucket when no valid IP exists", () => {
    expect(
      resolveClientIp(new Headers(), {
        trustCloudflareProxy: false,
        nodeEnv: "test",
      }),
    ).toBe("dev-local");
  });
});
