import { apiFetch } from "@/lib/api";
import { resetPassword } from "@/services/auth.service";

jest.mock("@/lib/api", () => ({
  apiFetch: jest.fn(),
}));

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

describe("client authentication service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiFetch.mockResolvedValue({
      message: "Password reset successfully",
    });
  });

  it("sends both password fields required by the reset validator", async () => {
    await resetPassword("reset-token", "StrongPassword1!", "StrongPassword1!");

    expect(mockApiFetch).toHaveBeenCalledWith("/auth/reset-password", {
      method: "POST",
      skipAuth: true,
      body: JSON.stringify({
        token: "reset-token",
        newPassword: "StrongPassword1!",
        confirmPassword: "StrongPassword1!",
      }),
    });
  });
});
