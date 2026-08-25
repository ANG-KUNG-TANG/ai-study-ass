"use client";

import { useCallback, useEffect, useState } from "react";
import { Save, ShieldAlert, Trash2 } from "lucide-react";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { Topbar } from "@/components/layout/Topbar";
import {
  executeAdminRetention,
  getAdminSettings,
  previewAdminRetention,
  updateAdminSettings,
} from "@/services/admin.service";
import type { OperationalSettings } from "@/types/admin";

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<OperationalSettings | null>(null);
  const [preview, setPreview] = useState<{ auditLogs: number; content: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setSettings(await getAdminSettings());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Settings could not be loaded.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function update<K extends keyof OperationalSettings>(key: K, value: OperationalSettings[K]) {
    setSettings((current) => current ? { ...current, [key]: value } : current);
  }

  async function save() {
    if (!settings) return;
    const reason = window.prompt("Reason for changing operational settings:")?.trim();
    if (!reason) return;
    setBusy(true);
    try {
      const { id: _id, updatedBy: _updatedBy, createdAt: _createdAt, updatedAt: _updatedAt, ...input } = settings;
      setSettings(await updateAdminSettings(input, reason));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Settings update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function loadPreview() {
    try {
      setPreview(await previewAdminRetention());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Retention preview failed.");
    }
  }

  async function executeRetention() {
    if (!preview || !window.confirm(`Delete ${preview.auditLogs} old audit logs and ${preview.content} old content records?`)) return;
    const reason = window.prompt("Reason for executing retention now:")?.trim();
    if (!reason) return;
    setBusy(true);
    try {
      const result = await executeAdminRetention(reason);
      window.alert(`Deleted ${result.deletedAuditLogs} audit logs and ${result.deletedContent} content records.`);
      await loadPreview();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Retention execution failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Topbar eyebrow="Admin · System" title="Operational settings" />
      {error && <div className="mb-4 rounded-xl border border-coral/30 bg-coral-soft px-4 py-3 text-[12px] text-coral">{error}</div>}
      {!settings ? (
        <AdminPanel><p className="py-8 text-center text-[12px] text-ink-faint">Loading settings…</p></AdminPanel>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <AdminPanel>
              <h2 className="font-serif text-[17px] font-semibold">Feature controls</h2>
              <div className="mt-5 space-y-4 text-[12px]">
                <label className="flex items-center justify-between gap-4"><span><strong className="block">Uploads</strong><span className="text-[10px] text-ink-faint">Pause all new document uploads.</span></span><input type="checkbox" checked={settings.uploadsEnabled} onChange={(event) => update("uploadsEnabled", event.target.checked)} /></label>
                <label className="flex items-center justify-between gap-4"><span><strong className="block">AI-provider generation</strong><span className="text-[10px] text-ink-faint">Symbolic features remain available when disabled.</span></span><input type="checkbox" checked={settings.aiGenerationEnabled} onChange={(event) => update("aiGenerationEnabled", event.target.checked)} /></label>
                <label className="block text-ink-soft">Maximum upload size (MB)<input type="number" min={1} max={10} value={(settings.maxUploadSizeBytes / 1_048_576).toString()} onChange={(event) => update("maxUploadSizeBytes", Math.round(Number(event.target.value) * 1_048_576))} className="mt-1 w-full rounded-lg border border-line bg-transparent px-3 py-2" /></label>
                <div><p className="text-ink-soft">Allowed file types</p><div className="mt-2 flex gap-4">{(["pdf", "docx"] as const).map((type) => <label key={type} className="flex items-center gap-2 uppercase"><input type="checkbox" checked={settings.allowedFileTypes.includes(type)} onChange={(event) => update("allowedFileTypes", event.target.checked ? [...settings.allowedFileTypes, type] : settings.allowedFileTypes.filter((item) => item !== type))} /> {type}</label>)}</div></div>
              </div>
            </AdminPanel>

            <AdminPanel>
              <h2 className="font-serif text-[17px] font-semibold">Provider pricing</h2>
              <p className="mt-1 text-[10px] text-ink-faint">USD per one million tokens. Values drive estimated spend reporting.</p>
              <div className="mt-5 space-y-4">
                {(["openai", "gemini"] as const).map((provider) => (
                  <div key={provider} className="rounded-lg border border-line p-3">
                    <p className="text-[12px] font-medium capitalize">{provider}</p>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      {(["inputPerMillionUsd", "outputPerMillionUsd"] as const).map((field) => <label key={field} className="text-[10px] text-ink-soft">{field.startsWith("input") ? "Input" : "Output"}<input type="number" min={0} step="0.01" value={settings.pricing[provider][field]} onChange={(event) => update("pricing", { ...settings.pricing, [provider]: { ...settings.pricing[provider], [field]: Number(event.target.value) } })} className="mt-1 w-full rounded-lg border border-line bg-transparent px-3 py-2 text-[12px]" /></label>)}
                    </div>
                  </div>
                ))}
              </div>
            </AdminPanel>
          </div>

          <AdminPanel>
            <div className="flex items-start gap-3"><ShieldAlert size={18} className="mt-0.5 text-coral" /><div><h2 className="font-serif text-[17px] font-semibold">Retention policy</h2><p className="mt-1 text-[10px] text-ink-faint">Content retention at 0 is disabled. Preview before any manual execution.</p></div></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="text-[11px] text-ink-soft">Audit log days<input type="number" min={30} max={3650} value={settings.auditRetentionDays} onChange={(event) => update("auditRetentionDays", Number(event.target.value))} className="mt-1 w-full rounded-lg border border-line bg-transparent px-3 py-2" /></label>
              <label className="text-[11px] text-ink-soft">Content days (0 disables)<input type="number" min={0} max={3650} value={settings.contentRetentionDays} onChange={(event) => update("contentRetentionDays", Number(event.target.value))} className="mt-1 w-full rounded-lg border border-line bg-transparent px-3 py-2" /></label>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button disabled={busy} onClick={() => void loadPreview()} className="rounded-lg border border-line px-3 py-2 text-[12px]">Preview retention</button>
              {preview && <span className="text-[11px] text-ink-soft">{preview.auditLogs.toLocaleString()} logs and {preview.content.toLocaleString()} content records match.</span>}
              {preview && (preview.auditLogs > 0 || preview.content > 0) && <button disabled={busy} onClick={() => void executeRetention()} className="inline-flex items-center gap-2 rounded-lg border border-coral/30 px-3 py-2 text-[12px] text-coral"><Trash2 size={14} /> Execute now</button>}
            </div>
          </AdminPanel>

          <button disabled={busy || settings.allowedFileTypes.length === 0} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-lg bg-violet px-4 py-2.5 text-[12px] text-white disabled:opacity-50"><Save size={14} /> Save settings</button>
        </div>
      )}
    </>
  );
}
