"use client";
import { useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { UserTable } from "@/components/admin/UserTable";
import { useAdminUsers } from "@/hooks/useAdminUsers";

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { users, meta, isLoading, error, refetch } = useAdminUsers({ page, limit: 20, search: search || undefined });

  return (
    <>
      <Topbar
        eyebrow="Admin"
        title="Users"
        search={{ value: search, onChange: (v) => { setSearch(v); setPage(1); }, placeholder: "Search users…" }}
      />

      {isLoading && <p className="text-[13px] text-ink-soft">Loading users…</p>}
      {error && <p className="text-[13px] text-coral">{error}</p>}

      {!isLoading && !error && <UserTable users={users} onChanged={refetch} />}

      {meta && meta.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-[12.5px] text-ink-soft">
          <button disabled={!meta.hasPrev} onClick={() => setPage((p) => p - 1)} className="disabled:opacity-30">Prev</button>
          Page {meta.page} of {meta.totalPages}
          <button disabled={!meta.hasNext} onClick={() => setPage((p) => p + 1)} className="disabled:opacity-30">Next</button>
        </div>
      )}
    </>
  );
}