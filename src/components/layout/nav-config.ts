import { LayoutDashboard, FileText, AlignLeft, HelpCircle, Copy, MessageSquare, Users, Gauge, Activity, History, ShieldAlert, Settings, MessageSquareText } from "lucide-react";

export const studentNavItems = [
  { href: "/student/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/student/notes", label: "Notes", icon: FileText },
  { href: "/student/summary", label: "Summary", icon: AlignLeft },
  { href: "/student/quiz", label: "Quiz", icon: HelpCircle },
  { href: "/student/flashcards", label: "Flashcards", icon: Copy },
  { href: "/student/chat", label: "Chat", icon: MessageSquare },
  { href: "/student/ai-usage", label: "AI Usage", icon: Gauge },
  { href: "/student/feedback", label: "Feedback", icon: MessageSquareText },
];

export const adminNavItems = [
  { href: "/admin/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/content", label: "Content", icon: FileText },
  { href: "/admin/ai-usage", label: "AI Usage", icon: Gauge },
  { href: "/admin/activity", label: "Activity", icon: History },
  { href: "/admin/security", label: "Security", icon: ShieldAlert },
  { href: "/admin/health", label: "Health", icon: Activity },
  { href: "/admin/feedback", label: "Feedback", icon: MessageSquareText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];
