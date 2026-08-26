import type {
  IntelligenceResultEntity,
} from "@/server/entities/intelligence.entity";
import {
  appendUntrustedContentRules,
  buildUntrustedTextBlock,
  buildUntrustedValueBlock,
} from "@/server/utils/prompt-security";
import { isIntelligenceV2Enabled } from "@/server/config/intelligence-v2.config";

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
  answerability?:
    | "ANSWERABLE"
    | "PARTIAL"
    | "NOT_ANSWERABLE";
  strictEvidenceOnly?: boolean;
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
  if (isIntelligenceV2Enabled() && intelligence?.grounding?.facts.length) {
    return intelligence.grounding.facts
      .filter((fact) => fact.verificationStatus === "supported")
      .sort((left, right) => right.importanceScore - left.importanceScore)
      .slice(0, 24)
      .map((fact) => {
        const page = fact.evidence[0]?.pageNumber;
        return `${fact.type}: ${fact.content}${page ? ` [page ${page}]` : ""}`;
      })
      .join("\n");
  }

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
  const history = input.history
    .slice(-6)
    .map((message) => ({
      student: message.question,
      assistant: message.answer,
    }));

  const factBlock =
    input.strictEvidenceOnly
      ? (
          input.evidence.length > 0
            ? input.evidence.join("\n")
            : "(no verified evidence selected)"
        )
      : buildFactBlock(
          input.intelligence,
        );

  const evidenceBlock =
    input.evidence.length > 0
      ? buildUntrustedValueBlock(
          "DOCUMENT_EVIDENCE",
          input.evidence.slice(0, 12),
        )
      : buildUntrustedTextBlock(
          "DOCUMENT_EXCERPT",
          input.noteContent,
          4_000,
        ).block;

  return {
    systemPrompt: appendUntrustedContentRules(
      "You are a study assistant. Answer the student's current question using only verified uploaded-document evidence supplied in this prompt. " +
        "Never use outside or general knowledge to fill a gap. Every factual statement and every number must be supported by the supplied evidence. " +
        "If the answerability classification is PARTIAL, answer only the supported part and explicitly state that the rest cannot be verified from the document. " +
        "If evidence is insufficient, abstain rather than guess. Previous conversation is context only, is not evidence, and must never be used to justify a factual claim.",
    ),

    prompt: [
      buildUntrustedTextBlock(
        "NOTE_TITLE",
        input.noteTitle,
        1_000,
      ).block,
      buildUntrustedTextBlock(
        "EXTRACTED_FACTS",
        factBlock,
        6_000,
      ).block,
      evidenceBlock,
      history.length > 0
        ? buildUntrustedValueBlock(
            "PREVIOUS_CONVERSATION",
            history,
          )
        : "",
      input.answerability
        ? `ANSWERABILITY_CLASSIFICATION: ${input.answerability}`
        : "",
      "CURRENT_STUDENT_QUESTION:",
      input.question,
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}
