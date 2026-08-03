import assert from "node:assert/strict";
import { runPipeline } from "../pipeline";

const text = `
An Empirical Study towards dealing with Noise and Class Imbalance issues in Software Defect Prediction

Abstract
The quality of defect datasets is a critical issue in software defect prediction. Class imbalance and noisy instances can lead to inconsistent results. This paper evaluates the impact of noise and class imbalance on five baseline software defect prediction models. Noise levels from 0% to 80% are added and the models are evaluated using True Positive Rate, False Positive Rate and Receiver Operating Characteristic values.

1. Introduction
Software defect prediction uses software metrics and machine learning to identify fault-prone modules. Existing datasets may contain inconsistent bug labels and imbalanced classes.

2. Methodology
We evaluate five baseline models under controlled noise levels and class-imbalance conditions. The experiments compare model tolerance and predictive performance.

3. Results
True Positive Rate and False Positive Rate decrease between 20% and 30% after adding 10% to 40% noisy instances. ROC values reduce by 40% to 50%.

4. Conclusion
The study provides guidelines for tolerable noise ranges and identifies the model with the highest noise tolerance.

References
Example reference.
`;

const result = runPipeline({
  rawText: text,
  fileName: "An_empirical_study_toward_dealing_with_n.pdf",
  mimeType: "application/pdf",
  fileSize: 4_000,
  pageCount: 4,
});

assert.equal(result.profile.classification.kind, "research_paper");
assert.equal(result.profile.classification.domain, "software_engineering");
assert.equal(result.profile.classification.taskType, "software_defect_prediction_analysis");
assert.match(result.profile.title.value, /Empirical Study/i);
assert.ok(result.profile.concepts.some((concept) => /Class Imbalance/i.test(concept.term)));
assert.ok(result.profile.concepts.some((concept) => /Software Defect Prediction/i.test(concept.term)));
assert.ok(result.profile.textQuality.passed);
assert.ok(result.profile.qualityScore >= 0.72);
assert.ok(!result.document.cleanText.includes("Example reference"));

console.log(`research-paper reliability score: ${result.profile.qualityScoreOutOf10}/10`);
