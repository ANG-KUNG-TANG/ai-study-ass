import {
  generateActionToken,
  hashActionToken,
} from "@/server/utils/action-token";

describe("action tokens", () => {
  it("generates a cryptographically random 256-bit token", () => {
    const first = generateActionToken();
    const second = generateActionToken();

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(second).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toBe(second);
  });

  it("stores only a deterministic SHA-256 digest", () => {
    const rawToken = "test-action-token";
    const digest = hashActionToken(rawToken);

    expect(digest).toBe(
      "e3f35da2297bf3c896504432e9f6b4c07a3e084a5bc3f7f5e9d2ac594dd0aa98",
    );
    expect(digest).not.toBe(rawToken);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
  });
});
