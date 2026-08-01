# Intelligence Engine Review

## Main causes of the unexpected behaviour

1. **Gap contract drift**
   - `pipeline/gap_detector.ts` returned `structuralGaps` and `domainGaps` but did not return `missingFields`.
   - `types.ts`, `ai_fallback.service.ts`, and the workflow tests expected `missingFields`.
   - Result: strict TypeScript compilation failed, and the AI fallback could crash on `gaps.missingFields.length`.

2. **False NER dataset detection**
   - Known terms were detected with raw substring matching.
   - The dataset token `ner` matched the letters inside `general`, creating a fake dataset.
   - `cifar` also matched before the more specific `cifar-10`, preventing correct ontology mapping.

3. **Primary concepts were excluded from ontology scoring**
   - The engine resolved only `knowledge.entities`.
   - The extractor intentionally removed the selected method and dataset from that array.
   - Therefore, ontology confidence and domain-gap analysis ignored the paper's main method and dataset.

4. **AI fallback left stale symbolic results**
   - After AI filled fields, the graph and confidence were recomputed, but ontology resolution was not.
   - AI-filled key points were also not rebuilt.

5. **Empty evidence increased confidence**
   - An empty ontology and an empty graph each scored `1.0`.
   - Weak documents could receive confidence for stages that produced no evidence.

6. **Problem sentences rarely became task nodes**
   - The graph tried to resolve an entire problem sentence as one ontology alias.
   - It now searches for the longest grounded ontology concept inside the sentence.

7. **Optional fields were invented from arbitrary section text**
   - Limitations, future work, and contributions used complete section text as fallback even without matching signals.
   - They now remain empty unless the document contains suitable evidence.

## Important fixes

- Unified both gap-detector entry points around one `KnowledgeGap` contract.
- Restored `missingFields` for AI fallback and preserved structural/domain diagnostics.
- Added whole-term NER matching and specific-term preference.
- Removed `ner` from the dataset dictionary.
- Selected `CIFAR-10` rather than generic `CIFAR`.
- Included method, dataset, entities, and a grounded task concept in ontology resolution.
- Re-resolved ontology after AI completion.
- Rebuilt `keyPoints` after AI completion.
- Prevented optional AI failures from crashing the engine.
- Counted distinct Prolog fact types instead of raw answer count.
- Used section-focused text for AI fallback.
- Validated AI accuracy as a number from 0 to 100.
- Removed the empty initial `other` section.
- Normalised internal imports and removed a duplicate type declaration.

## Verification performed

- Strict TypeScript compilation: **passed**.
- Document pipeline smoke test: **23/23 passed**.
- Ontology integrity test: **14/14 passed**.
- Full engine harness:
  - strong paper completed with the expected method and `CIFAR-10` dataset;
  - weak paper did not invent a dataset;
  - AI fallback filled missing fields without crashing;
  - confidence improved after usable AI completion;
  - thrown and malformed AI responses remained non-fatal.

The environment did not provide the real `tau-prolog` package, so the full-engine harness used a small API-compatible Prolog test double. Run the Jest workflow test inside the main project with the real dependency before deployment:

```bash
npx jest src/server/intelligence/__tests__/full_workflow.test.ts --runInBand
```
