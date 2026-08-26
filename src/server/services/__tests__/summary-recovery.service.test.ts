import {
  GROUNDING_SCHEMA_VERSION,
  type AtomicFact,
  type GroundedKnowledge,
} from "@/server/intelligence/grounding";
import {
  NOTE_RULES,
} from "@/server/entities/note.entity";
import {
  assessSummaryQuality,
} from "@/server/services/summary/summary-quality.service";
import {
  buildGroundedSummaryRecovery,
} from "@/server/services/summary/summary-recovery.service";

function fact(
  id: string,
  sectionId: string,
  content: string,
  importance = 0.9,
): AtomicFact {
  return {
    id,
    type: "claim",
    content,
    verbatimRequired: false,
    sourceSectionId:
      sectionId,
    evidence: [{
      id: `e-${id}`,
      sectionId,
      sectionTitle:
        sectionId,
      pageNumber: 1,
      text: content,
    }],
    evidenceType: "stated",
    verificationStatus:
      "supported",
    confidence: 0.96,
    importanceScore:
      importance,
    numericTokens: [],
  };
}

function grounding():
  GroundedKnowledge {
  const facts = [
    fact(
      "f1",
      "s1",
      "The smart window detector uses a rain sensor to detect water on the window surface.",
      0.99,
    ),
    fact(
      "f2",
      "s2",
      "The system closes the window automatically when rain is detected.",
      0.95,
    ),
    fact(
      "f3",
      "s3",
      "The smart door can be controlled as part of the IoT automation workflow.",
      0.9,
    ),
    fact(
      "f4",
      "s4",
      "The prototype operates from a 5 volt control supply.",
      0.88,
    ),
  ];

  return {
    schemaVersion:
      GROUNDING_SCHEMA_VERSION,
    pipelineVersion:
      "intelligence-v2.4",
    sourceHash: "source",
    documentKind:
      "lecture_notes",
    sourceLanguage: "en",
    facts,
    keyTerms: [],
    concepts: [
      {
        name: "Rain Sensor",
        normalizedName:
          "rain sensor",
        explanation:
          "A sensor used to detect rain.",
        sourceSectionIds:
          ["s1"],
        evidence:
          facts[0]!.evidence,
        importanceScore: 0.95,
      },
      {
        name:
          "Automatic Window Control",
        normalizedName:
          "automatic window control",
        explanation:
          "Window automation triggered by detected rain.",
        sourceSectionIds:
          ["s2"],
        evidence:
          facts[1]!.evidence,
        importanceScore: 0.9,
      },
    ],
    sections: [
      {
        sectionId: "s1",
        heading: "Rain Detection",
        status: "covered",
        factIds: ["f1"],
        sourceUnitCount: 1,
        omittedUnitCount: 0,
      },
      {
        sectionId: "s2",
        heading:
          "Window Automation",
        status: "covered",
        factIds: ["f2"],
        sourceUnitCount: 1,
        omittedUnitCount: 0,
      },
      {
        sectionId: "s3",
        heading: "Smart Door",
        status: "covered",
        factIds: ["f3"],
        sourceUnitCount: 1,
        omittedUnitCount: 0,
      },
      {
        sectionId: "s4",
        heading:
          "Power Requirement",
        status: "covered",
        factIds: ["f4"],
        sourceUnitCount: 1,
        omittedUnitCount: 0,
      },
    ],
    quality: {
      score: 0.92,
      scoreOutOf10: 9.2,
      passed: true,
      supportedFactRatio: 1,
      sectionCoverageRatio: 1,
      numericExactnessRatio: 1,
      qualifiedTermPrecision: 1,
      duplicateFactRatio: 0,
      artifactCount:
        facts.length,
      warnings: [],
    },
    createdAt:
      new Date(
        "2026-08-27T00:00:00.000Z",
      ),
  };
}

describe(
  "grounded summary recovery",
  () => {
    it(
      "builds a faithful source-extractive recovery summary",
      () => {
        const source =
          grounding();
        const recovered =
          buildGroundedSummaryRecovery(
            source,
            null,
            "Smart Window Detector",
            "comprehensive",
          );

        const quality =
          assessSummaryQuality({
            artifact: {
              summary:
                recovered.summary,
              keyPoints:
                recovered.keyPoints,
              importantConcepts:
                recovered.importantConcepts,
            },
            grounding: source,
            mode: "comprehensive",
          });

        expect(
          quality.faithful,
        ).toBe(true);
        expect(
          quality.metrics
            .unsupportedNumericUnitCount,
        ).toBe(0);
        expect(
          recovered.summary,
        ).toContain(
          "5 volt",
        );
      },
    );

    it(
      "covers every supported source section in comprehensive recovery",
      () => {
        const recovered =
          buildGroundedSummaryRecovery(
            grounding(),
            null,
            "Smart Window Detector",
            "comprehensive",
          );

        expect(
          recovered.summary,
        ).toContain(
          "### Rain Detection",
        );
        expect(
          recovered.summary,
        ).toContain(
          "### Window Automation",
        );
        expect(
          recovered.summary,
        ).toContain(
          "### Smart Door",
        );
        expect(
          recovered.summary,
        ).toContain(
          "### Power Requirement",
        );
      },
    );

    it(
      "never exceeds the summary storage limit",
      () => {
        const source =
          grounding();

        for (
          let index = 5;
          index <= 220;
          index += 1
        ) {
          const sectionId =
            `s${index}`;
          const id =
            `f${index}`;
          const content =
            `Supported section ${index} contains verified document information about the smart automation prototype and its implementation details.`;

          source.facts.push(
            fact(
              id,
              sectionId,
              content,
              0.5,
            ),
          );
          source.sections.push({
            sectionId,
            heading:
              `Section ${index}`,
            status: "covered",
            factIds: [id],
            sourceUnitCount: 1,
            omittedUnitCount: 0,
          });
        }

        const recovered =
          buildGroundedSummaryRecovery(
            source,
            null,
            "Large Document",
            "comprehensive",
          );

        expect(
          recovered.summary.length,
        ).toBeLessThanOrEqual(
          NOTE_RULES.SUMMARY_MAX,
        );
      },
    );
  },
);
