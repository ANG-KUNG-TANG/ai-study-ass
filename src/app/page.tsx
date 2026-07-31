// src/app/page.tsx
//
// The App Router requires an explicit page.tsx to serve "/" — without one,
// Next 404s the root route (which is what was happening here). This is a
// server component that redirects immediately; it does no auth check itself
// because LoginPage doesn't currently redirect already-authenticated users
// away from /auth/login either, so this keeps behavior consistent rather
// than introducing a different auth-check pattern in just one place.
//
// If/when you want "/" to send logged-in users straight to their dashboard
// instead of through the login page, that's the place to add the check —
// either here (reading the auth cookie server-side) or in middleware.ts.

import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/auth/login");
}