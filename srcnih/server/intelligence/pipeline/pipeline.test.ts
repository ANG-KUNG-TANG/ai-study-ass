/**
 * Executable evidence-grounding smoke test.
 * Run: npx tsx src/server/intelligence/pipeline/pipeline.test.ts
 */
import { runPipeline } from "./index";
import type { RawDocument } from "./types";

const PAPER: RawDocument = {
  fileName: "Improved_software_defect_prediction.pdf",
  mimeType: "application/pdf",
  fileSize: 250_000,
  pageCount: 10,
  rawText: `Improved Software Defect Prediction
Martin Neil and Norman Fenton

Abstract
Although a number of approaches have been taken to quality prediction for software, none have achieved widespread applicability. This paper describes a single model to combine the diverse forms of, often causal, evidence available in software development. We use Bayesian Networks as the appropriate formalism for representing defect introduction, detection and removal processes throughout any life-cycle. The approach combines subjective judgements from experienced project managers and available defect rate data to produce a risk map. The resulting model is packaged within a commercial software tool, AgenaRisk. We have found 95% correlation between actual and predicted defects.

1. INTRODUCTION
Project managers use a BN-based tool such as AID to help decide when to stop testing and release software. Causal models are important because they allow all the evidence to be taken into account.

2. DEFECT PREDICTION WITH BNs
A Bayesian network (BN) is a graph together with an associated set of probability tables. The nodes represent uncertain variables and the arcs represent causal relationships.

3. MODELLING THE LIFECYCLE
We express the set of phases as a Dynamic Bayesian Network (DBN). The quality attribute is the number of residual defects.

6. VALIDATION
Initially, 116 consumer electronics software projects were assessed for inclusion in the trial. Thirty-two projects were identified as suitable for the trial. Predictions were compared with the actual number of defects found in testing.

6.2 Results
0-30% inaccuracy in predictions was achieved on 65% of projects. The linear correlation coefficient is 95%.

7. CONCLUSIONS
A retrospective trial of 32 projects showed a good fit between predicted and actual defect counts. In future, we hope to combine the two models into a single decision support system.

REFERENCES
[1] AgenaRisk.
`,
};

const result = runPipeline(PAPER);
const core = result.knowledge;
const validClaims = core.claims.filter((claim) => claim.validationStatus === "valid");

console.log("Document kind:", core.documentProfile.kind);
console.log("Method:", core.method);
console.log("Dataset:", core.dataset);
console.log("Accuracy:", core.accuracy);
console.log("Results:", validClaims.filter((claim) => claim.type === "result").map((claim) => ({ metric: claim.metric, value: claim.numericValue })));
console.log("Concepts:", core.concepts.filter((concept) => concept.valid).slice(0, 12).map((concept) => concept.term));
console.log("Validation:", core.validation);

const conceptTerms = core.concepts.map((concept) => concept.term.toLowerCase());
const resultClaims = validClaims.filter((claim) => claim.type === "result");

const checks: Array<[string, boolean]> = [
  ["research paper classified", core.documentProfile.kind === "research_paper"],
  ["Bayesian Network method extracted", core.method?.toLowerCase().includes("bayesian network") ?? false],
  ["no invented dataset", core.dataset === null],
  ["correlation not converted into accuracy", core.accuracy === null],
  ["95% correlation preserved", resultClaims.some((claim) => claim.numericValue === 95 && claim.metric?.includes("correlation"))],
  ["32-project sample extracted", validClaims.some((claim) => claim.type === "sample" && claim.numericValue === 32)],
  ["GAN not extracted", !conceptTerms.includes("gan")],
  ["NER not extracted", !conceptTerms.includes("ner")],
  ["standalone numbers rejected", !conceptTerms.some((term) => /^\d+%?$/.test(term))],
  ["valid claims are evidence-grounded", validClaims.every((claim) => claim.evidence.length > 0)],
  ["later results section retained", result.document.sections.some((section) => section.title === "results")],
];

let passed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (ok) passed += 1;
}
console.log(`${passed}/${checks.length} checks passed`);
if (passed !== checks.length) process.exit(1);
