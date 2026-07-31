import {
  LayoutDashboard,
  FileText,
  AlignLeft,
  HelpCircle,
  Copy,
  MessageSquare,
  Users,
  Sparkles,
  Activity,
} from "lucide-react";

export const studentNavItems = [
  { href: "/student/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/student/notes", label: "Notes", icon: FileText },
  { href: "/student/summary", label: "Summary", icon: AlignLeft },
  { href: "/student/quiz", label: "Quiz", icon: HelpCircle },
  { href: "/student/flashcards", label: "Flashcards", icon: Copy },
  { href: "/student/chat", label: "Chat", icon: MessageSquare },
];

export const adminNavItems = [
  { href: "/admin/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/content", label: "Content", icon: FileText },
  { href: "/admin/ai-usage", label: "AI Usage", icon: Sparkles },
  { href: "/admin/health", label: "Health", icon: Activity },
];