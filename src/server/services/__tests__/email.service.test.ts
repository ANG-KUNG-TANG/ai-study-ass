import { sendEmail } from "@/server/integrations/email/resend.client";
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "@/server/services/email.service";

jest.mock("@/server/config/env", () => ({
  env: {
    APP_URL: "https://study.example.test",
  },
}));

jest.mock("@/server/integrations/email/resend.client", () => ({
  sendEmail: jest.fn(),
}));

const mockSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;

describe("email service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendEmail.mockResolvedValue({
      status: "sent",
      messageId: "email-1",
    });
  });

  it("creates a verification message with the trusted application URL", async () => {
    await sendVerificationEmail("student@example.com", "verification-token");

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "student@example.com",
        subject: "Verify your email — AI Study Assistant",
        text: expect.stringContaining(
          "https://study.example.test/auth/verify-email?token=verification-token",
        ),
        idempotencyKey: expect.stringMatching(/^verify-email\/[a-f0-9]{64}$/),
      }),
    );
  });

  it("creates a password-reset message with a distinct purpose key", async () => {
    await sendPasswordResetEmail("student@example.com", "reset-token");

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "student@example.com",
        subject: "Reset your password — AI Study Assistant",
        text: expect.stringContaining(
          "https://study.example.test/auth/reset-password?token=reset-token",
        ),
        idempotencyKey: expect.stringMatching(
          /^password-reset\/[a-f0-9]{64}$/,
        ),
      }),
    );
  });

  it("uses the same idempotency key when the same action is retried", async () => {
    await sendVerificationEmail("student@example.com", "same-token");
    await sendVerificationEmail("student@example.com", "same-token");

    const firstInput = mockSendEmail.mock.calls[0]?.[0];
    const secondInput = mockSendEmail.mock.calls[1]?.[0];

    expect(firstInput?.idempotencyKey).toBe(secondInput?.idempotencyKey);
  });
});
