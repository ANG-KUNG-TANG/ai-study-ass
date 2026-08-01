import {
  randomUUID,
} from "crypto";
import * as chatRepo from "@/server/repositories/chat.repo";
import * as noteRepo from "@/server/repositories/note.repo";
import * as intelligenceService from "@/server/services/intelligence.service";
import {
  ChatEntity,
  type AIProvider,
} from "@/server/entities/chat.entity";
import {
  ForbiddenError,
} from "@/server/utils/errors";
import {
  logger,
} from "@/server/utils/logger";
import {
  generate,
} from "@/server/services/ai.service";
import {
  CHAT_HISTORY_LIMIT,
} from "@/server/utils/constants";
import {
  buildSymbolicChatAnswer,
} from "@/server/services/symbolic-content.service";
import {
  buildChatPrompt,
} from "@/server/services/chat/chat.prompt";
import type {
  GenerationMetadata,
} from "@/server/types/generation";

interface ChatAnswer {
  text: string;
  provider: AIProvider;
  tokensUsed: number;
  degraded: boolean;
}

async function answerQuestion(
  noteTitle: string,
  noteContent: string,
  intelligence:
    | Awaited<
        ReturnType<
          typeof intelligenceService.getOrRunPipeline
        >
      >
    | null,
  history: Array<{
    question: string;
    answer: string;
  }>,
  question: string,
): Promise<ChatAnswer> {
  const symbolic =
    buildSymbolicChatAnswer(
      intelligence?.core,
      noteContent,
      question,
    );

  // High-confidence structured facts or document retrieval answer the
  // question without consuming provider quota.
  if (
    symbolic.confidence >= 0.72
  ) {
    return {
      text:
        symbolic.text,
      provider:
        "symbolic",
      tokensUsed:
        0,
      degraded:
        false,
    };
  }

  try {
    const {
      systemPrompt,
      prompt,
    } = buildChatPrompt({
      noteTitle,
      noteContent,
      intelligence,
      history,
      question,
      evidence:
        symbolic.evidence,
    });

    const aiResult =
      await generate({
        prompt,
        systemPrompt,
        temperature:
          0.25,
        maxTokens:
          900,
      });

    return {
      text:
        aiResult.text,
      provider:
        aiResult.provider,
      tokensUsed:
        aiResult.tokensUsed,
      degraded:
        false,
    };
  } catch (error) {
    logger.warn(
      "AI chat fallback unavailable; returning symbolic evidence",
      {
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
    );

    return {
      text:
        symbolic.text,
      provider:
        "symbolic",
      tokensUsed:
        0,
      degraded:
        true,
    };
  }
}

export async function prepareChatKnowledge(
  noteId: string,
  userId: string,
): Promise<GenerationMetadata> {
  const note =
    await noteRepo.findByIdOrThrow(
      noteId,
    );

  if (
    !note.belongsTo(userId)
  ) {
    throw new ForbiddenError();
  }

  const intelligence =
    await intelligenceService
      .getOrRunPipeline(
        noteId,
      )
      .catch(() => null);

  const hasCore =
    Boolean(
      intelligence?.core,
    );

  const confidence =
    intelligence?.confidence ??
    (
      note.content.length >= 500
        ? 0.45
        : 0.2
    );

  return {
    source:
      "symbolic",
    confidence,
    aiFallbackUsed:
      false,
    status:
      hasCore ||
      note.content.length >= 500
        ? "ready"
        : "partial",
    itemCount:
      (
        intelligence?.core
          ?.keyPoints.length ??
        0
      ) +
      (
        intelligence?.core
          ?.entities.length ??
        0
      ),
    tokensUsed:
      0,
  };
}

export async function askQuestion(
  noteId: string,
  userId: string,
  question: string,
): Promise<
  ReturnType<
    ChatEntity["toPublic"]
  >
> {
  const note =
    await noteRepo.findByIdOrThrow(
      noteId,
    );

  if (
    !note.belongsTo(userId)
  ) {
    throw new ForbiddenError();
  }

  const intelligence =
    await intelligenceService
      .getOrRunPipeline(
        noteId,
      )
      .catch(() => null);

  const history =
    await chatRepo
      .findByNoteIdAndUserId(
        noteId,
        userId,
        CHAT_HISTORY_LIMIT,
      );

  const answer =
    await answerQuestion(
      note.title,
      note.content,
      intelligence,
      history,
      question,
    );

  const entity =
    ChatEntity.create({
      id:
        randomUUID(),
      noteId,
      userId,
      question,
      answer:
        answer.text,
      provider:
        answer.provider,
      tokensUsed:
        answer.tokensUsed,
    });

  const saved =
    await chatRepo.create(
      entity,
    );

  logger.info(
    "Chat answered",
    {
      noteId,
      userId,
      provider:
        answer.provider,
      tokensUsed:
        answer.tokensUsed,
      degraded:
        answer.degraded,
    },
  );

  return saved.toPublic();
}

export async function getChatHistory(
  noteId: string,
  userId: string,
): Promise<
  ReturnType<
    ChatEntity["toPublic"]
  >[]
> {
  const note =
    await noteRepo.findByIdOrThrow(
      noteId,
    );

  if (
    !note.belongsTo(userId)
  ) {
    throw new ForbiddenError();
  }

  const history =
    await chatRepo
      .findByNoteIdAndUserId(
        noteId,
        userId,
      );

  return history.map(
    (message) =>
      message.toPublic(),
  );
}

export async function clearChatHistory(
  noteId: string,
  userId: string,
): Promise<void> {
  const note =
    await noteRepo.findByIdOrThrow(
      noteId,
    );

  if (
    !note.belongsTo(userId)
  ) {
    throw new ForbiddenError();
  }

  await chatRepo
    .deleteByNoteIdAndUserId(
      noteId,
      userId,
    );

  logger.info(
    "Chat history cleared",
    {
      noteId,
      userId,
    },
  );
}

export async function deleteForNote(
  noteId: string,
): Promise<void> {
  await chatRepo
    .deleteByNoteId(
      noteId,
    );

  logger.info(
    "Chat data deleted",
    {
      noteId,
    },
  );
}
