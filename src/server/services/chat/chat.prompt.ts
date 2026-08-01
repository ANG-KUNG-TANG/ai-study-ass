import type {
  IntelligenceResultEntity,
} from "@/server/entities/intelligence.entity";

export interface ChatHistoryMessage {
  question: string;
  answer: string;
}

export interface BuildChatPromptInput {
  noteTitle: string;
  noteContent: string;
  intelligence:
    | IntelligenceResultEntity
    | null;
  history: ChatHistoryMessage[];
  question: string;
  evidence: string[];
}

export interface ChatPromptResult {
  systemPrompt: string;
  prompt: string;
}

function buildFactBlock(
  intelligence:
    | IntelligenceResultEntity
    | null,
): string {
  if (!intelligence?.core) {
    return "(no structured facts were extracted)";
  }

  const core =
    intelligence.core;

  const facts: string[] = [];

  if (core.problem) {
    facts.push(
      `Problem: ${core.problem}`,
    );
  }

  if (core.method) {
    facts.push(
      `Method: ${core.method}`,
    );
  }

  if (core.dataset) {
    facts.push(
      `Dataset: ${core.dataset}`,
    );
  }

  if (
    core.accuracy !== null &&
    core.accuracy !== undefined
  ) {
    facts.push(
      `Accuracy: ${core.accuracy}%`,
    );
  }

  for (
    const contribution of
    core.contributions.slice(0, 3)
  ) {
    facts.push(
      `Contribution: ${contribution}`,
    );
  }

  const concepts =
    intelligence
      .resolvedConcepts()
      .map(
        (match) =>
          match.concept.label,
      )
      .slice(0, 10);

  if (concepts.length > 0) {
    facts.push(
      `Key concepts: ${concepts.join(", ")}`,
    );
  }

  return facts.length > 0
    ? facts.join("\n")
    : "(no structured facts were extracted)";
}

export function buildChatPrompt(
  input: BuildChatPromptInput,
): ChatPromptResult {
  const historyText =
    input.history
      .slice(-6)
      .map(
        (message) =>
          `Student: ${message.question}\n` +
          `Assistant: ${message.answer}`,
      )
      .join("\n\n");

  const documentBlock =
    input.evidence.length > 0
      ? [
          "Relevant document evidence:",
          input.evidence.join("\n\n"),
        ].join("\n")
      : [
          "Document excerpt:",
          input.noteContent.slice(0, 4_000),
        ].join("\n");

  return {
    systemPrompt:
      `You are a study assistant for ` +
      `"${input.noteTitle}". ` +
      "Answer using only the extracted facts " +
      "and uploaded-document evidence. " +
      "Do not invent information. " +
      "If the evidence is insufficient, say so clearly.",

    prompt: [
      [
        "Extracted facts:",
        buildFactBlock(
          input.intelligence,
        ),
      ].join("\n"),

      documentBlock,

      historyText
        ? [
            "Previous conversation:",
            historyText,
          ].join("\n")
        : "",

      `Question: ${input.question}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}
