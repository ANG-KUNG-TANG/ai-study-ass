"use client";

import type {
  ReactNode,
} from "react";

import {
  RequireRole,
} from "@/context/AuthContext";
import {
  SidebarProvider,
} from "@/context/SidebarContext";
import {
  Sidebar,
} from "@/components/layout/Sidebar";

export default function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <RequireRole section="admin">
      <SidebarProvider>
        <div className="min-h-dvh bg-paper md:flex md:h-dvh md:overflow-hidden">
          <Sidebar variant="admin" />

          <main className="min-w-0 flex-1 md:h-dvh md:overflow-y-auto">
            <div className="mx-auto w-full max-w-[1560px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
              {children}
            </div>
          </main>
        </div>
      </SidebarProvider>
    </RequireRole>
  );
}
