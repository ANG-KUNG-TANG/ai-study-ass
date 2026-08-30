import type {
  DocumentSection,
} from "./types";
import type {
  TextUnitKind,
} from "./text-units";

const ADMIN_METADATA_RE =
  /^(?:student(?:\s+(?:name|id))?|course(?:\s+code)?|section|class|lecturer|instructor|teacher|date)\s*[:#-]\s*/iu;

const SIMPLE_NAVIGATION_RE =
  /^(?:home|contact us|about us|privacy policy|terms(?: of (?:use|service))?|sign in|log in|login|sign up|register|menu|search|next|previous)$/iu;

const NAVIGATION_TOKENS = new Set([
  "home",
  "whiteboard",
  "online",
  "compiler",
  "compilers",
  "practice",
  "articles",
  "article",
  "tutorial",
  "tutorials",
  "assistant",
  "courses",
  "course",
  "login",
  "register",
  "menu",
  "search",
]);

const WEB_TECH_TOKENS = new Set([
  "sql",
  "html",
  "css",
  "javascript",
  "typescript",
  "python",
  "java",
  "c",
  "c++",
  "c#",
  "php",
  "scala",
  "ruby",
  "go",
  "rust",
  "swift",
  "kotlin",
]);

const PROMOTION_PRIMARY_RE =
  /\b(?:subscribe|buy|shop|free trial|get started|book now|download now|limited offer|foreign-friendly|company formation|register your)\b/iu;

const PROMOTION_SECONDARY_RE =
  /\b(?:online|today|now|free|discount|offer|fast|remote)\b|%/iu;

const PRESENTATION_ARTIFACT_RE =
  /^(?:(?:the\s+)?(?:following|above|below)\s+(?:figure|diagram|table)\s+(?:shows?|illustrates?|depicts?)|figure\s+(?:shows?|illustrates?|depicts?)|image\s+source\b|click\s+here\b)/iu;

const GENERIC_STRUCTURAL_HEADING_RE =
  /^(?:example|examples|illustration|illustrations|figure|figures|diagram|diagrams)$/iu;

const TRAILING_PARENT_RE =
  /(?:[:：]|[-–—−])\s*$/u;

const RELATIVE_FRAGMENT_RE =
  /^[^,]{1,48},\s+(?:which|that)\s+(?:is|are|was|were|can|may|will|has|have)\b/iu;

const SUBORDINATE_START_RE =
  /^(?:although|though|because|while|whereas)\b/iu;

const FINITE_VERB_RE =
  /\b(?:is|are|was|were|means|refers|defines|describes|shows|uses|allows|requires|provides|contains|includes|connects|represents|models|depicts|has|have|can|may|must|should|will|does|do)\b/iu;

const TECHNICAL_TAILS = new Set([
  "analysis",
  "model",
  "models",
  "design",
  "diagram",
  "diagrams",
  "system",
  "systems",
  "machine",
  "machines",
  "state",
  "states",
  "transition",
  "transitions",
  "object",
  "objects",
  "class",
  "classes",
  "account",
  "accounts",
  "method",
  "methods",
  "process",
  "processes",
  "requirement",
  "requirements",
  "association",
  "associations",
  "interface",
  "interfaces",
  "component",
  "components",
  "package",
  "packages",
  "event",
  "events",
  "action",
  "actions",
  "activity",
  "activities",
  "flow",
  "flows",
  "store",
  "stores",
  "modelling",
  "modeling",
  "programming",
  "inheritance",
  "polymorphism",
  "encapsulation",
  "abstraction",
  "concurrency",
  "persistence",
  "hierarchy",
  "typing",
  "modularity",
]);

const CONCEPT_KEY_ALIASES = new Map<string, string>([
  ["ooad", "object oriented analysis and design"],
  ["object oriented analysis and design", "object oriented analysis and design"],
  ["ooa", "object oriented analysis"],
  ["objectoriented analysis", "object oriented analysis"],
  ["object oriented analysis", "object oriented analysis"],
  ["ood", "object oriented design"],
  ["objectoriented design", "object oriented design"],
  ["object oriented design", "object oriented design"],
]);

const PLURAL_CANONICAL = new Map<string, string>([
  ["machines", "machine"],
  ["diagrams", "diagram"],
  ["models", "model"],
  ["systems", "system"],
  ["objects", "object"],
  ["classes", "class"],
  ["states", "state"],
  ["transitions", "transition"],
  ["actors", "actor"],
  ["processes", "process"],
  ["methods", "method"],
  ["requirements", "requirement"],
  ["associations", "association"],
  ["interfaces", "interface"],
  ["components", "component"],
  ["packages", "package"],
  ["events", "event"],
  ["actions", "action"],
  ["activities", "activity"],
  ["flows", "flow"],
  ["stores", "store"],
  ["accounts", "account"],
]);

export function cleanStudyAnalysisText(
  value: string,
): string {
  const kept: string[] = [];

  for (const rawLine of value
    .replace(/\r\n?/gu, "\n")
    .split("\n")) {
    const line = rawLine
      .replace(/[ \t]+/gu, " ")
      .trim();

    if (!line) {
      if (
        kept.length > 0 &&
        kept.at(-1) !== ""
      ) {
        kept.push("");
      }
      continue;
    }

    if (isStudyNoiseLine(line)) {
      continue;
    }

    kept.push(line);
  }

  return kept
    .join("\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

export function isStudyNoiseLine(
  value: string,
): boolean {
  const text = value
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim();

  if (!text) return true;

  if (
    ADMIN_METADATA_RE.test(text) ||
    SIMPLE_NAVIGATION_RE.test(text) ||
    PRESENTATION_ARTIFACT_RE.test(text)
  ) {
    return true;
  }

  if (
    PROMOTION_PRIMARY_RE.test(text) &&
    PROMOTION_SECONDARY_RE.test(text)
  ) {
    return true;
  }

  if (looksLikeNavigationCluster(text)) {
    return true;
  }

  if (/^figure\s+shows?\b/iu.test(text)) {
    return true;
  }

  return false;
}

export function looksLikeNavigationCluster(
  value: string,
): boolean {
  const text = value
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim();

  if (
    !text ||
    /[.!?]/u.test(text)
  ) {
    return false;
  }

  const tokens = text
    .split(/\s+/u)
    .map((token) =>
      token
        .replace(/^[^\p{L}\p{N}+#]+|[^\p{L}\p{N}+#]+$/gu, "")
        .toLocaleLowerCase(),
    )
    .filter(Boolean);

  if (tokens.length < 4) {
    return false;
  }

  const navigationCount =
    tokens.filter((token) =>
      NAVIGATION_TOKENS.has(token),
    ).length;

  if (navigationCount >= 3) {
    return true;
  }

  const technologyCount =
    tokens.filter((token) =>
      WEB_TECH_TOKENS.has(token),
    ).length;

  return (
    tokens.length >= 7 &&
    technologyCount / tokens.length >= 0.72
  );
}

export function isIncompleteStudyUnit(
  value: string,
): boolean {
  const text = value
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim();

  if (!text) return true;

  if (TRAILING_PARENT_RE.test(text)) {
    return true;
  }

  if (RELATIVE_FRAGMENT_RE.test(text)) {
    const commaIndex = text.indexOf(",");
    const tail = commaIndex >= 0
      ? text.slice(commaIndex + 1)
      : text;

    const secondClause =
      tail.match(/,\s+(.+)$/u)?.[1] ?? "";

    if (
      !secondClause ||
      !FINITE_VERB_RE.test(secondClause)
    ) {
      return true;
    }
  }

  if (SUBORDINATE_START_RE.test(text)) {
    const commaIndex = text.indexOf(",");

    if (commaIndex < 0) {
      return true;
    }

    const mainClause =
      text.slice(commaIndex + 1).trim();

    if (
      mainClause.split(/\s+/u).length < 4 ||
      !FINITE_VERB_RE.test(mainClause)
    ) {
      return true;
    }
  }

  return false;
}

export function isStudyEligibleUnit(
  value: string,
  _kind?: TextUnitKind,
): boolean {
  const text = value
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim();

  if (
    text.length < 4 ||
    !/\p{L}/u.test(text)
  ) {
    return false;
  }

  return (
    !isStudyNoiseLine(text) &&
    !isIncompleteStudyUnit(text)
  );
}

export function isGenericStructuralHeading(
  value: string,
): boolean {
  return GENERIC_STRUCTURAL_HEADING_RE.test(
    value.trim(),
  );
}

export function hasSubstantiveStudyText(
  value: string,
): boolean {
  const cleaned =
    cleanStudyAnalysisText(value);

  if (!cleaned) return false;

  return cleaned
    .split(/\n+/u)
    .some((line) => {
      const text = line.trim();

      return (
        text.length >= 12 &&
        isStudyEligibleUnit(text)
      );
    });
}

export function canonicalStudyConceptKey(
  value: string,
): string {
  let cleaned = value
    .normalize("NFKC")
    .replace(/\([^)]*\)/gu, " ")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}+#]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

  if (!cleaned) return "";

  cleaned = cleaned
    .replace(/\bobjectoriented\b/gu, "object oriented")
    .replace(/\s+/gu, " ")
    .trim();

  const alias =
    CONCEPT_KEY_ALIASES.get(cleaned);

  if (alias) return alias;

  const words = cleaned.split(" ");
  const last = words.at(-1);

  if (
    last &&
    PLURAL_CANONICAL.has(last)
  ) {
    words[words.length - 1] =
      PLURAL_CANONICAL.get(last)!;
  }

  return words.join(" ");
}

export function looksLikePersonName(
  value: string,
): boolean {
  const words = value
    .trim()
    .split(/\s+/u)
    .filter(Boolean);

  if (
    words.length < 2 ||
    words.length > 3
  ) {
    return false;
  }

  if (
    !words.every((word) =>
      /^[A-Z][A-Za-z'’-]+$/u.test(word),
    )
  ) {
    return false;
  }

  const last =
    words.at(-1)!.toLocaleLowerCase();

  return !TECHNICAL_TAILS.has(last);
}

export function normaliseStudySections(
  sections: DocumentSection[],
): DocumentSection[] {
  const output: DocumentSection[] = [];
  const seenExact =
    new Set<string>();

  for (const original of sections) {
    const section: DocumentSection = {
      ...original,
      analysisBody:
        cleanStudyAnalysisText(
          original.analysisBody,
        ),
    };

    const substantive =
      hasSubstantiveStudyText(
        section.analysisBody,
      );
    const noisyHeading =
      isStudyNoiseLine(
        section.rawHeading,
      );
    const genericHeading =
      isGenericStructuralHeading(
        section.rawHeading,
      );

    const sectionIndex =
      sections.indexOf(original);
    const nextSection =
      sections[sectionIndex + 1];
    const structuralParent =
      !substantive &&
      !noisyHeading &&
      !genericHeading &&
      Boolean(
        nextSection &&
        nextSection.level >
          section.level &&
        (
          !section.headingNumber ||
          !nextSection.headingNumber ||
          nextSection.headingNumber.startsWith(
            `${section.headingNumber}.`,
          )
        ) &&
        hasSubstantiveStudyText(
          nextSection.analysisBody,
        ),
      );

    if (
      !substantive &&
      output.length === 0 &&
      section.startOffset === 0 &&
      !noisyHeading &&
      !genericHeading
    ) {
      output.push({
        ...section,
        semanticRole: "title",
      });
      continue;
    }

    if (
      !substantive &&
      !structuralParent
    ) {
      continue;
    }

    if (
      noisyHeading ||
      genericHeading
    ) {
      const previous =
        output.at(-1);

      if (previous) {
        previous.body =
          [previous.body, section.body]
            .filter(Boolean)
            .join("\n");
        previous.analysisBody =
          [
            previous.analysisBody,
            section.analysisBody,
          ]
            .filter(Boolean)
            .join("\n");
        previous.endOffset =
          Math.max(
            previous.endOffset,
            section.endOffset,
          );
        previous.pageEnd =
          section.pageEnd ??
          previous.pageEnd;
        continue;
      }

      section.rawHeading =
        "Document";
      section.title =
        "other";
      section.semanticRole =
        "other";
    }

    const exactKey = [
      canonicalHeading(
        section.rawHeading,
      ),
      normaliseForExact(
        section.analysisBody,
      ),
    ].join("|");

    if (seenExact.has(exactKey)) {
      continue;
    }

    seenExact.add(exactKey);
    output.push(section);
  }

  return output;
}

function canonicalHeading(
  value: string,
): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function normaliseForExact(
  value: string,
): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\s+/gu, " ")
    .trim();
}
