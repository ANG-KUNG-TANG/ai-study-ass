jest.mock("@/server/repositories/ai-usage.repo");
jest.mock("@/server/services/ai-quota.service", () => ({
  getUserAIQuotaSnapshot: jest.fn().mockResolvedValue({
    enabled: true,
    requestLimit: 10,
    tokenLimit: 1_000,
    requestsUsed: 2,
    tokensUsed: 150,
    requestsRemaining: 8,
    tokensRemaining: 850,
    requestLimitReached: false,
    tokenLimitReached: false,
    allowed: true,
    resetsAt: new Date("2026-08-24T00:00:00.000Z"),
  }),
}));

import { AIUsageEntity } from "@/server/entities/ai-usage.entity";
import * as aiUsageRepo from "@/server/repositories/ai-usage.repo";
import {
  getUserAIUsageSummary,
  recordAIUsage,
} from "@/server/services/ai-usage.service";

function event(input: {
  id: string;
  success: boolean;
  tokensUsed: number;
  usageLabel: string;
  createdAt: Date;
}): AIUsageEntity {
  return AIUsageEntity.create({
    ...input,
    userId: "user-1",
    noteId: "note-1",
    provider: "gemini",
    model: "gemini-test",
    latencyMs: 100,
    statusCode: input.success ? 200 : 429,
    quotaExceeded: !input.success,
  });
}

describe("ai-usage.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("persists user and note ownership context", async () => {
    jest.mocked(aiUsageRepo.create).mockImplementation(async (value) => value);

    await recordAIUsage({
      userId: "user-1",
      noteId: "note-1",
      provider: "gemini",
      model: "gemini-test",
      usageLabel: "summary",
      success: true,
      tokensUsed: 75,
      latencyMs: 125,
      statusCode: 200,
    });

    const persisted = jest.mocked(aiUsageRepo.create).mock.calls[0]?.[0];

    expect(persisted?.toPublic()).toMatchObject({
      userId: "user-1",
      noteId: "note-1",
      provider: "gemini",
      usageLabel: "summary",
      tokensUsed: 75,
      success: true,
    });
  });

  it("builds a per-user summary from durable events", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-23T12:00:00.000Z"));
    jest.mocked(aiUsageRepo.findByUserIdSince).mockResolvedValue([
      event({
        id: "usage-1",
        success: true,
        tokensUsed: 100,
        usageLabel: "summary",
        createdAt: new Date("2026-08-23T10:00:00.000Z"),
      }),
      event({
        id: "usage-2",
        success: false,
        tokensUsed: 0,
        usageLabel: "quiz",
        createdAt: new Date("2026-08-23T11:00:00.000Z"),
      }),
    ]);

    const result = await getUserAIUsageSummary("user-1");

    expect(result.summary).toMatchObject({
      requestsToday: 2,
      successesToday: 1,
      failuresToday: 1,
      tokensToday: 100,
      successRate: 50,
      quotaExceededToday: 1,
    });
    expect(result.features.map((item) => item.label)).toEqual([
      "summary",
      "quiz",
    ]);
    expect(result.recentActivity).toHaveLength(2);
  });
});
