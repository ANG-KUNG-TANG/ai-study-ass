import type {
  AtomicFact,
  GroundedKnowledge,
} from "@/server/intelligence/grounding";
import type {
  ReliableDocumentProfile,
} from "@/server/intelligence/reliability/types";
import {
  NOTE_RULES,
} from "@/server/entities/note.entity";
import {
  getStudyNotesVersionMarker,
  type GroundedStudyNotesResult,
} from "@/server/services/summary/grounded-study-notes.service";
import type {
  SummaryMode,
} from "@/types/summary";

interface RecoveryPolicy {
  keyPointLimit: number;
  conceptLimit: number;
}

const RECOVERY_POLICIES: Record<
  SummaryMode,
  RecoveryPolicy
> = {
  concise: {
    keyPointLimit: 6,
    conceptLimit: 8,
  },
  comprehensive: {
    keyPointLimit: 12,
    conceptLimit: 16,
  },
  exam: {
    keyPointLimit: 10,
    conceptLimit: 12,
  },
};

const RESERVED_TAIL_CHARS = 800;

export function buildGroundedSummaryRecovery(
  grounding: GroundedKnowledge,
  profile: ReliableDocumentProfile | null,
  fallbackTitle: string,
  mode: SummaryMode,
): GroundedStudyNotesResult {
  const policy =
    RECOVERY_POLICIES[mode];

  const supportedFacts =
    uniqueFacts(
      grounding.facts.filter(
        (fact) =>
          fact.verificationStatus ===
          "supported" &&
          fact.content.trim().length > 0,
      ),
    );

  const rankedFacts =
    [...supportedFacts].sort(
      (left, right) =>
        right.importanceScore -
          left.importanceScore ||
        right.confidence -
          left.confidence,
    );

  const keyPoints =
    rankedFacts
      .slice(
        0,
        policy.keyPointLimit,
      )
      .map(
        (fact) => fact.content.trim(),
      );

  const importantConcepts =
    grounding.concepts
      .filter(
        (concept) =>
          concept.name.trim().length >
            0 &&
          concept.evidence.length > 0,
      )
      .slice(
        0,
        policy.conceptLimit,
      )
      .map(
        (concept) =>
          concept.name.trim(),
      );

  const title =
    cleanHeading(
      profile?.title.value ??
        fallbackTitle,
    ) || "Study Notes";

  const overviewFacts =
    rankedFacts.slice(0, 2);

  const blocks: string[] = [
    `# ${title}`,
    getStudyNotesVersionMarker(
      mode,
    ),
    "## Overview",
    overviewFacts.length > 0
      ? overviewFacts
          .map(
            (fact) =>
              fact.content.trim(),
          )
          .join(" ")
      : "These notes contain only verified information extracted from the uploaded document.",
  ];

  if (keyPoints.length > 0) {
    blocks.push(
      "## Key Points",
      keyPoints
        .map(
          (point) => `- ${point}`,
        )
        .join("\n"),
    );
  }

  if (
    importantConcepts.length > 0
  ) {
    blocks.push(
      "## Main Concepts",
      importantConcepts
        .map(
          (concept) =>
            `- ${concept}`,
        )
        .join("\n"),
    );
  }

  const factsById =
    new Map(
      supportedFacts.map(
        (fact) => [
          fact.id,
          fact,
        ],
      ),
    );

  const sectionBlocks =
    buildSectionBlocks(
      grounding,
      factsById,
      blocks.join("\n\n")
        .length,
    );

  if (sectionBlocks.length > 0) {
    blocks.push(
      "## Section Notes",
      ...sectionBlocks,
    );
  }

  const summary =
    blocks
      .filter(Boolean)
      .join("\n\n")
      .trim();

  if (
    summary.length >
    NOTE_RULES.SUMMARY_MAX
  ) {
    return buildCompactRecovery({
      grounding,
      profile,
      fallbackTitle,
      mode,
      rankedFacts,
      keyPoints,
      importantConcepts,
    });
  }

  return {
    summary,
    keyPoints,
    importantConcepts,
    confidence:
      Math.min(
        grounding.quality.score,
        0.84,
      ),
    status: "partial",
    profile,
  };
}

function buildSectionBlocks(
  grounding: GroundedKnowledge,
  factsById: Map<
    string,
    AtomicFact
  >,
  currentLength: number,
): string[] {
  const output: string[] = [];
  let used = currentLength;

  for (
    const section of
    grounding.sections
  ) {
    if (
      section.status !==
        "covered" &&
      section.status !==
        "no_extractable_knowledge"
    ) {
      continue;
    }

    const heading =
      `### ${cleanHeading(
        section.heading,
      ) || "Source section"}`;

    const fact =
      section.factIds
        .map(
          (id) =>
            factsById.get(id),
        )
        .find(Boolean);

    const block = fact
      ? `${heading}\n- ${fact.content.trim()}`
      : heading;

    if (
      used +
        block.length +
        RESERVED_TAIL_CHARS >
      NOTE_RULES.SUMMARY_MAX
    ) {
      // A heading alone is still useful for
      // source-coverage visibility and costs
      // much less space than another fact.
      if (
        used +
          heading.length +
          RESERVED_TAIL_CHARS <=
        NOTE_RULES.SUMMARY_MAX
      ) {
        output.push(heading);
        used +=
          heading.length + 2;
      }

      continue;
    }

    output.push(block);
    used += block.length + 2;
  }

  return output;
}

function buildCompactRecovery(
  input: {
    grounding:
      GroundedKnowledge;
    profile:
      ReliableDocumentProfile | null;
    fallbackTitle: string;
    mode: SummaryMode;
    rankedFacts: AtomicFact[];
    keyPoints: string[];
    importantConcepts: string[];
  },
): GroundedStudyNotesResult {
  const title =
    cleanHeading(
      input.profile?.title.value ??
        input.fallbackTitle,
    ) || "Study Notes";

  const blocks = [
    `# ${title}`,
    getStudyNotesVersionMarker(
      input.mode,
    ),
    "## Overview",
    input.rankedFacts[0]
      ?.content.trim() ??
      "These notes contain only verified information extracted from the uploaded document.",
    input.keyPoints.length > 0
      ? "## Key Points"
      : "",
    input.keyPoints.length > 0
      ? input.keyPoints
          .map(
            (point) => `- ${point}`,
          )
          .join("\n")
      : "",
    input.importantConcepts
        .length > 0
      ? "## Main Concepts"
      : "",
    input.importantConcepts
        .length > 0
      ? input.importantConcepts
          .map(
            (concept) =>
              `- ${concept}`,
          )
          .join("\n")
      : "",
  ].filter(Boolean);

  let summary =
    blocks.join("\n\n");

  if (
    summary.length >
    NOTE_RULES.SUMMARY_MAX
  ) {
    const safeLimit =
      NOTE_RULES.SUMMARY_MAX -
      32;

    summary =
      summary
        .slice(0, safeLimit)
        .trimEnd();
  }

  return {
    summary,
    keyPoints:
      input.keyPoints,
    importantConcepts:
      input.importantConcepts,
    confidence:
      Math.min(
        input.grounding.quality.score,
        0.8,
      ),
    status: "partial",
    profile: input.profile,
  };
}

function uniqueFacts(
  facts: AtomicFact[],
): AtomicFact[] {
  const seen =
    new Set<string>();
  const output:
    AtomicFact[] = [];

  for (const fact of facts) {
    const key =
      normalise(
        fact.content,
      );

    if (
      !key ||
      seen.has(key)
    ) {
      continue;
    }

    seen.add(key);
    output.push(fact);
  }

  return output;
}

function cleanHeading(
  value: string,
): string {
  return value
    .normalize("NFKC")
    .replace(/^#+\s*/u, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function normalise(
  value: string,
): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\s+/gu, " ")
    .trim();
}
