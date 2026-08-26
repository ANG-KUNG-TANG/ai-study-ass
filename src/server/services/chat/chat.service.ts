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
  NotFoundError,
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
import {
  buildGroundedChatFallback,
  chatGroundingLogContext,
  classifyGroundedQuestion,
  validateGroundedChatResponse,
  type ChatAnswerability,
} from "@/server/services/chat/chat-grounding.service";
import type {
  GenerationMetadata,
} from "@/server/types/generation";
import { isIntelligenceV2Enabled } from "@/server/config/intelligence-v2.config";

async function requireOwnedNote(
  noteId: string,
  userId: string,
) {
  const note = await noteRepo.findByIdAndUserId(
    noteId,
    userId,
  );

  if (!note) {
    throw new NotFoundError("Note");
  }

  return note;
}

interface ChatAnswer {
  text: string;
  provider: AIProvider;
  tokensUsed: number;
  degraded: boolean;
  answerability: ChatAnswerability | null;
}

async function answerQuestion(
  noteId: string,
  userId: string,
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
  const grounding = isIntelligenceV2Enabled()
    ? intelligence?.grounding ?? null
    : null;

  if (grounding) {
    const decision =
      classifyGroundedQuestion(
        grounding,
        question,
      );
    const groundedFallback =
      buildGroundedChatFallback(
        decision,
      );

    if (
      decision.answerability ===
      "NOT_ANSWERABLE"
    ) {
      return {
        text: groundedFallback,
        provider: "symbolic",
        tokensUsed: 0,
        degraded: false,
        answerability:
          decision.answerability,
      };
    }

    if (
      decision.answerability ===
        "ANSWERABLE" &&
      decision.confidence >= 0.82
    ) {
      return {
        text: groundedFallback,
        provider: "symbolic",
        tokensUsed: 0,
        degraded: false,
        answerability:
          decision.answerability,
      };
    }

    try {
      const {
        systemPrompt,
        prompt,
      } = buildChatPrompt({
        noteTitle,
        noteContent:
          decision.evidence.join(
            "\n",
          ),
        intelligence: null,
        history,
        question,
        evidence:
          decision.evidence,
        answerability:
          decision.answerability,
        strictEvidenceOnly: true,
      });

      const aiResult =
        await generate({
          prompt,
          systemPrompt,
          temperature: 0.2,
          maxTokens: 900,
          usageLabel: "chat",
          userId,
          noteId,
        });

      const validation =
        validateGroundedChatResponse(
          aiResult.text,
          decision,
        );

      if (!validation.accepted) {
        logger.warn(
          "AI chat response rejected by grounded validation",
          {
            noteId,
            ...chatGroundingLogContext(
              decision,
              validation,
            ),
          },
        );

        return {
          text: groundedFallback,
          provider: "symbolic",
          tokensUsed:
            aiResult.tokensUsed,
          degraded: true,
          answerability:
            decision.answerability,
        };
      }

      return {
        text: aiResult.text,
        provider:
          aiResult.provider,
        tokensUsed:
          aiResult.tokensUsed,
        degraded: false,
        answerability:
          decision.answerability,
      };
    } catch (error) {
      logger.warn(
        "AI chat fallback unavailable; returning grounded evidence",
        {
          noteId,
          error:
            error instanceof Error
              ? error.message
              : String(error),
          ...chatGroundingLogContext(
            decision,
          ),
        },
      );

      return {
        text: groundedFallback,
        provider: "symbolic",
        tokensUsed: 0,
        degraded: true,
        answerability:
          decision.answerability,
      };
    }
  }

  const symbolic =
    buildSymbolicChatAnswer(
      intelligence?.core,
      noteContent,
      question,
    );

  if (
    symbolic.confidence >= 0.72
  ) {
    return {
      text: symbolic.text,
      provider: "symbolic",
      tokensUsed: 0,
      degraded: false,
      answerability: null,
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
        temperature: 0.25,
        maxTokens: 900,
        usageLabel: "chat",
        userId,
        noteId,
      });

    return {
      text: aiResult.text,
      provider:
        aiResult.provider,
      tokensUsed:
        aiResult.tokensUsed,
      degraded: false,
      answerability: null,
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
      text: symbolic.text,
      provider: "symbolic",
      tokensUsed: 0,
      degraded: true,
      answerability: null,
    };
  }
}

export async function prepareChatKnowledge(
  noteId: string,
  userId: string,
): Promise<GenerationMetadata> {
  const note =
    await requireOwnedNote(
      noteId,
      userId,
    );

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
  const grounding = isIntelligenceV2Enabled()
    ? intelligence?.grounding ?? null
    : null;
  const hasGrounding = Boolean(
    grounding?.facts.length,
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
      hasGrounding ||
      hasCore ||
      note.content.length >= 500
        ? "ready"
        : "partial",
    itemCount:
      (
        grounding
          ?.facts.length ??
        intelligence?.core
          ?.keyPoints.length ?? 0
      ) +
      (
        grounding
          ?.concepts.length ??
        intelligence?.core
          ?.entities.length ?? 0
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
    await requireOwnedNote(
      noteId,
      userId,
    );

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
      noteId,
      userId,
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
      answerability:
        answer.answerability,
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
  await requireOwnedNote(
    noteId,
    userId,
  );

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
  await requireOwnedNote(
    noteId,
    userId,
  );

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
