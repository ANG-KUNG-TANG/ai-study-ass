"use client";

import type { ReactNode } from "react";

import { RequireRole } from "@/context/AuthContext";
import { SidebarProvider } from "@/context/SidebarContext";
import { Sidebar } from "@/components/layout/Sidebar";
import { FloatingStudyNoteAssistant } from "@/components/study/FloatingStudyNoteAssistant";

export default function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <RequireRole section="student">
      <SidebarProvider>
        <div className="min-h-dvh bg-paper md:flex md:h-dvh md:overflow-hidden">
          <Sidebar variant="student" />

          <main className="min-w-0 flex-1 md:h-dvh md:overflow-y-auto">
            <div className="w-full px-4 py-6 sm:px-6 lg:px-8">{children}</div>
          </main>

          <FloatingStudyNoteAssistant />
        </div>
      </SidebarProvider>
    </RequireRole>
  );
}
