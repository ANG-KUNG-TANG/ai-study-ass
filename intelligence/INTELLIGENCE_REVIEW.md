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

## BRD / requirements-document upgrade

The engine now has a deterministic requirements-document path aimed at documents such as the Mala Bowl BRD:

- detects `business_requirements_document` as a project-report subtype instead of treating it like a research paper;
- marks research-only fields such as dataset, experimental result, and research method as not applicable;
- recognises BRD sections including business/service/product objectives, functional requirements, process narrative, UML/DFD diagrams, appendices, and metadata;
- extracts MoSCoW requirements into structured `{ id, priority, statement, evidence }` records;
- extracts business objectives, process actors, process steps, and diagram types;
- filters requirement boilerplate such as `System Shall` and metadata table fragments from concepts;
- prevents noun phrases from being incorrectly joined across conjunctions (for example `Soup Type Spice Level`);
- adds section-aware, diversity-aware sentence ranking so metadata and repetitive requirement rows do not dominate summaries;
- adds glossary-row extraction for BRD/FR/DFD/UML terms;
- calibrates confidence so business documents are not unfairly penalized for having document-local concepts that are absent from the CS ontology;
- includes a dedicated BRD reliability regression test.

### Mala Bowl BRD validation (real extracted PDF text)

The upgraded requirements path was also exercised against the extracted text of the 12-page Mala Bowl BRD, not only a synthetic fixture. Results:

- reliability status: **ready**;
- internal reliability/coverage score: **0.963**;
- **11** business/service/product objectives recovered, including wrapped bullet lines;
- **17/17** functional requirements recovered with FR id, MoSCoW priority, statement, and evidence;
- **6** business actors detected;
- **14** clean ordering/fulfilment process steps recovered;
- **5** diagram types detected (Use Case, Activity, DFD, Class, Object);
- glossary terms restricted to grounded definitions such as BRD, FR, DFD, and UML;
- research-only fields remain `not_applicable`, so BRDs no longer trigger repair for missing dataset/method/results.

Regression smoke checks were repeated after the BRD changes:

- software-defect research-paper path: **passed**, quality about **0.863**;
- finance capital-budgeting case-study path: **passed**, quality about **0.930**.

The remaining major limitation is visual semantics inside rasterized diagrams. If a PDF parser returns only the diagram heading (for example `Class diagram`) but not the classes/relationships drawn inside the image, this engine cannot reconstruct those pixels from text alone. The next architectural upgrade should feed page-image/diagram observations from the upload parser or vision layer into the intelligence pipeline as grounded visual evidence.
