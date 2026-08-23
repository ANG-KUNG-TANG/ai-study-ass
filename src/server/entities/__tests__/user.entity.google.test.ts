import { UserEntity } from "@/server/entities/user.entity";

describe("UserEntity.createGoogle", () => {
  it("creates an active user without email-verification fields", () => {
    const user = UserEntity.createGoogle({
      id: "user-1",
      name: "  Ada Student  ",
      email: "  ADA@GMAIL.COM ",
      passwordHash: "hashed-placeholder",
      googleSubject: "google-subject-1",
    });

    expect(user.toPersistence()).toMatchObject({
      id: "user-1",
      name: "Ada Student",
      email: "ada@gmail.com",
      googleSubject: "google-subject-1",
      isActive: true,
      emailVerificationToken: null,
      emailVerificationExpires: null,
    });
  });

  it("rejects an empty Google subject", () => {
    expect(() =>
      UserEntity.createGoogle({
        id: "user-2",
        name: "Ada Student",
        email: "ada@gmail.com",
        passwordHash: "hashed-placeholder",
        googleSubject: "   ",
      }),
    ).toThrow("Validation failed");
  });
});
