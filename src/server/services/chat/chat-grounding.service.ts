import type {
  GroundedKnowledge,
} from "@/server/intelligence/grounding";

export type ChatAnswerability =
  | "ANSWERABLE"
  | "PARTIAL"
  | "NOT_ANSWERABLE";

export type ChatGroundingIssueCode =
  | "UNSUPPORTED_NUMERIC"
  | "UNSUPPORTED_CLAIM"
  | "PARTIAL_WITHOUT_LIMITATION"
  | "UNEXPECTED_ABSTENTION";

export interface ChatGroundingDecision {
  answerability: ChatAnswerability;
  confidence: number;
  queryCoverage: number;
  evidence: string[];
  evidenceIds: string[];
  supportedPoints: string[];
}

export interface ChatResponseValidation {
  accepted: boolean;
  issueCodes: ChatGroundingIssueCode[];
}

interface EvidenceCandidate {
  id: string;
  answerText: string;
  searchableText: string;
  evidenceText: string;
  aliases: string[];
  importance: number;
}

interface RankedCandidate {
  candidate: EvidenceCandidate;
  score: number;
  matchedQueryTokens: Set<string>;
}

const QUERY_STOP_WORDS = new Set([
  "a",
  "about",
  "after",
  "also",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "can",
  "could",
  "did",
  "do",
  "does",
  "explain",
  "for",
  "from",
  "give",
  "have",
  "how",
  "in",
  "into",
  "is",
  "it",
  "its",
  "me",
  "of",
  "on",
  "or",
  "please",
  "tell",
  "that",
  "the",
  "their",
  "this",
  "to",
  "was",
  "were",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "will",
  "with",
  "would",
  "you",
  "your",
]);

const BROAD_STUDY_QUERY_RE =
  /\b(?:summary|summarize|summarise|overview|main\s+(?:idea|ideas|point|points)|key\s+(?:idea|ideas|point|points)|what\s+is\s+this\s+(?:document|paper|note)\s+about)\b/iu;

const LIMITATION_RE =
  /\b(?:could\s+not|couldn't|cannot|can't|not\s+enough|insufficient|not\s+available|not\s+provided|does\s+not\s+provide|doesn't\s+provide|only\s+supports?|only\s+part|unable\s+to\s+verify|could\s+not\s+verify|couldn't\s+verify)\b/iu;

const SCAFFOLDING_RE =
  /^(?:based\s+on|according\s+to|the\s+document|the\s+uploaded\s+document|the\s+source|verified\s+evidence|from\s+the\s+document|the\s+evidence)/iu;

export function classifyGroundedQuestion(
  grounding: GroundedKnowledge,
  question: string,
): ChatGroundingDecision {
  const candidates = buildEvidenceCandidates(
    grounding,
  );

  if (candidates.length === 0) {
    return notAnswerableDecision();
  }

  const broadStudyQuery =
    BROAD_STUDY_QUERY_RE.test(question);

  if (broadStudyQuery) {
    const selected = candidates
      .filter(
        (candidate) =>
          candidate.answerText.trim().length >
          0,
      )
      .sort(
        (left, right) =>
          right.importance -
          left.importance,
      )
      .slice(0, 4);

    if (selected.length === 0) {
      return notAnswerableDecision();
    }

    return {
      answerability: "ANSWERABLE",
      confidence: 0.9,
      queryCoverage: 1,
      evidence: uniqueStrings(
        selected.map(
          (candidate) =>
            candidate.evidenceText,
        ),
      ),
      evidenceIds: uniqueStrings(
        selected.map(
          (candidate) =>
            candidate.id,
        ),
      ),
      supportedPoints: uniqueStrings(
        selected.map(
          (candidate) =>
            candidate.answerText,
        ),
      ),
    };
  }

  const queryTokens = meaningfulTokens(
    question,
  );

  if (queryTokens.size === 0) {
    return notAnswerableDecision();
  }

  const ranked = candidates
    .map((candidate) =>
      rankCandidate(
        candidate,
        question,
        queryTokens,
      ),
    )
    .filter(
      (item) =>
        item.score >= 0.2 &&
        item.matchedQueryTokens.size > 0,
    )
    .sort(
      (left, right) =>
        right.score - left.score,
    )
    .slice(0, 4);

  if (ranked.length === 0) {
    return notAnswerableDecision();
  }

  const matchedTokens = new Set<string>();
  for (const item of ranked) {
    for (
      const token of
      item.matchedQueryTokens
    ) {
      matchedTokens.add(token);
    }
  }

  const queryCoverage =
    queryTokens.size === 0
      ? 0
      : matchedTokens.size /
        queryTokens.size;

  const bestScore =
    ranked[0]?.score ?? 0;

  let answerability:
    ChatAnswerability;

  if (
    queryCoverage >= 0.72 &&
    bestScore >= 0.48
  ) {
    answerability = "ANSWERABLE";
  } else if (
    queryCoverage >= 0.2 &&
    bestScore >= 0.28
  ) {
    answerability = "PARTIAL";
  } else {
    return notAnswerableDecision();
  }

  const selected =
    selectDiverseCandidates(ranked, 3);

  return {
    answerability,
    confidence:
      roundRatio(
        Math.min(
          0.97,
          0.35 +
            queryCoverage * 0.45 +
            bestScore * 0.2,
        ),
      ),
    queryCoverage:
      roundRatio(queryCoverage),
    evidence: uniqueStrings(
      selected.map(
        (item) =>
          item.candidate.evidenceText,
      ),
    ),
    evidenceIds: uniqueStrings(
      selected.map(
        (item) =>
          item.candidate.id,
      ),
    ),
    supportedPoints:
      uniqueStrings(
        selected.map(
          (item) =>
            item.candidate.answerText,
        ),
      ),
  };
}

export function buildGroundedChatFallback(
  decision: ChatGroundingDecision,
): string {
  if (
    decision.answerability ===
    "NOT_ANSWERABLE"
  ) {
    return (
      "I couldn't find verified evidence in this document that answers that question. " +
      "I won't guess beyond the uploaded material."
    );
  }

  const points =
    decision.supportedPoints
      .filter(Boolean)
      .slice(0, 3);

  if (points.length === 0) {
    return (
      "I couldn't find enough verified document evidence to answer that confidently."
    );
  }

  const body =
    points.length === 1
      ? points[0]!
      : [
          "Based on verified document evidence:",
          ...points.map(
            (point) => `- ${point}`,
          ),
        ].join("\n");

  if (
    decision.answerability ===
    "PARTIAL"
  ) {
    return (
      `${body}\n\n` +
      "The document only supports part of your question; I couldn't verify the rest from the uploaded material."
    );
  }

  return body;
}

export function validateGroundedChatResponse(
  answer: string,
  decision: ChatGroundingDecision,
): ChatResponseValidation {
  const issueCodes:
    ChatGroundingIssueCode[] = [];

  if (
    decision.answerability ===
    "NOT_ANSWERABLE"
  ) {
    return {
      accepted: false,
      issueCodes: [
        "UNSUPPORTED_CLAIM",
      ],
    };
  }

  const supportCorpus = uniqueStrings([
    ...decision.evidence,
    ...decision.supportedPoints,
  ]).join(" ");

  const answerNumbers =
    numericTokens(answer);
  const supportNumbers =
    numericTokens(supportCorpus);

  if (
    !isSubset(
      answerNumbers,
      supportNumbers,
    )
  ) {
    issueCodes.push(
      "UNSUPPORTED_NUMERIC",
    );
  }

  const statements =
    factualStatements(answer);

  for (const statement of statements) {
    if (
      LIMITATION_RE.test(statement)
    ) {
      continue;
    }

    const support =
      supportScore(
        statement,
        supportCorpus,
      );

    if (support < 0.46) {
      issueCodes.push(
        "UNSUPPORTED_CLAIM",
      );
      break;
    }
  }

  if (
    decision.answerability ===
      "PARTIAL" &&
    !LIMITATION_RE.test(answer)
  ) {
    issueCodes.push(
      "PARTIAL_WITHOUT_LIMITATION",
    );
  }

  if (
    decision.answerability ===
      "ANSWERABLE" &&
    LIMITATION_RE.test(answer) &&
    statements.every(
      (statement) =>
        LIMITATION_RE.test(statement),
    )
  ) {
    issueCodes.push(
      "UNEXPECTED_ABSTENTION",
    );
  }

  return {
    accepted:
      issueCodes.length === 0,
    issueCodes:
      [...new Set(issueCodes)],
  };
}

export function chatGroundingLogContext(
  decision: ChatGroundingDecision,
  validation?:
    ChatResponseValidation,
): Record<string, unknown> {
  return {
    answerability:
      decision.answerability,
    groundingConfidence:
      decision.confidence,
    queryCoverage:
      decision.queryCoverage,
    evidenceCount:
      decision.evidence.length,
    responseAccepted:
      validation?.accepted,
    responseIssueCodes:
      validation?.issueCodes ?? [],
  };
}

function buildEvidenceCandidates(
  grounding: GroundedKnowledge,
): EvidenceCandidate[] {
  const headings =
    new Map(
      grounding.sections.map(
        (section) => [
          section.sectionId,
          section.heading,
        ],
      ),
    );

  const candidates:
    EvidenceCandidate[] = [];

  for (const term of grounding.keyTerms) {
    if (
      term.evidence.length === 0 ||
      !term.definition.trim()
    ) {
      continue;
    }

    candidates.push({
      id:
        term.evidence[0]?.id ??
        `term:${normalise(term.term)}`,
      answerText:
        term.definition.trim(),
      searchableText: [
        term.term,
        term.definition,
        headings.get(
          term.sourceSectionId,
        ) ?? "",
        ...term.evidence.map(
          (evidence) =>
            evidence.text,
        ),
      ].join(" "),
      evidenceText:
        term.evidence[0]?.text ??
        term.definition,
      aliases:
        aliasesFor(term.term),
      importance:
        Math.max(
          0.8,
          term.confidence,
        ),
    });
  }

  for (
    const concept of
    grounding.concepts
  ) {
    if (
      concept.evidence.length === 0
    ) {
      continue;
    }

    const answerText =
      concept.explanation?.trim() ||
      concept.evidence[0]?.text ||
      "";

    if (!answerText) continue;

    candidates.push({
      id:
        concept.evidence[0]?.id ??
        `concept:${normalise(
          concept.name,
        )}`,
      answerText,
      searchableText: [
        concept.name,
        concept.explanation ?? "",
        ...concept.sourceSectionIds.map(
          (sectionId) =>
            headings.get(sectionId) ??
            "",
        ),
        ...concept.evidence.map(
          (evidence) =>
            evidence.text,
        ),
      ].join(" "),
      evidenceText:
        concept.evidence[0]?.text ??
        answerText,
      aliases:
        aliasesFor(
          concept.name,
        ),
      importance:
        concept.importanceScore,
    });
  }

  for (const fact of grounding.facts) {
    if (
      fact.verificationStatus !==
        "supported" ||
      fact.evidence.length === 0 ||
      !isChatEligibleFact(
        fact.content,
      )
    ) {
      continue;
    }

    candidates.push({
      id:
        fact.evidence[0]?.id ??
        fact.id,
      answerText:
        fact.content,
      searchableText: [
        fact.content,
        headings.get(
          fact.sourceSectionId,
        ) ?? "",
        ...fact.evidence.map(
          (evidence) =>
            evidence.text,
        ),
      ].join(" "),
      evidenceText:
        fact.evidence[0]?.text ??
        fact.content,
      aliases: [],
      importance:
        fact.importanceScore,
    });
  }

  return deduplicateCandidates(
    candidates,
  );
}

function rankCandidate(
  candidate: EvidenceCandidate,
  question: string,
  queryTokens: Set<string>,
): RankedCandidate {
  const sourceTokens =
    meaningfulTokens(
      candidate.searchableText,
    );
  const matchedQueryTokens =
    intersection(
      queryTokens,
      sourceTokens,
    );

  const queryCoverage =
    queryTokens.size === 0
      ? 0
      : matchedQueryTokens.size /
        queryTokens.size;

  const phraseBonus =
    candidate.aliases.some(
      (alias) =>
        alias.length >= 2 &&
        containsPhrase(
          question,
          alias,
        ),
    )
      ? 0.36
      : 0;

  const sourceSpecificity =
    sourceTokens.size === 0
      ? 0
      : matchedQueryTokens.size /
        Math.min(
          sourceTokens.size,
          Math.max(
            1,
            queryTokens.size,
          ),
        );

  return {
    candidate,
    score:
      queryCoverage * 0.62 +
      Math.min(
        0.22,
        sourceSpecificity * 0.22,
      ) +
      phraseBonus +
      Math.min(
        0.08,
        candidate.importance * 0.08,
      ),
    matchedQueryTokens,
  };
}

function selectDiverseCandidates(
  ranked: RankedCandidate[],
  limit: number,
): RankedCandidate[] {
  const selected:
    RankedCandidate[] = [];
  const seenAnswers =
    new Set<string>();

  for (const item of ranked) {
    const key =
      normalise(
        item.candidate.answerText,
      );

    if (
      !key ||
      seenAnswers.has(key)
    ) {
      continue;
    }

    seenAnswers.add(key);
    selected.push(item);

    if (
      selected.length >= limit
    ) {
      break;
    }
  }

  return selected;
}

function deduplicateCandidates(
  candidates: EvidenceCandidate[],
): EvidenceCandidate[] {
  const output:
    EvidenceCandidate[] = [];
  const seen =
    new Set<string>();

  for (const candidate of candidates) {
    const key =
      normalise(
        candidate.answerText,
      );

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(candidate);
  }

  return output;
}

function factualStatements(
  answer: string,
): string[] {
  return answer
    .split(
      /\n+|(?<=[.!?。！？])\s+/u,
    )
    .map((statement) =>
      statement
        .replace(
          /^\s*[-*•]\s*/u,
          "",
        )
        .trim(),
    )
    .filter(
      (statement) =>
        statement.length > 0 &&
        !SCAFFOLDING_RE.test(
          statement,
        ) &&
        (
          meaningfulTokens(
            statement,
          ).size >= 3 ||
          numericTokens(
            statement,
          ).size > 0
        ),
    );
}

function supportScore(
  candidate: string,
  source: string,
): number {
  const left =
    normalise(candidate);
  const right =
    normalise(source);

  if (!left || !right) {
    return 0;
  }

  if (right.includes(left)) {
    return 1;
  }

  const tokenCoverage =
    setCoverage(
      meaningfulTokens(left),
      meaningfulTokens(right),
    );

  const gramCoverage =
    characterGramCoverage(
      compact(left),
      compact(right),
      3,
    );

  return Math.max(
    tokenCoverage,
    gramCoverage * 0.88,
  );
}

function meaningfulTokens(
  value: string,
): Set<string> {
  const raw =
    normalise(value).match(
      /[\p{L}\p{N}][\p{L}\p{N}\p{M}_-]*/gu,
    ) ?? [];

  return new Set(
    raw
      .map(canonicalToken)
      .filter(
        (token) =>
          token.length >= 2 &&
          !QUERY_STOP_WORDS.has(
            token,
          ),
      ),
  );
}

function canonicalToken(
  token: string,
): string {
  const value =
    token.toLocaleLowerCase();

  if (
    !/^[a-z0-9-]+$/u.test(
      value,
    ) ||
    value.length <= 4
  ) {
    return value;
  }

  if (
    value.endsWith("ing") &&
    value.length > 6
  ) {
    return value.slice(0, -3);
  }

  if (
    value.endsWith("ed") &&
    value.length > 5
  ) {
    return value.slice(0, -2);
  }

  if (
    value.endsWith("es") &&
    value.length > 5
  ) {
    return value.slice(0, -2);
  }

  if (
    value.endsWith("s") &&
    value.length > 4
  ) {
    return value.slice(0, -1);
  }

  return value;
}

function aliasesFor(
  label: string,
): string[] {
  const aliases = [
    normalise(label),
  ];
  const acronym =
    initialism(label);

  if (acronym.length >= 2) {
    aliases.push(acronym);
  }

  return uniqueStrings(aliases);
}

function initialism(
  value: string,
): string {
  const words =
    value
      .normalize("NFKC")
      .match(
        /[\p{L}\p{N}]+/gu,
      ) ?? [];

  if (words.length < 2) {
    return "";
  }

  return words
    .map((word) =>
      word[0] ?? "",
    )
    .join("")
    .toLocaleLowerCase();
}

function containsPhrase(
  text: string,
  phrase: string,
): boolean {
  const haystack =
    normalise(text);
  const needle =
    normalise(phrase);

  if (!needle) return false;

  const start =
    haystack.indexOf(needle);

  if (start < 0) {
    return false;
  }

  const before =
    start === 0
      ? ""
      : haystack[
          start - 1
        ] ?? "";
  const end =
    start + needle.length;
  const after =
    end >= haystack.length
      ? ""
      : haystack[end] ?? "";

  return (
    !/[\p{L}\p{N}\p{M}]/u.test(
      before,
    ) &&
    !/[\p{L}\p{N}\p{M}]/u.test(
      after,
    )
  );
}

function numericTokens(
  value: string,
): Set<string> {
  return new Set(
    (
      value
        .normalize("NFKC")
        .match(
          /[-+]?\d+(?:[.,]\d+)*(?:\s*%)?/gu,
        ) ?? []
    ).map((token) =>
      token
        .replace(/\s+/gu, "")
        .replace(
          /,(?=\d{3}(?:\D|$))/gu,
          "",
        ),
    ),
  );
}

function intersection(
  left: Set<string>,
  right: Set<string>,
): Set<string> {
  return new Set(
    [...left].filter(
      (token) =>
        right.has(token),
    ),
  );
}

function setCoverage(
  candidate: Set<string>,
  source: Set<string>,
): number {
  if (candidate.size === 0) {
    return 0;
  }

  let matches = 0;

  for (const token of candidate) {
    if (source.has(token)) {
      matches += 1;
    }
  }

  return matches /
    candidate.size;
}

function characterGramCoverage(
  candidate: string,
  source: string,
  width: number,
): number {
  if (
    candidate.length < width ||
    source.length < width
  ) {
    return candidate === source
      ? 1
      : 0;
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
  const output =
    new Set<string>();

  for (
    let index = 0;
    index <=
    value.length - width;
    index += 1
  ) {
    output.add(
      value.slice(
        index,
        index + width,
      ),
    );
  }

  return output;
}

function isSubset(
  candidate: Set<string>,
  source: Set<string>,
): boolean {
  for (const token of candidate) {
    if (!source.has(token)) {
      return false;
    }
  }

  return true;
}

function isChatEligibleFact(
  value: string,
): boolean {
  return !/^(?:project name|team members?|course:?|date:?|student name|student id|use case name|brief description|actor involved|system purpose|purpose of the system|problem summary|stakeholders|system scope)\b/iu.test(
    value.trim(),
  );
}

function notAnswerableDecision():
  ChatGroundingDecision {
  return {
    answerability:
      "NOT_ANSWERABLE",
    confidence: 0.98,
    queryCoverage: 0,
    evidence: [],
    evidenceIds: [],
    supportedPoints: [],
  };
}

function uniqueStrings(
  values: string[],
): string[] {
  return [
    ...new Set(
      values.filter(
        (value) =>
          value.trim().length > 0,
      ),
    ),
  ];
}

function compact(
  value: string,
): string {
  return value.replace(
    /[^\p{L}\p{N}]+/gu,
    "",
  );
}

function normalise(
  value: string,
): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(
      /[^\p{L}\p{N}\p{M}%+., -]+/gu,
      " ",
    )
    .replace(/\s+/gu, " ")
    .trim();
}

function roundRatio(
  value: number,
): number {
  return (
    Math.round(
      value * 1000,
    ) / 1000
  );
}
