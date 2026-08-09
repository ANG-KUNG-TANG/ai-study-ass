import type { SectionedDocument } from "../pipeline/types";
import type {
  RequirementItem,
  RequirementsDocumentProfile,
} from "./types";
import { normaliseLine } from "./text-quality";

const ACTOR_PATTERNS: Array<[RegExp, string]> = [
  [/\bcustomer(?:s)?\b/i, "Customer"],
  [/\bcashier(?:s)?\b/i, "Cashier"],
  [/\bkitchen staff\b/i, "Kitchen Staff"],
  [/\brestaurant owner\b/i, "Restaurant Owner"],
  [/\bcounter manager\b/i, "Counter Manager"],
  [/\bchef(?:s)?\b/i, "Chef"],
];

const DIAGRAM_PATTERNS: Array<[RegExp, string]> = [
  [/\buse case diagram\b/i, "Use Case Diagram"],
  [/\bactivity diagram\b/i, "Activity Diagram"],
  [/\bdata flow diagram\b|\bdfd(?:-\d+)?\b/i, "Data Flow Diagram"],
  [/\bclass diagram\b/i, "Class Diagram"],
  [/\bobject diagram\b/i, "Object Diagram"],
];

const PROCESS_VERB_RE = /^(?:select|carry|weigh|calculate|write|make|accept|issue|pass|read|receive|prepare|cross-check|serve|collect|tally|record|route|confirm|retrieve|cook|assemble|plate)\b/i;

function unique(values: string[], limit = Number.POSITIVE_INFINITY): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const cleaned = normaliseLine(value)
      .replace(/^[-–—•*]+\s*/, "")
      .replace(/^\d+[.)]\s*/, "")
      .trim();
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key)) continue;
    seen.add(key);
    output.push(cleaned);
    if (output.length >= limit) break;
  }
  return output;
}

function extractRequirements(text: string): RequirementItem[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  const pattern = /\b(FR\d+(?:\.\d+)*)\s+(M|S|C|W)\s+(.+?)(?=\s+FR\d+(?:\.\d+)*\s+(?:M|S|C|W)\s+|$)/gi;
  const output: RequirementItem[] = [];
  const seen = new Set<string>();

  for (const match of normalized.matchAll(pattern)) {
    const id = match[1].toUpperCase();
    const statement = match[3]
      .replace(/\s+/g, " ")
      .replace(/\s+(?:Use Case Diagram|Activity Diagram|Data Flow Diagram).*$/i, "")
      .trim();
    if (statement.length < 12 || seen.has(id)) continue;
    seen.add(id);
    output.push({
      id,
      priority: match[2].toUpperCase() as RequirementItem["priority"],
      statement,
      evidence: `${id} ${match[2].toUpperCase()} ${statement}`,
    });
  }

  return output.slice(0, 60);
}

function extractObjectives(doc: SectionedDocument): string[] {
  const sections = doc.sections.filter(
    (section) => section.semanticRole === "objectives" || /objective/i.test(section.rawHeading),
  );
  const candidates: string[] = [];
  const objectiveVerb = /^(?:provide|serve|receive|accept|prepare|offer|determine|deliver|maintain|support|improve|reduce|ensure)\b/i;

  for (const section of sections) {
    let current = "";
    const flush = () => {
      const line = normaliseLine(current).replace(/^[-–—•*]+\s*/, "").trim();
      if (line.length >= 12 && line.length <= 360 && objectiveVerb.test(line)) candidates.push(line);
      current = "";
    };

    for (const rawLine of section.body.split(/\n+/)) {
      const raw = normaliseLine(rawLine).trim();
      const line = raw.replace(/^[-–—•*]+\s*/, "").trim();
      if (!line || /^[-–—•*]+$/.test(raw)) continue;
      if (/^(?:service|product|business) objectives?$/i.test(line)) {
        flush();
        continue;
      }

      if (objectiveVerb.test(line)) {
        flush();
        current = line;
      } else if (current && !/^[A-Z][A-Za-z ]{2,40}:?$/.test(line)) {
        current = `${current} ${line}`;
      }
    }
    flush();
  }

  return unique(candidates, 20);
}

function extractActors(doc: SectionedDocument): string[] {
  const relevantText = doc.sections
    .filter((section) => !["metadata", "appendix", "references"].includes(section.semanticRole))
    .map((section) => section.analysisBody)
    .join("\n");

  const actors: string[] = [];
  for (const [pattern, label] of ACTOR_PATTERNS) {
    if (pattern.test(relevantText)) actors.push(label);
  }
  return unique(actors, 12);
}

function extractProcessSteps(doc: SectionedDocument): string[] {
  const primarySections = doc.sections.filter((section) =>
    section.semanticRole === "process" ||
    /use case diagram|activity diagram|full story|process|workflow/i.test(section.rawHeading),
  );
  const secondarySections = doc.sections.filter((section) =>
    section.semanticRole === "diagram" &&
    /data flow diagram|dfd/i.test(section.rawHeading),
  );
  const steps: string[] = [];

  const collect = (sections: typeof doc.sections) => {
    for (const section of sections) {
      for (const rawLine of section.body.split(/\n+/)) {
        const line = normaliseLine(rawLine)
          .replace(/^\d+(?:\.\d+)*\s*/, "")
          .replace(/^[-–—•*]+\s*/, "")
          .replace(/\s+(?:written to|printed as|read by kitchen|handoff)(?:\s.*)?$/i, "")
          .trim();
        const words = line.split(/\s+/).filter(Boolean);
        if (line.length < 8 || line.length > 100 || words.length > 12) continue;
        if (/\b[a-z]\d+[a-z]|[a-z]\d+\.[a-z]|\d+[a-z]{2,}\b/i.test(line)) continue;
        if (PROCESS_VERB_RE.test(line)) steps.push(line);
      }
    }
  };

  collect(primarySections);
  if (unique(steps).length < 6) collect(secondarySections);
  return unique(steps, 24);
}

function extractDiagramTypes(doc: SectionedDocument): string[] {
  const text = doc.sections.map((section) => `${section.rawHeading}\n${section.body}`).join("\n");
  const diagrams: string[] = [];
  for (const [pattern, label] of DIAGRAM_PATTERNS) {
    if (pattern.test(text)) diagrams.push(label);
  }
  return unique(diagrams, 8);
}

export function extractRequirementsDocument(
  doc: SectionedDocument,
): RequirementsDocumentProfile {
  const requirementsText = doc.sections
    .filter((section) => section.semanticRole === "requirements" || /functional requirements/i.test(section.rawHeading))
    .map((section) => `${section.rawHeading}\n${section.body}`)
    .join("\n") || doc.analysisText;

  const priorityScheme = /MoSCoW/i.test(doc.analysisText)
    ? "MoSCoW: M = Must have, S = Should have, C = Could have, W = Won't have"
    : null;

  return {
    objectives: extractObjectives(doc),
    requirements: extractRequirements(requirementsText),
    actors: extractActors(doc),
    processSteps: extractProcessSteps(doc),
    diagramTypes: extractDiagramTypes(doc),
    priorityScheme,
  };
}
