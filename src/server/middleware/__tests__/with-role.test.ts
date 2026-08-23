jest.mock("@/server/config/database", () => ({
  connectDb: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/server/utils/jwt", () => ({
  extractBearerToken: jest.fn().mockReturnValue("test-token"),
  verifyAccessTokenFull: jest.fn(),
}));

import { NextResponse } from "next/server";

import { withRole } from "@/server/middleware/auth.middleware";
import { verifyAccessTokenFull } from "@/server/utils/jwt";

describe("withRole", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fails closed for an authenticated non-admin user", async () => {
    jest.mocked(verifyAccessTokenFull).mockResolvedValue({
      userId: "user-1",
      email: "user@example.com",
      role: "user",
      jti: "jti-1",
    });

    const handler = jest.fn(async () =>
      NextResponse.json({ success: true }),
    );

    const route = withRole("admin")(handler);

    const response = await route(
      new Request("http://localhost/api/admin/overview", {
        headers: {
          Authorization: "Bearer test-token",
        },
      }),
      {
        params: Promise.resolve({}),
      },
    );

    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("allows an authenticated admin through to the handler", async () => {
    jest.mocked(verifyAccessTokenFull).mockResolvedValue({
      userId: "admin-1",
      email: "admin@example.com",
      role: "admin",
      jti: "jti-admin",
    });

    const handler = jest.fn(async () =>
      NextResponse.json({ success: true }),
    );

    const route = withRole("admin")(handler);

    const response = await route(
      new Request("http://localhost/api/admin/overview", {
        headers: {
          Authorization: "Bearer test-token",
        },
      }),
      {
        params: Promise.resolve({}),
      },
    );

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
