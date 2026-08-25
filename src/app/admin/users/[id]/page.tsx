"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { KeyRound, Save } from "lucide-react";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { Topbar } from "@/components/layout/Topbar";
import {
  getAdminUser,
  getAdminUserAIPolicy,
  revokeAdminUserSessions,
  updateAdminUserAIPolicy,
} from "@/services/admin.service";
import type { AdminUserAIPolicy } from "@/types/admin";
import type { User } from "@/types/user";

function optionalLimit(value: string): number | null {
  return value.trim() === "" ? null : Number(value);
}

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [policy, setPolicy] = useState<AdminUserAIPolicy | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [requests, setRequests] = useState("");
  const [tokens, setTokens] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [nextUser, nextPolicy] = await Promise.all([
        getAdminUser(id),
        getAdminUserAIPolicy(id),
      ]);
      setUser(nextUser);
      setPolicy(nextPolicy);
      setEnabled(nextPolicy.stored?.enabled ?? true);
      setRequests(nextPolicy.stored?.dailyRequestLimit?.toString() ?? "");
      setTokens(nextPolicy.stored?.dailyTokenLimit?.toString() ?? "");
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "User detail could not be loaded.");
    }
  }, [id]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function savePolicy() {
    const reason = window.prompt("Reason for changing this user's AI policy:")?.trim();
    if (!reason) return;
    setBusy(true);
    try {
      await updateAdminUserAIPolicy(id, {
        enabled,
        dailyRequestLimit: optionalLimit(requests),
        dailyTokenLimit: optionalLimit(tokens),
        reason,
      });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AI policy update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function revokeSessions() {
    const reason = window.prompt("Reason for revoking all active sessions:")?.trim();
    if (!reason) return;
    setBusy(true);
    try {
      await revokeAdminUserSessions(id, reason);
      window.alert("All access tokens and refresh sessions were revoked.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Session revocation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Topbar eyebrow="Admin · Users" title={user?.name ?? "User detail"} />
      {error && <div className="mb-4 rounded-xl border border-coral/30 bg-coral-soft px-4 py-3 text-[12px] text-coral">{error}</div>}
      {!user || !policy ? (
        <AdminPanel><p className="py-8 text-center text-[12px] text-ink-faint">Loading user controls…</p></AdminPanel>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <AdminPanel>
            <h2 className="font-serif text-[17px] font-semibold">Account</h2>
            <dl className="mt-4 space-y-3 text-[12px]">
              <div><dt className="text-ink-faint">Email</dt><dd className="mt-1">{user.email}</dd></div>
              <div><dt className="text-ink-faint">Role and status</dt><dd className="mt-1">{user.role} · {user.isActive ? "active" : "banned"}</dd></div>
              <div><dt className="text-ink-faint">Joined</dt><dd className="mt-1">{new Date(user.createdAt).toLocaleString()}</dd></div>
            </dl>
            <button disabled={busy} onClick={() => void revokeSessions()} className="mt-6 inline-flex items-center gap-2 rounded-lg border border-coral/30 px-3 py-2 text-[12px] text-coral disabled:opacity-50"><KeyRound size={14} /> Revoke all sessions</button>
          </AdminPanel>

          <AdminPanel>
            <h2 className="font-serif text-[17px] font-semibold">AI-provider access</h2>
            <p className="mt-1 text-[11px] text-ink-faint">Blank limits inherit the system defaults. A value of 0 means unlimited.</p>
            <label className="mt-5 flex items-center gap-3 text-[12px]"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Provider access enabled</label>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-[11px] text-ink-soft">Daily requests<input type="number" min={0} value={requests} onChange={(event) => setRequests(event.target.value)} placeholder="System default" className="mt-1 w-full rounded-lg border border-line bg-transparent px-3 py-2 text-[12px]" /></label>
              <label className="text-[11px] text-ink-soft">Daily tokens<input type="number" min={0} value={tokens} onChange={(event) => setTokens(event.target.value)} placeholder="System default" className="mt-1 w-full rounded-lg border border-line bg-transparent px-3 py-2 text-[12px]" /></label>
            </div>
            <div className="mt-4 rounded-lg bg-line-soft p-3 text-[11px] text-ink-soft">
              Effective today: {policy.effective.requestsUsed.toLocaleString()} / {policy.effective.requestLimit?.toLocaleString() ?? "unlimited"} requests; {policy.effective.tokensUsed.toLocaleString()} / {policy.effective.tokenLimit?.toLocaleString() ?? "unlimited"} tokens. Source: {policy.effective.source.replace("_", " ")}.
            </div>
            <button disabled={busy} onClick={() => void savePolicy()} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-violet px-3 py-2 text-[12px] text-white disabled:opacity-50"><Save size={14} /> Save AI policy</button>
          </AdminPanel>
        </div>
      )}
    </>
  );
}
