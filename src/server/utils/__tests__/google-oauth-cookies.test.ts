jest.mock("@/server/config/env", () => ({
  env: { NODE_ENV: "test" },
}));

import { secureStringEqual } from "@/server/utils/google-oauth-cookies";

describe("secureStringEqual", () => {
  it("accepts identical OAuth state values", () => {
    expect(secureStringEqual("expected-state", "expected-state")).toBe(true);
  });

  it("rejects missing, different, and different-length state values", () => {
    expect(secureStringEqual(undefined, "expected-state")).toBe(false);
    expect(secureStringEqual("changed-state", "expected-state")).toBe(false);
    expect(secureStringEqual("short", "expected-state")).toBe(false);
  });
});
