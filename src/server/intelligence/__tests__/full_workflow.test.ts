import { runPipeline } from "../engine";
import { ontologyCache } from "../ontology/ontology.cache";
import type { RawDocument } from "../pipeline/types";
import type { AIGenerateFn } from "../types";

const DEFECT_PAPER: RawDocument = {
  fileName: "defect-paper.pdf",
  mimeType: "application/pdf",
  fileSize: 1000,
  pageCount: 10,
  rawText: `Abstract
Although approaches have been taken to quality prediction for software, none have achieved widespread applicability. We use Bayesian Networks as the appropriate formalism for representing defect introduction, detection and removal. AgenaRisk is used as a decision support tool. We have found 95% correlation between actual and predicted defects.

1. Introduction
Causal models allow conflicting evidence to be taken into account.

2. Method
A Bayesian Network (BN) combines empirical data and expert judgement. A Dynamic Bayesian Network (DBN) links lifecycle phases.

6. Validation
Initially, 116 software projects were assessed. Thirty-two projects were suitable for the trial.

6.2 Results
The linear correlation coefficient is 95%. 0-30% inaccuracy was achieved on 65% of projects.

7. Conclusions
A retrospective trial of 32 projects showed a good fit between predicted and actual defect counts.

References
[1] Example reference.`,
};

const REPAIRABLE_REPORT: RawDocument = {
  fileName: "restaurant-report.txt",
  mimeType: "text/plain",
  fileSize: 420,
  rawText: `Executive Summary
Manual order recording causes order errors during peak service.

Business Objective
The objective is to reduce order errors during peak service.

Recommendation
The restaurant should standardize order checks before tickets reach the kitchen.`,
};

const groundedRepair: AIGenerateFn = async () => ({
  text: JSON.stringify({
    claims: [
      {
        type: "objective",
        subject: "Restaurant report",
        predicate: "aims to",
        object: "reduce order errors during peak service",
        evidenceText:
          "The objective is to reduce order errors during peak service.",
        confidence: 0.86,
      },
    ],
  }),
  provider: "openai",
});

describe("Evidence-grounded workflow", () => {
  beforeAll(() => ontologyCache.load());

  test("ontology contains software-defect concepts", () => {
    expect(ontologyCache.resolve("Bayesian Network").concept.id).toBe(
      "bayesian_network",
    );
    expect(
      ontologyCache.resolve("software defect prediction").concept.id,
    ).toBe("software_defect_prediction");
  });

  test("preserves correlation semantics and exposes every stage", async () => {
    const events: string[] = [];
    const result = await runPipeline({
      noteId: "defect-paper",
      document: DEFECT_PAPER,
      onProgress: (event) => {
        events.push(`${event.stage}:${event.status}`);
      },
    });

    expect(result.stage).toBe("complete");
    expect(result.core.method?.toLowerCase()).toContain("bayesian network");
    expect(result.core.dataset).toBeNull();
    expect(result.core.accuracy).toBeNull();
    expect(result.core.claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "sample",
          numericValue: 32,
          validationStatus: "valid",
        }),
        expect.objectContaining({
          type: "result",
          numericValue: 95,
          metric: expect.stringContaining("correlation"),
        }),
      ]),
    );
    expect(result.stageProgress.at(-1)?.stage).toBe("complete");
    expect(events).toContain("claim_validation:complete");
    expect(events).toContain("graph_construction:complete");
    expect(result.graph.nodes.size).toBeGreaterThan(5);
  });

  test("AI repair accepts a missing claim only with exact source evidence", async () => {
    const result = await runPipeline({
      noteId: "repairable-report",
      document: REPAIRABLE_REPORT,
      aiGenerate: groundedRepair,
      aiFallbackThreshold: 0.99,
    });

    expect(result.stage).toBe("complete");
    expect(
      result.core.claims.some(
        (claim) =>
          claim.type === "objective" &&
          claim.extractionSource === "ai",
      ),
    ).toBe(true);
    expect(result.aiFallback.used).toBe(true);
  });

  test("unsupported AI evidence is rejected", async () => {
    const badRepair: AIGenerateFn = async () => ({
      text: JSON.stringify({
        claims: [
          {
            type: "method",
            subject: "Document",
            predicate: "uses",
            object: "GAN",
            evidenceText: "The document uses a GAN model.",
          },
        ],
      }),
    });

    const result = await runPipeline({
      noteId: "bad-repair",
      document: REPAIRABLE_REPORT,
      aiGenerate: badRepair,
      aiFallbackThreshold: 0.99,
    });

    expect(result.core.method).toBeNull();
    expect(result.aiFallback.used).toBe(false);
  });
});
