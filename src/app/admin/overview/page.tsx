"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Bot,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Database,
  FileQuestion,
  HeartPulse,
  RefreshCw,
  ShieldAlert,
  Users,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Topbar,
} from "@/components/layout/Topbar";
import {
  AdminPanel,
} from "@/components/admin/AdminPanel";
import {
  getAdminActivity,
  getAdminAIUsage,
  getOverviewStats,
  getUserStats,
} from "@/services/admin.service";
import {
  getHealth,
} from "@/services/health.service";
import {
  useLanguage,
} from "@/context/LanguageContext";
import type {
  Locale,
  TranslationKey,
  TranslationValues,
} from "@/i18n/translations";

type Translate = (
  key: TranslationKey,
  values?: TranslationValues,
) => string;

const ACTIVITY_LIMIT = 6;

type OverviewData =
  Awaited<
    ReturnType<
      typeof getOverviewStats
    >
  >;

type UserStatsData =
  Awaited<
    ReturnType<
      typeof getUserStats
    >
  >;

type AIUsageData =
  Awaited<
    ReturnType<
      typeof getAdminAIUsage
    >
  >;

type HealthData =
  Awaited<
    ReturnType<
      typeof getHealth
    >
  >;

type ActivityResponse =
  Awaited<
    ReturnType<
      typeof getAdminActivity
    >
  >;

type ActivityItem =
  ActivityResponse["data"][number];

interface DashboardState {
  overview: OverviewData | null;
  users: UserStatsData | null;
  ai: AIUsageData | null;
  health: HealthData | null;
}

interface AttentionItem {
  id: string;
  title: string;
  detail: string;
  tone:
    | "warning"
    | "danger"
    | "info";
  href: string;
}

function formatNumber(
  value: number | null | undefined,
): string {
  return typeof value === "number" &&
    Number.isFinite(value)
    ? value.toLocaleString()
    : "—";
}

function formatPercent(
  value: number,
): string {
  return `${Math.round(value)}%`;
}

function formatBytes(
  value: number | undefined,
): string {
  if (
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return "—";
  }

  return `${(
    value /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}

function formatUptime(
  seconds: number | undefined,
): string {
  if (
    seconds === undefined ||
    !Number.isFinite(seconds)
  ) {
    return "—";
  }

  const days =
    Math.floor(
      seconds / 86_400,
    );

  const hours =
    Math.floor(
      (
        seconds %
        86_400
      ) /
        3_600,
    );

  const minutes =
    Math.floor(
      (
        seconds %
        3_600
      ) /
        60,
    );

  return [
    days > 0
      ? `${days}d`
      : "",
    `${hours}h`,
    `${minutes}m`,
  ]
    .filter(Boolean)
    .join(" ");
}

function timeAgo(
  value: string,
  locale: Locale,
  t: Translate,
): string {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return t("admin.overview.unknownTime");
  }

  const seconds =
    Math.max(
      0,
      Math.floor(
        (
          Date.now() -
          date.getTime()
        ) /
          1000,
      ),
    );

  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (seconds < 60) return relative.format(0, "second");
  if (seconds < 3_600) return relative.format(-Math.floor(seconds / 60), "minute");
  if (seconds < 86_400) return relative.format(-Math.floor(seconds / 3_600), "hour");
  return relative.format(-Math.floor(seconds / 86_400), "day");
}

function activityTone(
  action: string,
): string {
  if (
    action.includes(
      "rate_limit",
    ) ||
    action.includes(
      "deleted",
    ) ||
    action.includes(
      "banned",
    ) ||
    action.includes(
      "error",
    )
  ) {
    return "bg-coral";
  }

  if (
    action.includes(
      "generated",
    ) ||
    action.includes(
      "uploaded",
    ) ||
    action.includes(
      "register",
    )
  ) {
    return "bg-sage";
  }

  return "bg-violet";
}

function activityText(
  item: ActivityItem,
  systemLabel: string,
): string {
  if (
    typeof item.text ===
      "string" &&
    item.text.trim()
  ) {
    return item.text;
  }

  const action =
    item.action
      .replace(/^admin\./, "")
      .replaceAll("_", " ");

  return `${item.actorEmail ?? systemLabel} ${action}`;
}

function routeLabel(
  value: string,
): string {
  return value
    .replace(/^\/?api\//, "")
    .replaceAll("-", " ")
    .replaceAll("_", " ");
}

function KpiCard({
  label,
  value,
  helper,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  helper: string;
  icon:
    typeof Users;
  tone:
    | "violet"
    | "coral"
    | "sage"
    | "slate";
}) {
  const { t } = useLanguage();

  const tones = {
    violet:
      "bg-violet-soft text-violet",
    coral:
      "bg-coral-soft text-coral",
    sage:
      "bg-sage-soft text-sage",
    slate:
      "bg-slate-soft text-slate",
  };

  return (
    <AdminPanel className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div
          className={[
            "flex h-9 w-9 items-center justify-center rounded-xl",
            tones[tone],
          ].join(" ")}
        >
          <Icon
            size={17}
            strokeWidth={1.8}
          />
        </div>

        <span className="rounded-full bg-line-soft px-2 py-1 font-mono text-[9px] uppercase tracking-wide text-ink-faint">
          {t("common.live")}
        </span>
      </div>

      <p className="mt-4 font-serif text-[28px] font-semibold leading-none text-ink">
        {value}
      </p>

      <p className="mt-2 text-[12.5px] font-medium text-ink">
        {label}
      </p>

      <p className="mt-1 text-[10.5px] leading-4 text-ink-faint">
        {helper}
      </p>
    </AdminPanel>
  );
}

export default function AdminOverviewPage() {
  const {
    locale,
    t,
  } = useLanguage();
  const [
    dashboard,
    setDashboard,
  ] =
    useState<DashboardState>({
      overview: null,
      users: null,
      ai: null,
      health: null,
    });

  const [
    activity,
    setActivity,
  ] =
    useState<ActivityResponse | null>(
      null,
    );

  const [
    activityPage,
    setActivityPage,
  ] =
    useState(1);

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(true);

  const [
    isActivityLoading,
    setIsActivityLoading,
  ] =
    useState(true);

  const [
    errors,
    setErrors,
  ] =
    useState<string[]>([]);

  const [
    updatedAt,
    setUpdatedAt,
  ] =
    useState<Date | null>(
      null,
    );

  const loadDashboard =
    useCallback(
      async () => {
        setIsLoading(true);

        const results =
          await Promise.allSettled([
            getOverviewStats(),
            getUserStats(),
            getAdminAIUsage(),
            getHealth(),
          ]);

        const nextErrors:
          string[] = [];

        const [
          overviewResult,
          usersResult,
          aiResult,
          healthResult,
        ] = results;

        setDashboard({
          overview:
            overviewResult.status ===
            "fulfilled"
              ? overviewResult.value
              : null,

          users:
            usersResult.status ===
            "fulfilled"
              ? usersResult.value
              : null,

          ai:
            aiResult.status ===
            "fulfilled"
              ? aiResult.value
              : null,

          health:
            healthResult.status ===
            "fulfilled"
              ? healthResult.value
              : null,
        });

        if (
          overviewResult.status ===
          "rejected"
        ) {
          nextErrors.push(
            t("admin.overview.overviewUnavailable"),
          );
        }

        if (
          usersResult.status ===
          "rejected"
        ) {
          nextErrors.push(
            t("admin.overview.usersUnavailable"),
          );
        }

        if (
          aiResult.status ===
          "rejected"
        ) {
          nextErrors.push(
            t("admin.overview.aiUnavailable"),
          );
        }

        if (
          healthResult.status ===
          "rejected"
        ) {
          nextErrors.push(
            t("admin.overview.healthUnavailable"),
          );
        }

        setErrors(
          nextErrors,
        );

        setUpdatedAt(
          new Date(),
        );

        setIsLoading(false);
      },
      [t],
    );

  const loadActivity =
    useCallback(
      async (
        page: number,
      ) => {
        setIsActivityLoading(true);

        try {
          const result =
            await getAdminActivity({
              page,
              limit:
                ACTIVITY_LIMIT,
            });

          setActivity(result);
        } catch {
          setActivity(null);
        } finally {
          setIsActivityLoading(false);
        }
      },
      [],
    );

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    void loadActivity(
      activityPage,
    );
  }, [
    activityPage,
    loadActivity,
  ]);

  const aiRequestsToday =
    useMemo(
      () =>
        dashboard.ai?.providers.reduce(
          (total, provider) =>
            total +
            provider.requestsToday,
          0,
        ) ??
        0,
      [dashboard.ai],
    );

  const aiFailuresToday =
    useMemo(
      () =>
        dashboard.ai?.providers.reduce(
          (total, provider) =>
            total +
            provider.failuresToday,
          0,
        ) ??
        0,
      [dashboard.ai],
    );

  const aiSpendThisMonth =
    dashboard.ai?.monthlySpend ??
    dashboard.overview?.aiSpendThisMonth ??
    0;

  const activeProvider =
    dashboard.ai?.providers.find(
      (provider) =>
        provider.status ===
        "operational",
    );

  const activeUsers =
    dashboard.users?.active ??
    0;

  const inactiveUsers =
    dashboard.users?.inactive ??
    0;

  const noteConversion =
    dashboard.overview &&
    dashboard.overview.totalNotes > 0
      ? dashboard.overview
          .totalQuizzes /
        dashboard.overview
          .totalNotes *
        100
      : 0;

  const notesPerActiveUser =
    activeUsers > 0 &&
    dashboard.overview
      ? dashboard.overview
          .totalNotes /
        activeUsers
      : 0;

  const requestSeries =
    dashboard.ai
      ?.requestsLastSevenDays ??
    [];

  const maxRequests =
    Math.max(
      1,
      ...requestSeries.map(
        (item) =>
          item.value,
      ),
    );

  const requestTotal =
    requestSeries.reduce(
      (total, item) =>
        total +
        item.value,
      0,
    );

  const routeUsage =
    useMemo(
      () =>
        [
          ...(
            dashboard.ai
              ?.requestsByRoute ??
            []
          ),
        ]
          .sort(
            (left, right) =>
              right.count -
              left.count,
          )
          .slice(0, 5),
      [dashboard.ai],
    );

  const maxRouteCount =
    Math.max(
      1,
      ...routeUsage.map(
        (item) =>
          item.count,
      ),
    );

  const memoryPercent =
    dashboard.health &&
    dashboard.health.memory.total >
      0
      ? dashboard.health.memory.used /
        dashboard.health.memory.total *
        100
      : 0;

  const attentionItems =
    useMemo<
      AttentionItem[]
    >(() => {
      const items:
        AttentionItem[] = [];

      if (
        inactiveUsers > 0
      ) {
        items.push({
          id:
            "inactive-users",
          title:
            t(
              inactiveUsers === 1
                ? "admin.overview.inactiveAccountOne"
                : "admin.overview.inactiveAccounts",
              { count: inactiveUsers },
            ),
          detail:
            t("admin.overview.inactiveDetail"),
          tone:
            "warning",
          href:
            "/admin/users",
        });
      }

      if (
        aiFailuresToday > 0
      ) {
        items.push({
          id:
            "ai-failures",
          title:
            t(
              aiFailuresToday === 1
                ? "admin.overview.aiFailureOne"
                : "admin.overview.aiFailures",
              { count: aiFailuresToday },
            ),
          detail:
            t("admin.overview.aiFailureDetail"),
          tone:
            "danger",
          href:
            "/admin/ai-usage",
        });
      }

      if (
        dashboard.health &&
        !dashboard.health.database
          .connected
      ) {
        items.push({
          id:
            "database",
          title:
            t("admin.overview.databaseDisconnected"),
          detail:
            t("admin.overview.databaseDetail"),
          tone:
            "danger",
          href:
            "/admin/health",
        });
      }

      if (
        memoryPercent >= 80
      ) {
        items.push({
          id:
            "memory",
          title:
            t("admin.overview.memoryUsage", {
              value: formatPercent(memoryPercent),
            }),
          detail:
            t("admin.overview.memoryDetail"),
          tone:
            "warning",
          href:
            "/admin/health",
        });
      }

      if (
        dashboard.ai
          ?.warning
      ) {
        items.push({
          id:
            "telemetry",
          title:
            t("admin.overview.telemetryTemporary"),
          detail:
            dashboard.ai.warning,
          tone:
            "info",
          href:
            "/admin/ai-usage",
        });
      }

      return items;
    }, [
      aiFailuresToday,
      dashboard.ai,
      dashboard.health,
      inactiveUsers,
      memoryPercent,
      t,
    ]);

  const activities =
    Array.isArray(
      activity?.data,
    )
      ? activity.data
      : [];

  async function refreshAll() {
    await Promise.allSettled([
      loadDashboard(),
      loadActivity(
        activityPage,
      ),
    ]);
  }

  return (
    <>
      <Topbar
        eyebrow={t("admin.overview.eyebrow")}
        title={t("admin.overview.title")}
        actions={
          <button
            type="button"
            onClick={() =>
              void refreshAll()
            }
            disabled={
              isLoading ||
              isActivityLoading
            }
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-paper-raised px-3.5 text-[12px] font-medium text-ink-soft transition hover:bg-line-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              size={14}
              className={
                isLoading ||
                isActivityLoading
                  ? "animate-spin"
                  : undefined
              }
            />

            {t("common.refresh")}
          </button>
        }
      />

      <div className="-mt-5 mb-5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-ink-faint">
          {t("admin.overview.description")}
        </p>

        <p className="font-mono text-[10px] text-ink-faint">
          {updatedAt
            ? t("admin.overview.updated", {
                time: updatedAt.toLocaleTimeString(locale),
              })
            : t("admin.overview.loading")}
        </p>
      </div>

      {errors.length > 0 && (
        <div className="mb-5 rounded-xl border border-yellow/50 bg-yellow-soft px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle
              size={16}
              className="mt-0.5 shrink-0 text-[#8B6A0E]"
            />

            <div>
              <p className="text-[12px] font-medium text-ink">
                {t("admin.overview.partialError")}
              </p>

              <p className="mt-1 text-[11px] leading-5 text-ink-soft">
                {errors.join(
                  " ",
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      <section className="mb-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2 2xl:grid-cols-4">
        <KpiCard
          label={t("admin.overview.userAccounts")}
          value={
            isLoading
              ? "—"
              : formatNumber(
                  dashboard.overview
                    ?.totalUsers,
                )
          }
          helper={
            dashboard.users
              ? t("admin.overview.accountBreakdown", {
                  active: dashboard.users.active.toLocaleString(locale),
                  inactive: dashboard.users.inactive.toLocaleString(locale),
                  admins: dashboard.users.admins.toLocaleString(locale),
                })
              : t("admin.overview.accountBreakdownUnavailable")
          }
          icon={Users}
          tone="violet"
        />

        <KpiCard
          label={t("admin.overview.contentLibrary")}
          value={
            isLoading
              ? "—"
              : formatNumber(
                  dashboard.overview
                    ?.totalNotes,
                )
          }
          helper={
            notesPerActiveUser > 0
              ? t("admin.overview.notesPerUser", {
                  count: notesPerActiveUser.toFixed(1),
                })
              : t("admin.overview.uploadedAcrossUsers")
          }
          icon={BookOpen}
          tone="coral"
        />

        <KpiCard
          label={t("admin.overview.quizOutput")}
          value={
            isLoading
              ? "—"
              : formatNumber(
                  dashboard.overview
                    ?.totalQuizzes,
                )
          }
          helper={
            dashboard.overview
              ?.totalNotes
              ? t("admin.overview.quizConversion", {
                  value: formatPercent(noteConversion),
                })
              : t("admin.overview.generatedAssessments")
          }
          icon={FileQuestion}
          tone="sage"
        />

        <KpiCard
          label={t("admin.overview.aiRequests")}
          value={
            isLoading
              ? "—"
              : formatNumber(
                  aiRequestsToday,
                )
          }
          helper={
            activeProvider
              ? `${t("admin.overview.providerActive", {
                  provider: activeProvider.provider,
                  failures: aiFailuresToday,
                })} · Monthly cost $${aiSpendThisMonth.toFixed(2)}`
              : t("admin.overview.noProviderTelemetry")
          }
          icon={Bot}
          tone="slate"
        />
      </section>

      <section className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-[1.45fr_1fr]">
        <AdminPanel>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-serif text-[16px] font-semibold text-ink">
                {t("admin.overview.aiWorkload")}
              </h2>

              <p className="mt-1 text-[11px] text-ink-faint">
                {t("admin.overview.aiWorkloadDescription")}
              </p>
            </div>

            <span className="font-mono text-[11px] text-ink-soft">
              {t("admin.overview.total", {
                count: requestTotal.toLocaleString(),
              })}
            </span>
          </div>

          {requestSeries.length ===
          0 ? (
            <div className="flex h-[190px] items-center justify-center rounded-xl border border-dashed border-line text-[12px] text-ink-faint">
              {t("admin.overview.noHistory")}
            </div>
          ) : (
            <div className="flex h-[190px] items-end gap-2 sm:gap-3">
              {requestSeries.map(
                (item) => (
                  <div
                    key={item.label}
                    className="flex h-full min-w-0 flex-1 flex-col justify-end gap-2"
                  >
                    <div className="flex h-full items-end">
                      <div
                        className="w-full rounded-t-lg bg-violet transition-[height] duration-300"
                        style={{
                          height:
                            `${Math.max(
                              4,
                              item.value /
                                maxRequests *
                                100,
                            )}%`,
                        }}
                        title={t(
                          item.value === 1
                            ? "student.ai.requestCountOne"
                            : "student.ai.requestCount",
                          { count: item.value },
                        )}
                      />
                    </div>

                    <span className="text-center font-mono text-[10px] text-ink-faint">
                      {item.label}
                    </span>
                  </div>
                ),
              )}
            </div>
          )}
        </AdminPanel>

        <AdminPanel>
          <div className="mb-5">
            <h2 className="font-serif text-[16px] font-semibold text-ink">
              {t("admin.overview.workloadMix")}
            </h2>

            <p className="mt-1 text-[11px] text-ink-faint">
              {t("admin.overview.workloadMixDescription")}
            </p>
          </div>

          {routeUsage.length ===
          0 ? (
            <div className="flex h-[190px] items-center justify-center rounded-xl border border-dashed border-line text-center text-[12px] text-ink-faint">
              {t("admin.overview.noFeatureUsage")}
            </div>
          ) : (
            <div className="space-y-4">
              {routeUsage.map(
                (item) => (
                  <div
                    key={item.route}
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <span className="truncate text-[12px] font-medium capitalize text-ink">
                        {routeLabel(
                          item.route,
                        )}
                      </span>

                      <span className="shrink-0 font-mono text-[10.5px] text-ink-faint">
                        {item.count.toLocaleString()}
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-line-soft">
                      <div
                        className="h-full rounded-full bg-sage"
                        style={{
                          width:
                            `${Math.max(
                              4,
                              item.count /
                                maxRouteCount *
                                100,
                            )}%`,
                        }}
                      />
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </AdminPanel>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.45fr_1fr]">
        <AdminPanel>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Activity
                size={16}
                className="text-violet"
              />

              <div>
                <h2 className="font-serif text-[16px] font-semibold text-ink">
                  {t("admin.overview.recentActivity")}
                </h2>

                <p className="mt-0.5 text-[10.5px] text-ink-faint">
                  {t("admin.overview.auditEvents", {
                    count: activity?.meta.total.toLocaleString() ?? 0,
                  })}
                </p>
              </div>
            </div>

            <Link
              href="/admin/activity"
              className="text-[11px] font-medium text-ink-soft hover:text-ink"
            >
              {t("admin.overview.openAudit")}
            </Link>
          </div>

          {isActivityLoading ? (
            <div className="space-y-3">
              {Array.from({
                length: 5,
              }).map(
                (_, index) => (
                  <div
                    key={index}
                    className="h-11 animate-pulse rounded-lg bg-line-soft"
                  />
                ),
              )}
            </div>
          ) : activities.length ===
            0 ? (
            <p className="py-10 text-center text-[12px] text-ink-faint">
              {t("admin.overview.noActivity")}
            </p>
          ) : (
            <div className="divide-y divide-line-soft">
              {activities.map(
                (item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 py-3 first:pt-0"
                  >
                    <span
                      className={[
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        activityTone(
                          item.action,
                        ),
                      ].join(" ")}
                    />

                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] leading-5 text-ink">
                        {activityText(
                          item,
                          t("admin.health.system"),
                        )}
                      </p>

                      <p className="mt-0.5 font-mono text-[10px] text-ink-faint">
                        {timeAgo(
                          item.createdAt,
                          locale,
                          t,
                        )}
                      </p>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
            <button
              type="button"
              disabled={
                isActivityLoading ||
                !activity?.meta
                  .hasPrev
              }
              onClick={() =>
                setActivityPage(
                  (page) =>
                    Math.max(
                      1,
                      page - 1,
                    ),
                )
              }
              className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-[11px] text-ink-soft hover:bg-line-soft disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft
                size={13}
              />
              {t("common.previous")}
            </button>

            <span className="font-mono text-[10px] text-ink-faint">
              {t("notes.pageOf", {
                page: activity?.meta.page ?? activityPage,
                total: Math.max(activity?.meta.totalPages ?? 1, 1),
              })}
            </span>

            <button
              type="button"
              disabled={
                isActivityLoading ||
                !activity?.meta
                  .hasNext
              }
              onClick={() =>
                setActivityPage(
                  (page) =>
                    page + 1,
                )
              }
              className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-[11px] text-ink-soft hover:bg-line-soft disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("common.next")}
              <ChevronRight
                size={13}
              />
            </button>
          </div>
        </AdminPanel>

        <div className="space-y-5">
          <AdminPanel>
            <div className="mb-4 flex items-center gap-2">
              <ShieldAlert
                size={16}
                className={
                  attentionItems.length >
                  0
                    ? "text-coral"
                    : "text-sage"
                }
              />

              <div>
                <h2 className="font-serif text-[16px] font-semibold text-ink">
                  {t("admin.overview.attention")}
                </h2>

                <p className="mt-0.5 text-[10.5px] text-ink-faint">
                  {t("admin.overview.attentionDescription")}
                </p>
              </div>
            </div>

            {attentionItems.length ===
            0 ? (
              <div className="flex items-start gap-3 rounded-xl border border-sage/30 bg-sage-soft p-3">
                <CheckCircle2
                  size={16}
                  className="mt-0.5 shrink-0 text-sage"
                />

                <div>
                  <p className="text-[12.5px] font-medium text-ink">
                    {t("admin.overview.noUrgent")}
                  </p>

                  <p className="mt-1 text-[11px] leading-4 text-ink-soft">
                    {t("admin.overview.noUrgentDescription")}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {attentionItems
                  .slice(0, 4)
                  .map(
                    (item) => {
                      const tone = {
                        warning:
                          "border-yellow/40 bg-yellow-soft",
                        danger:
                          "border-coral/30 bg-coral-soft",
                        info:
                          "border-violet/25 bg-violet-soft",
                      }[
                        item.tone
                      ];

                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          className={[
                            "block rounded-xl border p-3 transition hover:-translate-y-0.5",
                            tone,
                          ].join(" ")}
                        >
                          <p className="text-[12px] font-medium text-ink">
                            {item.title}
                          </p>

                          <p className="mt-1 line-clamp-2 text-[10.5px] leading-4 text-ink-soft">
                            {item.detail}
                          </p>
                        </Link>
                      );
                    },
                  )}
              </div>
            )}
          </AdminPanel>

          <AdminPanel>
            <div className="mb-4 flex items-center gap-2">
              <HeartPulse
                size={16}
                className="text-sage"
              />

              <div>
                <h2 className="font-serif text-[16px] font-semibold text-ink">
                  {t("admin.overview.readiness")}
                </h2>

                <p className="mt-0.5 text-[10.5px] text-ink-faint">
                  {t("admin.overview.readinessDescription")}
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between rounded-xl border border-line-soft px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <Database
                    size={14}
                    className={
                      dashboard.health
                        ?.database
                        .connected
                        ? "text-sage"
                        : "text-coral"
                    }
                  />

                  <span className="text-[12px] text-ink">
                    MongoDB
                  </span>
                </div>

                <span className="font-mono text-[10.5px] text-ink-soft">
                  {dashboard.health
                    ?.database
                    .connected
                    ? `${dashboard.health.database.latencyMs ?? "—"}ms`
                    : dashboard.health
                        ?.database
                        .state ??
                      "unknown"}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-line-soft px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <Bot
                    size={14}
                    className={
                      dashboard.health
                        ?.ai
                        .configured
                        ? "text-sage"
                        : "text-coral"
                    }
                  />

                  <span className="text-[12px] capitalize text-ink">
                    {dashboard.health
                      ?.ai
                      .provider ??
                      t("admin.health.aiProvider")}
                  </span>
                </div>

                <span className="max-w-[140px] truncate font-mono text-[10.5px] text-ink-soft">
                  {dashboard.health
                    ?.ai
                    .model ??
                    "unknown"}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-line-soft px-3 py-2.5">
                <span className="text-[12px] text-ink">
                  {t("admin.health.uptime")}
                </span>

                <span className="font-mono text-[10.5px] text-ink-soft">
                  {formatUptime(
                    dashboard.health
                      ?.uptime,
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-line-soft px-3 py-2.5">
                <span className="text-[12px] text-ink">
                  {t("admin.overview.heapMemory")}
                </span>

                <span className="font-mono text-[10.5px] text-ink-soft">
                  {formatBytes(
                    dashboard.health
                      ?.memory
                      .used,
                  )}
                  {" / "}
                  {formatBytes(
                    dashboard.health
                      ?.memory
                      .total,
                  )}
                </span>
              </div>
            </div>
          </AdminPanel>
        </div>
      </section>
    </>
  );
}
