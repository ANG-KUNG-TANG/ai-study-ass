import type { KnowledgeCore } from "@/server/intelligence/types";
import type { QuizQuestionInput } from "@/server/entities/quiz.entity";
import type { FlashcardDifficulty } from "@/server/entities/flashcard.entity";

const STOP_WORDS = new Set([
  "about", "after", "again", "also", "among", "because", "before", "being",
  "between", "both", "could", "does", "during", "each", "from", "have",
  "having", "into", "itself", "more", "most", "other", "over", "same",
  "should", "some", "such", "than", "that", "their", "them", "then",
  "there", "these", "they", "this", "those", "through", "under", "using",
  "very", "were", "what", "when", "where", "which", "while", "with",
  "would", "your",
]);

export interface SymbolicSummary {
  summary: string;
  keyPoints: string[];
  importantConcepts: string[];
  confidence: number;
  status: "ready" | "partial";
}

export interface SymbolicFlashcard {
  front: string;
  back: string;
  difficulty: FlashcardDifficulty;
}

export interface SymbolicChatAnswer {
  text: string;
  confidence: number;
  evidence: string[];
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function cleanDocumentText(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/-\s*\n\s*/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractMeaningfulSentences(
  sourceText: string,
  limit = 12,
): string[] {
  const clean = cleanDocumentText(sourceText);

  return clean
    .replace(/^\s*\d+\s*$/gm, "")
    .split(/(?<=[.!?])\s+|\n{2,}/)
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter(
      (sentence) =>
        sentence.length >= 45 &&
        sentence.length <= 360 &&
        !/^(references|bibliography|acknowledg)/i.test(sentence) &&
        !/^[\d\s.,;:()[\]-]+$/.test(sentence),
    )
    .filter((sentence, index, all) => {
      const key = sentence.toLowerCase();
      return all.findIndex((candidate) => candidate.toLowerCase() === key) === index;
    })
    .slice(0, limit);
}

export function extractHeadings(sourceText: string, limit = 12): string[] {
  return cleanDocumentText(sourceText)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => {
      if (line.length < 3 || line.length > 90) return false;
      return (
        /^\d+(?:\.\d+)*\s+[A-Z]/.test(line) ||
        /^(abstract|introduction|background|method|methodology|results?|discussion|conclusion|limitations?|future work)$/i.test(
          line,
        )
      );
    })
    .map((line) => line.replace(/^\d+(?:\.\d+)*\s+/, "").trim())
    .filter((line, index, all) => all.indexOf(line) === index)
    .slice(0, limit);
}

export function extractDefinitions(
  sourceText: string,
  limit = 15,
): Array<{ term: string; definition: string }> {
  const sentences = extractMeaningfulSentences(sourceText, 80);
  const definitions: Array<{ term: string; definition: string }> = [];

  for (const sentence of sentences) {
    const match = sentence.match(
      /^([A-Z][A-Za-z0-9 ()/_-]{2,70}?)\s+(?:is|are|means|refers to|can be defined as)\s+(.{20,260})$/i,
    );

    if (!match) continue;

    const term = match[1].trim();
    const definition = match[2].trim();

    if (
      definitions.some(
        (item) => item.term.toLowerCase() === term.toLowerCase(),
      )
    ) {
      continue;
    }

    definitions.push({ term, definition });
    if (definitions.length >= limit) break;
  }

  return definitions;
}

export function extractKeywords(sourceText: string, limit = 12): string[] {
  const counts = new Map<string, number>();
  const clean = cleanDocumentText(sourceText).toLowerCase();

  for (const word of clean.match(/[a-z][a-z-]{3,}/g) ?? []) {
    if (STOP_WORDS.has(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word]) => word);
}

export function buildSymbolicSummary(
  core: KnowledgeCore | null | undefined,
  sourceText: string,
  title: string,
): SymbolicSummary {
  const sourceSentences = extractMeaningfulSentences(sourceText, 8);
  const definitions = extractDefinitions(sourceText, 6);
  const headings = extractHeadings(sourceText, 8);
  const keywords = extractKeywords(sourceText, 10);

  const overview =
    core?.problem?.trim() ||
    sourceSentences[0] ||
    `This document discusses ${title}.`;

  const keyPoints = [
    ...(core?.keyPoints?.map((item) => `${item.label}: ${item.value}`) ?? []),
    ...(core?.contributions ?? []),
    ...sourceSentences.slice(1, 5),
  ]
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, all) => all.indexOf(item) === index)
    .slice(0, 8);

  const importantConcepts = [
    ...(core?.entities ?? []),
    ...(core?.extras?.keywords ?? []),
    ...definitions.map((item) => item.term),
    ...headings,
    ...keywords,
  ]
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, all) => {
      const lower = item.toLowerCase();
      return all.findIndex((candidate) => candidate.toLowerCase() === lower) === index;
    })
    .slice(0, 12);

  const details: string[] = [];
  if (core?.method) details.push(`- **Method:** ${core.method}`);
  if (core?.dataset) details.push(`- **Dataset:** ${core.dataset}`);
  if (core?.accuracy !== null && core?.accuracy !== undefined) {
    details.push(`- **Reported result:** ${core.accuracy}%`);
  }
  if (core?.extras?.metric) {
    details.push(`- **Evaluation metric:** ${core.extras.metric}`);
  }

  const definitionBlock = definitions.length
    ? [
        "## Key Terms",
        ...definitions.map(
          ({ term, definition }) => `- **${term}:** ${definition}`,
        ),
      ].join("\n")
    : "";

  const summary = [
    `# ${title}`,
    "## Overview",
    overview,
    details.length ? ["## Important Details", ...details].join("\n") : "",
    keyPoints.length
      ? [
          "## Key Points",
          ...keyPoints.map((point) => `- ${point}`),
        ].join("\n")
      : "",
    importantConcepts.length
      ? [
          "## Main Concepts",
          ...importantConcepts.map((concept) => `- ${concept}`),
        ].join("\n")
      : "",
    definitionBlock,
    sourceSentences.length
      ? [
          "## Key Takeaways",
          ...sourceSentences.slice(0, 5).map((sentence) => `- ${sentence}`),
        ].join("\n")
      : "",
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 4_800)
    .trim();

  const evidenceCount =
    Number(Boolean(core?.problem)) +
    Number(Boolean(core?.method)) +
    Number(Boolean(core?.dataset)) +
    Math.min(4, keyPoints.length) +
    Math.min(3, definitions.length) +
    Math.min(2, headings.length);

  const confidence = clamp(
    0.25 +
      evidenceCount * 0.055 +
      Math.min(sourceText.length / 20_000, 0.2),
  );

  return {
    summary,
    keyPoints,
    importantConcepts,
    confidence,
    status:
      summary.length >= 350 && keyPoints.length >= 3
        ? "ready"
        : "partial",
  };
}

export function buildQuestionsFromSource(
  sourceText: string,
  count: number,
  allowedTypes: string[],
): QuizQuestionInput[] {
  const questions: QuizQuestionInput[] = [];
  const definitions = extractDefinitions(sourceText, count);
  const sentences = extractMeaningfulSentences(sourceText, count * 3);
  const headings = extractHeadings(sourceText, count);

  if (allowedTypes.includes("short_answer")) {
    for (const { term, definition } of definitions) {
      questions.push({
        question: `What is ${term}?`,
        questionType: "short_answer",
        options: [],
        answer: definition.slice(0, 300),
        explanation: "This definition was extracted from the uploaded document.",
      });

      if (questions.length >= count) return questions;
    }

    for (let index = 0; index < headings.length; index += 1) {
      const answer = sentences[index];
      if (!answer) break;

      questions.push({
        question: `What is an important point from the section "${headings[index]}"?`,
        questionType: "short_answer",
        options: [],
        answer: answer.slice(0, 300),
        explanation: "The answer is based on text extracted from that document section.",
      });

      if (questions.length >= count) return questions;
    }
  }

  if (allowedTypes.includes("true_false")) {
    for (const sentence of sentences) {
      questions.push({
        question: `True or false: ${sentence}`,
        questionType: "true_false",
        options: ["True", "False"],
        answer: "True",
        explanation: "The statement appears in the uploaded document.",
      });

      if (questions.length >= count) return questions;
    }
  }

  return questions.slice(0, count);
}

export function buildFlashcardsFromSource(
  sourceText: string,
  count: number,
): SymbolicFlashcard[] {
  const cards: SymbolicFlashcard[] = [];
  const definitions = extractDefinitions(sourceText, count);
  const sentences = extractMeaningfulSentences(sourceText, count * 2);
  const headings = extractHeadings(sourceText, count);

  for (const { term, definition } of definitions) {
    cards.push({
      front: `What is ${term}?`,
      back: definition.slice(0, 350),
      difficulty: "easy",
    });
    if (cards.length >= count) return cards;
  }

  for (let index = 0; index < headings.length; index += 1) {
    const answer = sentences[index];
    if (!answer) break;

    cards.push({
      front: `What is a key point from "${headings[index]}"?`,
      back: answer.slice(0, 350),
      difficulty: "medium",
    });

    if (cards.length >= count) return cards;
  }

  for (const sentence of sentences) {
    cards.push({
      front: "What important fact is explained in this document?",
      back: sentence.slice(0, 350),
      difficulty: "medium",
    });

    if (cards.length >= count) break;
  }

  return cards;
}

export function retrieveRelevantExcerpts(
  sourceText: string,
  question: string,
  limit = 3,
): string[] {
  const queryTerms = new Set(
    (question.toLowerCase().match(/[a-z][a-z-]{2,}/g) ?? []).filter(
      (term) => !STOP_WORDS.has(term),
    ),
  );

  return extractMeaningfulSentences(sourceText, 120)
    .map((sentence) => {
      const lower = sentence.toLowerCase();
      const score = [...queryTerms].reduce(
        (sum, term) => sum + (lower.includes(term) ? 1 : 0),
        0,
      );
      return { sentence, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.sentence);
}

export function buildSymbolicChatAnswer(
  core: KnowledgeCore | null | undefined,
  sourceText: string,
  question: string,
): SymbolicChatAnswer {
  const lower = question.toLowerCase();

  const directFacts: Array<{
    pattern: RegExp;
    value: string | undefined;
  }> = [
    { pattern: /method|approach|technique/, value: core?.method ?? undefined },
    { pattern: /dataset|data set|corpus/, value: core?.dataset ?? undefined },
    {
      pattern: /accuracy|performance|result/,
      value:
        core?.accuracy !== null && core?.accuracy !== undefined
          ? `${core.accuracy}%`
          : undefined,
    },
    { pattern: /problem|goal|aim/, value: core?.problem ?? undefined },
  ];

  for (const fact of directFacts) {
    if (fact.pattern.test(lower) && fact.value) {
      return {
        text: fact.value,
        confidence: 0.92,
        evidence: [fact.value],
      };
    }
  }

  if (/contribut/.test(lower) && core?.contributions?.length) {
    const evidence = core.contributions.slice(0, 3);
    return {
      text: evidence.map((item) => `- ${item}`).join("\n"),
      confidence: 0.88,
      evidence,
    };
  }

  const excerpts = retrieveRelevantExcerpts(sourceText, question, 3);

  if (excerpts.length > 0) {
    return {
      text: [
        "Based on the uploaded document:",
        ...excerpts.map((excerpt) => `- ${excerpt}`),
      ].join("\n"),
      confidence: excerpts.length >= 2 ? 0.72 : 0.58,
      evidence: excerpts,
    };
  }

  return {
    text:
      "I could not find enough document evidence to answer that confidently. " +
      "Try asking about the method, dataset, problem, results, definitions, or contributions.",
    confidence: 0.2,
    evidence: [],
  };
}
