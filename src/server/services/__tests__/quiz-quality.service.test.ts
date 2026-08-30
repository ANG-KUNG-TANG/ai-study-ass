import {
  GROUNDING_SCHEMA_VERSION,
  type AtomicFact,
  type GroundedKnowledge,
  type QualifiedTerm,
} from "@/server/intelligence/grounding";
import type { QuizQuestionInput } from "@/server/entities/quiz.entity";
import {
  validateGroundedQuizQuestions,
} from "@/server/services/quiz/quiz-quality.service";

function makeFact(input: {
  id: string;
  sectionId: string;
  content: string;
  type?: AtomicFact["type"];
  page?: number;
}): AtomicFact {
  return {
    id: input.id,
    type: input.type ?? "claim",
    content: input.content,
    verbatimRequired: false,
    sourceSectionId: input.sectionId,
    evidence: [{
      id: `evidence-${input.id}`,
      sectionId: input.sectionId,
      sectionTitle: input.sectionId,
      pageNumber: input.page ?? 1,
      text: input.content,
    }],
    evidenceType: "stated",
    verificationStatus: "supported",
    confidence: 0.95,
    importanceScore: 0.9,
    numericTokens: [],
  };
}

function makeTerm(
  term: string,
  definition: string,
  sectionId = "s1",
): QualifiedTerm {
  return {
    term,
    definition,
    sourceSectionId: sectionId,
    evidence: [{
      id: `term-${term}`,
      sectionId,
      sectionTitle: sectionId,
      pageNumber: 1,
      text: `${term}: ${definition}`,
    }],
    qualification: "explicit_definition",
    confidence: 0.98,
  };
}

function makeGrounding(): GroundedKnowledge {
  const facts = [
    makeFact({
      id: "f1",
      sectionId: "s1",
      content:
        "Spanning Tree Protocol prevents Layer 2 switching loops in redundant Ethernet topologies.",
      type: "definition",
    }),
    makeFact({
      id: "f2",
      sectionId: "s1",
      content:
        "The root bridge is selected using the lowest bridge identifier.",
      type: "rule",
    }),
    makeFact({
      id: "f3",
      sectionId: "s2",
      content:
        "PortFast should be enabled only on access ports connected to end devices.",
      type: "warning",
      page: 2,
    }),
    makeFact({
      id: "f4",
      sectionId: "s2",
      content:
        "BPDU Guard disables a protected edge port when an unexpected BPDU is received.",
      type: "relationship",
      page: 2,
    }),
    makeFact({
      id: "f5",
      sectionId: "s3",
      content: "The default STP bridge priority is 32768.",
      type: "number",
      page: 3,
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
      makeTerm(
        "Root Bridge",
        "the switch selected using the lowest bridge identifier",
      ),
      makeTerm(
        "PortFast",
        "an edge-port feature that moves an access port quickly to forwarding",
        "s2",
      ),
    ],
    concepts: [
      {
        name: "Spanning Tree Protocol",
        normalizedName: "spanning tree protocol",
        explanation: "A protocol that prevents Layer 2 switching loops.",
        sourceSectionIds: ["s1"],
        evidence: facts[0]!.evidence,
        importanceScore: 0.99,
      },
      {
        name: "BPDU Guard",
        normalizedName: "bpdu guard",
        explanation: "A protection mechanism for edge ports.",
        sourceSectionIds: ["s2"],
        evidence: facts[3]!.evidence,
        importanceScore: 0.9,
      },
    ],
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
        factIds: ["f3", "f4"],
        sourceUnitCount: 2,
        omittedUnitCount: 0,
      },
      {
        sectionId: "s3",
        heading: "Bridge Priority",
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

function validate(
  question: QuizQuestionInput,
  grounding = makeGrounding(),
) {
  return validateGroundedQuizQuestions([question], grounding);
}

describe("quiz grounded quality validation", () => {
  it("accepts a qualified-definition MCQ with one defensible answer", () => {
    const result = validate({
      question:
        'Which term is defined as: "the switch selected using the lowest bridge identifier"?',
      questionType: "multiple_choice",
      options: ["Root Bridge", "PortFast", "BPDU Guard"],
      answer: "Root Bridge",
      explanation: "unsafe model explanation",
    });

    expect(result.rejected).toHaveLength(0);
    expect(result.contract.hardGatePassed).toBe(true);
    expect(result.accepted[0]?.explanation).toBe(
      "The answer is supported by verified evidence on page 1.",
    );
  });

  it("rejects a definition MCQ when a distractor also matches", () => {
    const grounding = makeGrounding();
    grounding.keyTerms.push(
      makeTerm(
        "Primary Bridge",
        "the switch selected using the lowest bridge identifier",
      ),
    );

    const result = validate({
      question:
        'Which term is defined as: "the switch selected using the lowest bridge identifier"?',
      questionType: "multiple_choice",
      options: ["Root Bridge", "Primary Bridge", "PortFast"],
      answer: "Root Bridge",
    }, grounding);

    expect(result.rejected[0]?.reasonCodes).toContain(
      "AMBIGUOUS_DISTRACTOR",
    );
  });

  it("rejects duplicate MCQ options after normalization", () => {
    const result = validate({
      question:
        'Which term is defined as: "the switch selected using the lowest bridge identifier"?',
      questionType: "multiple_choice",
      options: ["Root Bridge", "root bridge", "PortFast"],
      answer: "Root Bridge",
    });

    expect(result.rejected[0]?.reasonCodes).toContain(
      "DUPLICATE_OPTIONS",
    );
  });

  it("rejects an unsupported MCQ answer", () => {
    const result = validate({
      question:
        "Which technology encrypts every Ethernet frame in this document?",
      questionType: "multiple_choice",
      options: ["AES-512", "Root Bridge", "PortFast"],
      answer: "AES-512",
    });

    expect(result.rejected[0]?.reasonCodes).toContain(
      "ANSWER_NOT_GROUNDED",
    );
  });

  it("rejects answer leakage in a general MCQ", () => {
    const result = validate({
      question:
        "The Root Bridge is the answer. Which bridge is selected using the lowest identifier?",
      questionType: "multiple_choice",
      options: ["Root Bridge", "PortFast", "BPDU Guard"],
      answer: "Root Bridge",
    });

    expect(result.rejected[0]?.reasonCodes).toContain(
      "ANSWER_LEAKAGE",
    );
  });

  it("accepts a directly supported true statement", () => {
    const result = validate({
      question:
        "True or false: The default STP bridge priority is 32768.",
      questionType: "true_false",
      options: ["True", "False"],
      answer: "True",
    });

    expect(result.rejected).toHaveLength(0);
  });

  it("rejects False when missing evidence is the only basis", () => {
    const result = validate({
      question:
        "True or false: STP encrypts all Ethernet frames.",
      questionType: "true_false",
      options: ["True", "False"],
      answer: "False",
    });

    expect(result.rejected[0]?.reasonCodes).toContain(
      "FALSE_STATEMENT_NOT_PROVABLE",
    );
  });

  it("accepts False when a numeric contradiction is grounded", () => {
    const result = validate({
      question:
        "True or false: The default STP bridge priority is 99999.",
      questionType: "true_false",
      options: ["True", "False"],
      answer: "False",
    });

    expect(result.rejected).toHaveLength(0);
  });

  it("accepts a section-scoped supported short answer", () => {
    const result = validate({
      question:
        'What is one important point from "Edge Port Protection"?',
      questionType: "short_answer",
      options: [],
      answer:
        "PortFast should be enabled only on access ports connected to end devices.",
    });

    expect(result.rejected).toHaveLength(0);
  });

  it("rejects a hallucinated short answer", () => {
    const result = validate({
      question:
        'What is one important point from "Edge Port Protection"?',
      questionType: "short_answer",
      options: [],
      answer: "Every edge port must use public-key encryption.",
    });

    expect(result.rejected[0]?.reasonCodes).toContain(
      "ANSWER_NOT_GROUNDED",
    );
  });

  it("supports Unicode evidence without English-only token assumptions", () => {
    const grounding = makeGrounding();
    grounding.sourceLanguage = "th";
    grounding.facts = [
      makeFact({
        id: "thai-1",
        sectionId: "thai-section",
        content:
          "โปรโตคอล STP ช่วยป้องกันลูปในเครือข่ายสวิตช์เลเยอร์ 2",
        type: "definition",
      }),
    ];
    grounding.sections = [{
      sectionId: "thai-section",
      heading: "STP",
      status: "covered",
      factIds: ["thai-1"],
      sourceUnitCount: 1,
      omittedUnitCount: 0,
    }];
    grounding.keyTerms = [];
    grounding.concepts = [];

    const result = validate({
      question:
        "True or false: โปรโตคอล STP ช่วยป้องกันลูปในเครือข่ายสวิตช์เลเยอร์ 2",
      questionType: "true_false",
      options: ["True", "False"],
      answer: "True",
    }, grounding);

    expect(result.rejected).toHaveLength(0);
  });
});
