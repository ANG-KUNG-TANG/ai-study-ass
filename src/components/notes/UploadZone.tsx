"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ALLOWED_EXTENSIONS, MAX_FILE_SIZE_BYTES } from "@/server/utils/constants";
import { apiFetch } from "@/lib/api";
import type { Note } from "@/types/notes";

interface UploadZoneProps {
  onUploaded: (note: Note) => void;
}

function validateFile(file: File): string | null {
  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
    return `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`;
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `File too large. Max size: ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`;
  }
  return null;
}

export function UploadZone({ onUploaded }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    const validationError = validateFile(file);
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
      setError(err instanceof Error ? err.message : "Upload failed");
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
      className={`mb-7 flex flex-col items-center gap-2 rounded-card border-2 border-dashed px-6 py-10 text-center transition-colors ${
        isDragging ? "border-ink bg-line-soft" : "border-line bg-paper-raised"
      }`}
    >
      <Upload size={22} strokeWidth={1.6} className="text-ink-faint" />
      <h3 className="font-serif text-[15px] font-semibold">
        {isUploading ? "Uploading…" : "Drop a PDF or DOCX to upload"}
      </h3>
      <p className="max-w-[360px] text-[12.5px] text-ink-soft">
        We&apos;ll extract the text and get it ready for summaries, quizzes, and chat.
      </p>

      {error && <p className="text-[12px] text-coral">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_EXTENSIONS.join(",")}
        onChange={handleBrowse}
        className="hidden"
      />
      <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={isUploading}>
        {isUploading ? "Uploading…" : "Browse files"}
      </Button>
    </div>
  );
}