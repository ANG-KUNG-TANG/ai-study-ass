import { deriveSystemHealthStatus } from "@/server/utils/system-health";

describe("deriveSystemHealthStatus", () => {
  it("returns healthy when core dependencies and AI config are ready", () => {
    expect(
      deriveSystemHealthStatus({
        databaseConnected: true,
        redisReachable: true,
        aiConfigured: true,
      }),
    ).toBe("healthy");
  });

  it("returns degraded when core dependencies work but AI is not configured", () => {
    expect(
      deriveSystemHealthStatus({
        databaseConnected: true,
        redisReachable: true,
        aiConfigured: false,
      }),
    ).toBe("degraded");
  });

  it.each([
    [false, true],
    [true, false],
    [false, false],
  ])("returns unhealthy when a core dependency is unavailable", (databaseConnected, redisReachable) => {
    expect(
      deriveSystemHealthStatus({
        databaseConnected,
        redisReachable,
        aiConfigured: true,
      }),
    ).toBe("unhealthy");
  });
});
