"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Globe2,
  KeyRound,
  Laptop2,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useLanguage } from "@/context/LanguageContext";
import { setAccessToken } from "@/lib/auth-token-store";
import {
  changePassword,
  logoutAllSessions,
} from "@/services/auth.service";
import { deleteAccount, getProfile } from "@/services/user.service";
import type { AccountProfile } from "@/types/user";

export default function StudentSettingsPage() {
  const { locale, setLocale, t } = useLanguage();
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);
  const [revokingSessions, setRevokingSessions] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void getProfile()
        .then((result) => {
          if (active) setProfile(result);
        })
        .catch((cause: unknown) => {
          if (!active) return;
          setLoadError(
            cause instanceof Error ? cause.message : t("settings.loadFailed"),
          );
        });
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [t]);

  async function handleChangePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (changingPassword) return;

    setPasswordError(null);
    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordError(t("settings.passwordMismatch"));
      return;
    }

    setChangingPassword(true);
    try {
      await changePassword(passwords);
      setAccessToken(null);
      window.location.replace("/auth/login?password_changed=1");
    } catch (cause) {
      setPasswordError(
        cause instanceof Error ? cause.message : t("settings.passwordFailed"),
      );
      setChangingPassword(false);
    }
  }

  async function handleLogoutAll() {
    if (revokingSessions) return;
    setRevokingSessions(true);
    setSessionError(null);

    try {
      await logoutAllSessions();
      setAccessToken(null);
      window.location.replace("/auth/login?sessions_revoked=1");
    } catch (cause) {
      setSessionError(
        cause instanceof Error ? cause.message : t("settings.sessionsFailed"),
      );
      setRevokingSessions(false);
    }
  }

  async function handleDelete(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (deleting || !deleteConfirmed) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      await deleteAccount(deletePassword);
      setAccessToken(null);
      window.location.replace("/auth/register?account_deleted=1");
    } catch (cause) {
      setDeleteError(
        cause instanceof Error ? cause.message : t("settings.deleteFailed"),
      );
      setDeleting(false);
    }
  }

  return (
    <>
      <Topbar
        eyebrow={t("settings.eyebrow")}
        title={t("settings.title")}
        description={t("settings.description")}
      />

      {loadError && (
        <div className="mb-5 border-l-[3px] border-coral bg-coral-soft px-4 py-3 text-[12px] text-coral">
          {loadError}
        </div>
      )}

      <div className="space-y-5">
        <Card className="rounded-none border-x-0 bg-transparent px-0">
          <div className="flex gap-3">
            <Globe2 className="mt-0.5 shrink-0 text-ink-faint" size={19} />
            <div className="flex-1">
              <h2 className="font-serif text-[17px] font-semibold text-ink">
                {t("settings.language")}
              </h2>
              <p className="mt-1 text-[12px] leading-5 text-ink-faint">
                {t("settings.languageDescription")}
              </p>
              <div className="mt-4 inline-flex rounded-[8px] border border-line bg-paper p-1">
                <button
                  type="button"
                  onClick={() => setLocale("en")}
                  aria-pressed={locale === "en"}
                  className={`rounded-lg px-4 py-2 text-[12px] font-semibold transition-colors ${
                    locale === "en"
                      ? "bg-ink text-paper-raised"
                      : "text-ink-soft hover:text-ink"
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setLocale("my")}
                  aria-pressed={locale === "my"}
                  className={`rounded-lg px-4 py-2 text-[12px] font-semibold transition-colors ${
                    locale === "my"
                      ? "bg-ink text-paper-raised"
                      : "text-ink-soft hover:text-ink"
                  }`}
                >
                  မြန်မာ
                </button>
              </div>
            </div>
          </div>
        </Card>

        <Card className="rounded-none border-x-0 bg-transparent px-0">
          <div className="flex gap-3">
            <KeyRound className="mt-0.5 shrink-0 text-ink-faint" size={19} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-serif text-[17px] font-semibold text-ink">
                    {t("settings.password")}
                  </h2>
                  <p className="mt-1 text-[12px] leading-5 text-ink-faint">
                    {t("settings.passwordDescription")}
                  </p>
                </div>
                {profile?.googleConnected && (
                  <span className="rounded-full bg-line-soft px-2.5 py-1 text-[10px] font-medium text-ink-soft">
                    {t("settings.googleConnected")}
                  </span>
                )}
              </div>

              {!profile && !loadError && (
                <p className="mt-4 text-[12px] text-ink-faint">
                  {t("common.loading")}
                </p>
              )}

              {profile && !profile.passwordConfigured && (
                <div className="mt-4 border-l-[3px] border-yellow bg-yellow-soft/50 px-4 py-3">
                  <p className="text-[12px] leading-5 text-ink-soft">
                    {t("settings.googlePasswordHelp")}
                  </p>
                  <Link
                    href={`/auth/forgot-password?email=${encodeURIComponent(profile.email)}`}
                    className="mt-2 inline-block text-[12px] font-semibold text-ink underline underline-offset-2"
                  >
                    {t("settings.createPassword")}
                  </Link>
                </div>
              )}

              {profile?.passwordConfigured && (
                <form onSubmit={handleChangePassword} className="mt-5 grid gap-3 lg:max-w-xl">
                  <Input
                    id="current-password"
                    label={t("settings.currentPassword")}
                    type="password"
                    autoComplete="current-password"
                    value={passwords.currentPassword}
                    onChange={(event) =>
                      setPasswords({ ...passwords, currentPassword: event.target.value })
                    }
                    required
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      id="new-password"
                      label={t("settings.newPassword")}
                      type="password"
                      autoComplete="new-password"
                      value={passwords.newPassword}
                      onChange={(event) =>
                        setPasswords({ ...passwords, newPassword: event.target.value })
                      }
                      required
                    />
                    <Input
                      id="confirm-new-password"
                      label={t("settings.confirmPassword")}
                      type="password"
                      autoComplete="new-password"
                      value={passwords.confirmPassword}
                      onChange={(event) =>
                        setPasswords({ ...passwords, confirmPassword: event.target.value })
                      }
                      required
                    />
                  </div>
                  <p className="text-[11px] leading-5 text-ink-faint">
                    {t("register.passwordHelp")}
                  </p>
                  {passwordError && (
                    <p className="rounded-[8px] bg-coral-soft px-3 py-2 text-[12px] text-coral" role="alert">
                      {passwordError}
                    </p>
                  )}
                  <div>
                    <Button type="submit" disabled={changingPassword}>
                      {changingPassword
                        ? t("settings.changingPassword")
                        : t("settings.changePassword")}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </Card>

        <Card className="rounded-none border-x-0 bg-transparent px-0">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex gap-3">
              <Laptop2 className="mt-0.5 shrink-0 text-ink-faint" size={19} />
              <div>
                <h2 className="font-serif text-[17px] font-semibold text-ink">
                  {t("settings.sessions")}
                </h2>
                <p className="mt-1 max-w-2xl text-[12px] leading-5 text-ink-faint">
                  {t("settings.sessionsDescription")}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={revokingSessions}
              onClick={() => void handleLogoutAll()}
            >
              {revokingSessions
                ? t("settings.signingOut")
                : t("settings.signOutAll")}
            </Button>
          </div>
          {sessionError && (
            <p className="mt-3 rounded-[8px] bg-coral-soft px-3 py-2 text-[12px] text-coral" role="alert">
              {sessionError}
            </p>
          )}
        </Card>

        <Card className="rounded-none border-x-0 border-l-[3px] border-l-coral bg-transparent pl-4">
          <div className="flex gap-3">
            <ShieldAlert className="mt-0.5 shrink-0 text-coral" size={19} />
            <div className="min-w-0 flex-1">
              <h2 className="font-serif text-[17px] font-semibold text-ink">
                {t("settings.dangerZone")}
              </h2>
              <p className="mt-1 text-[12px] leading-5 text-ink-faint">
                {t("settings.deleteDescription")}
              </p>

              {!profile ? (
                <p className="mt-4 text-[12px] text-ink-faint">
                  {loadError ? t("settings.loadFailed") : t("common.loading")}
                </p>
              ) : !profile.passwordConfigured ? (
                <div className="mt-4 flex items-start gap-2 bg-line-soft px-4 py-3 text-[12px] leading-5 text-ink-soft">
                  <ShieldCheck className="mt-0.5 shrink-0" size={15} />
                  <p>{t("settings.deleteNeedsPassword")}</p>
                </div>
              ) : (
                <form onSubmit={handleDelete} className="mt-4 max-w-xl space-y-3">
                  <Input
                    id="delete-password"
                    label={t("settings.confirmWithPassword")}
                    type="password"
                    autoComplete="current-password"
                    value={deletePassword}
                    onChange={(event) => setDeletePassword(event.target.value)}
                    required
                  />
                  <label className="flex items-start gap-2.5 text-[12px] leading-5 text-ink-soft">
                    <input
                      type="checkbox"
                      checked={deleteConfirmed}
                      onChange={(event) => setDeleteConfirmed(event.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-line accent-coral"
                    />
                    {t("settings.deleteConfirmation")}
                  </label>
                  {deleteError && (
                    <p className="rounded-[8px] bg-coral-soft px-3 py-2 text-[12px] text-coral" role="alert">
                      {deleteError}
                    </p>
                  )}
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={deleting || !deleteConfirmed || !deletePassword}
                    className="border-coral/40 text-coral hover:bg-coral-soft"
                  >
                    {deleting ? t("common.deleting") : t("settings.deleteAccount")}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
