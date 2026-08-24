"use client";

import Link from "next/link";
import { useState } from "react";
import { BadgeCheck, CalendarDays, Mail, Settings } from "lucide-react";

import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { updateProfile } from "@/services/user.service";

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "U";
}

export default function StudentProfilePage() {
  const { user, refreshUser } = useAuth();
  const { locale, t } = useLanguage();
  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || saving || name.trim() === user.name) return;

    setSaving(true);
    setSuccess(false);
    setError(null);

    try {
      const updated = await updateProfile({ name });
      setName(updated.name);
      await refreshUser();
      setSuccess(true);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : t("profile.updateFailed"),
      );
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  const joined = new Date(user.createdAt);
  const joinedLabel = Number.isNaN(joined.getTime())
    ? t("common.unknownDate")
    : joined.toLocaleDateString(locale, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

  return (
    <>
      <Topbar
        eyebrow={t("profile.eyebrow")}
        title={t("profile.title")}
        actions={
          <Link
            href="/student/settings"
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-paper-raised px-3 py-2 text-[12px] font-medium text-ink-soft transition-colors hover:text-ink"
          >
            <Settings size={14} />
            {t("profile.openSettings")}
          </Link>
        }
      />

      <p className="-mt-4 mb-6 text-[13px] text-ink-soft">
        {t("profile.description")}
      </p>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
        <Card>
          <div className="flex flex-wrap items-center gap-4 border-b border-line pb-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-ink font-serif text-xl font-semibold text-paper-raised">
              {initials(user.name)}
            </div>
            <div>
              <h2 className="font-serif text-xl font-semibold text-ink">
                {user.name}
              </h2>
              <p className="mt-1 text-[12px] text-ink-soft">{user.email}</p>
            </div>
          </div>

          <form onSubmit={handleSave} className="mt-5 space-y-4">
            <div>
              <h3 className="text-[13px] font-semibold text-ink">
                {t("profile.personalDetails")}
              </h3>
              <p className="mt-1 text-[11px] leading-5 text-ink-faint">
                {t("profile.personalDetailsDescription")}
              </p>
            </div>

            <Input
              id="profile-name"
              label={t("common.name")}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setSuccess(false);
              }}
              minLength={2}
              maxLength={100}
              autoComplete="name"
              required
            />

            {success && (
              <p className="rounded-xl bg-sage-soft px-3 py-2 text-[12px] text-sage" aria-live="polite">
                {t("profile.updated")}
              </p>
            )}
            {error && (
              <p className="rounded-xl bg-coral-soft px-3 py-2 text-[12px] text-coral" role="alert">
                {error}
              </p>
            )}

            <Button
              type="submit"
              variant="dark"
              disabled={saving || name.trim().length < 2 || name.trim() === user.name}
            >
              {saving ? t("profile.saving") : t("profile.save")}
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="font-serif text-[17px] font-semibold text-ink">
            {t("profile.accountDetails")}
          </h2>

          <dl className="mt-5 space-y-5">
            <div className="flex gap-3">
              <Mail className="mt-0.5 shrink-0 text-ink-faint" size={17} />
              <div className="min-w-0">
                <dt className="text-[11px] uppercase tracking-[0.08em] text-ink-faint">
                  {t("common.email")}
                </dt>
                <dd className="mt-1 break-all text-[13px] text-ink">{user.email}</dd>
              </div>
            </div>

            <div className="flex gap-3">
              <BadgeCheck className="mt-0.5 shrink-0 text-sage" size={17} />
              <div>
                <dt className="text-[11px] uppercase tracking-[0.08em] text-ink-faint">
                  {t("profile.emailStatus")}
                </dt>
                <dd className="mt-1 text-[13px] text-ink">
                  {user.emailVerified
                    ? t("profile.verified")
                    : t("profile.notVerified")}
                </dd>
              </div>
            </div>

            <div className="flex gap-3">
              <CalendarDays className="mt-0.5 shrink-0 text-ink-faint" size={17} />
              <div>
                <dt className="text-[11px] uppercase tracking-[0.08em] text-ink-faint">
                  {t("profile.memberSince")}
                </dt>
                <dd className="mt-1 text-[13px] text-ink">{joinedLabel}</dd>
              </div>
            </div>
          </dl>
        </Card>
      </div>
    </>
  );
}
