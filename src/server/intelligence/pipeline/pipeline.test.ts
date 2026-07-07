/**
 * End-to-end pipeline smoke test.
 * Run with: npx tsx src/server/intelligence/pipeline/pipeline.test.ts
 */
import { runPipeline } from "./index";
import type { RawDocument } from "./types";

const SAMPLE: RawDocument = {
  fileName: "cnn-paper.pdf",
  mimeType: "application/pdf",
  fileSize: 54321,
  pageCount: 8,
  rawText: `
Abstract

Image classification remains a fundamental chal-
lenge in computer vision. We propose a novel convolutional neural network (CNN)
architecture with residual connections for image classification.
Our model is trained on CIFAR-10 and achieves 96.2% accuracy, outperforming
existing methods [1]. We demonstrate that batch normalisation significantly
improves convergence (LeCun et al., 2021).

1

International Conference on Machine Learning 2024
International Conference on Machine Learning 2024

1. Introduction

Deep learning has transformed the field of computer vision [1,2]. Prior work
[Smith, 2020] showed that deeper networks outperform shallow ones. However,
training very deep networks suffers from the vanishing gradient problem.
In this paper, we present a new approach that addresses this limitation.
Our contribution is a lightweight CNN that achieves state-of-the-art results.

2

International Conference on Machine Learning 2024

2. Related Work

ResNet [3] introduced skip connections to solve the gradient problem.
BERT demonstrated that pre-training on large corpora improves downstream tasks.
GAN-based methods have been explored for data augmentation (Goodfellow et al., 2014).

3. Methodology

We propose a three-layer CNN with batch normalisa-
tion and dropout regularisation. The architecture uses 3×3 convolutions
with ReLU activations. We train using the Adam optimiser with learning rate 0.001.

Page 4

4. Experiments

We evaluate on the CIFAR-10 dataset, which contains 60,000 images across
10 classes. Accuracy is the primary evaluation metric. We also report F1.
Training is performed for 100 epochs with batch size 64.

5. Results

Our CNN achieves 96.2% accuracy on CIFAR-10, surpassing the previous
state-of-the-art of 95.1%. F1 score is 0.961. See Table 1 for comparisons.

6. Discussion

The results confirm that residual connections improve gradient flow.
One limitation of our approach is that it requires significant GPU memory.
The model does not handle class imbalance well.

7. Conclusion

We presented a novel CNN architecture for image classification.
The model achieves 96.2% accuracy on CIFAR-10.
In future work, we plan to explore transformer-based architectures and
extend the approach to object detection tasks.

References

LeCun, Y., Bengio, Y., & Hinton, G. (2015). Deep learning. Nature.
Smith, J. (2020). Residual networks. CVPR 2020.
He, K., et al. (2016). Deep residual learning. CVPR.
Goodfellow, I., et al. (2014). Generative adversarial nets. NeurIPS.
`,
};

// ─── Run ──────────────────────────────────────────────────────────────────────
console.log("Running pipeline...\n");
const result = runPipeline(SAMPLE);

console.log("═══ SECTIONS ════════════════════════════════════════");
for (const s of result.document.sections) {
  console.log(`  [${s.title.padEnd(15)}] "${s.rawHeading}" → ${s.body.slice(0, 60).replace(/\n/g, " ")}…`);
}

console.log("\n═══ KEYWORDS (TF-IDF top 10, from nlp result) ═══════");
console.log(" ", result.nlp.keywords.slice(0, 10).join(", "));

console.log("\n═══ ENTITIES (from nlp result) ═══════════════════════");
for (const e of result.nlp.entities.slice(0, 12)) {
  console.log(`  [${e.type.padEnd(10)}] ${e.text}`);
}

console.log("\n═══ TOP SENTENCES (TextRank) ════════════════════════");
for (const s of result.nlp.topSentences) {
  console.log(`  • ${s.slice(0, 90)}…`);
}

console.log("\n═══ KNOWLEDGE CORE (strict — feeds ontology/graph/prolog) ═══");
const k = result.knowledge;
console.log(`  method:        ${k.method}`);
console.log(`  dataset:       ${k.dataset}`);
console.log(`  accuracy:      ${k.accuracy}  (type: ${typeof k.accuracy})`);
console.log(`  problem:       ${k.problem?.slice(0, 70)}…`);
console.log(`  contributions: ${JSON.stringify(k.contributions)}`);
console.log(`  keyPoints:     ${JSON.stringify(k.keyPoints)}`);
console.log(`  entities[]:    ${k.entities.slice(0, 8).join(", ")}`);

console.log("\n═══ EXTRAS (richer fields — summary/chat only) ═══════");
console.log(`  metric:        ${k.extras?.metric}`);
console.log(`  limitations:   ${k.extras?.limitations?.slice(0, 70)}…`);
console.log(`  futureWork:    ${k.extras?.futureWork?.slice(0, 70)}…`);
console.log(`  topic:         ${k.extras?.topic}`);
console.log(`  keywords[]:    ${k.extras?.keywords.slice(0, 8).join(", ")}`);

// ─── Assertions ───────────────────────────────────────────────────────────────
const checks: Array<[string, boolean]> = [
  ["sections detected > 3",          result.document.sections.length > 3],
  ["abstract section found",         result.document.hasAbstract],
  ["methodology section found",      result.document.hasMethodology],
  ["references section truncated",   result.document.cleaningStats.referencesSectionTruncated],
  ["nlp keywords not empty",         result.nlp.keywords.length > 0],
  ["nlp entities not empty",         result.nlp.entities.length > 0],
  ["top sentences not empty",        result.nlp.topSentences.length > 0],

  // Strict core — must match intelligence/type.ts
  ["method extracted",               k.method !== null],
  ["dataset extracted (cifar)",      k.dataset?.toLowerCase().includes("cifar") ?? false],
  ["accuracy is a number",           typeof k.accuracy === "number"],
  ["accuracy value correct",         k.accuracy === 96.2],
  ["problem extracted",              k.problem !== null],
  ["contributions is non-empty array", k.contributions.length > 0],
  ["keyPoints is non-empty array",   k.keyPoints.length > 0],
  ["core has no stray fields",       Object.keys(k).every(key =>
    ["method","dataset","accuracy","problem","contributions","keyPoints","entities","extras"].includes(key)
  )],

  // Extras — richer fields
  ["extras exists",                  k.extras !== undefined],
  ["extras.metric set",              k.extras?.metric !== null],
  ["extras.topic is AI or vision",   ["artificial_intelligence","computer_vision"].includes(k.extras?.topic ?? "")],
  ["extras.limitations extracted",   k.extras?.limitations !== null],
  ["extras.futureWork extracted",    k.extras?.futureWork !== null],
  ["extras.keywords not empty",      (k.extras?.keywords.length ?? 0) > 0],

  // Cleaner correctness
  ["running headers removed",        !result.document.cleanText.includes("International Conference on Machine Learning 2024")],
  ["page numbers removed",           !result.document.cleanText.includes("\n4\n")],
];

console.log("\n═══ CHECKS ══════════════════════════════════════════");
let passed = 0;
for (const [label, ok] of checks) {
  console.log(`  ${ok ? "✓" : "✗"}  ${label}`);
  if (ok) passed++;
}
console.log(`\n  ${passed}/${checks.length} checks passed`);
if (passed < checks.length) process.exit(1);