import {
  GROUNDING_SCHEMA_VERSION,
  type AtomicFact,
  type GroundedKnowledge,
  type ImportantConcept,
} from "@/server/intelligence/grounding";
import {
  buildLearningEvidenceProfile,
  isLearningConceptEligible,
  toLearningGrounding,
} from "@/server/services/quality/learning-evidence.service";
import {
  canonicalizeStudyConceptLabel,
  isValidConcept,
} from "@/server/intelligence/reliability/concept-validator";

function fact(input: {
  id: string;
  sectionId: string;
  content: string;
  type?: AtomicFact["type"];
  importance?: number;
  page?: number;
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
      pageNumber: input.page ?? 1,
      text: input.content,
    }],
    evidenceType: "stated",
    verificationStatus: "supported",
    confidence: 0.96,
    importanceScore: input.importance ?? 0.82,
    numericTokens: input.content.match(/\b\d+(?:\.\d+)*(?:%|\/\d+)?\b/gu) ?? [],
  };
}

function concept(
  name: string,
  evidenceText: string,
  importance = 0.9,
): ImportantConcept {
  return {
    name,
    normalizedName: name.toLocaleLowerCase(),
    explanation: evidenceText,
    sourceSectionIds: ["s1"],
    evidence: [{
      id: `concept-${name}`,
      sectionId: "s1",
      sectionTitle: "Core Concepts",
      pageNumber: 1,
      text: evidenceText,
    }],
    importanceScore: importance,
  };
}

function grounding(): GroundedKnowledge {
  const facts = [
    fact({
      id: "raw-gateway",
      sectionId: "s1",
      content: "The default gateway is 10.10.10.0.",
      importance: 0.72,
    }),
    fact({
      id: "gateway-correction",
      sectionId: "s1",
      type: "warning",
      content: "In a /24 network, 10.10.10.0 is the network address and normally cannot be the default gateway; use 10.10.10.254 instead.",
      importance: 0.99,
    }),
    fact({
      id: "definition",
      sectionId: "s2",
      type: "definition",
      content: "DNS resolves a domain name to an IP address.",
      importance: 0.98,
      page: 2,
    }),
    fact({
      id: "procedure",
      sectionId: "s3",
      type: "procedure_step",
      content: "Configure the client with the address of its DNS server.",
      importance: 0.86,
      page: 3,
    }),
    fact({
      id: "ui",
      sectionId: "s4",
      content: "Click Desktop >> IP Configuration and select Static.",
      importance: 0.4,
      page: 4,
    }),
    fact({
      id: "example",
      sectionId: "s5",
      type: "example",
      content: "A sample account is used only as an example of the concept.",
      importance: 0.4,
      page: 5,
    }),
  ];

  return {
    schemaVersion: GROUNDING_SCHEMA_VERSION,
    pipelineVersion: "intelligence-v2.7",
    sourceHash: "fixture",
    documentKind: "technical_documentation",
    sourceLanguage: "en",
    facts,
    keyTerms: [],
    concepts: [
      concept("DNS", "DNS resolves a domain name to an IP address.", 0.99),
      concept("HTTP", "HTTP transfers web content between a client and server.", 0.96),
      concept("Step 1", "Step 1: configure the client.", 0.4),
      concept("There", "There are two networks.", 0.3),
      concept("The DNS server translates", "The DNS server translates a website name.", 0.4),
      concept("Desktop", "Click Desktop >> IP Configuration.", 0.2),
    ],
    sections: [
      { sectionId: "s1", heading: "Addressing", status: "covered", factIds: ["raw-gateway", "gateway-correction"], sourceUnitCount: 2, omittedUnitCount: 0 },
      { sectionId: "s2", heading: "Name Resolution", status: "covered", factIds: ["definition"], sourceUnitCount: 1, omittedUnitCount: 0 },
      { sectionId: "s3", heading: "Configuration Process", status: "covered", factIds: ["procedure"], sourceUnitCount: 1, omittedUnitCount: 0 },
      { sectionId: "s4", heading: "Desktop", status: "covered", factIds: ["ui"], sourceUnitCount: 1, omittedUnitCount: 0 },
      { sectionId: "s5", heading: "Example", status: "covered", factIds: ["example"], sourceUnitCount: 1, omittedUnitCount: 0 },
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

describe("shared learning evidence profile", () => {
  it("keeps short technical acronyms as valid concepts and canonicalises their casing", () => {
    expect(isValidConcept("DNS")).toBe(true);
    expect(isValidConcept("IP")).toBe(true);
    expect(canonicalizeStudyConceptLabel("Dns")).toBe("DNS");
    expect(canonicalizeStudyConceptLabel("http")).toBe("HTTP");
  });

  it("rejects labels and sentence fragments without hard-coding a document topic", () => {
    expect(isLearningConceptEligible(concept("Step 1", "Step 1: configure the client."))).toBe(false);
    expect(isLearningConceptEligible(concept("There", "There are two networks."))).toBe(false);
    expect(isLearningConceptEligible(concept("The DNS server translates", "The DNS server translates a website name."))).toBe(false);
    expect(isLearningConceptEligible(concept("DNS", "DNS resolves a domain name to an IP address."))).toBe(true);
  });

  it("treats a UI word as noise only when its evidence is actually UI navigation", () => {
    expect(isLearningConceptEligible(concept("Desktop", "Click Desktop >> IP Configuration."))).toBe(false);
    expect(isLearningConceptEligible(concept("Desktop", "A desktop is a graphical workspace that organizes application windows and files."))).toBe(true);
  });

  it("gives an explicit correction precedence over the raw value it qualifies", () => {
    const profile = buildLearningEvidenceProfile(grounding());

    expect(profile.suppressedFactIds.has("raw-gateway")).toBe(true);
    expect(profile.facts.map((item) => item.id)).not.toContain("raw-gateway");
    expect(profile.warningFacts.map((item) => item.id)).toContain("gateway-correction");
  });

  it("removes examples and source-UI scaffolding from feature generation evidence", () => {
    const learning = toLearningGrounding(grounding());
    const factIds = learning.facts.map((item) => item.id);
    const conceptNames = learning.concepts.map((item) => item.name);

    expect(factIds).not.toContain("example");
    expect(factIds).not.toContain("ui");
    expect(conceptNames).toEqual(expect.arrayContaining(["DNS", "HTTP"]));
    expect(conceptNames).not.toEqual(expect.arrayContaining(["Step 1", "There", "The DNS server translates", "Desktop"]));
  });
});
