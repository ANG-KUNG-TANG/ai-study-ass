import type {
  DocumentKind,
  DocumentProfile,
  ExpectedFieldDefinition,
} from "../types";
import type { SectionedDocument } from "./types";

export function classifyDocument(doc: SectionedDocument): DocumentProfile {
  const text = doc.analysisText.toLowerCase();
  const headings = doc.sections.map((section) => section.rawHeading.toLowerCase());
  const reasons: string[] = [];
  const isBusinessRequirementsDocument = /\bbusiness requirements document\b|\bfunctional requirements\b|\bmoscow priority\b/.test(text) &&
    /\buse case diagram\b|\bdata flow diagram\b|\bactivity diagram\b|\bclass diagram\b/.test(text);

  let kind: DocumentKind = "unknown";
  let confidence = 0.45;

  const researchSignals = [
    doc.hasAbstract,
    headings.some((heading) => /references|bibliography/.test(heading)),
    headings.some((heading) => /method|approach|model|validation|experiment/.test(heading)),
    /\b(this paper|we propose|we present|our approach|experimental validation)\b/.test(text),
  ].filter(Boolean).length;

  const lectureSignals = [
    /\blearning objectives?\b/.test(text),
    headings.some((heading) => /lecture|lesson|week\s+\d+/.test(heading)),
    /\bexercise|quiz|review questions?\b/.test(text),
  ].filter(Boolean).length;

  const textbookSignals = [
    headings.some((heading) => /^chapter\s+\d+/.test(heading)),
    /\bchapter summary\b/.test(text),
    /\bworked example\b/.test(text),
  ].filter(Boolean).length;

  const technicalSignals = [
    /\bapi reference|installation|configuration|usage example\b/.test(text),
    /\bparameter|return value|endpoint|command line\b/.test(text),
  ].filter(Boolean).length;

  const reportSignals = [
    /\bexecutive summary\b/.test(text),
    headings.some((heading) => /recommendation|project overview|business objective|functional requirement/.test(heading)),
    /\bprepared for|prepared by\b/.test(text),
    isBusinessRequirementsDocument,
  ].filter(Boolean).length;

  const assignmentSignals = [
    /\bassignment|student id|submission date|answer sheet\b/.test(text),
    headings.some((heading) => /question\s+\d+|task\s+\d+/.test(heading)),
  ].filter(Boolean).length;

  const scores: Array<[DocumentKind, number]> = [
    ["research_paper", researchSignals],
    ["lecture_notes", lectureSignals],
    ["textbook_chapter", textbookSignals],
    ["technical_documentation", technicalSignals],
    ["project_report", reportSignals],
    ["assignment", assignmentSignals],
  ];

  scores.sort((a, b) => b[1] - a[1]);
  const [bestKind, bestScore] = scores[0];
  const secondScore = scores[1]?.[1] ?? 0;

  if (bestScore > 0) {
    kind = bestKind;
    confidence = Math.min(0.98, 0.55 + bestScore * 0.1 + Math.max(0, bestScore - secondScore) * 0.05);
  }

  if (isBusinessRequirementsDocument) {
    kind = "project_report";
    confidence = Math.max(confidence, 0.94);
  }

  if (kind === "research_paper") reasons.push("Abstract/research sections and paper-style language were detected.");
  if (kind === "lecture_notes") reasons.push("Teaching-oriented headings and learning signals were detected.");
  if (kind === "textbook_chapter") reasons.push("Chapter structure and worked-example signals were detected.");
  if (kind === "technical_documentation") reasons.push("API/configuration terminology was detected.");
  if (kind === "project_report") reasons.push("Report-style executive, objective, or requirements sections were detected.");
  if (isBusinessRequirementsDocument) reasons.push("Business-requirements structure, functional requirements, and UML/DFD diagram signals were detected.");
  if (kind === "assignment") reasons.push("Assignment/task and submission terminology was detected.");
  if (kind === "unknown") reasons.push("No document profile reached a strong classification threshold.");

  return {
    kind,
    ...(isBusinessRequirementsDocument ? { subtype: "business_requirements_document" as const } : {}),
    confidence,
    reasons,
    expectedFields: expectedFieldsFor(kind, isBusinessRequirementsDocument),
  };
}

function expectedFieldsFor(kind: DocumentKind, isBusinessRequirementsDocument = false): ExpectedFieldDefinition[] {
  const field = (
    name: ExpectedFieldDefinition["field"],
    required: boolean,
    applicable: boolean,
    reason: string,
  ): ExpectedFieldDefinition => ({ field: name, required, applicable, reason });

  if (isBusinessRequirementsDocument) {
    return [
      field("problem", true, true, "A BRD should explain the current business problem or pain points."),
      field("objective", true, true, "A BRD should state business, service, or product objectives."),
      field("definition", false, true, "Acronyms and domain terms may be defined in a glossary or appendix."),
      field("method", false, false, "A research method is not required for a business requirements document."),
      field("result", false, false, "Experimental results are not required for a business requirements document."),
      field("data_source", false, false, "A machine-learning dataset is not required for a business requirements document."),
    ];
  }

  switch (kind) {
    case "research_paper":
      return [
        field("problem", true, true, "A research paper should state the problem or motivation."),
        field("method", true, true, "A research paper should describe its approach or model."),
        field("data_source", false, true, "A named dataset may be absent in industrial or conceptual studies."),
        field("sample", false, true, "Evaluation may use projects, participants, systems, or documents."),
        field("metric", false, true, "Evaluation metrics are expected when empirical results are reported."),
        field("result", true, true, "A research paper should report findings or conclusions."),
        field("limitation", false, true, "Limitations improve study interpretation but may be implicit."),
        field("future_work", false, true, "Future work is optional."),
      ];
    case "lecture_notes":
    case "textbook_chapter":
      return [
        field("objective", false, true, "Learning material may provide explicit objectives."),
        field("definition", true, true, "Learning material should define central ideas."),
        field("method", false, true, "Procedures or methods may be taught."),
        field("result", false, false, "Experimental findings are not required for teaching material."),
        field("data_source", false, false, "A dataset is not required for teaching material."),
      ];
    case "technical_documentation":
      return [
        field("objective", true, true, "Documentation should explain the component's purpose."),
        field("method", false, true, "Implementation or usage procedures may be present."),
        field("tool", false, true, "Tools and technologies are often central."),
        field("definition", true, true, "Important interfaces and terms should be defined."),
        field("result", false, false, "Research results are not expected."),
      ];
    case "project_report":
      return [
        field("problem", true, true, "A report should explain the context or problem."),
        field("objective", true, true, "A report should state its objectives."),
        field("method", false, true, "A report may explain an implementation or process."),
        field("result", true, true, "A report should state outcomes or findings."),
        field("limitation", false, true, "Constraints may be reported."),
      ];
    case "assignment":
      return [
        field("objective", false, true, "The task or question supplies the objective."),
        field("definition", false, true, "Definitions may be required by the assignment."),
        field("method", false, true, "A solution procedure may be present."),
        field("result", false, true, "Answers may contain final results."),
      ];
    default:
      return [
        field("problem", false, true, "The document may describe a problem."),
        field("method", false, true, "The document may describe a method."),
        field("definition", false, true, "The document may define concepts."),
        field("result", false, true, "The document may contain findings."),
      ];
  }
}
