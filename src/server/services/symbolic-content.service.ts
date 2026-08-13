import { cleanTextForStudyFeatures } from "@/server/intelligence/reliability/text-quality";
import type { KnowledgeCore } from "@/server/intelligence/types";
import type { QuizQuestionInput } from "@/server/entities/quiz.entity";
import type { FlashcardDifficulty } from "@/server/entities/flashcard.entity";

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "among",
  "because",
  "before",
  "being",
  "between",
  "both",
  "could",
  "does",
  "during",
  "each",
  "from",
  "have",
  "having",
  "into",
  "itself",
  "more",
  "most",
  "other",
  "over",
  "same",
  "should",
  "some",
  "such",
  "than",
  "that",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "under",
  "using",
  "very",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "with",
  "would",
  "your",
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

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function uniqueCaseInsensitive(values: string[]): string[] {
  const seen = new Set<string>();

  return values.filter((value) => {
    const key = normalizeKey(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function selectEvenly<T>(items: T[], limit: number): T[] {
  if (limit <= 0 || items.length === 0) return [];
  if (items.length <= limit) return [...items];
  if (limit === 1) return [items[0]];

  const result: T[] = [];
  const seen = new Set<number>();

  for (let index = 0; index < limit; index += 1) {
    const position = Math.round((index * (items.length - 1)) / (limit - 1));
    if (seen.has(position)) continue;
    seen.add(position);
    result.push(items[position]);
  }

  return result;
}

export function cleanDocumentText(text: string): string {
  return cleanTextForStudyFeatures(text);
}

function meaningfulSentenceCandidates(sourceText: string): string[] {
  const clean = cleanDocumentText(sourceText);

  return uniqueCaseInsensitive(
    clean
      .replace(/^\s*\d+\s*$/gm, "")
      .split(/(?<=[.!?])\s+|\n{2,}/)
      .map((sentence) => sentence.replace(/\s+/g, " ").trim())
      .filter(
        (sentence) =>
          sentence.length >= 45 &&
          sentence.length <= 420 &&
          !/^(references|bibliography|acknowledg)/i.test(sentence) &&
          !/^[\d\s.,;:()[\]-]+$/.test(sentence),
      ),
  ).slice(0, 2_000);
}

export function extractMeaningfulSentences(
  sourceText: string,
  limit = 12,
): string[] {
  return selectEvenly(meaningfulSentenceCandidates(sourceText), limit);
}

export function extractHeadings(sourceText: string, limit = 12): string[] {
  const headings = uniqueCaseInsensitive(
    cleanDocumentText(sourceText)
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
      .map((line) => line.replace(/^\d+(?:\.\d+)*\s+/, "").trim()),
  );

  return selectEvenly(headings, limit);
}

export function extractDefinitions(
  sourceText: string,
  limit = 15,
): Array<{ term: string; definition: string }> {
  const definitions: Array<{ term: string; definition: string }> = [];
  const seen = new Set<string>();

  for (const sentence of meaningfulSentenceCandidates(sourceText)) {
    const match = sentence.match(
      /^([A-Z][A-Za-z0-9 ()/_-]{2,70}?)\s+(?:is|are|means|refers to|can be defined as)\s+(.{20,300})$/i,
    );

    if (!match) continue;

    const term = match[1].trim();
    const definition = match[2].trim();
    const key = normalizeKey(term);

    if (seen.has(key)) continue;
    seen.add(key);
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
  const sourceSentences = extractMeaningfulSentences(sourceText, 10);
  const definitions = extractDefinitions(sourceText, 8);
  const headings = extractHeadings(sourceText, 10);
  const keywords = extractKeywords(sourceText, 12);

  const overview =
    core?.problem?.trim() ||
    sourceSentences[0] ||
    `This document discusses ${title}.`;

  const keyPoints = uniqueCaseInsensitive([
    ...(core?.keyPoints?.map((item) => `${item.label}: ${item.value}`) ?? []),
    ...(core?.contributions ?? []),
    ...sourceSentences.slice(1, 7),
  ]).slice(0, 10);

  const importantConcepts = uniqueCaseInsensitive([
    ...(core?.entities ?? []),
    ...(core?.extras?.keywords ?? []),
    ...definitions.map((item) => item.term),
    ...headings,
    ...keywords,
  ]).slice(0, 14);

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
      ? ["## Key Points", ...keyPoints.map((point) => `- ${point}`)].join("\n")
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
          ...sourceSentences.slice(0, 6).map((sentence) => `- ${sentence}`),
        ].join("\n")
      : "",
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 5_500)
    .trim();

  const evidenceCount =
    Number(Boolean(core?.problem)) +
    Number(Boolean(core?.method)) +
    Number(Boolean(core?.dataset)) +
    Math.min(5, keyPoints.length) +
    Math.min(4, definitions.length) +
    Math.min(2, headings.length);

  const confidence = clamp(
    0.25 + evidenceCount * 0.05 + Math.min(sourceText.length / 20_000, 0.2),
  );

  return {
    summary,
    keyPoints,
    importantConcepts,
    confidence,
    status:
      summary.length >= 350 && keyPoints.length >= 3 ? "ready" : "partial",
  };
}

function definitionDistractors(
  definitions: Array<{ term: string; definition: string }>,
  correctTerm: string,
  count: number,
): string[] {
  return definitions
    .filter((item) => normalizeKey(item.term) !== normalizeKey(correctTerm))
    .map((item) => item.definition.slice(0, 220))
    .filter((value, index, all) => all.indexOf(value) === index)
    .slice(0, count);
}

export function buildQuestionsFromSource(
  sourceText: string,
  count: number,
  allowedTypes: string[],
): QuizQuestionInput[] {
  const questions: QuizQuestionInput[] = [];
  const definitions = extractDefinitions(sourceText, Math.max(count * 2, 12));
  const sentences = extractMeaningfulSentences(
    sourceText,
    Math.max(count * 4, 30),
  );
  const headings = extractHeadings(sourceText, Math.max(count, 10));

  if (allowedTypes.includes("multiple_choice")) {
    for (const definition of definitions) {
      const distractors = definitionDistractors(
        definitions,
        definition.term,
        3,
      );
      if (distractors.length < 1) continue;

      questions.push({
        question: `Which statement best defines ${definition.term}?`,
        questionType: "multiple_choice",
        options: [definition.definition.slice(0, 220), ...distractors],
        answer: definition.definition.slice(0, 220),
        explanation: `The uploaded document defines ${definition.term} this way.`,
      });

      if (questions.length >= count) return questions;
    }
  }

  if (allowedTypes.includes("true_false")) {
    for (let index = 0; index < definitions.length; index += 1) {
      const definition = definitions[index];
      const makeFalse = index % 2 === 1 && definitions.length > 1;
      const paired = definitions[(index + 1) % definitions.length];

      const statement = makeFalse ? paired.definition : definition.definition;
      questions.push({
        question: `True or false: ${definition.term} is described as ${statement}`,
        questionType: "true_false",
        options: ["True", "False"],
        answer: makeFalse ? "False" : "True",
        explanation: makeFalse
          ? `That description belongs to ${paired.term}, not ${definition.term}.`
          : `This matches the definition in the uploaded document.`,
      });

      if (questions.length >= count) return questions;
    }

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

  if (allowedTypes.includes("short_answer")) {
    for (const { term, definition } of definitions) {
      questions.push({
        question: `What is ${term}?`,
        questionType: "short_answer",
        options: [],
        answer: definition.slice(0, 300),
        explanation:
          "This definition was extracted from the uploaded document.",
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
        explanation: "The answer is based on extracted document text.",
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
  const definitions = extractDefinitions(sourceText, Math.max(count, 15));
  const sentences = extractMeaningfulSentences(
    sourceText,
    Math.max(count * 4, 40),
  );
  const headings = extractHeadings(sourceText, Math.max(count, 12));
  const usedAnswers = new Set<string>();

  const pushCard = (card: SymbolicFlashcard): boolean => {
    const answerKey = normalizeKey(card.back);
    const frontKey = normalizeKey(card.front);

    if (
      !frontKey ||
      !answerKey ||
      cards.some((existing) => normalizeKey(existing.front) === frontKey) ||
      usedAnswers.has(answerKey)
    ) {
      return false;
    }

    cards.push(card);
    usedAnswers.add(answerKey);
    return true;
  };

  for (const { term, definition } of definitions) {
    pushCard({
      front: `What is ${term}?`,
      back: definition.slice(0, 350),
      difficulty: "easy",
    });
    if (cards.length >= count) return cards;
  }

  for (let index = 0; index < headings.length; index += 1) {
    const answer = sentences[index];
    if (!answer) break;

    pushCard({
      front: `What is a key point from "${headings[index]}"?`,
      back: answer.slice(0, 350),
      difficulty: "medium",
    });

    if (cards.length >= count) return cards;
  }

  for (let index = 0; index < sentences.length; index += 1) {
    const sentence = sentences[index];
    if (usedAnswers.has(normalizeKey(sentence))) continue;

    const keywords = extractKeywords(sentence, 3);
    const focus =
      keywords.length > 0
        ? keywords.slice(0, 2).join(" / ")
        : `study point ${index + 1}`;

    pushCard({
      front: `What does the document explain about ${focus}?`,
      back: sentence.slice(0, 350),
      difficulty: sentence.length > 180 ? "hard" : "medium",
    });

    if (cards.length >= count) break;
  }

  return cards;
}

function tokenizeForRetrieval(value: string): string[] {
  return (value.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) ?? []).filter(
    (term) => !STOP_WORDS.has(term),
  );
}

export function retrieveRelevantExcerpts(
  sourceText: string,
  question: string,
  limit = 3,
): string[] {
  const queryTerms = tokenizeForRetrieval(question);
  if (queryTerms.length === 0) return [];

  const uniqueTerms = [...new Set(queryTerms)];
  const queryPhrase = normalizeKey(question);
  const sentences = meaningfulSentenceCandidates(sourceText);

  const documentFrequency = new Map<string, number>();
  for (const term of uniqueTerms) {
    const count = sentences.reduce(
      (sum, sentence) => sum + Number(normalizeKey(sentence).includes(term)),
      0,
    );
    documentFrequency.set(term, count);
  }

  return sentences
    .map((sentence) => {
      const lower = normalizeKey(sentence);
      const sentenceTerms = new Set(tokenizeForRetrieval(sentence));

      let score = 0;
      for (const term of uniqueTerms) {
        if (!sentenceTerms.has(term) && !lower.includes(term)) continue;

        const frequency = documentFrequency.get(term) ?? 1;
        score += 1 + Math.log((sentences.length + 1) / (frequency + 1));
      }

      for (let index = 0; index < uniqueTerms.length - 1; index += 1) {
        const bigram = `${uniqueTerms[index]} ${uniqueTerms[index + 1]}`;
        if (lower.includes(bigram)) score += 1.5;
      }

      if (queryPhrase.length >= 12 && lower.includes(queryPhrase)) score += 4;
      if (sentence.length >= 70 && sentence.length <= 280) score += 0.25;

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

  const excerpts = retrieveRelevantExcerpts(sourceText, question, 4);

  if (excerpts.length > 0) {
    return {
      text: [
        "Based on the uploaded document:",
        ...excerpts.map((excerpt) => `- ${excerpt}`),
      ].join("\n"),
      confidence: excerpts.length >= 2 ? 0.76 : 0.6,
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
