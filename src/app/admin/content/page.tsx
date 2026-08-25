// src/app/admin/content/page.tsx
"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { Eye, Trash2 } from "lucide-react";

import { Topbar } from "@/components/layout/Topbar";
import {
  deleteAdminContent,
  listAdminContent,
} from "@/services/admin.service";
import type {
  AdminContentItem,
} from "@/types/admin";
import { useLanguage } from "@/context/LanguageContext";

function normalizeContentItems(
  value: unknown,
): AdminContentItem[] {
  if (Array.isArray(value)) {
    return value as AdminContentItem[];
  }

  if (
    value &&
    typeof value === "object"
  ) {
    const response =
      value as {
        data?: unknown;
      };

    if (
      Array.isArray(response.data)
    ) {
      return response.data as AdminContentItem[];
    }
  }

  return [];
}

function formatDate(
  value: string | Date | undefined,
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "—";
  }

  return date.toLocaleDateString();
}

export default function AdminContentPage() {
  const { t } = useLanguage();
  const [
    search,
    setSearch,
  ] = useState("");

  const [
    items,
    setItems,
  ] = useState<AdminContentItem[]>([]);

  const [statusFilter, setStatusFilter] =
    useState<"" | "active" | "quarantined">("");

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState<string | null>(null);

  const load = useCallback(
    async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response =
          await listAdminContent({
            search:
              search.trim() ||
              undefined,
            limit: 30,
            adminStatus: statusFilter || undefined,
          });

        setItems(
          normalizeContentItems(
            response,
          ),
        );
      } catch (unknownError) {
        setItems([]);

        setError(
          unknownError instanceof Error
            ? unknownError.message
            : t("admin.content.loadFailed"),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [search, statusFilter, t],
  );

  useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          void load();
        },
        250,
      );

    return () => {
      window.clearTimeout(
        timer,
      );
    };
  }, [load]);

  async function handleDelete(
    id: string,
    title: string,
  ) {
    const approved =
      window.confirm(
        t("admin.content.deleteConfirm", { title }),
      );

    if (!approved) {
      return;
    }

    const reason = window.prompt(
      "Reason for permanently deleting this content:",
    );
    if (!reason?.trim()) return;

    try {
      await deleteAdminContent(
        id,
        reason.trim(),
      );

      await load();
    } catch (unknownError) {
      setError(
        unknownError instanceof Error
          ? unknownError.message
          : t("admin.content.deleteFailed"),
      );
    }
  }

  const safeItems =
    Array.isArray(items)
      ? items
      : [];

  return (
    <>
      <Topbar
        eyebrow={t("admin.eyebrow")}
        title={t("admin.content.title")}
        search={{
          value: search,
          onChange: setSearch,
          placeholder:
            t("admin.content.search"),
        }}
      />

      <div className="mb-4 flex justify-end">
        <label className="flex items-center gap-2 text-[12px] text-ink-soft">
          Moderation status
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as "" | "active" | "quarantined",
              )
            }
            className="rounded-lg border border-line bg-transparent px-3 py-2"
          >
            <option value="">All content</option>
            <option value="active">Active</option>
            <option value="quarantined">Quarantined</option>
          </select>
        </label>
      </div>

      {isLoading && (
        <p className="text-[13px] text-ink-soft">
          {t("admin.content.loading")}
        </p>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-coral/30 bg-coral-soft px-4 py-3">
          <p className="text-[13px] text-coral">
            {error}
          </p>
        </div>
      )}

      {!isLoading &&
        !error && (
          <div className="overflow-x-auto rounded-card border border-line bg-paper-raised">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-wide text-ink-faint">
                  <th className="px-4 py-3 font-medium">
                    {t("admin.content.column.title")}
                  </th>

                  <th className="px-4 py-3 font-medium">
                    {t("admin.content.column.owner")}
                  </th>

                  <th className="px-4 py-3 font-medium">
                    {t("admin.content.column.type")}
                  </th>

                  <th className="px-4 py-3 font-medium">
                    Status
                  </th>

                  <th className="px-4 py-3 font-medium">
                    {t("admin.content.column.created")}
                  </th>

                  <th className="px-4 py-3 text-right font-medium">
                    {t("admin.content.column.actions")}
                  </th>
                </tr>
              </thead>

              <tbody>
                {safeItems.map(
                  (item) => (
                    <tr
                      key={item.id}
                      className="border-b border-line-soft last:border-0"
                    >
                      <td className="max-w-[300px] truncate px-4 py-3 font-medium">
                        <Link
                          href={`/admin/content/${item.id}`}
                          className="hover:text-violet hover:underline"
                        >
                          {item.title || t("admin.content.untitled")}
                        </Link>
                      </td>

                      <td className="px-4 py-3 text-ink-soft">
                        {item.ownerEmail ??
                          "—"}
                      </td>

                      <td className="px-4 py-3 uppercase text-ink-soft">
                        {item.fileType ??
                          "—"}
                      </td>

                      <td className="px-4 py-3 text-ink-soft">
                        <span
                          className={
                            item.adminStatus === "quarantined"
                              ? "text-coral"
                              : "text-sage"
                          }
                        >
                          {item.adminStatus === "quarantined"
                            ? "Quarantined"
                            : item.status}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-ink-soft">
                        {formatDate(
                          item.createdAt,
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/content/${item.id}`}
                          className="mr-1 inline-flex rounded-md p-1 text-violet hover:bg-violet-soft"
                          aria-label={`View ${item.title}`}
                        >
                          <Eye size={14} strokeWidth={1.8} />
                        </Link>

                        <button
                          type="button"
                          onClick={() =>
                            void handleDelete(
                              item.id,
                              item.title,
                            )
                          }
                          className="rounded-md p-1 text-coral hover:bg-coral-soft"
                          aria-label={t("note.deleteLabel", { title: item.title })}
                        >
                          <Trash2
                            size={14}
                            strokeWidth={1.8}
                          />
                        </button>
                      </td>
                    </tr>
                  ),
                )}

                {safeItems.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-ink-faint"
                    >
                      {t("admin.content.empty")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
    </>
  );
}
