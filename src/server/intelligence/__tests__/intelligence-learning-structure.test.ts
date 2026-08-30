import {
  runPipeline,
} from "@/server/intelligence/pipeline";
import {
  buildGroundedStudyNotes,
} from "@/server/services/summary/grounded-study-notes.service";
import {
  canonicalizeStudyConceptLabel,
  isValidConcept,
} from "@/server/intelligence/reliability/concept-validator";
import {
  validateSummaryRepairPatch,
} from "@/server/services/summary/summary-targeted-repair.service";
import {
  isSummaryCandidateTextEligible,
} from "@/server/services/summary/summary-learning-structure.service";

const OOAD_STRUCTURE_SOURCE = `
A Brief History
The object-oriented paradigm evolved from object-oriented programming.

Object-Oriented Analysis
Object-Oriented Analysis (OOA) is the process of identifying software requirements in terms of interacting objects.

Encapsulation
Encapsulation is the process of binding data and methods together within a class.

Inheritance
Inheritance is the mechanism that allows new classes to be created from existing classes.

State Machine
A state machine describes the changing states of an object in response to events.

State Machines
State machines describe dynamic behavior through states and transitions.

Example
A Savings Account is used here only as an example of a specialized account.

Encapsulation
Encapsulation protects an object's internal state from inappropriate direct access.

Sequence Diagrams
Sequence diagrams show interactions ordered over time.

Sequence Diagrams
Sequence diagrams emphasize message order between objects.

Actors
Relationships like dependency, generalization, and association.

Gift Details
The process computes the yearly total sales corresponding to each customer and records the data.

Common Mistakes Students Make
Presenting diagrams without explanation.
Using too much technical jargon.

Example Flow of a Strong Presentation
Introduction
SRS Summary
Actors and Use Case List
Domain Model
Validation Checklist
Q&A with stakeholders

Student Presentation Template
Presenting the Analysis Phase to Stakeholders

Slide 1 — Title Slide
Project Name
Team Members
Course: DTI 312 OOAD

Slide 10 — Validation Checklist
Are all actors correct?
Are all use cases complete?

Slide 12 — Q&A
Invite stakeholder feedback.
`;

describe("Intelligence learning structure v3.0 semantic topics", () => {
  const result = runPipeline({
    rawText: OOAD_STRUCTURE_SOURCE,
    fileName: "OOAD_Quick_Guide.pdf",
    mimeType: "application/pdf",
    fileSize: Buffer.byteLength(
      OOAD_STRUCTURE_SOURCE,
    ),
  });

  const notes = buildGroundedStudyNotes(
    result.grounding,
    result.reliabilityProfile,
    "OOAD Quick Guide",
    { mode: "comprehensive" },
  );

  it("uses a document-level title instead of a generic subsection title", () => {
    expect(
      result.reliabilityProfile.title.value,
    ).toMatch(/OOAD|Object-Oriented/i);
    expect(
      result.reliabilityProfile.title.value,
    ).not.toMatch(/^A Brief History$/i);
  });

  it("recovers grounded key terms directly from explicit definition facts", () => {
    const terms = result.grounding.keyTerms.map(
      (term) => term.term.toLowerCase(),
    );

    expect(terms.some((term) => term.includes("encapsulation"))).toBe(true);
    expect(terms.some((term) => term.includes("inheritance"))).toBe(true);
    expect(notes.summary).toContain("## Key Terms");
    expect(notes.summary).toMatch(/\*\*Encapsulation/i);
  });

  it("normalizes OO aliases and rejects sentence-like/example concept labels", () => {
    expect(
      canonicalizeStudyConceptLabel("ObjectOriented Analysis"),
    ).toBe("Object-Oriented Analysis (OOA)");
    expect(
      canonicalizeStudyConceptLabel("Object-Oriented Design"),
    ).toBe("Object-Oriented Design (OOD)");
    expect(
      isValidConcept("Physical containment - Example, a computer"),
    ).toBe(false);
    expect(isValidConcept("In OOP, a class")).toBe(false);
  });

  it("keeps example-only entities out of student-facing concepts and key terms", () => {
    expect(notes.importantConcepts).not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Savings Account/i),
      ]),
    );
    expect(notes.importantConcepts).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Encapsulation/i),
      ]),
    );
    expect(notes.summary).not.toMatch(/\*\*A?\s*Savings Account:/i);
  });

  it("consolidates repeated semantic study topics", () => {
    const encapsulation = notes.summary.match(
      /^###\s+Encapsulation\b/gm,
    ) ?? [];
    const sequence = notes.summary.match(
      /^###\s+Sequence Diagrams\b/gm,
    ) ?? [];
    const stateMachine = notes.summary.match(
      /^###\s+State Machines?\b/gm,
    ) ?? [];

    expect(encapsulation.length).toBeLessThanOrEqual(1);
    expect(sequence.length).toBeLessThanOrEqual(1);
    expect(stateMachine.length).toBeLessThanOrEqual(1);
    expect(notes.summary).toContain("## Study Topics");
  });

  it("does not promote obviously mismatched source headings into Section Notes", () => {
    expect(notes.summary).not.toMatch(/^###\s+Actors\b/gm);
    expect(notes.summary).not.toMatch(/^###\s+Gift Details\b/gm);
  });

  it("keeps presentation template scaffolding out of the student summary", () => {
    expect(notes.summary).not.toMatch(/^###\s+Slide\s+\d+\b/gm);
    expect(notes.summary).not.toContain("Course: DTI 312 OOAD");
    expect(notes.summary).not.toMatch(/^###\s+Student Presentation Template\b/gm);
  });

  it("keeps common mistakes as useful grounded warnings without promoting source debris", () => {
    expect(notes.summary).toContain(
      "## Important Warnings and Notes",
    );
    expect(notes.summary).toMatch(
      /Avoid presenting diagrams without explanation\./i,
    );
  });

  it("rejects metadata and example-only concepts from bounded AI repair", () => {
    const evidence = `
Encapsulation protects internal state.
A Savings Account is used here only as an example of a specialized account.
Course: DTI 312 OOAD
`;
    const repaired = validateSummaryRepairPatch(
      {
        overviewAdditions: ["Course: DTI 312 OOAD"],
        keyPoints: ["Team Members"],
        importantConcepts: ["Savings Account", "Encapsulation"],
      },
      evidence,
    );

    expect(repaired?.importantConcepts).toContain("Encapsulation");
    expect(repaired?.importantConcepts).not.toContain("Savings Account");
    expect(repaired?.overviewAdditions ?? []).not.toContain("Course: DTI 312 OOAD");
    expect(repaired?.keyPoints ?? []).not.toContain("Team Members");
  });

  it("rejects status-panel labels and timestamps as learning facts", () => {
    expect(
      isSummaryCandidateTextEligible("Last Success: 2026-08-20T17:50:05.717Z"),
    ).toBe(false);
    expect(
      isSummaryCandidateTextEligible("Document Processing: complete"),
    ).toBe(false);
    expect(
      isSummaryCandidateTextEligible("Tabs: Summary | Quiz | Flashcards | Chat | Knowledge"),
    ).toBe(false);
    expect(
      isSummaryCandidateTextEligible(
        "Usage telemetry is stored durably in MongoDB for later analysis.",
      ),
    ).toBe(true);
  });

  it("keeps checklist questions out of the overview", () => {
    const overview = notes.summary
      .split("## Overview")[1]
      ?.split(/^## /m)[0] ?? "";
    expect(overview).not.toMatch(/Are all .*\?/i);
  });

  it("keeps the familiar v2 summary contract for every study mode", () => {
    const concise = buildGroundedStudyNotes(
      result.grounding,
      result.reliabilityProfile,
      "OOAD Quick Guide",
      { mode: "concise" },
    );
    const exam = buildGroundedStudyNotes(
      result.grounding,
      result.reliabilityProfile,
      "OOAD Quick Guide",
      { mode: "exam" },
    );

    for (const summary of [concise.summary, exam.summary]) {
      expect(summary).toContain("## Overview");
      expect(summary).toContain("## Study Topics");
      expect(summary).toContain("**Simple explanation:**");
      expect(summary).toContain("**Important key points:**");
      expect(summary).not.toContain("## Key Points");
      expect(summary).not.toContain("## Main Concepts");
      expect(summary).not.toContain("## Section Notes");
      expect(summary).not.toContain("## Detailed Study Notes");
      expect(summary).not.toContain("## Practical Reference");
    }
  });

  it("marks regenerated grounding and study notes with the semantic-topic v3.0 versions", () => {
    expect(result.grounding.pipelineVersion).toBe("intelligence-v2.7");
    expect(notes.summary).toContain(
      "<!-- intelligence-engine:v3.0;mode:comprehensive -->",
    );
  });
});
