import type {
  AtomicFact,
  GroundedKnowledge,
} from "@/server/intelligence/grounding";
import type { QuizQuestionInput } from "@/server/entities/quiz.entity";
import type { FlashcardDifficulty } from "@/server/entities/flashcard.entity";

const QUERY_STOP_WORDS = new Set([
  "about", "after", "also", "and", "are", "can", "does", "for", "from",
  "have", "how", "into", "its", "that", "the", "their", "this", "what",
  "when", "where", "which", "with", "would", "your",
]);

export interface GroundedFlashcardDraft {
  front: string;
  back: string;
  difficulty: FlashcardDifficulty;
}

export interface GroundedChatAnswer {
  text: string;
  confidence: number;
  evidence: string[];
}

export function buildQuestionsFromGrounding(
  grounding: GroundedKnowledge,
  count: number,
  allowedTypes: readonly string[],
): QuizQuestionInput[] {
  const questions: QuizQuestionInput[] = [];
  const concepts = grounding.concepts.map((concept) => concept.name);

  for (const term of grounding.keyTerms) {
    if (questions.length >= count) break;

    if (allowedTypes.includes("multiple_choice")) {
      const distractors = concepts
        .filter((concept) => normalise(concept) !== normalise(term.term))
        .slice(0, 3);

      if (distractors.length >= 2) {
        questions.push({
          question: `Which term is defined as: "${shorten(term.definition, 220)}"?`,
          questionType: "multiple_choice",
          options: [term.term, ...distractors],
          answer: term.term,
          explanation: evidenceExplanation(term.evidence[0]?.pageNumber),
        });
        continue;
      }
    }

    if (allowedTypes.includes("short_answer")) {
      questions.push({
        question: `What does "${term.term}" mean?`,
        questionType: "short_answer",
        options: [],
        answer: shorten(term.definition, 300),
        explanation: evidenceExplanation(term.evidence[0]?.pageNumber),
      });
    }
  }

  const facts = factsWithoutQualifiedDefinitions(grounding);
  const sectionHeadings = new Map(
    grounding.sections.map((section) => [section.sectionId, section.heading]),
  );

  for (const fact of facts) {
    if (questions.length >= count) break;

    const shouldUseTrueFalse = allowedTypes.includes("true_false") &&
      (
        !allowedTypes.includes("short_answer") ||
        questions.length % 3 === 2
      );
    if (
      shouldUseTrueFalse &&
      isTrueFalseSuitable(fact.content)
    ) {
      questions.push({
        question: `True or false: ${fact.content}`,
        questionType: "true_false",
        options: ["True", "False"],
        answer: "True",
        explanation: evidenceExplanation(fact.evidence[0]?.pageNumber),
      });
      continue;
    }

    if (allowedTypes.includes("short_answer")) {
      const heading = sectionHeadings.get(fact.sourceSectionId) ?? "the document";
      questions.push({
        question: `What is one important point from "${cleanHeading(heading)}"?`,
        questionType: "short_answer",
        options: [],
        answer: shorten(fact.content, 300),
        explanation: evidenceExplanation(fact.evidence[0]?.pageNumber),
      });
    }
  }

  return deduplicateQuestions(questions).slice(0, count);
}

export function buildFlashcardsFromGrounding(
  grounding: GroundedKnowledge,
  count: number,
): GroundedFlashcardDraft[] {
  const cards: GroundedFlashcardDraft[] = grounding.keyTerms.map((term) => ({
    front: `What does "${term.term}" mean?`,
    back: shorten(term.definition, 350),
    difficulty: "easy" as const,
  }));
  const headings = new Map(
    grounding.sections.map((section) => [section.sectionId, section.heading]),
  );

  for (const fact of factsWithoutQualifiedDefinitions(grounding)) {
    if (cards.length >= count) break;
    const heading = cleanHeading(
      headings.get(fact.sourceSectionId) ?? "this document",
    );
    cards.push({
      front: questionForFact(fact, heading),
      back: shorten(fact.content, 350),
      difficulty: difficultyForFact(fact),
    });
  }

  return deduplicateCards(cards).slice(0, count);
}

export function answerFromGrounding(
  grounding: GroundedKnowledge,
  question: string,
  limit = 3,
): GroundedChatAnswer {
  const query = new Set(tokenise(question));
  const sectionHeadings = new Map(
    grounding.sections.map((section) => [section.sectionId, section.heading]),
  );

  for (const term of grounding.keyTerms) {
    if (question.toLowerCase().includes(term.term.toLowerCase())) {
      return {
        text: term.definition,
        confidence: 0.96,
        evidence: term.evidence.map((evidence) => evidence.text),
      };
    }
  }

  const ranked = uniqueSupportedFacts(grounding)
    .map((fact) => {
      const factTokens = new Set(tokenise(fact.content));
      const overlap = [...query].filter((token) => factTokens.has(token)).length;
      const headingTokens = new Set(
        tokenise(sectionHeadings.get(fact.sourceSectionId) ?? ""),
      );
      const headingOverlap = [...query].filter((token) => headingTokens.has(token)).length;
      const score = overlap + headingOverlap * 1.25 + fact.importanceScore * 0.35;
      return { fact, overlap: overlap + headingOverlap, score };
    })
    .filter((item) => item.overlap > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);

  if (ranked.length === 0) {
    return {
      text: "I could not find enough verified document evidence to answer that confidently.",
      confidence: 0.2,
      evidence: [],
    };
  }

  const evidence = ranked.map((item) => item.fact.evidence[0]?.text ?? item.fact.content);
  return {
    text: ranked.length === 1
      ? ranked[0].fact.content
      : ["Based on the verified document evidence:", ...ranked.map((item) => `- ${item.fact.content}`)].join("\n"),
    confidence: Math.min(0.94, 0.68 + ranked.length * 0.08),
    evidence,
  };
}

export function buildGroundedPromptSource(
  grounding: GroundedKnowledge,
  maxCharacters = 28_000,
): string {
  const covered = grounding.sections.filter(
    (section) => section.status === "covered",
  );
  if (covered.length === 0) return "";

  const factsById = new Map(
    grounding.facts
      .filter((fact) => fact.verificationStatus === "supported")
      .map((fact) => [fact.id, fact]),
  );
  const headingOverhead = covered.reduce(
    (total, section) => total + cleanHeading(section.heading).length + 5,
    0,
  );
  const perSectionBudget = Math.max(
    24,
    Math.floor((maxCharacters - headingOverhead) / covered.length),
  );

  const source = covered
    .map((section) => {
      const evidence = section.factIds
        .map((id) => factsById.get(id))
        .filter((fact): fact is AtomicFact => Boolean(fact))
        .map((fact) => fact.evidence[0]?.text ?? fact.content)
        .join(" ");
      return `[${cleanHeading(section.heading)}]\n${shorten(evidence, perSectionBudget)}`;
    })
    .join("\n\n");

  if (source.length <= maxCharacters) return source;

  // Keep every section represented when a large document exceeds the normal
  // prompt budget, reducing each evidence sample instead of dropping the end.
  const blockBudget = Math.max(
    12,
    Math.floor((maxCharacters - covered.length * 2) / covered.length),
  );
  const compactHeadingBudget = Math.max(4, Math.floor(blockBudget * 0.4));
  const compactEvidenceBudget = Math.max(
    4,
    blockBudget - compactHeadingBudget - 3,
  );

  return covered
    .map((section) => {
      const evidence = section.factIds
        .map((id) => factsById.get(id))
        .filter((fact): fact is AtomicFact => Boolean(fact))
        .map((fact) => fact.evidence[0]?.text ?? fact.content)
        .join(" ");
      return `[${shorten(cleanHeading(section.heading), compactHeadingBudget)}]\n${shorten(evidence, compactEvidenceBudget)}`;
    })
    .join("\n\n");
}

function uniqueSupportedFacts(grounding: GroundedKnowledge): AtomicFact[] {
  const seen = new Set<string>();
  const unique = [...grounding.facts]
    .filter((fact) => fact.verificationStatus === "supported")
    .filter(isArtifactEligibleFact)
    .sort((left, right) => right.importanceScore - left.importanceScore)
    .filter((fact) => {
      const key = normalise(fact.content);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const firstPerSection: AtomicFact[] = [];
  const remaining: AtomicFact[] = [];
  const sections = new Set<string>();

  for (const fact of unique) {
    if (sections.has(fact.sourceSectionId)) {
      remaining.push(fact);
    } else {
      sections.add(fact.sourceSectionId);
      firstPerSection.push(fact);
    }
  }

  return [...firstPerSection, ...remaining];
}

function factsWithoutQualifiedDefinitions(
  grounding: GroundedKnowledge,
): AtomicFact[] {
  const qualifiedEvidence = new Set(
    grounding.keyTerms.flatMap((term) =>
      term.evidence.map((evidence) => normalise(evidence.text)),
    ),
  );

  return uniqueSupportedFacts(grounding).filter(
    (fact) => !qualifiedEvidence.has(
      normalise(fact.evidence[0]?.text ?? fact.content),
    ),
  );
}

function isArtifactEligibleFact(fact: AtomicFact): boolean {
  return !/^(?:project name|team members|course:\s*|date$|use case name|brief description|actor involved|system purpose|purpose of the system|problem summary|stakeholders|system scope)/i.test(
    fact.content.trim(),
  );
}

function isTrueFalseSuitable(value: string): boolean {
  const text = value.trim();
  return text.length >= 28 &&
    text.length <= 220 &&
    /\b(?:is|are|was|were|must|should|can|cannot|does|do|has|have|uses?|includes?|contains?|ensures?|allows?|requires?|reflects?|represents?|shows?|confirms?)\b/i.test(text);
}

function questionForFact(fact: AtomicFact, heading: string): string {
  if (fact.type === "number" || fact.type === "result") {
    return `What numerical result or value is reported in "${heading}"?`;
  }
  if (["warning", "common_mistake", "limitation"].includes(fact.type)) {
    return `What warning or limitation should be remembered from "${heading}"?`;
  }
  if (fact.type === "procedure_step") {
    return `What step is required in "${heading}"?`;
  }
  return `What is an important point from "${heading}"?`;
}

function difficultyForFact(fact: AtomicFact): FlashcardDifficulty {
  if (["number", "definition"].includes(fact.type)) return "easy";
  if (["limitation", "relationship", "result"].includes(fact.type)) return "hard";
  return "medium";
}

function evidenceExplanation(page?: number): string {
  return page
    ? `The answer is supported by verified evidence on page ${page}.`
    : "The answer is supported by verified document evidence.";
}

function deduplicateQuestions(
  questions: QuizQuestionInput[],
): QuizQuestionInput[] {
  const seen = new Set<string>();
  return questions.filter((question) => {
    const key = normalise(question.question);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function deduplicateCards(
  cards: GroundedFlashcardDraft[],
): GroundedFlashcardDraft[] {
  const seen = new Set<string>();
  return cards.filter((card) => {
    const key = normalise(card.front);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function tokenise(value: string): string[] {
  return (value.toLowerCase().match(/[\p{L}\p{N}-]{3,}/gu) ?? [])
    .filter((token) => !QUERY_STOP_WORDS.has(token));
}

function cleanHeading(value: string): string {
  return value
    .replace(/\s*\(\s*insert\s+(?:a\s+)?(?:class\s+)?(?:diagram|image|figure|chart)\s*\)\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function shorten(value: string, maxLength: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  const candidate = text.slice(0, Math.max(1, maxLength - 1));
  const boundary = candidate.lastIndexOf(" ");
  return `${candidate.slice(0, boundary >= maxLength * 0.65 ? boundary : candidate.length).trim()}…`;
}

function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}.%+-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
