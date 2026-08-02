import { ontologyCache } from "./ontology.cache";

ontologyCache.load();
const integrity = ontologyCache.validateIntegrity();

const checks: Array<[string, boolean]> = [
  ["loaded", ontologyCache.isLoaded()],
  ["has a broad ontology", ontologyCache.size > 100],
  ["CNN alias resolves", ontologyCache.resolve("CNN").concept.id === "cnn"],
  ["Bayesian Network resolves", ontologyCache.resolve("Bayesian Network").concept.id === "bayesian_network"],
  ["BN resolves context default to Bayesian Network", ontologyCache.resolve("BN").concept.id === "bayesian_network"],
  ["software defect prediction resolves", ontologyCache.resolve("software defect prediction").concept.id === "software_defect_prediction"],
  ["unknown concepts remain unknown", ontologyCache.resolve("xyzzy-not-real").matchType === "unknown"],
  ["no dangling relations", integrity.danglingRelations.length === 0],
  ["no dangling ancestors", integrity.danglingAncestors.length === 0],
];

let passed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (ok) passed += 1;
}
console.log(`${passed}/${checks.length} checks passed`);
if (passed !== checks.length) process.exit(1);
