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
import { buildGroundedKnowledgeGraph } from "@/server/services/grounded-knowledge-graph.service";

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

const LECTURE_PAGE_STARTS = [
  "3.2 Summary of SRS Understanding",
  "3.6 Validation Points",
  "4.6 Show Traceability",
  "Slide 6 — Use Case Diagram",
  "Slide 10 — Validation Checklist",
];

const LECTURE_PAGES = splitAtHeadings(
  LECTURE_NOTE,
  LECTURE_PAGE_STARTS,
).map((rawText, index) => ({
  pageNumber: index + 1,
  rawText:
    index === 0
      ? `${rawText}\n-- 1 of 6 --`
      : rawText,
}));

describe("Intelligence Engine V2 grounding", () => {
  const result = runPipeline({
    rawText: LECTURE_NOTE,
    fileName: "lecture-note.pdf",
    mimeType: "application/pdf",
    fileSize: Buffer.byteLength(LECTURE_NOTE),
    pageCount: 6,
    pages: LECTURE_PAGES,
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

  it("marks regenerated grounding with the current pipeline version", () => {
    expect(result.grounding.pipelineVersion).toBe("intelligence-v2.4");
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
    expect(result.document.sections.every((section) => !section.pageEstimate)).toBe(true);
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
    expect(notes.summary).toContain(
      "<!-- intelligence-engine:v2.5;mode:comprehensive -->",
    );
    expect(notes.summary).toContain("## Section Notes");
    expect(notes.summary).toContain("Principles of Effective Stakeholder Presentation");
    expect(notes.summary).toContain("Common Mistakes Students Make");
    expect(notes.summary).toMatch(/Slide 12\s+[-–—]\s+Q&A/);
    expect(notes.summary).toMatch(/Slide 10\s+[-–—]\s+Validation Checklist \(p\. 6\)/);
    expect(notes.summary).not.toMatch(/insert diagram|svg\s*regenerate/i);
    expect(notes.summary).not.toContain("1 of 6");

    const points = sectionBullets(notes.summary, "Key Points");
    const takeaways = sectionBullets(notes.summary, "Key Takeaways");
    expect(points.filter((point) => takeaways.includes(point))).toHaveLength(0);
    expect(takeaways.every((takeaway) => takeaway.length >= 18)).toBe(true);
    expect(takeaways).not.toEqual(
      expect.arrayContaining([
        "Purpose of the system",
        "System Purpose",
        "Use case list",
        "Use case diagram",
      ]),
    );

    expect(
      subsectionBullets(notes.summary, "Slide 10 — Validation Checklist"),
    ).toEqual(
      expect.arrayContaining([
        "Are all actors correct?",
        "Are all use cases complete?",
      ]),
    );
    expect(notes.summary).toMatch(
      /- Ask stakeholders to confirm:\n  - Are all actors correct\?/,
    );
  });

  it("preserves exact page provenance for facts across the document", () => {
    const pageNumbers = new Set(
      result.grounding.facts.flatMap((fact) =>
        fact.evidence.map((evidence) => evidence.pageNumber),
      ),
    );

    expect(pageNumbers).toEqual(new Set([1, 2, 3, 4, 5, 6]));

    const validationFact = result.grounding.facts.find(
      (fact) =>
        fact.sourceSectionId.includes("slide-10-validation-checklist") &&
        fact.content === "Are all actors correct?",
    );

    expect(validationFact?.evidence[0].pageNumber).toBe(6);
  });

  it("recovers page boundaries from summaries extracted before V2", () => {
    const legacyText = LECTURE_PAGES.map(
      (page, index) =>
        `${page.rawText.replace(/\n-- 1 of 6 --$/, "")}\n- ${index + 1} of 6 --`,
    ).join("\n\n");
    const legacyResult = runPipeline({
      rawText: legacyText,
      fileName: "legacy-lecture-note.pdf",
      mimeType: "application/pdf",
      fileSize: Buffer.byteLength(legacyText),
    });

    expect(legacyResult.document.sourcePages).toHaveLength(6);
    expect(
      legacyResult.grounding.sections.find((section) =>
        section.heading.includes("Slide 10"),
      )?.pageStart,
    ).toBe(6);
    expect(
      legacyResult.grounding.facts.some((fact) =>
        fact.content.includes("1 of 6"),
      ),
    ).toBe(false);
  });

  it("does not invent page-one citations when legacy provenance is unavailable", () => {
    const unknownPageResult = runPipeline({
      rawText: LECTURE_NOTE,
      fileName: "legacy-without-page-markers.pdf",
      mimeType: "application/pdf",
      fileSize: Buffer.byteLength(LECTURE_NOTE),
    });
    const unknownPageNotes = buildGroundedStudyNotes(
      unknownPageResult.grounding,
      unknownPageResult.reliabilityProfile,
      "Lecture Note",
    );

    expect(
      unknownPageResult.document.sections.every(
        (section) => section.pageStart === undefined,
      ),
    ).toBe(true);
    expect(
      unknownPageResult.grounding.facts.every(
        (fact) => fact.evidence.every((evidence) => evidence.pageNumber === undefined),
      ),
    ).toBe(true);
    expect(unknownPageNotes.summary).not.toMatch(/\(p{1,2}\.\s*1\)/);
  });

  it("rejects slide-field labels even if they are misclassified as mistakes", () => {
    const labels = [
      "Purpose of the system",
      "System Purpose",
      "Use case list",
      "Use case diagram",
    ];
    const sourceSectionId = result.grounding.sections[0].sectionId;
    const labelFacts = labels.map((content, index) => ({
      id: `misclassified-label-${index}`,
      type: "common_mistake" as const,
      content,
      verbatimRequired: false,
      sourceSectionId,
      evidence: [],
      evidenceType: "stated" as const,
      verificationStatus: "supported" as const,
      confidence: 1,
      importanceScore: 1,
      numericTokens: [],
    }));
    const labelNotes = buildGroundedStudyNotes(
      {
        ...result.grounding,
        facts: [...labelFacts, ...result.grounding.facts],
      },
      result.reliabilityProfile,
      "Lecture Note",
    );
    const takeaways = sectionBullets(labelNotes.summary, "Key Takeaways");

    expect(takeaways).not.toEqual(expect.arrayContaining(labels));
  });

  it("turns a common-mistake fragment into an actionable takeaway", () => {
    const sourceSectionId = result.grounding.sections[0].sectionId;
    const actionableNotes = buildGroundedStudyNotes(
      {
        ...result.grounding,
        facts: [
          {
            id: "common-mistake-overloading",
            type: "common_mistake",
            content: "Overloading slides with text",
            verbatimRequired: false,
            sourceSectionId,
            evidence: [],
            evidenceType: "stated",
            verificationStatus: "supported",
            confidence: 1,
            importanceScore: 1,
            numericTokens: [],
          },
          ...result.grounding.facts,
        ],
      },
      result.reliabilityProfile,
      "Lecture Note",
    );
    const takeaways = sectionBullets(actionableNotes.summary, "Key Takeaways");

    expect(takeaways).toContain("Avoid overloading slides with text.");
  });

  it("builds distinct concise and exam-revision modes", () => {
    const concise = buildGroundedStudyNotes(
      result.grounding,
      result.reliabilityProfile,
      "Lecture Note",
      { mode: "concise" },
    );
    const exam = buildGroundedStudyNotes(
      result.grounding,
      result.reliabilityProfile,
      "Lecture Note",
      { mode: "exam" },
    );

    expect(concise.summary).toContain(
      "<!-- intelligence-engine:v2.5;mode:concise -->",
    );
    expect(exam.summary).toContain(
      "<!-- intelligence-engine:v2.5;mode:exam -->",
    );
    expect(concise.summary.length).toBeLessThan(notes.summary.length);
    expect(sectionBullets(concise.summary, "Key Points")).toHaveLength(5);
    expect(sectionBullets(exam.summary, "Key Points").length).toBeLessThanOrEqual(10);
    expect(exam.importantConcepts.length).toBeLessThanOrEqual(12);
    expect(exam.summary).toMatch(/Warnings and Common Mistakes/);
  });

  it("builds each learning-path section from its own grounded facts", () => {
    const graph = buildGroundedKnowledgeGraph(result.grounding);
    const commonMistakes = graph.nodes.find(
      (node) =>
        node.type === "section" &&
        node.label.includes("Common Mistakes Students Make"),
    );
    expect(commonMistakes).toBeDefined();

    const childIds = new Set(
      graph.edges
        .filter(
          (edge) =>
            edge.from === commonMistakes?.id &&
            edge.type === "contains",
        )
        .map((edge) => edge.to),
    );
    const childLabels = graph.nodes
      .filter((node) => childIds.has(node.id))
      .map((node) => node.label);

    expect(childLabels).toEqual(
      expect.arrayContaining([
        "Presenting diagrams without explanation",
        "Using too much technical jargon",
        "Not connecting analysis back to the SRS",
        "Ignoring non-functional requirements",
      ]),
    );
    expect(childLabels).not.toContain("Functional Requirements");
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
    .map((line) =>
      line
        .replace(/^-\s+/, "")
        .replace(/\s+_\(p\.\s+\d+\)_$/, "")
        .trim(),
    );
}

function subsectionBullets(markdown: string, heading: string): string[] {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markdown.match(
    new RegExp(`### ${escapedHeading} \\(p{1,2}\\. [^)]+\\)\\n([\\s\\S]*?)(?=\\n\\n### |\\n\\n## |$)`),
  );

  return (match?.[1] ?? "")
    .split("\n")
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim());
}

function splitAtHeadings(text: string, headings: string[]): string[] {
  const pages: string[] = [];
  let start = 0;

  for (const heading of headings) {
    const boundary = text.indexOf(heading, start);

    if (boundary < 0) {
      throw new Error(`Fixture heading was not found: ${heading}`);
    }

    pages.push(text.slice(start, boundary).trim());
    start = boundary;
  }

  pages.push(text.slice(start).trim());
  return pages;
}
