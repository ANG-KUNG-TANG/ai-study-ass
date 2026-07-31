import { ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { SidebarFooter } from "@/components/layout/SiderbarFooter";
import { RequireRole } from "@/context/AuthContext";

export default function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <RequireRole section="student">
      <div className="flex min-h-screen overflow-hidden bg-[#FAF6EC]">
        <Sidebar variant="student" footer={<SidebarFooter showStreak />} />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </main>
      </div>
    </RequireRole>
  );
}