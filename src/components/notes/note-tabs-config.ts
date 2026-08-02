import {
  AlignLeft,
  Copy,
  HelpCircle,
  Network,
  MessageSquare,
} from "lucide-react";

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
      label:
        "Summary",
      icon:
        AlignLeft,
    },
    {
      href:
        `/student/notes/${encodedNoteId}/quiz`,
      label:
        "Quiz",
      icon:
        HelpCircle,
    },
    {
      href:
        `/student/notes/${encodedNoteId}/flashcards`,
      label:
        "Flashcards",
      icon:
        Copy,
    },
    {
      href:
        `/student/notes/${encodedNoteId}/chat`,
      label:
        "Chat",
      icon:
        MessageSquare,
    },
    {
      href:
        `/student/notes/${encodedNoteId}/knowledge`,
      label:
        "Knowledge",
      icon:
        Network,
    },
  ];
}
