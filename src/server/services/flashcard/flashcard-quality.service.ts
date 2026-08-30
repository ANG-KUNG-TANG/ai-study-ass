import type {
  GroundedKnowledge,
} from "@/server/intelligence/grounding";
import type {
  FlashcardDifficulty,
} from "@/server/entities/flashcard.entity";
import {
  buildFeatureQualityReport,
  qualityRatio,
  type FeatureQualityContractReport,
} from "@/server/services/quality/feature-quality.contract";
import {
  selectLearningConcepts,
  toLearningGrounding,
} from "@/server/services/quality/learning-evidence.service";

export interface FlashcardQualityDraft {
  front: string;
  back: string;
  difficulty: FlashcardDifficulty;
}

export type FlashcardQualityIssueCode =
  | "BACK_NOT_GROUNDED"
  | "FRONT_NOT_ANSWERABLE"
  | "ANSWER_LEAKAGE"
  | "MULTIPLE_IDEAS"
  | "NEAR_DUPLICATE"
  | "LOW_STUDY_VALUE";

export interface FlashcardQualityRejection {
  issueCodes: FlashcardQualityIssueCode[];
}

export interface FlashcardQualityResult {
  accepted: FlashcardQualityDraft[];
  rejected: FlashcardQualityRejection[];
  contract: FeatureQualityContractReport;
}

interface SupportSource {
  text: string;
  sectionId: string | null;
  heading: string | null;
  kind: "fact" | "term" | "concept";
  label: string | null;
  importance: number;
}

interface SupportMatch {
  source: SupportSource;
  score: number;
  questionRelevance: number;
}

const QUESTION_STOP_WORDS = new Set([
  "a", "about", "an", "and", "are", "as", "at", "be", "does", "document",
  "evaluation", "for", "from", "important", "in", "is", "main", "one",
  "or", "reported", "result", "the", "this", "to", "used", "uses", "what",
  "which", "with", "work",
]);

const SAFE_GENERIC_FRONTS = [
  /^what is the main method proposed or evaluated\??$/i,
  /^which dataset is used\??$/i,
  /^which evaluation metric is used\??$/i,
  /^what performance result is reported\??$/i,
  /^what problem does the document address\??$/i,
  /^what is one contribution of this work\??$/i,
];

const LOW_VALUE_PATTERNS = [
  /^(?:project name|team members?|course|date|student name|student id|page number)\b/i,
  /^(?:name|title):?\s*$/i,
];

export function validateGroundedFlashcards(
  cards: FlashcardQualityDraft[],
  grounding: GroundedKnowledge,
): FlashcardQualityResult {
  const accepted: FlashcardQualityDraft[] = [];
  const rejected: FlashcardQualityRejection[] = [];
  const sources = buildSupportSources(grounding);

  for (const card of cards) {
    const issueCodes = validateCard(
      card,
      grounding,
      sources,
      accepted,
    );

    if (issueCodes.length > 0) {
      rejected.push({ issueCodes });
      continue;
    }

    accepted.push({
      ...card,
      front: card.front.trim(),
      back: card.back.trim(),
    });
  }

  const contract = assessFlashcardQualityContract(accepted, grounding);
  return { accepted, rejected, contract };
}

export function assessFlashcardQualityContract(
  cards: FlashcardQualityDraft[],
  grounding: GroundedKnowledge,
): FeatureQualityContractReport {
  const sources = buildSupportSources(grounding);
  const total = cards.length;
  const matches = cards.map((card) => ({
    card,
    match: bestSupportMatch(card.back, card.front, sources),
  }));
  const groundedCount = matches.filter(({ card, match }) =>
    Boolean(match && isSupportStrong(card.back, match)),
  ).length;
  const atomicCount = matches.filter(({ card, match }) =>
    Boolean(match && isAtomic(card.back, match, sources)),
  ).length;
  const usefulCount = matches.filter(({ card, match }) =>
    Boolean(
      match &&
      isFrontAnswerable(card.front, card.back, grounding, match, sources) &&
      hasStudyValue(card, match),
    ),
  ).length;
  const clarityCount = cards.filter((card) => isClearCard(card)).length;
  const concepts = selectLearningConcepts(grounding.concepts, Math.max(4, Math.min(12, total)));
  const deckText = cards.map((card) => `${card.front} ${card.back}`).join(" ");
  const coverage = qualityRatio(
    concepts.filter((concept) => textRepresents(deckText, concept.name)).length,
    concepts.length,
    1,
  );
  const importance = average(
    matches
      .map(({ match }) => match?.source.importance ?? 0)
      .map((value) => Math.min(1, value / 0.8)),
    1,
  );
  const duplicateRatio = nearDuplicateDeckRatio(cards);
  const difficultyBalance = flashcardDifficultyBalance(cards);
  const leakageFree = cards.every((card) => !leaksAnswer(card.front, card.back));

  return buildFeatureQualityReport({
    feature: "flashcards",
    dimensions: [
      { key: "grounding", label: "Grounding", weight: 2.0, ratio: qualityRatio(groundedCount, total, 1) },
      { key: "atomicity", label: "Atomicity", weight: 1.5, ratio: qualityRatio(atomicCount, total, 1) },
      { key: "recallUsefulness", label: "Recall usefulness", weight: 1.5, ratio: qualityRatio(usefulCount, total, 1) },
      { key: "conceptImportance", label: "Concept importance", weight: 1.5, ratio: importance },
      { key: "clarity", label: "Front/back clarity", weight: 1.0, ratio: qualityRatio(clarityCount, total, 1) },
      { key: "coverage", label: "Concept coverage", weight: 1.0, ratio: coverage },
      { key: "duplicateControl", label: "Duplicate control", weight: 0.75, ratio: 1 - duplicateRatio },
      { key: "evidenceTraceability", label: "Evidence traceability", weight: 0.5, ratio: qualityRatio(groundedCount, total, 1) },
      { key: "deckBalance", label: "Deck balance", weight: 0.25, ratio: difficultyBalance },
    ],
    hardGates: [
      {
        code: "NON_EMPTY_DECK",
        message: "A quality-scored flashcard deck must contain at least one validated card.",
        passed: total > 0,
      },
      {
        code: "ALL_BACKS_GROUNDED",
        message: "Every flashcard answer must be supported by document evidence.",
        passed: groundedCount === total,
      },
      {
        code: "ATOMIC_RECALL",
        message: "Every persisted flashcard must test one primary recall unit.",
        passed: atomicCount === total,
      },
      {
        code: "NO_ANSWER_LEAKAGE",
        message: "Flashcard fronts must not reveal their answers.",
        passed: leakageFree,
      },
    ],
  });
}

export function selectHighestQualityFlashcardSet(
  cards: FlashcardQualityDraft[],
  grounding: GroundedKnowledge,
  limit: number,
): FlashcardQualityDraft[] {
  const target = Math.max(1, Math.floor(limit));
  if (cards.length <= target) return [...cards];

  const remaining = [...cards];
  const selected: FlashcardQualityDraft[] = [];

  while (remaining.length > 0 && selected.length < target) {
    let bestIndex = 0;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index];
      if (!candidate) continue;
      const report = assessFlashcardQualityContract(
        [...selected, candidate],
        grounding,
      );
      const score =
        report.scoreOutOf10 +
        (report.hardGatePassed ? 0.05 : 0) +
        (report.passed ? 0.1 : 0);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }

    const [best] = remaining.splice(bestIndex, 1);
    if (best) selected.push(best);
  }

  return selected;
}

export function flashcardQualityLogContext(
  result: FlashcardQualityResult,
): Record<string, unknown> {
  const rejectionReasonCounts: Record<string, number> = {};

  for (const rejection of result.rejected) {
    for (const code of rejection.issueCodes) {
      rejectionReasonCounts[code] =
        (rejectionReasonCounts[code] ?? 0) + 1;
    }
  }

  return {
    acceptedCount: result.accepted.length,
    rejectedCount: result.rejected.length,
    rejectionReasonCounts,
    qualityScoreOutOf10: result.contract.scoreOutOf10,
    qualityPassed: result.contract.passed,
    failedHardGates: result.contract.hardGates.filter((gate) => !gate.passed).map((gate) => gate.code),
  };
}

function isClearCard(card: FlashcardQualityDraft): boolean {
  const front = card.front.trim();
  const back = card.back.trim();
  if (front.length < 6 || front.length > 220 || back.length < 2 || back.length > 450) return false;
  if (/^(?:it|this|that|these|those)\b/iu.test(front)) return false;
  return true;
}

function flashcardDifficultyBalance(cards: FlashcardQualityDraft[]): number {
  if (cards.length <= 4) return 1;
  const levels = new Set(cards.map((card) => card.difficulty));
  if (levels.size >= 3) return 1;
  if (levels.size === 2) return 0.97;
  return 0.9;
}

function nearDuplicateDeckRatio(cards: FlashcardQualityDraft[]): number {
  if (cards.length <= 1) return 0;
  let duplicates = 0;
  const accepted: FlashcardQualityDraft[] = [];
  for (const card of cards) {
    if (isNearDuplicate(card, accepted)) duplicates += 1;
    else accepted.push(card);
  }
  return duplicates / cards.length;
}

function textRepresents(source: string, target: string): boolean {
  const left = normalise(source);
  const right = normalise(target);
  if (!left || !right) return false;
  if (left.includes(right)) return true;
  return setCoverage(meaningfulTokens(right), meaningfulTokens(left)) >= 0.8;
}

function average(values: number[], emptyValue: number): number {
  if (values.length === 0) return emptyValue;
  return Math.max(0, Math.min(1, values.reduce((sum, value) => sum + value, 0) / values.length));
}

function validateCard(
  card: FlashcardQualityDraft,
  grounding: GroundedKnowledge,
  sources: SupportSource[],
  accepted: FlashcardQualityDraft[],
): FlashcardQualityIssueCode[] {
  const issues: FlashcardQualityIssueCode[] = [];
  const backMatch = bestSupportMatch(
    card.back,
    card.front,
    sources,
  );

  if (
    !backMatch ||
    !isSupportStrong(card.back, backMatch)
  ) {
    issues.push("BACK_NOT_GROUNDED");
    return uniqueIssues(issues);
  }

  if (leaksAnswer(card.front, card.back)) {
    issues.push("ANSWER_LEAKAGE");
  }

  if (!isAtomic(card.back, backMatch, sources)) {
    issues.push("MULTIPLE_IDEAS");
  }

  if (
    !isFrontAnswerable(
      card.front,
      card.back,
      grounding,
      backMatch,
      sources,
    )
  ) {
    issues.push("FRONT_NOT_ANSWERABLE");
  }

  if (!hasStudyValue(card, backMatch)) {
    issues.push("LOW_STUDY_VALUE");
  }

  if (isNearDuplicate(card, accepted)) {
    issues.push("NEAR_DUPLICATE");
  }

  return uniqueIssues(issues);
}

function buildSupportSources(
  grounding: GroundedKnowledge,
): SupportSource[] {
  grounding = toLearningGrounding(grounding);
  const headings = new Map(
    grounding.sections.map(
      (section) => [section.sectionId, section.heading],
    ),
  );
  const sources: SupportSource[] = [];

  for (const fact of grounding.facts) {
    if (fact.verificationStatus !== "supported") continue;

    sources.push({
      text: [
        fact.content,
        ...fact.evidence.map((item) => item.text),
      ].join(" "),
      sectionId: fact.sourceSectionId,
      heading: headings.get(fact.sourceSectionId) ?? null,
      kind: "fact",
      label: null,
      importance: fact.importanceScore,
    });
  }

  for (const term of grounding.keyTerms) {
    sources.push({
      text: [
        term.term,
        term.definition,
        ...term.evidence.map((item) => item.text),
      ].join(" "),
      sectionId: term.sourceSectionId,
      heading: headings.get(term.sourceSectionId) ?? null,
      kind: "term",
      label: term.term,
      importance: Math.max(0.75, term.confidence),
    });
  }

  for (const concept of grounding.concepts) {
    sources.push({
      text: [
        concept.name,
        concept.explanation ?? "",
        ...concept.evidence.map((item) => item.text),
      ].join(" "),
      sectionId: concept.sourceSectionIds[0] ?? null,
      heading:
        concept.sourceSectionIds[0]
          ? headings.get(concept.sourceSectionIds[0]) ?? null
          : null,
      kind: "concept",
      label: concept.name,
      importance: concept.importanceScore,
    });
  }

  return sources;
}

function bestSupportMatch(
  back: string,
  front: string,
  sources: SupportSource[],
): SupportMatch | null {
  const backNumbers = numericTokens(back);
  let best: SupportMatch | null = null;

  for (const source of sources) {
    if (
      backNumbers.size > 0 &&
      !isSubset(backNumbers, numericTokens(source.text))
    ) {
      continue;
    }

    const score = supportScore(back, source.text);
    const questionRelevance = contextRelevance(
      front,
      source,
    );
    const candidate: SupportMatch = {
      source,
      score,
      questionRelevance,
    };

    if (
      !best ||
      candidate.score + candidate.questionRelevance * 0.12 >
        best.score + best.questionRelevance * 0.12
    ) {
      best = candidate;
    }
  }

  return best;
}

function isSupportStrong(
  back: string,
  match: SupportMatch,
): boolean {
  const normalisedBack = normalise(back);
  const normalisedSource = normalise(match.source.text);

  if (
    normalisedBack &&
    normalisedSource.includes(normalisedBack)
  ) {
    return true;
  }

  const tokenCount = meaningfulTokens(back).size;
  if (tokenCount <= 2) return match.score >= 0.88;
  if (tokenCount <= 5) return match.score >= 0.70;
  return match.score >= 0.56;
}

function isFrontAnswerable(
  front: string,
  back: string,
  grounding: GroundedKnowledge,
  match: SupportMatch,
  sources: SupportSource[],
): boolean {
  const quoted = extractQuoted(front);

  if (quoted) {
    const term = grounding.keyTerms.find(
      (item) => normalise(item.term) === normalise(quoted),
    );

    if (
      term &&
      /what does|mean|define|definition/i.test(front)
    ) {
      return supportScore(back, term.definition) >= 0.60;
    }

    const section = grounding.sections.find(
      (item) => normalise(item.heading) === normalise(quoted),
    );

    if (section) {
      return match.source.sectionId === section.sectionId;
    }

    const conceptOrLabel = sources.find(
      (source) =>
        source.label &&
        normalise(source.label) === normalise(quoted),
    );

    if (conceptOrLabel) {
      return (
        match.source.sectionId === conceptOrLabel.sectionId ||
        supportScore(back, conceptOrLabel.text) >= 0.55
      );
    }
  }

  if (
    SAFE_GENERIC_FRONTS.some((pattern) => pattern.test(front.trim()))
  ) {
    return true;
  }

  return match.questionRelevance >= 0.12;
}

function isAtomic(
  back: string,
  bestMatch: SupportMatch,
  sources: SupportSource[],
): boolean {
  if (
    /(?:^|\n)\s*(?:[-*•]|\d+[.)])\s+/u.test(back)
  ) {
    return false;
  }

  const substantiveSentences = back
    .split(/(?<=[.!?。！？])\s+/u)
    .map((item) => item.trim())
    .filter((item) => meaningfulTokens(item).size >= 3);

  if (substantiveSentences.length >= 3) {
    return false;
  }

  // If one grounded source supports the complete back strongly, treat it as
  // one study unit even when the sentence contains conjunctions.
  if (isSupportStrong(back, bestMatch)) {
    const independentlyStrong = sources.filter((source) => {
      if (source === bestMatch.source) return false;
      if (source.sectionId === bestMatch.source.sectionId) return false;
      return supportScore(back, source.text) >= 0.72;
    });

    return independentlyStrong.length === 0;
  }

  return true;
}

function leaksAnswer(
  front: string,
  back: string,
): boolean {
  const normalisedBack = normalise(back);
  const normalisedFront = normalise(front);

  if (!normalisedBack || normalisedBack.length < 3) return false;

  if (
    normalisedBack.length <= 80 &&
    normalisedFront.includes(normalisedBack)
  ) {
    return true;
  }

  const backTokens = meaningfulTokens(back);
  if (backTokens.size === 0 || backTokens.size > 4) {
    return false;
  }

  return setCoverage(
    backTokens,
    meaningfulTokens(front),
  ) === 1;
}

function hasStudyValue(
  card: FlashcardQualityDraft,
  match: SupportMatch,
): boolean {
  const back = card.back.trim();

  if (
    LOW_VALUE_PATTERNS.some(
      (pattern) =>
        pattern.test(card.front.trim()) ||
        pattern.test(back),
    )
  ) {
    return false;
  }

  if (match.source.kind === "term") return true;

  if (
    match.source.kind === "fact" &&
    match.source.importance >= 0.35
  ) {
    return true;
  }

  return (
    match.source.kind === "concept" &&
    match.source.importance >= 0.50
  );
}

function isNearDuplicate(
  candidate: FlashcardQualityDraft,
  accepted: FlashcardQualityDraft[],
): boolean {
  return accepted.some((existing) => {
    const frontScore = supportScore(
      candidate.front,
      existing.front,
    );
    const backScore = supportScore(
      candidate.back,
      existing.back,
    );

    return (
      backScore >= 0.93 ||
      (frontScore >= 0.88 && backScore >= 0.58)
    );
  });
}

function contextRelevance(
  front: string,
  source: SupportSource,
): number {
  const frontTokens = new Set(
    [...meaningfulTokens(front)].filter(
      (token) => !QUESTION_STOP_WORDS.has(token),
    ),
  );

  const context = [
    source.label ?? "",
    source.heading ?? "",
    source.text,
  ].join(" ");

  return setCoverage(
    frontTokens,
    meaningfulTokens(context),
  );
}

function supportScore(
  candidate: string,
  source: string,
): number {
  const left = normalise(candidate);
  const right = normalise(source);

  if (!left || !right) return 0;
  if (right.includes(left)) return 1;

  const tokenScore = setCoverage(
    meaningfulTokens(left),
    meaningfulTokens(right),
  );
  const gramScore = characterGramCoverage(
    compact(left),
    compact(right),
    3,
  );

  return Math.max(tokenScore, gramScore * 0.90);
}

function meaningfulTokens(
  value: string,
): Set<string> {
  return new Set(
    (
      normalise(value).match(
        /[\p{L}\p{N}][\p{L}\p{N}\p{M}_-]{1,}/gu,
      ) ?? []
    ).filter((token) => token.length >= 2),
  );
}

function numericTokens(
  value: string,
): Set<string> {
  return new Set(
    (
      value.normalize("NFKC").match(
        /[-+]?\d+(?:[.,]\d+)*(?:\s*%)?/gu,
      ) ?? []
    ).map((token) =>
      token
        .replace(/\s+/gu, "")
        .replace(/,(?=\d{3}(?:\D|$))/gu, ""),
    ),
  );
}

function extractQuoted(value: string): string | null {
  const match = value.match(/["“](.+?)["”]/u);
  return match?.[1]?.trim() ?? null;
}

function normalise(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}%+\-., ]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function compact(value: string): string {
  return value.replace(/[^\p{L}\p{N}]+/gu, "");
}

function characterGramCoverage(
  candidate: string,
  source: string,
  width: number,
): number {
  if (candidate.length < width || source.length < width) {
    return candidate === source ? 1 : 0;
  }

  return setCoverage(
    grams(candidate, width),
    grams(source, width),
  );
}

function grams(
  value: string,
  width: number,
): Set<string> {
  const result = new Set<string>();

  for (
    let index = 0;
    index <= value.length - width;
    index += 1
  ) {
    result.add(value.slice(index, index + width));
  }

  return result;
}

function setCoverage(
  candidate: Set<string>,
  source: Set<string>,
): number {
  if (candidate.size === 0) return 0;

  let matches = 0;
  for (const token of candidate) {
    if (source.has(token)) matches += 1;
  }

  return matches / candidate.size;
}

function isSubset(
  candidate: Set<string>,
  source: Set<string>,
): boolean {
  for (const token of candidate) {
    if (!source.has(token)) return false;
  }

  return true;
}

function uniqueIssues(
  issues: FlashcardQualityIssueCode[],
): FlashcardQualityIssueCode[] {
  return [...new Set(issues)];
}
