"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronUp,
  Info,
  Languages,
  LogOut,
  Settings,
  UserRound,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

interface SidebarAccountMenuProps {
  variant: "student" | "admin";
  collapsed: boolean;
  onExpand: () => void;
}

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "U"
  );
}

export function SidebarAccountMenu({
  variant,
  collapsed,
  onExpand,
}: SidebarAccountMenuProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { locale, setLocale, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  async function handleLogout() {
    setIsOpen(false);
    await logout();
    router.replace("/auth/login");
    router.refresh();
  }

  function handleTrigger() {
    if (collapsed) {
      onExpand();
      setIsOpen(true);
      return;
    }

    setIsOpen((current) => !current);
  }

  const displayName = user?.name || t("sidebar.account");
  const profileHref =
    variant === "admin" && user
      ? `/admin/users/${user.id}`
      : "/student/profile";
  const settingsHref =
    variant === "admin" ? "/admin/settings" : "/student/settings";
  const aboutHref = variant === "admin" ? "/admin/about" : "/student/about";
  const roleLabel =
    variant === "admin" ? t("sidebar.adminRole") : t("sidebar.studentRole");
  const nextLocale = locale === "en" ? "my" : "en";

  return (
    <div ref={menuRef} className="relative">
      {isOpen && (
        <div
          role="menu"
          aria-label={t("sidebar.accountMenu")}
          className={[
            "absolute bottom-[calc(100%+10px)] left-0 z-[70]",
            "w-[272px] max-w-[calc(100vw-2rem)] overflow-hidden",
            "rounded-[12px] border border-line bg-paper-raised p-2",
            "text-ink shadow-[0_16px_36px_rgba(45,40,32,0.13)]",
          ].join(" ")}
        >
          <div className="flex items-center gap-3 px-2.5 py-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-[12px] font-semibold text-paper-raised">
              {initials(displayName)}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-semibold">
                {displayName}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-ink-faint">
                {user?.email || roleLabel}
              </p>
            </div>

            <span className="rounded-full bg-yellow-soft px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
              {roleLabel}
            </span>
          </div>

          <div className="my-1 border-t border-line" />

          <Link
            href={profileHref}
            role="menuitem"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13px] text-ink-soft transition-colors hover:bg-line-soft hover:text-ink"
          >
            <UserRound size={17} strokeWidth={1.7} aria-hidden="true" />
            {t("nav.profile")}
          </Link>

          <Link
            href={settingsHref}
            role="menuitem"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13px] text-ink-soft transition-colors hover:bg-line-soft hover:text-ink"
          >
            <Settings size={17} strokeWidth={1.7} aria-hidden="true" />
            {t("nav.settings")}
          </Link>

          <button
            type="button"
            role="menuitem"
            onClick={() => setLocale(nextLocale)}
            className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[13px] text-ink-soft transition-colors hover:bg-line-soft hover:text-ink"
          >
            <Languages size={17} strokeWidth={1.7} aria-hidden="true" />
            <span className="flex-1">{t("common.language")}</span>
            <span className="rounded-md bg-line-soft px-1.5 py-0.5 text-[10px] font-semibold text-ink-faint">
              {locale === "en" ? "EN" : "မြန်မာ"}
            </span>
          </button>

          <div className="my-1 border-t border-line" />

          <Link
            href={aboutHref}
            role="menuitem"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13px] text-ink-soft transition-colors hover:bg-line-soft hover:text-ink"
          >
            <Info size={17} strokeWidth={1.7} aria-hidden="true" />
            {t("sidebar.aboutTitle")}
          </Link>

          <button
            type="button"
            role="menuitem"
            onClick={() => void handleLogout()}
            className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[13px] text-ink-soft transition-colors hover:bg-coral-soft hover:text-coral"
          >
            <LogOut size={17} strokeWidth={1.7} aria-hidden="true" />
            {t("sidebar.logout")}
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={handleTrigger}
        title={collapsed ? t("sidebar.accountMenu") : undefined}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={[
          "flex w-full items-center rounded-[8px] py-2 transition-colors",
          "text-ink-soft hover:bg-line-soft hover:text-ink",
          collapsed ? "justify-center px-1" : "gap-2.5 px-2",
        ].join(" ")}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-paper-raised">
          {initials(displayName)}
        </div>

        {!collapsed && (
          <>
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-[12.5px] font-semibold text-ink">
                {displayName}
              </p>
              <p className="mt-0.5 truncate text-[10.5px] text-ink-faint">
                {roleLabel}
              </p>
            </div>

            <ChevronUp
              size={15}
              strokeWidth={1.7}
              className={[
                "shrink-0 transition-transform duration-200",
                isOpen ? "" : "rotate-180",
              ].join(" ")}
              aria-hidden="true"
            />
          </>
        )}
      </button>
    </div>
  );
}
