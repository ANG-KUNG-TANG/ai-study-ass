import type {
  GroundedKnowledge,
} from "@/server/intelligence/grounding";
import type {
  QuizQuestionInput,
  QuestionType,
} from "@/server/entities/quiz.entity";

export type QuizQualityIssueCode =
  | "ANSWER_NOT_GROUNDED"
  | "ANSWER_NOT_UNIQUE"
  | "AMBIGUOUS_DISTRACTOR"
  | "DUPLICATE_OPTIONS"
  | "ANSWER_LEAKAGE"
  | "TRUE_STATEMENT_NOT_SUPPORTED"
  | "FALSE_STATEMENT_NOT_PROVABLE"
  | "SHORT_ANSWER_NOT_ANSWERABLE";

export interface QuizQualityRejection {
  questionType: QuestionType;
  reasonCodes: QuizQualityIssueCode[];
}

export interface QuizQualityResult {
  accepted: QuizQuestionInput[];
  rejected: QuizQualityRejection[];
}

interface SupportSource {
  text: string;
  sectionId: string | null;
  pageNumber?: number;
}

interface SupportMatch {
  source: SupportSource;
  score: number;
  questionRelevance: number;
}

const QUESTION_STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "does", "document",
  "false", "for", "from", "how", "in", "is", "it", "main", "material",
  "of", "one", "or", "reported", "stated", "the", "this", "to", "true",
  "uses", "what", "which", "with",
]);

const GENERIC_ANSWERABLE_QUESTION_PATTERNS = [
  /^which method does this document\b/i,
  /^what main problem does this document\b/i,
  /^what performance result is reported\b/i,
  /^name one contribution of this work\b/i,
  /^what is one important point from\b/i,
  /^what is stated about\b/i,
  /^what does .+ mean\b/i,
];

export function validateGroundedQuizQuestions(
  questions: QuizQuestionInput[],
  grounding: GroundedKnowledge,
): QuizQualityResult {
  const accepted: QuizQuestionInput[] = [];
  const rejected: QuizQualityRejection[] = [];
  const sources = buildSupportSources(grounding);

  for (const question of questions) {
    const reasonCodes = validateQuestion(question, grounding, sources);

    if (reasonCodes.length > 0) {
      rejected.push({
        questionType: question.questionType,
        reasonCodes,
      });
      continue;
    }

    accepted.push({
      ...question,
      options: [...question.options],
      explanation: buildEvidenceExplanation(question, grounding, sources),
    });
  }

  return { accepted, rejected };
}

export function quizQualityLogContext(
  result: QuizQualityResult,
): Record<string, unknown> {
  const reasonCounts: Record<string, number> = {};

  for (const rejection of result.rejected) {
    for (const code of rejection.reasonCodes) {
      reasonCounts[code] = (reasonCounts[code] ?? 0) + 1;
    }
  }

  return {
    acceptedCount: result.accepted.length,
    rejectedCount: result.rejected.length,
    rejectionReasonCounts: reasonCounts,
  };
}

function validateQuestion(
  question: QuizQuestionInput,
  grounding: GroundedKnowledge,
  sources: SupportSource[],
): QuizQualityIssueCode[] {
  if (question.questionType === "multiple_choice") {
    return validateMultipleChoice(question, grounding, sources);
  }
  if (question.questionType === "true_false") {
    return validateTrueFalse(question, sources);
  }
  return validateShortAnswer(question, grounding, sources);
}

function validateMultipleChoice(
  question: QuizQuestionInput,
  grounding: GroundedKnowledge,
  sources: SupportSource[],
): QuizQualityIssueCode[] {
  const issues: QuizQualityIssueCode[] = [];
  const normalisedOptions = question.options.map(normalise);

  if (new Set(normalisedOptions).size !== normalisedOptions.length) {
    issues.push("DUPLICATE_OPTIONS");
  }

  const answerKey = normalise(question.answer);
  const answerOccurrences = normalisedOptions.filter(
    (option) => option === answerKey,
  ).length;

  if (answerOccurrences !== 1) {
    issues.push("ANSWER_NOT_UNIQUE");
    return uniqueIssues(issues);
  }

  if (
    answerKey.length >= 4 &&
    normalise(question.question).includes(answerKey) &&
    !isDefinitionQuestion(question.question)
  ) {
    issues.push("ANSWER_LEAKAGE");
  }

  const definition = extractDefinitionPrompt(question.question);
  if (definition) {
    const matchingTerms = grounding.keyTerms.filter(
      (term) => supportScore(definition, term.definition) >= 0.72,
    );
    const correctMatches = matchingTerms.filter(
      (term) => normalise(term.term) === answerKey,
    );

    if (correctMatches.length !== 1) {
      issues.push("ANSWER_NOT_GROUNDED");
    }

    const optionKeys = new Set(normalisedOptions);
    const competing = matchingTerms.some(
      (term) =>
        normalise(term.term) !== answerKey &&
        optionKeys.has(normalise(term.term)),
    );

    if (competing) issues.push("AMBIGUOUS_DISTRACTOR");
    return uniqueIssues(issues);
  }

  const correctMatch = bestSupportMatch(
    question.answer,
    question.question,
    sources,
  );

  if (!correctMatch || !isAnswerSupportStrong(question.answer, correctMatch)) {
    issues.push("ANSWER_NOT_GROUNDED");
    return uniqueIssues(issues);
  }

  for (const option of question.options) {
    if (normalise(option) === answerKey) continue;

    const distractorMatch = bestSupportMatch(
      option,
      question.question,
      sources,
    );
    if (!distractorMatch) continue;

    if (
      isAnswerSupportStrong(option, distractorMatch) &&
      distractorMatch.questionRelevance >= 0.16 &&
      distractorMatch.score >= Math.max(0.78, correctMatch.score - 0.08)
    ) {
      issues.push("AMBIGUOUS_DISTRACTOR");
      break;
    }
  }

  return uniqueIssues(issues);
}

function validateTrueFalse(
  question: QuizQuestionInput,
  sources: SupportSource[],
): QuizQualityIssueCode[] {
  const statement = stripTrueFalsePrefix(question.question);

  if (question.answer === "True") {
    const match = bestSupportMatch(statement, statement, sources);
    return match && isStatementSupportStrong(statement, match)
      ? []
      : ["TRUE_STATEMENT_NOT_SUPPORTED"];
  }

  if (question.answer === "False") {
    return hasGroundedContradiction(statement, sources)
      ? []
      : ["FALSE_STATEMENT_NOT_PROVABLE"];
  }

  return ["ANSWER_NOT_GROUNDED"];
}

function validateShortAnswer(
  question: QuizQuestionInput,
  grounding: GroundedKnowledge,
  sources: SupportSource[],
): QuizQualityIssueCode[] {
  const answer = question.answer.trim();
  const quoted = extractQuotedText(question.question);

  if (quoted) {
    const term = grounding.keyTerms.find(
      (item) => normalise(item.term) === normalise(quoted),
    );

    if (term && /what does|define|definition|mean/i.test(question.question)) {
      return supportScore(answer, term.definition) >= 0.60
        ? []
        : ["ANSWER_NOT_GROUNDED"];
    }

    const section = grounding.sections.find(
      (item) => normalise(item.heading) === normalise(quoted),
    );

    if (section) {
      const sectionSources = sources.filter(
        (source) => source.sectionId === section.sectionId,
      );
      const match = bestSupportMatch(
        answer,
        question.question,
        sectionSources,
      );
      return match && isAnswerSupportStrong(answer, match)
        ? []
        : ["ANSWER_NOT_GROUNDED"];
    }
  }

  const match = bestSupportMatch(
    answer,
    question.question,
    sources,
  );

  if (!match || !isAnswerSupportStrong(answer, match)) {
    return ["ANSWER_NOT_GROUNDED"];
  }

  if (
    !isGenericAnswerableQuestion(question.question) &&
    match.questionRelevance < 0.10 &&
    !questionMentionsConcept(question.question, grounding)
  ) {
    return ["SHORT_ANSWER_NOT_ANSWERABLE"];
  }

  return [];
}

function buildSupportSources(
  grounding: GroundedKnowledge,
): SupportSource[] {
  const sources: SupportSource[] = [];

  for (const fact of grounding.facts) {
    if (fact.verificationStatus !== "supported") continue;
    sources.push({
      text: [
        fact.content,
        ...fact.evidence.map((item) => item.text),
      ].join(" "),
      sectionId: fact.sourceSectionId,
      pageNumber: fact.evidence[0]?.pageNumber,
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
      pageNumber: term.evidence[0]?.pageNumber,
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
      pageNumber: concept.evidence[0]?.pageNumber,
    });
  }

  return sources;
}

function bestSupportMatch(
  answer: string,
  question: string,
  sources: SupportSource[],
): SupportMatch | null {
  const answerNumbers = extractNumericTokens(answer);
  let best: SupportMatch | null = null;

  for (const source of sources) {
    if (
      answerNumbers.size > 0 &&
      !setIsSubset(answerNumbers, extractNumericTokens(source.text))
    ) {
      continue;
    }

    const score = supportScore(answer, source.text);
    const questionRelevance = contextRelevance(question, source.text);

    if (
      !best ||
      score + questionRelevance * 0.15 >
        best.score + best.questionRelevance * 0.15
    ) {
      best = { source, score, questionRelevance };
    }
  }

  return best;
}

function isAnswerSupportStrong(
  answer: string,
  match: SupportMatch,
): boolean {
  if (normalise(match.source.text).includes(normalise(answer))) return true;

  const tokenCount = meaningfulTokens(answer).size;
  if (tokenCount <= 2) return match.score >= 0.88;
  if (tokenCount <= 5) return match.score >= 0.68;
  return match.score >= 0.56;
}

function isStatementSupportStrong(
  statement: string,
  match: SupportMatch,
): boolean {
  const numbers = extractNumericTokens(statement);
  if (
    numbers.size > 0 &&
    !setIsSubset(numbers, extractNumericTokens(match.source.text))
  ) {
    return false;
  }

  return match.score >= 0.72;
}

function hasGroundedContradiction(
  statement: string,
  sources: SupportSource[],
): boolean {
  const statementNumbers = extractNumericTokens(statement);

  if (statementNumbers.size > 0) {
    for (const source of sources) {
      const sourceNumbers = extractNumericTokens(source.text);
      if (sourceNumbers.size === 0) continue;

      if (
        supportScore(removeNumbers(statement), removeNumbers(source.text)) >= 0.68 &&
        !setsEqual(statementNumbers, sourceNumbers)
      ) {
        return true;
      }
    }
  }

  const statementNegated = hasExplicitNegation(statement);
  const strippedStatement = stripNegation(statement);

  for (const source of sources) {
    const sourceNegated = hasExplicitNegation(source.text);

    if (
      statementNegated !== sourceNegated &&
      supportScore(strippedStatement, stripNegation(source.text)) >= 0.78
    ) {
      return true;
    }
  }

  return false;
}

function buildEvidenceExplanation(
  question: QuizQuestionInput,
  grounding: GroundedKnowledge,
  sources: SupportSource[],
): string {
  const quoted = extractQuotedText(question.question);

  if (quoted) {
    const term = grounding.keyTerms.find(
      (item) => normalise(item.term) === normalise(quoted),
    );
    if (term?.evidence[0]?.pageNumber) {
      return `The answer is supported by verified evidence on page ${term.evidence[0].pageNumber}.`;
    }
  }

  const target =
    question.questionType === "true_false"
      ? stripTrueFalsePrefix(question.question)
      : question.answer;
  const match = bestSupportMatch(target, question.question, sources);

  return match?.source.pageNumber
    ? `The answer is supported by verified evidence on page ${match.source.pageNumber}.`
    : "The answer is supported by verified document evidence.";
}

function extractDefinitionPrompt(
  question: string,
): string | null {
  const match = question.match(
    /which term is defined as:\s*["“](.+?)["”]\??$/iu,
  );
  return match?.[1]?.trim() ?? null;
}

function isDefinitionQuestion(question: string): boolean {
  return extractDefinitionPrompt(question) !== null;
}

function extractQuotedText(question: string): string | null {
  const match = question.match(/["“](.+?)["”]/u);
  return match?.[1]?.trim() ?? null;
}

function stripTrueFalsePrefix(question: string): string {
  return question
    .replace(/^\s*true\s+or\s+false\s*:\s*/iu, "")
    .trim();
}

function isGenericAnswerableQuestion(question: string): boolean {
  return GENERIC_ANSWERABLE_QUESTION_PATTERNS.some(
    (pattern) => pattern.test(question.trim()),
  );
}

function questionMentionsConcept(
  question: string,
  grounding: GroundedKnowledge,
): boolean {
  const cleaned = normalise(question);
  return grounding.concepts.some((concept) => {
    const name = normalise(concept.name);
    return Boolean(name && cleaned.includes(name));
  });
}

function contextRelevance(
  question: string,
  source: string,
): number {
  const questionTokens = new Set(
    [...meaningfulTokens(question)].filter(
      (token) => !QUESTION_STOP_WORDS.has(token),
    ),
  );

  return setCoverage(questionTokens, meaningfulTokens(source));
}

function supportScore(
  candidate: string,
  source: string,
): number {
  const candidateNormalised = normalise(candidate);
  const sourceNormalised = normalise(source);

  if (!candidateNormalised || !sourceNormalised) return 0;
  if (sourceNormalised.includes(candidateNormalised)) return 1;

  const tokenCoverage = setCoverage(
    meaningfulTokens(candidateNormalised),
    meaningfulTokens(sourceNormalised),
  );
  const gramCoverage = characterGramCoverage(
    compactNormalised(candidateNormalised),
    compactNormalised(sourceNormalised),
    3,
  );

  return Math.max(tokenCoverage, gramCoverage * 0.90);
}

function meaningfulTokens(text: string): Set<string> {
  return new Set(
    (
      normalise(text).match(
        /[\p{L}\p{N}][\p{L}\p{N}\p{M}_-]{1,}/gu,
      ) ?? []
    ).filter((token) => token.length >= 2),
  );
}

function extractNumericTokens(text: string): Set<string> {
  return new Set(
    (
      text.normalize("NFKC").match(
        /[-+]?\d+(?:[.,]\d+)*(?:\s*%)?/gu,
      ) ?? []
    ).map((value) =>
      value
        .replace(/\s+/gu, "")
        .replace(/,(?=\d{3}(?:\D|$))/gu, ""),
    ),
  );
}

function removeNumbers(text: string): string {
  return text.replace(
    /[-+]?\d+(?:[.,]\d+)*(?:\s*%)?/gu,
    " ",
  );
}

function hasExplicitNegation(text: string): boolean {
  return /\b(?:not|never|no|cannot|can't|doesn't|isn't|aren't|without)\b/iu.test(
    text,
  );
}

function stripNegation(text: string): string {
  return text.replace(
    /\b(?:not|never|no|cannot|can't|doesn't|isn't|aren't|without)\b/giu,
    " ",
  );
}

function normalise(text: string): string {
  return text
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}%+\-., ]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function compactNormalised(text: string): string {
  return normalise(text).replace(/[^\p{L}\p{N}]+/gu, "");
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

function grams(text: string, width: number): Set<string> {
  const values = new Set<string>();

  for (let index = 0; index <= text.length - width; index += 1) {
    values.add(text.slice(index, index + width));
  }

  return values;
}

function setCoverage(
  candidate: Set<string>,
  source: Set<string>,
): number {
  if (candidate.size === 0) return 0;

  let matches = 0;
  for (const value of candidate) {
    if (source.has(value)) matches += 1;
  }

  return matches / candidate.size;
}

function setIsSubset(
  candidate: Set<string>,
  source: Set<string>,
): boolean {
  for (const value of candidate) {
    if (!source.has(value)) return false;
  }
  return true;
}

function setsEqual(
  left: Set<string>,
  right: Set<string>,
): boolean {
  return left.size === right.size && setIsSubset(left, right);
}

function uniqueIssues(
  issues: QuizQualityIssueCode[],
): QuizQualityIssueCode[] {
  return [...new Set(issues)];
}
