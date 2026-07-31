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

export function UserTable({ users, onChanged }: UserTableProps) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleToggleBan(user: User) {
    setBusyId(user.id);
    try {
      if (user.isActive) {
        if (!confirm(`Ban ${user.name}? They'll be signed out everywhere immediately.`)) return;
        await adminService.banUser(user.id);
      } else {
        await adminService.unbanUser(user.id);
      }
      onChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRoleChange(user: User, role: UserRole) {
    setBusyId(user.id);
    try {
      await adminService.updateUserRole(user.id, role);
      onChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(user: User) {
    if (
      !confirm(
        `Permanently delete ${user.name} (${user.email})? This cannot be undone. Their notes, quizzes, and other content will NOT be deleted and will stay orphaned.`
      )
    ) {
      return;
    }
    setBusyId(user.id);
    try {
      await adminService.deleteUser(user.id);
      onChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed");
      setBusyId(null);
    }
  }

  return (
    <div className="overflow-hidden rounded-card border border-line bg-paper-raised">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="border-b border-line text-[11px] uppercase tracking-wide text-ink-faint">
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Email</th>
            <th className="px-4 py-3 font-medium">Role</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Joined</th>
            <th className="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-b border-line-soft last:border-0">
              <td className="px-4 py-3 font-medium">{user.name}</td>
              <td className="px-4 py-3 text-ink-soft">{user.email}</td>
              <td className="px-4 py-3">
                <select
                  value={user.role}
                  disabled={busyId === user.id}
                  onChange={(e) => handleRoleChange(user, e.target.value as UserRole)}
                  className="rounded-md border border-line bg-transparent px-2 py-1 text-[12px]"
                >
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              </td>
              <td className="px-4 py-3">
                <Chip className="" tone={user.isActive ? "sage" : "coral"}>{user.isActive ? "Active" : "Banned"}</Chip>
              </td>
              <td className="px-4 py-3 text-ink-soft">
                {new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="inline-flex items-center gap-1">
                  <button
                    onClick={() => handleToggleBan(user)}
                    disabled={busyId === user.id}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[12px] font-medium ${
                      user.isActive
                        ? "text-coral hover:bg-coral-soft"
                        : "text-sage hover:bg-sage-soft"
                    } disabled:opacity-50`}
                  >
                    {user.isActive ? <Ban size={13} strokeWidth={1.8} /> : <CheckCircle2 size={13} strokeWidth={1.8} />}
                    {user.isActive ? "Ban" : "Unban"}
                  </button>
                  <button
                    onClick={() => handleDelete(user)}
                    disabled={busyId === user.id}
                    className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[12px] font-medium text-ink-faint hover:bg-coral-soft hover:text-coral disabled:opacity-50"
                  >
                    <Trash2 size={13} strokeWidth={1.8} />
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}