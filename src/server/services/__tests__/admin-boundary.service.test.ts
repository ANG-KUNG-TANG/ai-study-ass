jest.mock("@/server/repositories/user.repo");
jest.mock("@/server/utils/jwt", () => ({
  revokeAllUserTokens: jest.fn(),
}));

import * as userRepo from "@/server/repositories/user.repo";
import { revokeAllUserTokens } from "@/server/utils/jwt";
import {
  banUser,
  deleteUser,
  updateUserRole,
} from "@/server/services/admin.service";

describe("admin mutation safety boundaries", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("prevents an admin from changing their own role", async () => {
    await expect(
      updateUserRole("admin-1", "admin-1", "user"),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });

    expect(userRepo.updateRole).not.toHaveBeenCalled();
    expect(revokeAllUserTokens).not.toHaveBeenCalled();
  });

  it("prevents an admin from banning themselves", async () => {
    await expect(
      banUser("admin-1", "admin-1"),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });

    expect(userRepo.setActive).not.toHaveBeenCalled();
    expect(revokeAllUserTokens).not.toHaveBeenCalled();
  });

  it("prevents an admin from deleting themselves through the admin flow", async () => {
    await expect(
      deleteUser("admin-1", "admin-1"),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });

    expect(userRepo.deleteById).not.toHaveBeenCalled();
  });

  it("prevents demotion of the last administrator", async () => {
    jest.mocked(userRepo.findById).mockResolvedValue({
      id: "admin-2",
      role: "admin",
    } as never);
    jest.mocked(userRepo.count).mockResolvedValue(1);

    await expect(
      updateUserRole("admin-1", "admin-2", "user"),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });

    expect(userRepo.updateRole).not.toHaveBeenCalled();
    expect(revokeAllUserTokens).not.toHaveBeenCalled();
  });

  it("prevents deletion of the last administrator", async () => {
    jest.mocked(userRepo.findById).mockResolvedValue({
      id: "admin-2",
      role: "admin",
    } as never);
    jest.mocked(userRepo.count).mockResolvedValue(1);

    await expect(
      deleteUser("admin-1", "admin-2"),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });

    expect(userRepo.deleteById).not.toHaveBeenCalled();
    expect(revokeAllUserTokens).not.toHaveBeenCalled();
  });

  it("revokes the target user's sessions when their role changes", async () => {
    jest.mocked(userRepo.findById).mockResolvedValue({
      id: "user-2",
      role: "user",
    } as never);
    jest.mocked(userRepo.updateRole).mockResolvedValue(undefined);
    jest.mocked(revokeAllUserTokens).mockResolvedValue(undefined);

    await updateUserRole("admin-1", "user-2", "admin");

    expect(userRepo.updateRole).toHaveBeenCalledWith(
      "user-2",
      "admin",
    );
    expect(revokeAllUserTokens).toHaveBeenCalledWith("user-2");
  });

  it("revokes the target user's sessions when they are banned", async () => {
    jest.mocked(userRepo.findById).mockResolvedValue({
      id: "user-2",
      role: "user",
      isActive: true,
    } as never);
    jest.mocked(userRepo.setActive).mockResolvedValue(undefined);
    jest.mocked(revokeAllUserTokens).mockResolvedValue(undefined);

    await banUser("admin-1", "user-2");

    expect(userRepo.setActive).toHaveBeenCalledWith(
      "user-2",
      false,
    );
    expect(revokeAllUserTokens).toHaveBeenCalledWith("user-2");
  });
});
