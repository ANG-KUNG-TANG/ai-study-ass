import { UserAIPolicyEntity } from "@/server/entities/user-ai-policy.entity";

describe("UserAIPolicyEntity", () => {
  it("retains explicit access and daily limits", () => {
    const policy = UserAIPolicyEntity.create({
      userId: "user-1",
      enabled: false,
      dailyRequestLimit: 25,
      dailyTokenLimit: 50_000,
      updatedBy: "admin-1",
    }).toPublic();

    expect(policy.enabled).toBe(false);
    expect(policy.dailyRequestLimit).toBe(25);
    expect(policy.dailyTokenLimit).toBe(50_000);
  });

  it("allows null limits to inherit system defaults", () => {
    const policy = UserAIPolicyEntity.create({
      userId: "user-1",
      enabled: true,
      dailyRequestLimit: null,
      dailyTokenLimit: null,
      updatedBy: "admin-1",
    }).toPublic();

    expect(policy.dailyRequestLimit).toBeNull();
    expect(policy.dailyTokenLimit).toBeNull();
  });

  it("rejects negative limits", () => {
    expect(() => UserAIPolicyEntity.create({
      userId: "user-1",
      enabled: true,
      dailyRequestLimit: -1,
      dailyTokenLimit: null,
      updatedBy: "admin-1",
    })).toThrow("Validation failed");
  });
});
