import {
  GROUNDING_SCHEMA_VERSION,
  type AtomicFact,
  type GroundedKnowledge,
  type QualifiedTerm,
} from "@/server/intelligence/grounding";
import {
  validateGroundedFlashcards,
  type FlashcardQualityDraft,
} from "@/server/services/flashcard/flashcard-quality.service";

function fact(input: {
  id: string;
  sectionId: string;
  content: string;
  importance?: number;
  type?: AtomicFact["type"];
}): AtomicFact {
  return {
    id: input.id,
    type: input.type ?? "claim",
    content: input.content,
    verbatimRequired: false,
    sourceSectionId: input.sectionId,
    evidence: [{
      id: `e-${input.id}`,
      sectionId: input.sectionId,
      sectionTitle: input.sectionId,
      pageNumber: 1,
      text: input.content,
    }],
    evidenceType: "stated",
    verificationStatus: "supported",
    confidence: 0.95,
    importanceScore: input.importance ?? 0.85,
    numericTokens: [],
  };
}

function term(
  name: string,
  definition: string,
  sectionId = "s1",
): QualifiedTerm {
  return {
    term: name,
    definition,
    sourceSectionId: sectionId,
    evidence: [{
      id: `term-${name}`,
      sectionId,
      sectionTitle: sectionId,
      pageNumber: 1,
      text: `${name}: ${definition}`,
    }],
    qualification: "explicit_definition",
    confidence: 0.96,
  };
}

function grounding(): GroundedKnowledge {
  const facts = [
    fact({
      id: "f1",
      sectionId: "s1",
      content:
        "Spanning Tree Protocol prevents Layer 2 switching loops in redundant Ethernet topologies.",
      type: "definition",
      importance: 0.99,
    }),
    fact({
      id: "f2",
      sectionId: "s1",
      content:
        "The root bridge is selected using the lowest bridge identifier.",
      type: "rule",
      importance: 0.95,
    }),
    fact({
      id: "f3",
      sectionId: "s2",
      content:
        "PortFast should be enabled only on access ports connected to end devices.",
      type: "warning",
      importance: 0.90,
    }),
    fact({
      id: "f4",
      sectionId: "s3",
      content:
        "The default STP bridge priority is 32768.",
      type: "number",
      importance: 0.86,
    }),
    fact({
      id: "f5",
      sectionId: "s4",
      content: "Project Name",
      importance: 0.10,
    }),
  ];

  return {
    schemaVersion: GROUNDING_SCHEMA_VERSION,
    pipelineVersion: "intelligence-v2.4",
    sourceHash: "source-hash",
    documentKind: "lecture_notes",
    sourceLanguage: "en",
    facts,
    keyTerms: [
      term(
        "Root Bridge",
        "the switch selected using the lowest bridge identifier",
      ),
      term(
        "PortFast",
        "an edge-port feature that moves an access port quickly to forwarding",
        "s2",
      ),
    ],
    concepts: [{
      name: "Spanning Tree Protocol",
      normalizedName: "spanning tree protocol",
      explanation:
        "A protocol that prevents Layer 2 switching loops.",
      sourceSectionIds: ["s1"],
      evidence: facts[0]!.evidence,
      importanceScore: 0.99,
    }],
    sections: [
      {
        sectionId: "s1",
        heading: "STP Fundamentals",
        status: "covered",
        factIds: ["f1", "f2"],
        sourceUnitCount: 2,
        omittedUnitCount: 0,
      },
      {
        sectionId: "s2",
        heading: "Edge Port Protection",
        status: "covered",
        factIds: ["f3"],
        sourceUnitCount: 1,
        omittedUnitCount: 0,
      },
      {
        sectionId: "s3",
        heading: "Bridge Priority",
        status: "covered",
        factIds: ["f4"],
        sourceUnitCount: 1,
        omittedUnitCount: 0,
      },
      {
        sectionId: "s4",
        heading: "Cover Page",
        status: "covered",
        factIds: ["f5"],
        sourceUnitCount: 1,
        omittedUnitCount: 0,
      },
    ],
    quality: {
      score: 0.95,
      scoreOutOf10: 9.5,
      passed: true,
      supportedFactRatio: 1,
      sectionCoverageRatio: 1,
      numericExactnessRatio: 1,
      qualifiedTermPrecision: 1,
      duplicateFactRatio: 0,
      artifactCount: facts.length,
      warnings: [],
    },
    createdAt: new Date("2026-08-27T00:00:00.000Z"),
  };
}

function card(
  input: Partial<FlashcardQualityDraft> &
    Pick<FlashcardQualityDraft, "front" | "back">,
): FlashcardQualityDraft {
  return {
    difficulty: "medium",
    ...input,
  };
}

describe("flashcard grounded quality validation", () => {
  it("accepts a qualified-term definition card", () => {
    const result = validateGroundedFlashcards([
      card({
        front: 'What does "Root Bridge" mean?',
        back:
          "the switch selected using the lowest bridge identifier",
        difficulty: "easy",
      }),
    ], grounding());

    expect(result.rejected).toHaveLength(0);
    expect(result.accepted).toHaveLength(1);
  });

  it("accepts a section-scoped grounded fact card", () => {
    const result = validateGroundedFlashcards([
      card({
        front:
          'What warning or limitation should be remembered from "Edge Port Protection"?',
        back:
          "PortFast should be enabled only on access ports connected to end devices.",
      }),
    ], grounding());

    expect(result.rejected).toHaveLength(0);
  });

  it("rejects a hallucinated answer", () => {
    const result = validateGroundedFlashcards([
      card({
        front: "Which encryption algorithm does STP require?",
        back: "AES-512",
      }),
    ], grounding());

    expect(result.rejected[0]?.issueCodes).toContain(
      "BACK_NOT_GROUNDED",
    );
  });

  it("rejects a card whose front reveals its short answer", () => {
    const result = validateGroundedFlashcards([
      card({
        front:
          "Is the default STP bridge priority 32768?",
        back: "32768",
      }),
    ], grounding());

    expect(result.rejected[0]?.issueCodes).toContain(
      "ANSWER_LEAKAGE",
    );
  });

  it("rejects list-style multi-idea backs", () => {
    const source = grounding();
    source.facts.push(
      fact({
        id: "f-multi",
        sectionId: "s1",
        content:
          "STP prevents loops, selects a root bridge, and calculates path costs.",
        importance: 0.9,
      }),
    );

    const result = validateGroundedFlashcards([
      card({
        front: "What are three STP responsibilities?",
        back:
          "- Prevent loops\n- Select a root bridge\n- Calculate path costs",
      }),
    ], source);

    expect(result.rejected[0]?.issueCodes).toContain(
      "MULTIPLE_IDEAS",
    );
  });

  it("rejects low-value metadata cards", () => {
    const result = validateGroundedFlashcards([
      card({
        front: "What is the project name?",
        back: "Project Name",
      }),
    ], grounding());

    expect(result.rejected[0]?.issueCodes).toContain(
      "LOW_STUDY_VALUE",
    );
  });

  it("rejects semantic duplicates even when wording changes", () => {
    const result = validateGroundedFlashcards([
      card({
        front:
          'What numerical result or value is reported in "Bridge Priority"?',
        back: "The default STP bridge priority is 32768.",
      }),
      card({
        front:
          'Which value is reported for bridge priority in "Bridge Priority"?',
        back: "The default STP bridge priority is 32768.",
      }),
    ], grounding());

    expect(result.accepted).toHaveLength(1);
    expect(result.rejected[0]?.issueCodes).toContain(
      "NEAR_DUPLICATE",
    );
  });

  it("rejects a section question answered from a different section", () => {
    const result = validateGroundedFlashcards([
      card({
        front:
          'What is an important point from "Edge Port Protection"?',
        back:
          "The root bridge is selected using the lowest bridge identifier.",
      }),
    ], grounding());

    expect(result.rejected[0]?.issueCodes).toContain(
      "FRONT_NOT_ANSWERABLE",
    );
  });

  it("accepts a generic deterministic card when its back is grounded", () => {
    const source = grounding();
    source.facts.push(
      fact({
        id: "f-problem",
        sectionId: "s1",
        content:
          "The document addresses Layer 2 switching loops in redundant Ethernet topologies.",
        type: "objective",
        importance: 0.9,
      }),
    );

    const result = validateGroundedFlashcards([
      card({
        front: "What problem does the document address?",
        back:
          "The document addresses Layer 2 switching loops in redundant Ethernet topologies.",
        difficulty: "hard",
      }),
    ], source);

    expect(result.rejected).toHaveLength(0);
  });

  it("supports Unicode grounded cards", () => {
    const source = grounding();
    source.sourceLanguage = "th";
    source.facts = [
      fact({
        id: "thai",
        sectionId: "thai-section",
        content:
          "โปรโตคอล STP ช่วยป้องกันลูปในเครือข่ายสวิตช์เลเยอร์ 2",
        type: "definition",
        importance: 0.95,
      }),
    ];
    source.sections = [{
      sectionId: "thai-section",
      heading: "STP",
      status: "covered",
      factIds: ["thai"],
      sourceUnitCount: 1,
      omittedUnitCount: 0,
    }];
    source.keyTerms = [];
    source.concepts = [];

    const result = validateGroundedFlashcards([
      card({
        front: "STP ช่วยป้องกันอะไรในเครือข่าย?",
        back:
          "โปรโตคอล STP ช่วยป้องกันลูปในเครือข่ายสวิตช์เลเยอร์ 2",
      }),
    ], source);

    expect(result.rejected).toHaveLength(0);
  });
});
