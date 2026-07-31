"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { ReactNode, useState, useEffect } from "react";
import { studentNavItems, adminNavItems } from "./nav-config";

interface SidebarProps {
  variant: "student" | "admin";
  footer?: ReactNode;
}

export function Sidebar({ variant, footer }: SidebarProps) {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const navItems = variant === "student" ? studentNavItems : adminNavItems;

  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  const navContent = (
    <>
      <div className="mb-6 flex items-center justify-between px-2">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-lg bg-ink">
            <span className="absolute bottom-[7px] left-[9px] h-[2px] w-3 rounded-full bg-yellow" />
            <svg viewBox="0 0 24 24" fill="none" className="h-[15px] w-[15px] text-paper">
              <path d="M4 4h16v16H4z" stroke="currentColor" strokeWidth="1.6" />
              <path d="M8 9h8M8 13h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
          <span className="font-serif text-[17px] font-semibold text-ink">Recall</span>
        </div>
        <button
          onClick={() => setIsMobileOpen(false)}
          className="rounded-md p-1 text-ink-soft hover:bg-line-soft md:hidden"
          aria-label="Close menu"
        >
          <X size={18} strokeWidth={1.8} />
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-[3px]">
        <span className="px-2 pb-1 font-mono text-[10px] font-medium uppercase tracking-wider text-ink-faint">
          {variant === "student" ? "Study" : "Overview"}
        </span>
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex w-full items-center gap-[11px] rounded-[9px] px-3 py-2.5 text-[13.5px] font-medium transition-colors ${
                isActive ? "bg-ink text-paper-raised" : "text-ink-soft hover:bg-line-soft hover:text-ink"
              }`}
            >
              <item.icon size={17} strokeWidth={1.6} className="flex-shrink-0" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {footer && <div className="mt-auto">{footer}</div>}
    </>
  );

  return (
    <>
      <div className="flex items-center justify-between border-b border-line bg-paper-raised px-4 py-3 md:hidden">
        <span className="font-serif text-[16px] font-semibold text-ink">Recall</span>
        <button
          onClick={() => setIsMobileOpen(true)}
          className="rounded-md p-1.5 text-ink-soft hover:bg-line-soft"
          aria-label="Open menu"
          aria-expanded={isMobileOpen}
        >
          <Menu size={20} strokeWidth={1.8} />
        </button>
      </div>

      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setIsMobileOpen(false)} aria-hidden="true" />
          <aside className="absolute left-0 top-0 flex h-full w-[260px] flex-col bg-paper-raised px-4 py-6 shadow-xl">
            {navContent}
          </aside>
        </div>
      )}

      <aside className="sticky top-0 hidden h-screen w-[230px] flex-shrink-0 flex-col border-r border-line bg-paper-raised px-4 py-6 md:flex">
        {navContent}
      </aside>
    </>
  );
}