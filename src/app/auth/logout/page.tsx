"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

export default function LogoutPage() {
  const { logout } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  useEffect(() => {
    logout().finally(() => router.push("/auth/login"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <p className="text-[13px] text-ink-soft">{t("logout.progress")}</p>;
}
