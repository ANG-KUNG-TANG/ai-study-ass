import { ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { SidebarFooter } from "@/components/layout/SiderbarFooter";
import { RequireRole } from "@/context/AuthContext";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RequireRole section="admin">
      <div className="flex min-h-screen overflow-hidden bg-paper">
        <Sidebar variant="admin" footer={<SidebarFooter showStreak={false} />} />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </main>
      </div>
    </RequireRole>
  );
}