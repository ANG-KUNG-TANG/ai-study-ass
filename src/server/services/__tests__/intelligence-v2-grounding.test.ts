import { runPipeline } from "@/server/intelligence/pipeline";
import {
  buildGroundedStudyNotes,
} from "@/server/services/summary/grounded-study-notes.service";
import {
  answerFromGrounding,
  buildFlashcardsFromGrounding,
  buildGroundedPromptSource,
  buildQuestionsFromGrounding,
} from "@/server/services/grounded-artifacts.service";
import { isIntelligenceV2Enabled } from "@/server/config/intelligence-v2.config";

const LECTURE_NOTE = `
Lecture Note: Presenting the Analysis Phase to Stakeholders
How to communicate analysis results clearly, confidently, and professionally

1. Why Presentation After the Analysis Phase Matters
Once the SRS is completed and the Analysis Phase is finished, the development team must present the results to stakeholders.
• Confirms that the analysis correctly reflects stakeholder needs
• Ensures alignment before moving into design and implementation
• Prevents costly misunderstandings later

2. Objectives of the Analysis Presentation
Students must understand that the goal is not to show UML diagrams only.
The presentation must:
• Explain the problem domain
• Show how the SRS was interpreted
• Invite stakeholder feedback
• Confirm shared understanding

3. Structure of a Good Analysis Presentation
3.1 Introduction
• Project name
• Purpose of the system
• Scope based on the SRS

3.2 Summary of SRS Understanding
• Functional Requirements • Non-functional Requirements • Business Rules • Constraints • Assumptions

3.3 Use Case Model Presentation
Requirements traceability means connecting every analysis artifact to supporting SRS evidence.
• Identified actors
• Use case list
• System boundary

3.4 Domain Model Presentation
• Candidate classes
• Attributes
• Associations
• Multiplicity

3.5 Interaction Models
• Sequence diagrams
• Communication diagrams

3.6 Validation Points
Ask stakeholders to confirm:
• Are all actors correct?
• Are all use cases complete?
• Are domain concepts accurate?

4. Principles of Effective Stakeholder Presentation
4.1 Know Your Audience
Stakeholders may not be technical. Use simple language and avoid jargon.
4.2 Tell a Story
Move from problem to requirements to analysis models to confirmation.
4.3 Use Visuals
• Clear diagrams
• Minimal text on slides
4.4 Be Concise
Stakeholders want clarity, not complexity.
4.5 Invite Feedback
Ask whether each use case reflects the stakeholder workflow.
4.6 Show Traceability
Demonstrate how each analysis artifact comes from the SRS.

5. Common Mistakes Students Make
• Presenting diagrams without explanation
• Using too much technical jargon
• Not connecting analysis back to the SRS
• Ignoring non-functional requirements

6. Example Flow of a Strong Presentation
1. Introduction
2. SRS Summary
3. Actors and Use Case List
4. Use Case Diagram
5. Domain Model
6. Sequence and Communication Diagrams
7. Validation Checklist
8. Questions and answers with stakeholders

Student Presentation Template
Slide 1 — Title Slide
• Project Name • Team Members • Course: DTI 312 OOAD • Date
Slide 6 — Use Case Diagram
(Insert diagram)
• Highlight main interactions
Slide 10 — Validation Checklist
• Are all actors correct? • Are all use cases complete?
Slide 11 — Conclusion
• Summary of analysis • Confirmation of alignment • Next steps
Slide 12 — Q&A
Invite stakeholder feedback.
`;

describe("Intelligence Engine V2 grounding", () => {
  const result = runPipeline({
    rawText: LECTURE_NOTE,
    fileName: "lecture-note.pdf",
    mimeType: "application/pdf",
    fileSize: Buffer.byteLength(LECTURE_NOTE),
    pageCount: 6,
  });
  const notes = buildGroundedStudyNotes(
    result.grounding,
    result.reliabilityProfile,
    "Lecture Note",
  );

  it("supports an immediate environment-based rollback", () => {
    expect(isIntelligenceV2Enabled({ INTELLIGENCE_V2_ENABLED: "true" })).toBe(true);
    expect(isIntelligenceV2Enabled({ INTELLIGENCE_V2_ENABLED: "false" })).toBe(false);
  });

  it("preserves bullet boundaries instead of creating cross-bullet phrases", () => {
    expect(result.nlp.sentences.some((sentence) =>
      sentence.text === "Functional Requirements",
    )).toBe(true);
    expect(result.nlp.sentences.some((sentence) =>
      sentence.text === "Business Rules",
    )).toBe(true);
    expect(result.nlp.keyPhrases).not.toContain(
      "non-functional requirements business rules",
    );
  });

  it("accounts for late sections and presentation-template slides", () => {
    const coveredHeadings = result.grounding.sections
      .filter((section) => section.status === "covered")
      .map((section) => section.heading);

    expect(coveredHeadings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Common Mistakes Students Make"),
        expect.stringMatching(/Slide 12\s+[-–—]\s+Q&A/),
      ]),
    );
    expect(result.grounding.quality.sectionCoverageRatio).toBeGreaterThanOrEqual(0.85);
  });

  it("rejects sentence fragments, slide labels, and placeholders as terms", () => {
    const terms = result.grounding.keyTerms.map((term) => term.term.toLowerCase());

    expect(terms).toContain("requirements traceability");
    expect(terms).not.toContain("once the srs");
    expect(terms).not.toContain("students must understand that the goal");
    expect(terms.some((term) => term.startsWith("slide 6"))).toBe(false);
    expect(result.grounding.quality.artifactCount).toBe(0);
  });

  it("builds complete grounded notes with distinct points and takeaways", () => {
    expect(notes.summary).toContain("<!-- intelligence-engine:v2 -->");
    expect(notes.summary).toContain("## Section Notes");
    expect(notes.summary).toContain("Principles of Effective Stakeholder Presentation");
    expect(notes.summary).toContain("Common Mistakes Students Make");
    expect(notes.summary).toMatch(/Slide 12\s+[-–—]\s+Q&A/);
    expect(notes.summary).not.toMatch(/insert diagram|svg\s*regenerate/i);

    const points = sectionBullets(notes.summary, "Key Points");
    const takeaways = sectionBullets(notes.summary, "Key Takeaways");
    expect(points.filter((point) => takeaways.includes(point))).toHaveLength(0);
  });

  it("keeps every numerical token in its exact evidence span", () => {
    const numericalFacts = result.grounding.facts.filter(
      (fact) => fact.numericTokens.length > 0,
    );

    expect(numericalFacts.length).toBeGreaterThan(0);
    for (const fact of numericalFacts) {
      for (const token of fact.numericTokens) {
        expect(fact.evidence[0].text).toContain(token);
      }
    }
    expect(result.grounding.quality.numericExactnessRatio).toBe(1);
  });

  it("reuses verified knowledge for quiz, flashcard, and chat artifacts", () => {
    const questions = buildQuestionsFromGrounding(
      result.grounding,
      5,
      ["short_answer", "true_false"],
    );
    const cards = buildFlashcardsFromGrounding(result.grounding, 5);
    const chat = answerFromGrounding(
      result.grounding,
      "What common mistakes should students avoid?",
    );

    expect(questions).toHaveLength(5);
    expect(cards).toHaveLength(5);
    expect(questions[0].explanation).toMatch(/verified evidence/i);
    expect(cards[0].back).toContain("supporting SRS evidence");
    expect(chat.confidence).toBeGreaterThanOrEqual(0.8);
    expect(chat.text).toMatch(/Ignoring non-functional requirements/i);
  });

  it("distributes constrained AI context across the whole document", () => {
    const promptSource = buildGroundedPromptSource(result.grounding, 1_200);

    expect(promptSource.length).toBeLessThanOrEqual(1_200);
    expect(promptSource).toContain("Common Mistakes");
    expect(promptSource).toMatch(/Slide 12\s+[-–—]\s+Q&A/);
  });
});

function sectionBullets(markdown: string, heading: string): string[] {
  const match = markdown.match(
    new RegExp(`## ${heading}\\n\\n([\\s\\S]*?)(?=\\n\\n## |$)`),
  );

  return (match?.[1] ?? "")
    .split("\n")
    .filter((line) => line.startsWith("- "))
    .map((line) => line.replace(/\s+_\(p\.\s+\d+\)_$/, "").trim());
}
