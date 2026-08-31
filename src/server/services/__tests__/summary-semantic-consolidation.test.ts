import {
  GROUNDING_SCHEMA_VERSION,
  type AtomicFact,
  type GroundedKnowledge,
  type ImportantConcept,
} from "@/server/intelligence/grounding";
import {
  buildGroundedStudyNotes,
} from "@/server/services/summary/grounded-study-notes.service";

function fact(input: {
  id: string;
  sectionId: string;
  content: string;
  type: AtomicFact["type"];
  importance?: number;
}): AtomicFact {
  return {
    id: input.id,
    type: input.type,
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
    confidence: 0.96,
    importanceScore: input.importance ?? 0.86,
    numericTokens: input.content.match(/\b\d+(?:\.\d+)*\b/gu) ?? [],
  };
}

function concept(name: string, evidence: string): ImportantConcept {
  return {
    name,
    normalizedName: name.toLocaleLowerCase(),
    explanation: evidence,
    sourceSectionIds: ["core"],
    evidence: [{ id: `c-${name}`, sectionId: "core", sectionTitle: "Core", pageNumber: 1, text: evidence }],
    importanceScore: 0.9,
  };
}

function fixture(): GroundedKnowledge {
  const facts = [
    fact({ id: "definition", sectionId: "core", type: "definition", content: "A resolver maps a human-readable identifier to the network address used by a client.", importance: 0.99 }),
    fact({ id: "relationship", sectionId: "core", type: "relationship", content: "After resolution, the client uses the returned address to contact the application server.", importance: 0.97 }),
    fact({ id: "step1", sectionId: "step1", type: "procedure_step", content: "Configure the client with the resolver address.", importance: 0.9 }),
    fact({ id: "step2", sectionId: "step2", type: "procedure_step", content: "Add the identifier-to-address record to the resolver.", importance: 0.9 }),
    fact({ id: "thin", sectionId: "thin", type: "claim", content: "Webpage is displayed.", importance: 0.55 }),
    fact({ id: "warning", sectionId: "warning", type: "warning", content: "Do not assign a reserved network identifier to a host interface.", importance: 0.96 }),
  ];

  return {
    schemaVersion: GROUNDING_SCHEMA_VERSION,
    pipelineVersion: "intelligence-v2.7",
    sourceHash: "summary-fixture",
    documentKind: "lecture_notes",
    sourceLanguage: "en",
    facts,
    keyTerms: [],
    concepts: [
      concept("Resolver", facts[0]!.content),
      concept("Network Address", facts[1]!.content),
      concept("Step 1", facts[2]!.content),
    ],
    sections: [
      { sectionId: "core", heading: "Name Resolution", status: "covered", factIds: ["definition", "relationship"], sourceUnitCount: 2, omittedUnitCount: 0 },
      { sectionId: "step1", heading: "Step 1: Client Setup", status: "covered", factIds: ["step1"], sourceUnitCount: 1, omittedUnitCount: 0 },
      { sectionId: "step2", heading: "Step 2: Resolver Setup", status: "covered", factIds: ["step2"], sourceUnitCount: 1, omittedUnitCount: 0 },
      { sectionId: "thin", heading: "Server1", status: "covered", factIds: ["thin"], sourceUnitCount: 1, omittedUnitCount: 0 },
      { sectionId: "warning", heading: "Important Note", status: "covered", factIds: ["warning"], sourceUnitCount: 1, omittedUnitCount: 0 },
    ],
    quality: {
      score: 0.98,
      scoreOutOf10: 9.8,
      passed: true,
      supportedFactRatio: 1,
      sectionCoverageRatio: 1,
      numericExactnessRatio: 1,
      qualifiedTermPrecision: 1,
      duplicateFactRatio: 0,
      artifactCount: facts.length,
      warnings: [],
    },
    createdAt: new Date("2026-08-29T00:00:00.000Z"),
  };
}

describe("summary semantic learning consolidation", () => {
  it("turns source steps into one learner procedure section instead of one section per source step", () => {
    const notes = buildGroundedStudyNotes(fixture(), null, "Resolver Lab", { mode: "comprehensive" });

    expect(notes.summary).toContain("## Processes / Steps");
    expect(notes.summary).not.toContain("### Process and Procedure");
    expect(notes.summary).toContain("Configure the client with the resolver address.");
    expect(notes.summary).toContain("Add the identifier-to-address record to the resolver.");
    expect(notes.summary).not.toMatch(/^###\s+Step\s+1\b/gm);
    expect(notes.summary).not.toMatch(/^###\s+Step\s+2\b/gm);
  });

  it("does not promote a thin source label into a study section", () => {
    const notes = buildGroundedStudyNotes(fixture(), null, "Resolver Lab", { mode: "comprehensive" });

    expect(notes.summary).not.toMatch(/^###\s+Server1\b/gm);
  });

  it("keeps an important warning distinct from ordinary key points", () => {
    const notes = buildGroundedStudyNotes(fixture(), null, "Resolver Lab", { mode: "comprehensive" });

    expect(notes.summary).toContain("## Warnings / Common Mistakes");
    expect(notes.summary).toContain("Do not assign a reserved network identifier to a host interface.");
    expect(notes.keyPoints).not.toContain("Do not assign a reserved network identifier to a host interface.");
  });

  it("renders learner topics with a short explanation and local key points instead of global source-layout lists", () => {
    const notes = buildGroundedStudyNotes(fixture(), null, "Resolver Lab", { mode: "comprehensive" });

    expect(notes.summary).toContain("## Detailed Study Notes");
    expect(notes.summary).toContain("**Simple explanation:**");
    expect(notes.summary).toContain("## Key Points");
    expect(notes.summary).toContain("## Key Concepts");
    expect(notes.summary).toContain("## Key Terms");
    expect(notes.summary).not.toContain("## Study Topics");
    expect(notes.summary).not.toContain("## Key Takeaways");
    expect(notes.summary).not.toContain("## Section Notes");
  });

  it("keeps only real concepts in the student-facing concept list", () => {
    const notes = buildGroundedStudyNotes(fixture(), null, "Resolver Lab", { mode: "comprehensive" });

    expect(notes.importantConcepts).toEqual(expect.arrayContaining(["Resolver", "Network Address"]));
    expect(notes.importantConcepts).not.toContain("Step 1");
  });
});

describe("summary v3.1 semantic evidence topic eligibility", () => {
  it("uses semantic concepts instead of example/task headings when the heading and facts do not describe the same learning topic", () => {
    const facts = [
      fact({
        id: "algorithm-definition",
        sectionId: "largest-example",
        type: "definition",
        content: "An algorithm is a set of instructions that teaches a computer how to solve a problem.",
        importance: 0.99,
      }),
      fact({
        id: "algorithm-rule",
        sectionId: "largest-example",
        type: "rule",
        content: "Algorithms guide computers through a problem step by step.",
        importance: 0.95,
      }),
      fact({
        id: "variable-definition",
        sectionId: "current-total",
        type: "definition",
        content: "A variable is named memory that stores information while a problem is being solved.",
        importance: 0.98,
      }),
      fact({
        id: "variable-change",
        sectionId: "current-total",
        type: "rule",
        content: "A variable changes when the information the computer needs to remember changes.",
        importance: 0.92,
      }),
      fact({
        id: "fragment",
        sectionId: "move-fragment",
        type: "claim",
        content: "The array is sorted after the remaining values are placed in order.",
        importance: 0.75,
      }),
    ];
    const grounding: GroundedKnowledge = {
      ...fixture(),
      sourceHash: "semantic-heading-fixture",
      facts,
      keyTerms: [],
      concepts: [
        {
          name: "Algorithm",
          normalizedName: "algorithm",
          explanation: facts[0]!.content,
          sourceSectionIds: ["largest-example"],
          evidence: facts[0]!.evidence,
          importanceScore: 0.99,
        },
        {
          name: "Variable",
          normalizedName: "variable",
          explanation: facts[2]!.content,
          sourceSectionIds: ["current-total"],
          evidence: facts[2]!.evidence,
          importanceScore: 0.98,
        },
      ],
      sections: [
        { sectionId: "largest-example", heading: "Largest Number", status: "covered", factIds: ["algorithm-definition", "algorithm-rule"], sourceUnitCount: 2, omittedUnitCount: 0 },
        { sectionId: "current-total", heading: "Current Total", status: "covered", factIds: ["variable-definition", "variable-change"], sourceUnitCount: 2, omittedUnitCount: 0 },
        { sectionId: "move-fragment", heading: "→ move before 12", status: "covered", factIds: ["fragment"], sourceUnitCount: 1, omittedUnitCount: 0 },
      ],
      quality: {
        ...fixture().quality,
        artifactCount: facts.length,
      },
    };

    const notes = buildGroundedStudyNotes(
      grounding,
      null,
      "Algorithm Thinking",
      { mode: "comprehensive" },
    );

    expect(notes.summary).toMatch(/^###\s+Algorithm\b/gm);
    expect(notes.summary).toMatch(/^###\s+Variable\b/gm);
    expect(notes.summary).not.toMatch(/^###\s+Largest Number\b/gm);
    expect(notes.summary).not.toMatch(/^###\s+Current Total\b/gm);
    expect(notes.summary).not.toContain("### → move before 12");
  });

  it("recovers a semantic concept topic from an instructional/example-style source heading", () => {
    const facts = [
      fact({
        id: "decision-rule",
        sectionId: "decision-example",
        type: "rule",
        content: "Every algorithm contains decisions.",
        importance: 0.96,
      }),
      fact({
        id: "conditional-name",
        sectionId: "decision-example",
        type: "definition",
        content: "Programming gives those decisions a name: conditional statements.",
        importance: 0.99,
      }),
    ];
    const grounding: GroundedKnowledge = {
      ...fixture(),
      facts,
      concepts: [{
        name: "Conditional Statements",
        normalizedName: "conditional statements",
        explanation: facts[1]!.content,
        sourceSectionIds: ["decision-example"],
        evidence: facts[1]!.evidence,
        importanceScore: 0.99,
      }],
      sections: [{
        sectionId: "decision-example",
        heading: "Imagine You Are Looking for the Largest Number",
        status: "covered",
        factIds: facts.map((item) => item.id),
        sourceUnitCount: 2,
        omittedUnitCount: 0,
      }],
      quality: {
        ...fixture().quality,
        artifactCount: facts.length,
      },
    };

    const notes = buildGroundedStudyNotes(
      grounding,
      null,
      "Algorithm Thinking",
      { mode: "comprehensive" },
    );

    expect(notes.summary).toMatch(/^###\s+Conditional Statements\b/gm);
    expect(notes.summary).not.toMatch(/^###\s+Imagine You Are Looking for the Largest Number\b/gm);
  });

  it("removes prompt and narrative debris from topic key points", () => {
    const source = fixture();
    source.facts.push(
      fact({
        id: "prompt-debris",
        sectionId: "core",
        type: "claim",
        content: "Let's do another experiment.",
        importance: 0.95,
      }),
      fact({
        id: "transition-debris",
        sectionId: "core",
        type: "claim",
        content: "Now imagine a computer.",
        importance: 0.95,
      }),
    );
    source.sections[0]!.factIds.push("prompt-debris", "transition-debris");

    const notes = buildGroundedStudyNotes(source, null, "Resolver Lab", {
      mode: "comprehensive",
    });

    expect(notes.summary).not.toContain("Let's do another experiment.");
    expect(notes.summary).not.toContain("Now imagine a computer.");
  });

  it("omits the warnings section when a warning-typed fact is actually explanatory knowledge rather than an actionable caution", () => {
    const source = fixture();
    source.facts = source.facts.map((item) =>
      item.id === "warning"
        ? {
            ...item,
            content: "Computers do not understand a human concept unless programmers provide explicit instructions.",
            type: "warning" as const,
          }
        : item,
    );

    const notes = buildGroundedStudyNotes(source, null, "Resolver Lab", {
      mode: "comprehensive",
    });

    expect(notes.summary).not.toContain("## Warnings / Common Mistakes");
  });
});

describe("summary v3.1 source-structure separation", () => {
  it("does not use a highly important but unrelated fact as a topic explanation", () => {
    const facts = [
      fact({
        id: "generic-cause",
        sectionId: "build",
        type: "relationship",
        content: "Understanding cause and effect is a basic form of human knowledge underlying our decisions.",
        importance: 0.99,
      }),
      fact({
        id: "model-method",
        sectionId: "build",
        type: "claim",
        content: "The defect model was built using a mixture of project data and expert judgements.",
        importance: 0.91,
      }),
    ];
    const source: GroundedKnowledge = {
      ...fixture(),
      sourceHash: "topic-explanation-alignment",
      facts,
      concepts: [],
      keyTerms: [],
      sections: [{
        sectionId: "build",
        heading: "2.2 Building the BN Model",
        status: "covered",
        factIds: facts.map((item) => item.id),
        sourceUnitCount: facts.length,
        omittedUnitCount: 0,
      }],
      quality: { ...fixture().quality, artifactCount: facts.length },
    };

    const notes = buildGroundedStudyNotes(source, null, "Defect Prediction", {
      mode: "comprehensive",
    });

    expect(notes.summary).not.toContain("### Building the BN Model");
    expect(notes.summary).toMatch(
      /### Method and Approach[\s\S]*\*\*Simple explanation:\*\* The defect model was built using a mixture of project data and expert judgements\./,
    );
    expect(notes.summary).toMatch(
      /### Cause and Effect[\s\S]*\*\*Simple explanation:\*\* Understanding cause and effect is a basic form of human knowledge underlying our decisions\./,
    );
    expect(notes.summary).not.toMatch(
      /### Method and Approach[\s\S]*\*\*Simple explanation:\*\* Understanding cause and effect/,
    );
  });

  it("uses Abstract and Introduction as evidence containers, never as learner topic labels", () => {
    const facts = [
      fact({
        id: "bn-definition",
        sectionId: "abstract",
        type: "definition",
        content: "A Bayesian Network is a graph of uncertain variables connected by causal relationships and probability tables.",
        importance: 0.99,
      }),
      fact({
        id: "validation-result",
        sectionId: "abstract",
        type: "result",
        content: "The validation found 95% correlation between actual and predicted defects.",
        importance: 0.99,
      }),
      fact({
        id: "causal-rule",
        sectionId: "intro",
        type: "relationship",
        content: "Causal models allow conflicting evidence about software quality to be considered together.",
        importance: 0.95,
      }),
    ];
    const source: GroundedKnowledge = {
      ...fixture(),
      sourceHash: "structure-container-fixture",
      documentKind: "research_paper",
      facts,
      concepts: [{
        name: "Bayesian Network",
        normalizedName: "bayesian network",
        explanation: facts[0]!.content,
        sourceSectionIds: ["abstract"],
        evidence: facts[0]!.evidence,
        importanceScore: 0.99,
      }],
      keyTerms: [],
      sections: [
        { sectionId: "abstract", heading: "Abstract", status: "covered", factIds: ["bn-definition", "validation-result"], sourceUnitCount: 2, omittedUnitCount: 0 },
        { sectionId: "intro", heading: "1. INTRODUCTION", status: "covered", factIds: ["causal-rule"], sourceUnitCount: 1, omittedUnitCount: 0 },
      ],
      quality: { ...fixture().quality, artifactCount: facts.length },
    };

    const notes = buildGroundedStudyNotes(source, null, "Improved Software Defect Prediction", {
      mode: "comprehensive",
    });

    expect(notes.summary).not.toMatch(/^###\s+Abstract\b/gm);
    expect(notes.summary).not.toMatch(/^###\s+(?:1\.\s*)?INTRODUCTION\b/gm);
    expect(notes.summary).toMatch(/^###\s+Bayesian Network\b/gm);
    expect(notes.summary).toMatch(/^###\s+Results and Findings\b/gm);
  });

  it("keeps framework components inside one framework topic instead of spending topic slots on component labels", () => {
    const facts = [
      fact({ id: "think", sectionId: "think", type: "claim", content: "The THINK Framework uses five questions to guide problem solving.", importance: 0.97 }),
      fact({ id: "t", sectionId: "think-t", type: "objective", content: "Understand the Task before deciding how to solve it.", importance: 0.92 }),
      fact({ id: "h", sectionId: "think-h", type: "objective", content: "Human Solution asks how the problem would be solved without programming.", importance: 0.92 }),
      fact({ id: "i", sectionId: "think-i", type: "objective", content: "Identify Important Information that must be remembered while solving the problem.", importance: 0.92 }),
      fact({ id: "n", sectionId: "think-n", type: "objective", content: "Name the Memory by choosing variables or data structures for remembered information.", importance: 0.92 }),
      fact({ id: "k", sectionId: "think-k", type: "objective", content: "Keep Processing until the task is complete.", importance: 0.92 }),
    ];
    const source: GroundedKnowledge = {
      ...fixture(),
      sourceHash: "framework-grouping-fixture",
      facts,
      concepts: [],
      keyTerms: [],
      sections: [
        { sectionId: "think", heading: "The THINK Framework", status: "covered", factIds: ["think"], sourceUnitCount: 1, omittedUnitCount: 0 },
        { sectionId: "think-t", heading: "T", status: "covered", factIds: ["t"], sourceUnitCount: 1, omittedUnitCount: 0 },
        { sectionId: "think-h", heading: "Human Solution", status: "covered", factIds: ["h"], sourceUnitCount: 1, omittedUnitCount: 0 },
        { sectionId: "think-i", heading: "Identify Important Information", status: "covered", factIds: ["i"], sourceUnitCount: 1, omittedUnitCount: 0 },
        { sectionId: "think-n", heading: "N", status: "covered", factIds: ["n"], sourceUnitCount: 1, omittedUnitCount: 0 },
        { sectionId: "think-k", heading: "Keep Processing", status: "covered", factIds: ["k"], sourceUnitCount: 1, omittedUnitCount: 0 },
      ],
      quality: { ...fixture().quality, artifactCount: facts.length },
    };

    const notes = buildGroundedStudyNotes(source, null, "Thinking Before Coding", {
      mode: "comprehensive",
    });

    expect(notes.summary).toMatch(/^###\s+THINK Framework\b/gm);
    expect(notes.summary).not.toMatch(/^###\s+(?:T|N|Human Solution|Identify Important Information|Keep Processing)\s*$/gm);
    expect(notes.summary).toContain("Understand the Task before deciding how to solve it.");
    expect(notes.summary).toContain("Name the Memory by choosing variables or data structures for remembered information.");
    expect(notes.summary).toContain("Keep Processing until the task is complete.");
  });
});
