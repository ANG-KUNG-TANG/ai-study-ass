import { sanitizeLogContext } from "@/server/utils/logger";

describe("logger sensitive-data redaction", () => {
  it("redacts secret-bearing keys recursively", () => {
    expect(
      sanitizeLogContext({
        userId: "user-1",
        tokensUsed: 42,
        accessToken: "access-secret",
        nested: {
          refreshTokenId: "refresh-id",
          resetTokenHash: "token-hash",
          passwordHash: "bcrypt-hash",
          apiKey: "provider-key",
          telegramWebhookSecret: "webhook-secret",
          authorization: "Bearer abc.def.ghi",
        },
      }),
    ).toEqual({
      userId: "user-1",
      tokensUsed: 42,
      accessToken: "[REDACTED]",
      nested: {
        refreshTokenId: "[REDACTED]",
        resetTokenHash: "[REDACTED]",
        passwordHash: "[REDACTED]",
        apiKey: "[REDACTED]",
        telegramWebhookSecret: "[REDACTED]",
        authorization: "[REDACTED]",
      },
    });
  });

  it("redacts bearer credentials and token assignments in strings", () => {
    const result = sanitizeLogContext({
      message:
        "Authorization: Bearer abc.def.ghi " +
        "https://example.test/auth/reset?token=0123456789abcdef&next=/",
    });

    expect(result.message).toContain("Bearer [REDACTED]");
    expect(result.message).toContain("token=[REDACTED]");
    expect(result.message).not.toContain("abc.def.ghi");
    expect(result.message).not.toContain("0123456789abcdef");
  });

  it("normalizes Error objects without serializing extra secret fields", () => {
    const error = new Error(
      "request failed with token=0123456789abcdef",
    ) as Error & { accessToken?: string };
    error.accessToken = "should-never-appear";

    expect(sanitizeLogContext({ error })).toEqual({
      error: {
        name: "Error",
        message: "request failed with token=[REDACTED]",
      },
    });
  });
});
