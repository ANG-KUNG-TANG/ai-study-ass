"use client";

import Link from "next/link";
import {
  usePathname,
} from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Menu,
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
  useSidebar,
} from "@/context/SidebarContext";
import {
  useLanguage,
} from "@/context/LanguageContext";
import type {
  TranslationKey,
} from "@/i18n/translations";
import {
  SidebarAccountMenu,
} from "@/components/layout/SidebarAccountMenu";

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
  Feedback: "nav.feedback",
  Settings: "nav.settings",
  "Original text": "nav.originalText",
};

interface SidebarProps {
  variant: "student" | "admin";
}

export function Sidebar({
  variant,
}: SidebarProps) {
  const pathname = usePathname();
  const { t } = useLanguage();

  const {
    isCollapsed,
    toggle,
  } = useSidebar();

  const [
    isMobileOpen,
    setIsMobileOpen,
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

  function navContent(
    collapsed: boolean,
  ) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {/* Brand */}
        <div
          className={[
            "mb-5 flex shrink-0 items-center border-b border-line px-2 pb-5",
            collapsed
              ? "justify-center"
              : "justify-between",
          ].join(" ")}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="relative flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md bg-ink">
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
              <span className="truncate font-serif text-[16px] font-semibold tracking-[-0.01em]">
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
          {!collapsed && (
            <div className="mb-2 px-3 font-mono text-[9.5px] font-medium uppercase tracking-[0.12em] text-ink-faint">
              {variant === "admin" ? "Manage" : "Study"}
            </div>
          )}
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
                    "flex w-full items-center rounded-r-[8px] border-l-2 py-2.5",
                    "text-[13.5px] font-medium transition-colors",
                    collapsed
                      ? "justify-center px-2"
                      : "gap-[11px] px-3",
                    isActive
                      ? "border-coral bg-line-soft text-ink"
                      : "border-transparent text-ink-soft hover:bg-line-soft hover:text-ink",
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

        {/* Account menu */}
        <div className="mt-4 shrink-0 border-t border-line pt-3">
          <SidebarAccountMenu
            variant={variant}
            collapsed={collapsed}
            onExpand={toggle}
          />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-paper-raised/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-7 w-7 items-center justify-center rounded-md bg-ink text-paper">
            <FileText size={14} strokeWidth={1.7} />
            <span className="absolute bottom-1.5 left-2 h-0.5 w-3 bg-yellow" />
          </div>
          <span className="font-serif text-[16px] font-semibold">
            {t("common.brand")}
          </span>
        </div>

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
          "border-r border-line bg-paper-raised py-5",
          "transition-[width,padding] duration-300 ease-out",
          "md:flex",
          isCollapsed
            ? "w-[72px] px-2"
            : "w-[224px] px-4",
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
