"use client";

import { useState } from "react";
import Link from "next/link";
import { Ban, CheckCircle2, Eye, Trash2 } from "lucide-react";
import { Chip } from "@/components/ui/Chip";
import * as adminService from "@/services/admin.service";
import type { User, UserRole } from "@/types/user";
import { useLanguage } from "@/context/LanguageContext";

interface UserTableProps {
  users: User[];
  onChanged: () => void;
}

export function UserTable({
  users,
  onChanged,
}: UserTableProps) {
  const { locale, t } = useLanguage();
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
            t("admin.users.banConfirm", { name: user.name }),
          );

        if (!approved) {
          return;
        }

        const reason = window.prompt("Reason for banning this user:");
        if (!reason?.trim()) return;
        await adminService.banUser(user.id, reason.trim());
      } else {
        const reason = window.prompt("Reason for restoring this user:");
        if (!reason?.trim()) return;
        await adminService.unbanUser(user.id, reason.trim());
      }

      onChanged();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : t("admin.users.actionFailed"),
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleRoleChange(
    user: User,
    role: UserRole,
  ) {
    const reason = window.prompt(
      `Reason for changing ${user.email} to ${role}:`,
    );
    if (!reason?.trim()) return;

    setBusyId(
      user.id,
    );

    try {
      await adminService.updateUserRole(
        user.id,
        role,
        reason.trim(),
      );

      onChanged();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : t("admin.users.actionFailed"),
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
        t("admin.users.deleteConfirm", {
          name: user.name,
          email: user.email,
        }),
      );

    if (!approved) {
      return;
    }

    const reason = window.prompt(
      "Reason for permanently deleting this user:",
    );
    if (!reason?.trim()) return;

    setBusyId(
      user.id,
    );

    try {
      await adminService.deleteUser(
        user.id,
        reason.trim(),
      );

      onChanged();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : t("admin.users.actionFailed"),
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="overflow-x-auto border-y border-line bg-transparent">
      <table className="w-full min-w-[760px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-line text-[11px] uppercase tracking-wide text-ink-faint">
            <th className="px-4 py-3 font-medium">
              {t("admin.users.column.name")}
            </th>

            <th className="px-4 py-3 font-medium">
              {t("admin.users.column.email")}
            </th>

            <th className="px-4 py-3 font-medium">
              {t("admin.users.column.role")}
            </th>

            <th className="px-4 py-3 font-medium">
              {t("admin.users.column.status")}
            </th>

            <th className="px-4 py-3 font-medium">
              {t("admin.users.column.joined")}
            </th>

            <th className="px-4 py-3 text-right font-medium">
              {t("admin.users.column.actions")}
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
                      !user.isActive
                        ? "coral"
                        : user.emailVerified
                          ? "sage"
                          : "yellow"
                    }
                  >
                    {!user.isActive
                      ? t("admin.users.banned")
                      : user.emailVerified
                        ? t("admin.users.active")
                        : t("admin.users.pendingVerification")}
                  </Chip>
                </td>

                <td className="px-4 py-3 text-ink-soft">
                  {new Date(
                    user.createdAt,
                  ).toLocaleDateString(
                    locale,
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
                    <Link
                      href={`/admin/users/${user.id}`}
                      className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[12px] font-medium text-violet hover:bg-violet-soft"
                    >
                      <Eye size={13} strokeWidth={1.8} />
                      Details
                    </Link>

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
                        ? t("admin.users.ban")
                        : t("admin.users.unban")}
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

                      {t("common.delete")}
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
                {t("admin.users.empty")}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
