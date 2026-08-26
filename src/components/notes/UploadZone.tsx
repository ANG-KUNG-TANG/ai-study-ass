"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ALLOWED_EXTENSIONS, MAX_FILE_SIZE_BYTES } from "@/server/utils/constants";
import { apiFetch } from "@/lib/api";
import type { Note } from "@/types/notes";
import { useLanguage } from "@/context/LanguageContext";
import type { TranslationKey, TranslationValues } from "@/i18n/translations";

interface UploadZoneProps {
  onUploaded: (note: Note) => void;
}

function validateFile(
  file: File,
  t: (key: TranslationKey, values?: TranslationValues) => string,
): string | null {
  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
    return t("upload.unsupported", { types: ALLOWED_EXTENSIONS.join(", ") });
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return t("upload.tooLarge", {
      size: MAX_FILE_SIZE_BYTES / 1024 / 1024,
    });
  }
  return null;
}

export function UploadZone({ onUploaded }: UploadZoneProps) {
  const { t } = useLanguage();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    const validationError = validateFile(file, t);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file); // ⚠ assumed field name — confirm against upload.controller.ts

      const note = await apiFetch<Note>("/upload", {
        method: "POST",
        body: formData,
        headers: {}, // override apiFetch's default Content-Type: application/json — browser sets multipart boundary itself
      });

      onUploaded(note);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("upload.failed"));
    } finally {
      setIsUploading(false);
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleBrowse(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = ""; // allow re-selecting the same file later
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`mb-7 flex flex-col gap-4 border-y border-dashed px-4 py-5 transition-colors sm:flex-row sm:items-center sm:justify-between ${
        isDragging ? "border-ink bg-line-soft" : "border-line bg-transparent"
      }`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-yellow-soft text-ink">
          <Upload size={17} strokeWidth={1.7} />
        </span>
        <div className="min-w-0">
          <h3 className="font-serif text-[15px] font-semibold">
            {isUploading ? t("upload.uploading") : t("upload.drop")}
          </h3>
          <p className="mt-1 max-w-[520px] text-[12.5px] leading-5 text-ink-soft">
            {t("upload.description")}
          </p>
          {error && <p className="mt-1 text-[12px] text-coral">{error}</p>}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_EXTENSIONS.join(",")}
        onChange={handleBrowse}
        className="hidden"
      />
      <Button className="shrink-0" variant="outline" onClick={() => inputRef.current?.click()} disabled={isUploading}>
        {isUploading ? t("upload.uploading") : t("upload.browse")}
      </Button>
    </div>
  );
}
