"use client";

import { useState } from "react";
import { Ban, CheckCircle2, Trash2 } from "lucide-react";
import { Chip } from "@/components/ui/Chip";
import * as adminService from "@/services/admin.service";
import type { User, UserRole } from "@/types/user";

interface UserTableProps {
  users: User[];
  onChanged: () => void;
}

export function UserTable({
  users,
  onChanged,
}: UserTableProps) {
  const [
    busyId,
    setBusyId,
  ] =
    useState<string | null>(
      null,
    );

  async function handleToggleBan(
    user: User,
  ) {
    setBusyId(
      user.id,
    );

    try {
      if (user.isActive) {
        const approved =
          window.confirm(
            `Ban ${user.name}? They will be signed out immediately.`,
          );

        if (!approved) {
          return;
        }

        await adminService.banUser(
          user.id,
        );
      } else {
        await adminService.unbanUser(
          user.id,
        );
      }

      onChanged();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Action failed",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleRoleChange(
    user: User,
    role: UserRole,
  ) {
    setBusyId(
      user.id,
    );

    try {
      await adminService.updateUserRole(
        user.id,
        role,
      );

      onChanged();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Action failed",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(
    user: User,
  ) {
    const approved =
      window.confirm(
        `Permanently delete ${user.name} (${user.email})? This cannot be undone.`,
      );

    if (!approved) {
      return;
    }

    setBusyId(
      user.id,
    );

    try {
      await adminService.deleteUser(
        user.id,
      );

      onChanged();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Action failed",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="overflow-x-auto rounded-card border border-line bg-paper-raised">
      <table className="w-full min-w-[760px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-line text-[11px] uppercase tracking-wide text-ink-faint">
            <th className="px-4 py-3 font-medium">
              Name
            </th>

            <th className="px-4 py-3 font-medium">
              Email
            </th>

            <th className="px-4 py-3 font-medium">
              Role
            </th>

            <th className="px-4 py-3 font-medium">
              Status
            </th>

            <th className="px-4 py-3 font-medium">
              Joined
            </th>

            <th className="px-4 py-3 text-right font-medium">
              Actions
            </th>
          </tr>
        </thead>

        <tbody>
          {users.map(
            (user) => (
              <tr
                key={user.id}
                className="border-b border-line-soft last:border-0"
              >
                <td className="px-4 py-3 font-medium">
                  {user.name}
                </td>

                <td className="px-4 py-3 text-ink-soft">
                  {user.email}
                </td>

                <td className="px-4 py-3">
                  <select
                    value={user.role}
                    disabled={
                      busyId ===
                      user.id
                    }
                    onChange={(event) =>
                      void handleRoleChange(
                        user,
                        event.target.value as UserRole,
                      )
                    }
                    className="rounded-md border border-line bg-transparent px-2 py-1 text-[12px]"
                  >
                    <option value="user">
                      user
                    </option>

                    <option value="admin">
                      admin
                    </option>
                  </select>
                </td>

                <td className="px-4 py-3">
                  <Chip
                    className=""
                    tone={
                      user.isActive
                        ? "sage"
                        : "coral"
                    }
                  >
                    {user.isActive
                      ? "Active"
                      : "Banned"}
                  </Chip>
                </td>

                <td className="px-4 py-3 text-ink-soft">
                  {new Date(
                    user.createdAt,
                  ).toLocaleDateString(
                    "en-US",
                    {
                      month:
                        "short",
                      day:
                        "numeric",
                      year:
                        "numeric",
                    },
                  )}
                </td>

                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        void handleToggleBan(
                          user,
                        )
                      }
                      disabled={
                        busyId ===
                        user.id
                      }
                      className={[
                        "inline-flex items-center gap-1 rounded-md px-2.5 py-1",
                        "text-[12px] font-medium disabled:opacity-50",
                        user.isActive
                          ? "text-coral hover:bg-coral-soft"
                          : "text-sage hover:bg-sage-soft",
                      ].join(" ")}
                    >
                      {user.isActive ? (
                        <Ban
                          size={13}
                          strokeWidth={1.8}
                        />
                      ) : (
                        <CheckCircle2
                          size={13}
                          strokeWidth={1.8}
                        />
                      )}

                      {user.isActive
                        ? "Ban"
                        : "Unban"}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void handleDelete(
                          user,
                        )
                      }
                      disabled={
                        busyId ===
                        user.id
                      }
                      className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[12px] font-medium text-ink-faint hover:bg-coral-soft hover:text-coral disabled:opacity-50"
                    >
                      <Trash2
                        size={13}
                        strokeWidth={1.8}
                      />

                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ),
          )}

          {users.length === 0 && (
            <tr>
              <td
                colSpan={6}
                className="px-4 py-10 text-center text-ink-faint"
              >
                No users found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
