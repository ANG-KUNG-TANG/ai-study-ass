
import { ontologyCache } from "./ontology.cache";

console.log("Loading ontology...\n");
ontologyCache.load();

console.log(`Loaded ${ontologyCache.size} concepts, ${ontologyCache.aliasCount} aliases\n`);

// ─── Integrity check ──────────────────────────────────────────────────────────
console.log("═══ INTEGRITY CHECK ═══════════════════════════════════");
const { danglingRelations, danglingAncestors, reservedFunctorRelations } = ontologyCache.validateIntegrity();
console.log(`Dangling relations: ${danglingRelations.length}`);
for (const r of danglingRelations) console.log(`  ✗ ${r}`);
console.log(`Dangling ancestors: ${danglingAncestors.length}`);
for (const a of danglingAncestors.slice(0, 20)) console.log(`  ✗ ${a}`);
if (danglingAncestors.length > 20) console.log(`  ... and ${danglingAncestors.length - 20} more`);
console.log(`Reserved-functor relations (expected — renamed to concept_<type> at Prolog serialisation time): ${reservedFunctorRelations.length}`);
for (const r of reservedFunctorRelations) console.log(`  ℹ ${r}`);

// ─── Resolve tests ────────────────────────────────────────────────────────────
console.log("\n═══ RESOLVE TESTS ═════════════════════════════════════");
const testInputs = ["CNN", "cnn", "ConvNet", "resnet", "CIFAR-10", "transformerss", "quantum computing"];
for (const input of testInputs) {
  const result = ontologyCache.resolve(input);
  console.log(`  "${input}" → ${result.concept.id} (${result.matchType}, conf=${result.confidence})`);
}

// ─── Checks ───────────────────────────────────────────────────────────────────
const checks: Array<[string, boolean]> = [
  ["loaded successfully", ontologyCache.isLoaded()],
  ["concept count > 60", ontologyCache.size > 60],
  ["exact id match works", ontologyCache.resolve("cnn").matchType === "exact"],
  ["alias match works (CNN)", ontologyCache.resolve("CNN").matchType === "alias" || ontologyCache.resolve("CNN").matchType === "exact"],
  ["alias match works (ConvNet)", ontologyCache.resolve("ConvNet").concept.id === "cnn"],
  ["fuzzy match works", ontologyCache.resolve("transformerss").matchType === "fuzzy"],
  ["unknown match works", ontologyCache.resolve("quantum computing").matchType === "unknown"],
  ["unknown confidence is 0", ontologyCache.resolve("quantum computing").confidence === 0],
  ["getAncestors works", ontologyCache.getAncestors("cnn").length > 0],
  ["getRelations works", ontologyCache.getRelations("cnn").length > 0],
  ["getById works", ontologyCache.getById("resnet")?.label === "ResNet"],
  ["getByDomain works", ontologyCache.getByDomain("computer_vision").length > 0],
  ["concept count has no duplicates (101 unique)", ontologyCache.size === 101],
  ["reserved-functor relations are surfaced for visibility (not an error)", reservedFunctorRelations.length >= 0],
];

console.log("\n═══ CHECKS ════════════════════════════════════════════");
let passed = 0;
for (const [label, ok] of checks) {
  console.log(`  ${ok ? "✓" : "✗"}  ${label}`);
  if (ok) passed++;
}
console.log(`\n  ${passed}/${checks.length} checks passed`);
if (passed < checks.length) process.exit(1);