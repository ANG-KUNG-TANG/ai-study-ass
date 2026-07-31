// src/app/admin/users/page.tsx
"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { UserTable } from "@/components/admin/UserTable";
import { Button } from "@/components/ui/Button";
import { useAdminUsers } from "@/hooks/useAdminUsers";

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<"all" | "active" | "banned" | "pending">("all");
  const { users, meta, isLoading, error, refetch } = useAdminUsers({
    page,
    limit: 20,
    search: search || undefined,
    // you could extend the hook to accept filter, but for now we just filter client‑side
  });

  // Client‑side filter (temporary, until backend supports)
  const filteredUsers = users.filter((user) => {
    if (filter === "all") return true;
    if (filter === "active") return user.isActive && user.role === "user";
    if (filter === "banned") return !user.isActive;
    if (filter === "pending") return user.isActive === null; // adjust as needed
    return true;
  });

  const filterPills = [
    { value: "all", label: `All · ${users.length}` },
    { value: "active", label: `Active · ${users.filter((u) => u.isActive && u.role === "user").length}` },
    { value: "banned", label: `Banned · ${users.filter((u) => !u.isActive).length}` },
    { value: "pending", label: `Pending · ${users.filter((u) => u.isActive === null).length}` },
  ];

  return (
    <>
      <Topbar
        eyebrow="Manage"
        title="Users"
        search={{ value: search, onChange: (v) => { setSearch(v); setPage(1); }, placeholder: "Search users…" }}
        actions={
          <Button variant="dark" className="gap-1.5">
            <Plus size={16} strokeWidth={1.8} /> Invite admin
          </Button>
        }
      />

      {/* Filter pills */}
      <div className="mb-4 flex flex-wrap gap-2">
        {filterPills.map((pill) => (
          <button
            key={pill.value}
            onClick={() => setFilter(pill.value as typeof filter)}
            className={`rounded-full px-3 py-1.5 font-mono text-[11px] font-medium transition-colors ${
              filter === pill.value
                ? "bg-[#221F1A] text-white"
                : "border border-[#E6DDC8] bg-white text-[#726B5C] hover:border-[#B3A98F]"
            }`}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-[13px] text-[#726B5C]">Loading users…</p>}
      {error && <p className="text-[13px] text-[#E85D46]">{error}</p>}

      {!isLoading && !error && <UserTable users={filteredUsers} onChanged={refetch} />}

      {meta && meta.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-[12px] text-[#726B5C]">
          <span>Showing {users.length} of {meta.total}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={!meta.hasPrev}
              className="rounded-md border border-[#E6DDC8] px-3 py-1 disabled:opacity-30"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!meta.hasNext}
              className="rounded-md border border-[#E6DDC8] px-3 py-1 disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </>
  );
}