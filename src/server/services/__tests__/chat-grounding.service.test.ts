import {
  GROUNDING_SCHEMA_VERSION,
  type AtomicFact,
  type GroundedKnowledge,
  type QualifiedTerm,
} from "@/server/intelligence/grounding";
import {
  buildGroundedChatFallback,
  classifyGroundedQuestion,
  validateGroundedChatResponse,
} from "@/server/services/chat/chat-grounding.service";

function fact(input: {
  id: string;
  content: string;
  sectionId?: string;
  type?: AtomicFact["type"];
  importance?: number;
}): AtomicFact {
  const sectionId =
    input.sectionId ?? "s1";

  return {
    id: input.id,
    type:
      input.type ?? "claim",
    content: input.content,
    verbatimRequired: false,
    sourceSectionId:
      sectionId,
    evidence: [{
      id: `e-${input.id}`,
      sectionId,
      sectionTitle:
        sectionId,
      pageNumber: 1,
      text: input.content,
    }],
    evidenceType: "stated",
    verificationStatus:
      "supported",
    confidence: 0.96,
    importanceScore:
      input.importance ?? 0.9,
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
    sourceSectionId:
      sectionId,
    evidence: [{
      id: `term-${name}`,
      sectionId,
      sectionTitle:
        sectionId,
      pageNumber: 1,
      text:
        `${name}: ${definition}`,
    }],
    qualification:
      "explicit_definition",
    confidence: 0.96,
  };
}

function grounding():
  GroundedKnowledge {
  const facts = [
    fact({
      id: "f1",
      content:
        "Spanning Tree Protocol prevents Layer 2 switching loops in redundant Ethernet topologies.",
      type: "relationship",
      importance: 0.99,
    }),
    fact({
      id: "f2",
      content:
        "The root bridge is selected using the lowest bridge identifier.",
      type: "rule",
      importance: 0.95,
    }),
    fact({
      id: "f3",
      content:
        "PortFast should be enabled only on access ports connected to end devices.",
      sectionId: "s2",
      type: "warning",
      importance: 0.9,
    }),
    fact({
      id: "f4",
      content:
        "The default STP bridge priority is 32768.",
      sectionId: "s3",
      type: "number",
      importance: 0.88,
    }),
  ];

  return {
    schemaVersion:
      GROUNDING_SCHEMA_VERSION,
    pipelineVersion:
      "intelligence-v2.4",
    sourceHash:
      "source-hash",
    documentKind:
      "lecture_notes",
    sourceLanguage:
      "en",
    facts,
    keyTerms: [
      term(
        "STP",
        "Spanning Tree Protocol prevents Layer 2 switching loops.",
      ),
      term(
        "PortFast",
        "An edge-port feature intended for access ports connected to end devices.",
        "s2",
      ),
    ],
    concepts: [{
      name:
        "Spanning Tree Protocol",
      normalizedName:
        "spanning tree protocol",
      explanation:
        "A protocol that prevents Layer 2 switching loops.",
      sourceSectionIds:
        ["s1"],
      evidence:
        facts[0]!.evidence,
      importanceScore:
        0.99,
    }],
    sections: [
      {
        sectionId: "s1",
        heading:
          "STP Fundamentals",
        status: "covered",
        factIds:
          ["f1", "f2"],
        sourceUnitCount: 2,
        omittedUnitCount: 0,
      },
      {
        sectionId: "s2",
        heading:
          "Edge Port Protection",
        status: "covered",
        factIds: ["f3"],
        sourceUnitCount: 1,
        omittedUnitCount: 0,
      },
      {
        sectionId: "s3",
        heading:
          "Bridge Priority",
        status: "covered",
        factIds: ["f4"],
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
  "Chat grounded answerability",
  () => {
    it(
      "classifies a directly grounded definition as ANSWERABLE",
      () => {
        const decision =
          classifyGroundedQuestion(
            grounding(),
            "What is STP?",
          );

        expect(
          decision.answerability,
        ).toBe("ANSWERABLE");
        expect(
          decision.supportedPoints.join(" "),
        ).toMatch(
          /Spanning Tree Protocol|Layer 2 switching loops/i,
        );
      },
    );

    it(
      "classifies a grounded relationship question as ANSWERABLE",
      () => {
        const decision =
          classifyGroundedQuestion(
            grounding(),
            "How does STP prevent switching loops?",
          );

        expect(
          decision.answerability,
        ).toBe("ANSWERABLE");
        expect(
          decision.evidence.join(" "),
        ).toContain(
          "switching loops",
        );
      },
    );

    it(
      "classifies a mixed grounded and unsupported question as PARTIAL",
      () => {
        const decision =
          classifyGroundedQuestion(
            grounding(),
            "What is STP and which encryption algorithm does it use?",
          );

        expect(
          decision.answerability,
        ).toBe("PARTIAL");
        expect(
          decision.supportedPoints.length,
        ).toBeGreaterThan(0);
      },
    );

    it(
      "classifies an unrelated question as NOT_ANSWERABLE",
      () => {
        const decision =
          classifyGroundedQuestion(
            grounding(),
            "What is the capital city of France?",
          );

        expect(
          decision.answerability,
        ).toBe(
          "NOT_ANSWERABLE",
        );
        expect(
          decision.evidence,
        ).toHaveLength(0);
      },
    );

    it(
      "answers broad study requests from important grounded evidence",
      () => {
        const decision =
          classifyGroundedQuestion(
            grounding(),
            "Give me the key points of this document.",
          );

        expect(
          decision.answerability,
        ).toBe("ANSWERABLE");
        expect(
          decision.supportedPoints.length,
        ).toBeGreaterThanOrEqual(2);
      },
    );

    it(
      "builds a deterministic abstention instead of guessing",
      () => {
        const decision =
          classifyGroundedQuestion(
            grounding(),
            "Who won the 2026 World Cup?",
          );

        expect(
          buildGroundedChatFallback(
            decision,
          ),
        ).toContain(
          "won't guess",
        );
      },
    );

    it(
      "builds an explicit partial-answer limitation",
      () => {
        const decision =
          classifyGroundedQuestion(
            grounding(),
            "What is STP and which encryption algorithm does it use?",
          );

        const fallback =
          buildGroundedChatFallback(
            decision,
          );

        expect(fallback).toContain(
          "only supports part",
        );
        expect(fallback).toContain(
          "couldn't verify the rest",
        );
      },
    );

    it(
      "accepts a grounded AI paraphrase",
      () => {
        const decision =
          classifyGroundedQuestion(
            grounding(),
            "What does STP prevent?",
          );

        const validation =
          validateGroundedChatResponse(
            "STP prevents Layer 2 switching loops in redundant Ethernet topologies.",
            decision,
          );

        expect(
          validation.accepted,
        ).toBe(true);
      },
    );

    it(
      "rejects an unsupported numeric claim",
      () => {
        const decision =
          classifyGroundedQuestion(
            grounding(),
            "What is the default STP bridge priority?",
          );

        const validation =
          validateGroundedChatResponse(
            "The default STP bridge priority is 65535.",
            decision,
          );

        expect(
          validation.accepted,
        ).toBe(false);
        expect(
          validation.issueCodes,
        ).toContain(
          "UNSUPPORTED_NUMERIC",
        );
      },
    );

    it(
      "rejects an unsupported extra factual claim",
      () => {
        const decision =
          classifyGroundedQuestion(
            grounding(),
            "What does STP prevent?",
          );

        const validation =
          validateGroundedChatResponse(
            "STP prevents switching loops. It also encrypts every Ethernet frame with AES.",
            decision,
          );

        expect(
          validation.accepted,
        ).toBe(false);
        expect(
          validation.issueCodes,
        ).toContain(
          "UNSUPPORTED_CLAIM",
        );
      },
    );

    it(
      "requires partial AI answers to disclose the unsupported remainder",
      () => {
        const decision =
          classifyGroundedQuestion(
            grounding(),
            "What is STP and which encryption algorithm does it use?",
          );

        const validation =
          validateGroundedChatResponse(
            "STP prevents Layer 2 switching loops.",
            decision,
          );

        expect(
          validation.accepted,
        ).toBe(false);
        expect(
          validation.issueCodes,
        ).toContain(
          "PARTIAL_WITHOUT_LIMITATION",
        );
      },
    );

    it(
      "accepts a partial answer that stays inside evidence and states the limit",
      () => {
        const decision =
          classifyGroundedQuestion(
            grounding(),
            "What is STP and which encryption algorithm does it use?",
          );

        const validation =
          validateGroundedChatResponse(
            "STP prevents Layer 2 switching loops. The document only supports part of the question; it does not provide an encryption algorithm.",
            decision,
          );

        expect(
          validation.accepted,
        ).toBe(true);
      },
    );

    it(
      "supports Unicode grounded retrieval",
      () => {
        const source =
          grounding();
        source.sourceLanguage =
          "th";
        source.facts = [
          fact({
            id: "thai",
            content:
              "โปรโตคอล STP ช่วยป้องกันลูปในเครือข่ายสวิตช์เลเยอร์ 2",
            type: "relationship",
          }),
        ];
        source.keyTerms = [];
        source.concepts = [];
        source.sections = [{
          sectionId: "s1",
          heading:
            "การสวิตช์",
          status: "covered",
          factIds: ["thai"],
          sourceUnitCount: 1,
          omittedUnitCount: 0,
        }];

        const decision =
          classifyGroundedQuestion(
            source,
            "STP ช่วยป้องกันอะไรในเครือข่าย?",
          );

        expect(
          decision.answerability,
        ).not.toBe(
          "NOT_ANSWERABLE",
        );
      },
    );
  },
);
