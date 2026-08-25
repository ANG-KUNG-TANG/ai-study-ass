"use client";

import Link from "next/link";
import {
  usePathname,
  useRouter,
} from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Info,
  LogOut,
  Menu,
  Settings,
  UserRound,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";

import {
  studentNavItems,
  adminNavItems,
} from "./nav-config";
import {
  StreakBox,
} from "@/components/notes/StreakBox";
import {
  LanguageSwitcher,
} from "@/components/i18n/LanguageSwitcher";
import {
  useAuth,
} from "@/context/AuthContext";
import {
  useSidebar,
} from "@/context/SidebarContext";
import {
  useLanguage,
} from "@/context/LanguageContext";
import type {
  TranslationKey,
} from "@/i18n/translations";

const NAVIGATION_KEYS: Record<string, TranslationKey> = {
  Dashboard: "nav.dashboard",
  Notes: "nav.notes",
  Summary: "nav.summary",
  Quiz: "nav.quiz",
  Flashcards: "nav.flashcards",
  Chat: "nav.chat",
  Overview: "nav.overview",
  Users: "nav.users",
  Content: "nav.content",
  "AI Usage": "nav.aiUsage",
  Health: "nav.health",
  "Original text": "nav.originalText",
};

const STUDENT_ACCOUNT_ITEMS = [
  {
    href: "/student/profile",
    labelKey: "nav.profile" as const,
    icon: UserRound,
  },
  {
    href: "/student/settings",
    labelKey: "nav.settings" as const,
    icon: Settings,
  },
];

interface SidebarProps {
  variant: "student" | "admin";
}

export function Sidebar({
  variant,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const { logout } = useAuth();
  const { t } = useLanguage();

  const {
    isCollapsed,
    toggle,
  } = useSidebar();

  const [
    isMobileOpen,
    setIsMobileOpen,
  ] = useState(false);

  const [
    isAboutOpen,
    setIsAboutOpen,
  ] = useState(false);

  const noteMatch =
    variant === "student"
      ? pathname?.match(
          /^\/student\/notes\/([^/]+)(?:\/|$)/,
        )
      : null;

  const currentNoteId =
    noteMatch?.[1];

  const noteSourceItem =
    currentNoteId
      ? {
          href:
            `/student/notes/${currentNoteId}/original`,
          label:
            "Original text",
          icon:
            FileText,
        }
      : null;

  const navItems =
    variant === "student"
      ? [
          ...studentNavItems,
          ...(noteSourceItem
            ? [noteSourceItem]
            : []),
        ]
      : adminNavItems;

  const activeHref =
    navItems
      .filter(
        (
          item,
        ) =>
          pathname ===
            item.href ||
          pathname?.startsWith(
            `${item.href}/`,
          ),
      )
      .sort(
        (
          left,
          right,
        ) =>
          right.href.length -
          left.href.length,
      )[0]?.href;

  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  async function handleLogout() {
    await logout();

    router.replace("/auth/login");
    router.refresh();
  }

  function handleAboutToggle(collapsed: boolean) {
    if (collapsed) {
      toggle();
      setIsAboutOpen(true);
      return;
    }

    setIsAboutOpen((current) => !current);
  }

  function navContent(
    collapsed: boolean,
  ) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {/* Brand */}
        <div
          className={[
            "mb-6 flex shrink-0 items-center px-2",
            collapsed
              ? "justify-center"
              : "justify-between",
          ].join(" ")}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="relative flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-ink">
              <span className="absolute bottom-[7px] left-[9px] h-[2px] w-3 rounded-full bg-yellow" />

              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-[15px] w-[15px] text-paper"
                aria-hidden="true"
              >
                <path
                  d="M4 4h16v16H4z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />

                <path
                  d="M8 9h8M8 13h5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            {!collapsed && (
              <span className="truncate font-serif text-[17px] font-semibold">
                {t("common.brand")}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() =>
              setIsMobileOpen(false)
            }
            className="rounded-md p-1 text-ink-soft hover:bg-line-soft md:hidden"
            aria-label={t("sidebar.closeMenu")}
          >
            <X
              size={18}
              strokeWidth={1.8}
            />
          </button>
        </div>

        {/* Navigation */}
        <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="flex flex-col gap-[3px]">
            {navItems.map((item) => {
              const isActive =
                activeHref ===
                item.href;
              const labelKey =
                NAVIGATION_KEYS[item.label];
              const localizedLabel =
                labelKey
                  ? t(labelKey)
                  : item.label;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={
                    isActive
                      ? "page"
                      : undefined
                  }
                  title={
                    collapsed
                      ? localizedLabel
                      : undefined
                  }
                  className={[
                    "flex w-full items-center rounded-[9px] py-2.5",
                    "text-[13.5px] font-medium transition-colors",
                    collapsed
                      ? "justify-center px-2"
                      : "gap-[11px] px-3",
                    isActive
                      ? "bg-ink text-paper-raised"
                      : "text-ink-soft hover:bg-line-soft hover:text-ink",
                  ].join(" ")}
                >
                  <item.icon
                    size={17}
                    strokeWidth={1.6}
                    className="shrink-0"
                    aria-hidden="true"
                  />

                  {!collapsed && (
                    <span className="truncate">
                      {localizedLabel}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Student streak */}
        {variant === "student" &&
          !collapsed && (
            <div className="mt-4 shrink-0">
              <StreakBox
                days={6}
                message={t("sidebar.streak")}
              />
            </div>
          )}

        <div
          className={[
            "mt-4 flex shrink-0",
            collapsed ? "justify-center" : "justify-start",
          ].join(" ")}
        >
          <LanguageSwitcher compact={collapsed} />
        </div>

        {/* Account navigation */}
        <div className="mt-4 shrink-0 border-t border-line pt-3">
          {variant === "student" && !collapsed && (
            <p className="mb-1.5 px-3 font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-faint">
              {t("sidebar.account")}
            </p>
          )}

          {variant === "student" && (
            <div className="mb-1 flex flex-col gap-[3px]">
              {STUDENT_ACCOUNT_ITEMS.map((item) => {
                const isActive =
                  pathname === item.href || pathname?.startsWith(`${item.href}/`);
                const label = t(item.labelKey);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    title={collapsed ? label : undefined}
                    className={[
                      "flex w-full items-center rounded-[9px] py-2.5",
                      "text-[13.5px] font-medium transition-colors",
                      collapsed ? "justify-center px-2" : "gap-[11px] px-3",
                      isActive
                        ? "bg-ink text-paper-raised"
                        : "text-ink-soft hover:bg-line-soft hover:text-ink",
                    ].join(" ")}
                  >
                    <item.icon
                      size={17}
                      strokeWidth={1.6}
                      className="shrink-0"
                      aria-hidden="true"
                    />

                    {!collapsed && <span>{label}</span>}
                  </Link>
                );
              })}
            </div>
          )}

          <div className="mb-1">
            <button
              type="button"
              onClick={() => handleAboutToggle(collapsed)}
              title={collapsed ? t("sidebar.aboutTitle") : undefined}
              aria-expanded={!collapsed && isAboutOpen}
              className={[
                "flex w-full items-center rounded-[9px] py-2.5",
                "text-[13.5px] font-medium text-ink-soft",
                "transition-colors hover:bg-line-soft hover:text-ink",
                collapsed
                  ? "justify-center px-2"
                  : "gap-[11px] px-3",
              ].join(" ")}
            >
              <Info
                size={17}
                strokeWidth={1.6}
                className="shrink-0"
                aria-hidden="true"
              />

              {!collapsed && (
                <>
                  <span className="min-w-0 flex-1 truncate text-left">
                    {t("sidebar.aboutTitle")}
                  </span>

                  <ChevronDown
                    size={15}
                    strokeWidth={1.7}
                    className={[
                      "shrink-0 transition-transform duration-200",
                      isAboutOpen ? "rotate-180" : "",
                    ].join(" ")}
                    aria-hidden="true"
                  />
                </>
              )}
            </button>

            {!collapsed && isAboutOpen && (
              <div
                role="region"
                aria-label={t("sidebar.aboutTitle")}
                className="mx-2 mb-2 rounded-[9px] border border-line bg-paper px-3 py-2.5"
              >
                <p className="text-[11.5px] leading-[1.55] text-ink-soft">
                  {t("sidebar.aboutDescription")}
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() =>
              void handleLogout()
            }
            title={
              collapsed
                ? t("sidebar.logout")
                : undefined
            }
            className={[
              "flex w-full items-center rounded-[9px] py-2.5",
              "text-[13.5px] font-medium text-ink-soft",
              "transition-colors hover:bg-coral-soft hover:text-coral",
              collapsed
                ? "justify-center px-2"
                : "gap-[11px] px-3",
            ].join(" ")}
          >
            <LogOut
              size={17}
              strokeWidth={1.6}
              className="shrink-0"
              aria-hidden="true"
            />

            {!collapsed && (
              <span>{t("sidebar.logout")}</span>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-line bg-paper-raised px-4 py-3 md:hidden">
        <span className="font-serif text-[16px] font-semibold">
          {t("common.brand")}
        </span>

        <button
          type="button"
          onClick={() =>
            setIsMobileOpen(true)
          }
          className="rounded-md p-1.5 text-ink-soft hover:bg-line-soft"
          aria-label={t("sidebar.openMenu")}
          aria-expanded={isMobileOpen}
        >
          <Menu
            size={20}
            strokeWidth={1.8}
          />
        </button>
      </div>

      {/* Mobile drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink/40"
            onClick={() =>
              setIsMobileOpen(false)
            }
            aria-label={t("sidebar.closeMenu")}
          />

          <aside className="absolute inset-y-0 left-0 z-10 w-[260px] bg-paper-raised px-4 py-6 shadow-xl">
            {navContent(false)}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside
        className={[
          "relative hidden h-dvh shrink-0 flex-col",
          "border-r border-line bg-paper-raised py-6",
          "transition-[width,padding] duration-300 ease-out",
          "md:flex",
          isCollapsed
            ? "w-[72px] px-2"
            : "w-[230px] px-4",
        ].join(" ")}
      >
        {navContent(isCollapsed)}

        {/* Desktop collapse toggle */}
        <button
          type="button"
          onClick={toggle}
          className={[
            "absolute -right-3 top-6 z-50",
            "hidden h-6 w-6 items-center justify-center",
            "rounded-full border border-line bg-paper-raised",
            "text-ink-soft shadow-sm transition-colors",
            "hover:bg-line-soft md:flex",
          ].join(" ")}
          aria-label={
            isCollapsed
              ? t("sidebar.expand")
              : t("sidebar.collapse")
          }
        >
          {isCollapsed ? (
            <ChevronRight
              size={13}
              strokeWidth={2}
            />
          ) : (
            <ChevronLeft
              size={13}
              strokeWidth={2}
            />
          )}
        </button>
      </aside>
    </>
  );
}
