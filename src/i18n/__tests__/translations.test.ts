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
});
