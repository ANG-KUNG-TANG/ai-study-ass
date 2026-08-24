import {
  isLocale,
  translate,
  type TranslationKey,
} from "@/i18n/translations";

describe("language translations", () => {
  it("supports the configured English and Myanmar locales", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("my")).toBe(true);
    expect(isLocale("fr")).toBe(false);
  });

  it("translates authentication content", () => {
    expect(translate("en", "login.submit")).toBe("Log in");
    expect(translate("my", "login.submit")).toBe("ဝင်ရောက်ရန်");
  });

  it("interpolates values without changing unknown text", () => {
    expect(translate("en", "forgot.sent", { email: "user@example.com" })).toBe(
      "We’ve sent a password reset link to user@example.com.",
    );
  });

  it("keeps both dictionaries aligned at compile time", () => {
    const key: TranslationKey = "nav.dashboard";

    expect(translate("en", key)).toBe("Dashboard");
    expect(translate("my", key)).toBe("ပင်မစာမျက်နှာ");
  });

  it("translates the student study workspace", () => {
    expect(translate("my", "summary.keyPoints")).toBe("အဓိကအချက်များ");
    expect(translate("en", "summary.mode.exam")).toBe("Exam revision");
    expect(
      translate("my", "flashcards.position", { current: 2, total: 10 }),
    ).toBe("ကတ် 2 / 10");
    expect(
      translate("en", "knowledge.page", { page: 4 }),
    ).toBe("Page 4");
  });

  it("translates the current usage and observability screens", () => {
    expect(translate("my", "student.ai.title")).toBe("AI အသုံးပြုမှု");
    expect(translate("my", "admin.activity.title")).toBe(
      "လုပ်ဆောင်မှုမှတ်တမ်း",
    );
    expect(
      translate("en", "admin.health.lastSnapshot", {
        value: "2026-08-23 18:00",
      }),
    ).toBe("Last server snapshot: 2026-08-23 18:00");
  });

  it("translates account verification, profile, and settings screens", () => {
    expect(translate("en", "settings.signOutAll")).toBe(
      "Sign out all devices",
    );
    expect(translate("my", "nav.profile")).toBe("ပရိုဖိုင်");
    expect(
      translate("en", "verify.resendCooldown", { seconds: 12 }),
    ).toBe("Try again in 12s");
  });
});
