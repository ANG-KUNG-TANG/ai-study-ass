import {
  AlignLeft,
  Copy,
  HelpCircle,
  Network,
  MessageSquare,
} from "lucide-react";
import type { TranslationKey } from "@/i18n/translations";

export function noteTabItems(
  noteId: string,
) {
  const encodedNoteId =
    encodeURIComponent(
      noteId,
    );

  return [
    {
      href:
        `/student/notes/${encodedNoteId}/summary`,
      labelKey:
        "nav.summary" as TranslationKey,
      icon:
        AlignLeft,
    },
    {
      href:
        `/student/notes/${encodedNoteId}/quiz`,
      labelKey:
        "nav.quiz" as TranslationKey,
      icon:
        HelpCircle,
    },
    {
      href:
        `/student/notes/${encodedNoteId}/flashcards`,
      labelKey:
        "nav.flashcards" as TranslationKey,
      icon:
        Copy,
    },
    {
      href:
        `/student/notes/${encodedNoteId}/chat`,
      labelKey:
        "nav.chat" as TranslationKey,
      icon:
        MessageSquare,
    },
    {
      href:
        `/student/notes/${encodedNoteId}/knowledge`,
      labelKey:
        "note.tab.knowledge" as TranslationKey,
      icon:
        Network,
    },
  ];
}
