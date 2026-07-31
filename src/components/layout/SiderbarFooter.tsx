"use client";

import { LogOut, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { StreakBox } from "@/components/notes/StreakBox";

interface SidebarFooterProps {
  showStreak?: boolean;
}

export function SidebarFooter({ showStreak = true }: SidebarFooterProps) {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="flex flex-col gap-4">
      {showStreak && (
        <StreakBox days={6} message="Review 2 more flashcard decks today to keep it going." />
      )}

      <div className="border-t border-line pt-4">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-yellow text-ink">
            <User size={18} />
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="truncate text-[13px] font-medium text-ink">{user?.name || "Admin"}</div>
            <div className="truncate text-[11px] text-ink-soft">{user?.email || "admin@recall.ai"}</div>
          </div>
        </div>
        <Button
          variant="ghost"
          className="mt-1 w-full justify-start gap-2 px-3 text-[13px] text-ink-soft hover:text-coral"
          onClick={handleLogout}
        >
          <LogOut size={16} />
          Log out
        </Button>
      </div>
    </div>
  );
}