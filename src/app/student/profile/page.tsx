"use client";

import { useLanguage } from "@/context/LanguageContext";

export default function StudentProfilePage() {
  const { t } = useLanguage();

  return (
    <main>
      <h1 className="font-serif text-2xl font-semibold">
        {t("profile.title")}
      </h1>

      <p className="mt-2 text-sm text-gray-600">
        {t("profile.description")}
      </p>
    </main>
  );
}
