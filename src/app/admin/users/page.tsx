"use client";
import { useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { UserTable } from "@/components/admin/UserTable";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { useLanguage } from "@/context/LanguageContext";

export default function AdminUsersPage() {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { users, meta, isLoading, error, refetch } = useAdminUsers({ page, limit: 20, search: search || undefined });

  return (
    <>
      <Topbar
        eyebrow={t("admin.eyebrow")}
        title={t("admin.users.title")}
        search={{ value: search, onChange: (v) => { setSearch(v); setPage(1); }, placeholder: t("admin.users.search") }}
      />

      {isLoading && <p className="text-[13px] text-ink-soft">{t("admin.users.loading")}</p>}
      {error && <p className="text-[13px] text-coral">{error}</p>}

      {!isLoading && !error && <UserTable users={users} onChanged={refetch} />}

      {meta && meta.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-[12.5px] text-ink-soft">
          <button disabled={!meta.hasPrev} onClick={() => setPage((p) => p - 1)} className="disabled:opacity-30">{t("common.previous")}</button>
          {t("notes.pageOf", { page: meta.page, total: meta.totalPages })}
          <button disabled={!meta.hasNext} onClick={() => setPage((p) => p + 1)} className="disabled:opacity-30">{t("common.next")}</button>
        </div>
      )}
    </>
  );
}
