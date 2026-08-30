import type {
  GroundedKnowledge,
} from "@/server/intelligence/grounding";
import type {
  FlashcardDifficulty,
} from "@/server/entities/flashcard.entity";
import {
  retrieveGroundedEvidence,
  type GroundedEvidenceResult,
} from "@/server/services/evidence-retriever.service";
import {
  toLearningGrounding,
} from "@/server/services/quality/learning-evidence.service";

export interface FlashcardSufficiencyDraft {
  front: string;
  back: string;
  difficulty: FlashcardDifficulty;
}

export interface FlashcardSufficiencyPlan {
  targetCount: number;
  minimumAcceptableCount: number;
  acceptedCount: number;
  targetShortfall: number;
  requestedAIAdditions: number;
  needsAI: boolean;
}

const MINIMUM_READY_CARDS = 4;
const READY_RATIO = 0.7;
const MAX_REPAIR_EVIDENCE_CHARACTERS = 5_000;
const MAX_REPAIR_FACTS = 12;

const LOW_VALUE_FACT_PATTERN =
  /^(?:project name|team members?|course:\s*|date$|student name|student id|page number|use case name|brief description|actor involved|system purpose|purpose of the system|problem summary|stakeholders|system scope)\b/i;

export function minimumAcceptableFlashcardCount(
  targetCount: number,
): number {
  const target = Math.max(
    1,
    Math.floor(targetCount),
  );

  return Math.min(
    target,
    Math.max(
      MINIMUM_READY_CARDS,
      Math.ceil(
        target * READY_RATIO,
      ),
    ),
  );
}

export function buildFlashcardSufficiencyPlan(
  input: {
    targetCount: number;
    acceptedCount: number;
    qualityValidated: boolean;
    qualityRepairNeeded?: boolean;
  },
): FlashcardSufficiencyPlan {
  const targetCount = Math.max(
    1,
    Math.floor(
      input.targetCount,
    ),
  );
  const acceptedCount = Math.max(
    0,
    Math.floor(
      input.acceptedCount,
    ),
  );
  const minimumAcceptableCount =
    minimumAcceptableFlashcardCount(
      targetCount,
    );

  const desiredFinalCount =
    input.qualityValidated
      ? minimumAcceptableCount
      : targetCount;
  const countRepairAdditions =
    Math.max(
      0,
      desiredFinalCount -
        acceptedCount,
    );
  const qualityRepairAdditions =
    input.qualityRepairNeeded
      ? Math.min(
          5,
          Math.max(
            2,
            Math.ceil(targetCount * 0.25),
          ),
        )
      : 0;
  const requestedAIAdditions =
    Math.max(
      countRepairAdditions,
      qualityRepairAdditions,
    );

  return {
    targetCount,
    minimumAcceptableCount,
    acceptedCount,
    targetShortfall:
      Math.max(
        0,
        targetCount -
          acceptedCount,
      ),
    requestedAIAdditions,
    needsAI:
      requestedAIAdditions > 0,
  };
}

export function retrieveFlashcardRepairEvidence(
  grounding: GroundedKnowledge,
  acceptedCards:
    readonly FlashcardSufficiencyDraft[],
  requestedAdditions: number,
): GroundedEvidenceResult {
  const learningGrounding =
    toLearningGrounding(grounding);
  const supportedFacts =
    learningGrounding.facts
      .filter(
        (fact) =>
          fact.verificationStatus ===
            "supported" &&
          fact.content.trim().length >
            0 &&
          !LOW_VALUE_FACT_PATTERN.test(
            fact.content.trim(),
          ),
      )
      .sort(
        (left, right) =>
          right.importanceScore -
            left.importanceScore ||
          right.confidence -
            left.confidence,
      );

  const unrepresentedFacts =
    supportedFacts.filter(
      (fact) =>
        !acceptedCards.some(
          (card) =>
            sourceRepresentsBack(
              fact.content,
              card.back,
            ) ||
            fact.evidence.some(
              (evidence) =>
                sourceRepresentsBack(
                  evidence.text,
                  card.back,
                ),
            ),
        ),
    );

  const desiredFactLimit =
    Math.min(
      MAX_REPAIR_FACTS,
      Math.max(
        4,
        requestedAdditions * 3,
      ),
    );

  const selectedFacts =
    (
      unrepresentedFacts.length >
      0
        ? unrepresentedFacts
        : supportedFacts
    ).slice(
      0,
      desiredFactLimit,
    );

  const deckText =
    acceptedCards
      .map(
        (card) =>
          `${card.front} ${card.back}`,
      )
      .join(" ");

  const conceptNames =
    learningGrounding.concepts
      .filter(
        (concept) =>
          concept.evidence.length >
            0 &&
          !textRepresents(
            deckText,
            concept.name,
          ),
      )
      .sort(
        (left, right) =>
          right.importanceScore -
          left.importanceScore,
      )
      .slice(
        0,
        Math.max(
          2,
          Math.min(
            6,
            requestedAdditions * 2,
          ),
        ),
      )
      .map(
        (concept) =>
          concept.name,
      );

  const factIds =
    selectedFacts.map(
      (fact) => fact.id,
    );
  const sectionIds =
    [
      ...new Set(
        selectedFacts.map(
          (fact) =>
            fact.sourceSectionId,
        ),
      ),
    ];

  const maxCharacters =
    Math.min(
      MAX_REPAIR_EVIDENCE_CHARACTERS,
      Math.max(
        2_400,
        1_800 +
          requestedAdditions *
            700,
      ),
    );

  return retrieveGroundedEvidence(
    learningGrounding,
    {
      factIds,
      sectionIds,
      conceptNames,
      maxCharacters,
      maxFacts:
        Math.max(
          1,
          selectedFacts.length,
        ),
    },
  );
}

function sourceRepresentsBack(
  source: string,
  back: string,
): boolean {
  const normalisedSource =
    normalise(source);
  const normalisedBack =
    normalise(
      back.replace(/…$/u, ""),
    );

  if (
    !normalisedSource ||
    !normalisedBack
  ) {
    return false;
  }

  if (
    normalisedSource.includes(
      normalisedBack,
    ) ||
    normalisedBack.includes(
      normalisedSource,
    )
  ) {
    return true;
  }

  const backTokens =
    meaningfulTokens(
      normalisedBack,
    );

  if (
    backTokens.size === 0
  ) {
    return false;
  }

  const sourceTokens =
    meaningfulTokens(
      normalisedSource,
    );
  let matches = 0;

  for (
    const token of backTokens
  ) {
    if (
      sourceTokens.has(token)
    ) {
      matches += 1;
    }
  }

  return (
    matches /
      backTokens.size >=
    0.82
  );
}

function textRepresents(
  source: string,
  value: string,
): boolean {
  const left =
    normalise(source);
  const right =
    normalise(value);

  return Boolean(
    left &&
      right &&
      (
        left.includes(right) ||
        right.includes(left)
      ),
  );
}

function meaningfulTokens(
  value: string,
): Set<string> {
  return new Set(
    (
      value.match(
        /[\p{L}\p{N}][\p{L}\p{N}\p{M}_-]{1,}/gu,
      ) ?? []
    ).filter(
      (token) =>
        token.length >= 2,
    ),
  );
}

function normalise(
  value: string,
): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(
      /[^\p{L}\p{N}\p{M}%+\-., ]+/gu,
      " ",
    )
    .replace(/\s+/gu, " ")
    .trim();
}
