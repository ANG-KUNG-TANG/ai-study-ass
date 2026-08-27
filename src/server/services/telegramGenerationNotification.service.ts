import {
  sendMessage,
} from "@/server/integrations/telegram/telegram.client";
import type {
  TelegramInlineButton,
} from "@/server/integrations/telegram/telegram.client";
import type {
  StudyGenerationState,
} from "@/server/types/generation";
import type {
  PublicNote,
} from "@/server/services/note.service";
import { logger } from "@/server/utils/logger";

function getPublicAppUrl(): string {
  const url = process.env.APP_PUBLIC_URL?.trim();

  if (!url) {
    throw new Error("APP_PUBLIC_URL is not configured");
  }

  return url.replace(/\/+$/, "");
}

function buildDashboardUrl(): string {
  return `${getPublicAppUrl()}/student/dashboard`;
}

function buildNoteBaseUrl(noteId: string): string {
  return `${getPublicAppUrl()}/student/notes/${noteId}`;
}

function buildNoteUrl(noteId: string): string {
  return `${buildNoteBaseUrl(noteId)}/summary`;
}

function featureIcon(status: string): string {
  switch (status) {
    case "ready":
      return "✅";
    case "partial":
      return "⚠️";
    case "failed":
      return "❌";
    case "generating":
      return "⏳";
    default:
      return "•";
  }
}

function featureIsUsable(status: string): boolean {
  return status === "ready" || status === "partial";
}

function buildGenerationButtons(
  noteId: string,
  state: StudyGenerationState,
): TelegramInlineButton[][] {
  const baseUrl = buildNoteBaseUrl(noteId);
  const rows: TelegramInlineButton[][] = [];

  const row1: TelegramInlineButton[] = [];

  if (featureIsUsable(state.features.summary.status)) {
    row1.push({
      text: "📝 Summary",
      url: `${baseUrl}/summary`,
    });
  }

  if (featureIsUsable(state.features.quiz.status)) {
    row1.push({
      text: "❓ Quiz",
      url: `${baseUrl}/quiz`,
    });
  }

  if (row1.length > 0) {
    rows.push(row1);
  }

  const row2: TelegramInlineButton[] = [];

  if (featureIsUsable(state.features.flashcards.status)) {
    row2.push({
      text: "🃏 Flashcards",
      url: `${baseUrl}/flashcards`,
    });
  }

  if (featureIsUsable(state.features.chatKnowledge.status)) {
    row2.push({
      text: "🧠 Knowledge",
      url: `${baseUrl}/knowledge`,
    });
  }

  if (row2.length > 0) {
    rows.push(row2);
  }

  rows.push([
    {
      text: "📚 Open Study Note",
      url: buildNoteUrl(noteId),
    },
  ]);

  rows.push([
    {
      text: "🏠 Open Dashboard",
      url: buildDashboardUrl(),
    },
  ]);

  return rows;
}

export async function notifyTelegramDocumentReady(
  chatId: number,
  note: PublicNote,
): Promise<void> {
  await sendMessage(
    chatId,
    [
      "✅ Document is ready.",
      "",
      `📚 ${note.title}`,
      "",
      "Your document has been extracted and prepared.",
      "Summary, Quiz, Flashcards, Knowledge and Chat will use the saved document only when you open or request them.",
      "",
      "This on-demand flow avoids generating unused study materials.",
    ].join("\n"),
    {
      buttons: [
        [
          {
            text: "📝 Open Summary",
            url: buildNoteUrl(note.id),
          },
        ],
        [
          {
            text: "🏠 Open Dashboard",
            url: buildDashboardUrl(),
          },
        ],
      ],
    },
  );
}

export async function notifyTelegramGenerationComplete(
  chatId: number,
  note: PublicNote,
  state: StudyGenerationState,
): Promise<void> {
  const heading =
    state.stage === "complete"
      ? "🎉 Study materials are ready!"
      : state.stage === "partial"
        ? "⚠️ Study materials are partially ready."
        : "❌ Study material generation finished with errors.";

  await sendMessage(
    chatId,
    [
      heading,
      "",
      `📚 ${note.title}`,
      "",
      `${featureIcon(state.features.summary.status)} Summary — ${state.features.summary.status}`,
      `${featureIcon(state.features.chatKnowledge.status)} Knowledge — ${state.features.chatKnowledge.status}`,
      `${featureIcon(state.features.quiz.status)} Quiz — ${state.features.quiz.status}`,
      `${featureIcon(state.features.flashcards.status)} Flashcards — ${state.features.flashcards.status}`,
      "",
      state.stage === "complete"
        ? "Everything is ready to study."
        : state.stage === "partial"
          ? "Some materials are ready. Open the available features below."
          : "Open the note or dashboard for details and retry options.",
    ].join("\n"),
    {
      buttons: buildGenerationButtons(note.id, state),
    },
  );
}

export async function notifyTelegramGenerationFailure(
  chatId: number,
  note: PublicNote,
  error: unknown,
): Promise<void> {
  logger.error(
    "[telegram] study generation failed",
    {
      noteId: note.id,
      error:
        error instanceof Error
          ? error.message
          : String(error),
    },
  );

  await sendMessage(
    chatId,
    [
      "❌ Study material generation failed.",
      "",
      `📚 ${note.title}`,
      "",
      "Your document is still saved in AI Study Assistant.",
      "Open it from the web app to review the status or try again.",
    ].join("\n"),
    {
      buttons: [
        [
          {
            text: "📚 Open Study Note",
            url: buildNoteUrl(note.id),
          },
        ],
        [
          {
            text: "🏠 Open Dashboard",
            url: buildDashboardUrl(),
          },
        ],
      ],
    },
  );
}
