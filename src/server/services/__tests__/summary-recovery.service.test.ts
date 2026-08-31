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
      "preserves supported recovery evidence without requiring raw source-layout topics",
      () => {
        const recovered =
          buildGroundedSummaryRecovery(
            grounding(),
            null,
            "Smart Window Detector",
            "comprehensive",
          );

        expect(recovered.summary).toMatch(/rain sensor/i);
        expect(recovered.summary).toMatch(/closes the window automatically/i);
        expect(recovered.summary).not.toMatch(/^###\s+Smart Door\b/gimu);
        expect(recovered.summary).toContain("5 volt");
        expect(recovered.summary).toContain("## Detailed Study Notes");
        expect(recovered.summary).toContain("## Key Points");
        expect(recovered.summary).toContain("## Key Concepts");
      },
    );

    it(
      "does not reintroduce title metadata or structural headings during v3 recovery",
      () => {
        const source = grounding();
        const author = fact(
          "meta-1",
          "title",
          "Martin Neil and Norman Fenton (Agena Ltd and Queen Mary, University of London).",
          0.99,
        );
        const finding = fact(
          "result-1",
          "abstract",
          "We have found 95% correlation between actual and predicted defects.",
          0.99,
        );
        const causal = fact(
          "cause-1",
          "intro",
          "Causal models allow conflicting evidence to be taken into account when predicting software defects.",
          0.95,
        );
        const method = fact(
          "method-1",
          "build",
          "The defect model was built using a mixture of project data and expert judgements.",
          0.96,
        );

        source.facts = [author, finding, causal, method];
        source.sections = [
          {
            sectionId: "title",
            heading: "Improved Software Defect Prediction",
            status: "covered",
            factIds: [author.id],
            sourceUnitCount: 1,
            omittedUnitCount: 0,
          },
          {
            sectionId: "abstract",
            heading: "Abstract",
            status: "covered",
            factIds: [finding.id],
            sourceUnitCount: 1,
            omittedUnitCount: 0,
          },
          {
            sectionId: "intro",
            heading: "1. INTRODUCTION",
            status: "covered",
            factIds: [causal.id],
            sourceUnitCount: 1,
            omittedUnitCount: 0,
          },
          {
            sectionId: "build",
            heading: "2.2 Building the BN Model",
            status: "covered",
            factIds: [method.id],
            sourceUnitCount: 1,
            omittedUnitCount: 0,
          },
        ];
        source.concepts = [];
        source.keyTerms = [];

        const recovered = buildGroundedSummaryRecovery(
          source,
          null,
          "Improved Software Defect Prediction",
          "comprehensive",
        );

        expect(recovered.summary).not.toMatch(/^###\s+Abstract$/gmu);
        expect(recovered.summary).not.toMatch(/^###\s+1\.\s*INTRODUCTION$/gmu);
        expect(recovered.summary).not.toMatch(/^###\s+Improved Software Defect Prediction$/gmu);
        expect(recovered.summary).not.toContain("Martin Neil and Norman Fenton");
        expect(recovered.summary).toMatch(/Results and Findings|95% correlation/i);
        expect(recovered.summary).toMatch(/Building the BN Model|Method and Approach/i);
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
