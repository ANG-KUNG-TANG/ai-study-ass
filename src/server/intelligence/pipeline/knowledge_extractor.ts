/**
 * Knowledge extractor — Stage 4 of the pipeline.
 *
 * Receives NLPResult + SectionedDocument and produces a KnowledgeCore that
 * matches the contract in intelligence/type.ts exactly. This is the type
 * that ontology resolution, graph building, and Prolog fact generation
 * all consume downstream — so its shape is non-negotiable here.
 *
 * Strict core fields (drive ontology/graph/prolog):
 *   method, dataset, accuracy (number), problem, contributions[], keyPoints[], entities[]
 *
 * Extras (richer signal, used by summary/flashcard/chat, never touched
 * by graph.engine.ts or the Prolog fact generator):
 *   metric, limitations, futureWork, topic, keywords[]
 */

import type { KnowledgeCore, KeyPoint, KnowledgeExtras } from "../types";
import type { SectionedDocument, SectionTitle } from "./types";
import type { NLPResult, NLPSentence, NamedEntity } from "./nlp_pipeline";

// ─── Topic taxonomy ───────────────────────────────────────────────────────────

const TOPIC_KEYWORDS: Record<string, string[]> = {
  "artificial_intelligence": [
    "machine learning","deep learning","neural network","cnn","lstm","transformer",
    "bert","gpt","attention","backpropagation","gradient","classification","regression",
  ],
  "computer_vision": [
    "image","vision","object detection","segmentation","recognition","pixel",
    "convolutional","feature map","bounding box","yolo","resnet",
  ],
  "natural_language_processing": [
    "language model","text","nlp","token","sentence","embedding","sentiment",
    "translation","summarization","question answering","bert","gpt","squad",
  ],
  "databases": [
    "database","sql","nosql","query","index","transaction","relational","schema",
    "mongodb","postgresql","mysql","b-tree","join","acid",
  ],
  "networking": [
    "network","protocol","tcp","ip","routing","packet","bandwidth","latency",
    "throughput","socket","http","dns","firewall","subnet",
  ],
  "cloud_computing": [
    "cloud","kubernetes","docker","container","microservice","serverless",
    "aws","azure","gcp","devops","ci/cd","deployment","scalability",
  ],
  "cybersecurity": [
    "security","encryption","vulnerability","attack","authentication","firewall",
    "malware","intrusion","cryptography","certificate","oauth","tls",
  ],
};

// ─── Signal word sets ─────────────────────────────────────────────────────────

const PROBLEM_SIGNALS = [
  "problem","challenge","issue","limitation of","lack of","difficulty",
  "we address","we tackle","we focus on","our goal","aim to",
];

const CONTRIBUTION_SIGNALS = [
  "we propose","we present","we introduce","we develop","our contribution",
  "in this paper","this paper presents","novel","new approach","state-of-the-art",
];

const LIMITATION_SIGNALS = [
  "limitation of our",
  "drawback",
  "weakness",
  "not able to",
  "cannot",
  "fails to",
  "restricted to",
  "does not handle",
  "one downside",
  "main limitation",
  "key limitation",
];

const FUTURE_WORK_SIGNALS = [
  "future work","in future","future research","plan to","intend to",
  "leave for future","will explore","could be extended",
];

// ─── Main export ──────────────────────────────────────────────────────────────

export function extractKnowledge(
  doc: SectionedDocument,
  nlp: NLPResult
): KnowledgeCore {
  const sectionText = (titles: SectionTitle[]): string =>
    doc.sections
      .filter((s) => titles.includes(s.title))
      .map((s) => s.body)
      .join(" ");

  const method   = extractMethod(nlp.entities, sectionText(["methodology", "experiments"]));
  const dataset   = extractDataset(nlp.entities);
  const metric    = extractMetric(nlp.entities);
  const accuracy  = extractAccuracy(nlp.sentences, nlp.entities);
  const problem   = extractProblem(nlp.sentences, sectionText(["abstract", "introduction"]));
  const contribution = extractSignalText(nlp.sentences, CONTRIBUTION_SIGNALS, sectionText(["abstract", "introduction"]));
  const limitations  = extractSignalText(nlp.sentences, LIMITATION_SIGNALS, sectionText(["future_work"]));
  const futureWork    = extractSignalText(nlp.sentences, FUTURE_WORK_SIGNALS, sectionText(["future_work"]));
  const topic     = detectTopic(doc.cleanText);
  // FIX (audit #4): previously this was deduplicateEntityTexts(nlp.entities)
  // unfiltered — whatever text got assigned to `method`/`dataset`/`metric`
  // above also survived into the generic `entities` list untouched. E.g. if
  // "CNN" is tagged ALGORITHM and becomes core.method, it also appears in
  // core.entities. Downstream, graph.engine.ts then builds the *same*
  // concept twice: once as method:cnn (paper -[uses]-> method, weight 1.0),
  // and again as concept:cnn via the generic entities loop
  // (paper -[mentions]-> concept, weight 0.7) — producing redundant,
  // differently-weighted facts for one concept. Excluding the text already
  // claimed by method/dataset/metric keeps `entities` to genuinely "extra"
  // concepts.
  const claimedTexts = new Set(
    [method, dataset, metric]
      .filter((v): v is string => v !== null)
      .map((v) => v.toLowerCase()),
  );
  const entities  = deduplicateEntityTexts(nlp.entities).filter(
    (text) => !claimedTexts.has(text.toLowerCase()),
  );

  // ── Strict core (matches intelligence/type.ts exactly) ──────────────────────
  const core: KnowledgeCore = {
    method,
    dataset,
    accuracy,
    problem,
    contributions: contribution ? [contribution] : [],
    keyPoints: buildKeyPoints({ method, dataset, metric, accuracy }),
    entities,
  };

  // ── Extras (richer fields, never read by graph/prolog) ──────────────────────
  const extras: KnowledgeExtras = {
    metric,
    limitations,
    futureWork,
    topic,
    keywords: nlp.keywords,
  };

  core.extras = extras;

  return core;
}

// ─── Key points builder ───────────────────────────────────────────────────────
// Converts the core scalar fields into the KeyPoint[] shape that type.ts expects.

function buildKeyPoints(fields: {
  method: string | null;
  dataset: string | null;
  metric: string | null;
  accuracy: number | null;
}): KeyPoint[] {
  const points: KeyPoint[] = [];

  if (fields.method)   points.push({ label: "Method",   value: fields.method });
  if (fields.dataset)  points.push({ label: "Dataset",  value: fields.dataset });
  if (fields.metric)   points.push({ label: "Metric",   value: fields.metric });
  if (fields.accuracy !== null) points.push({ label: "Accuracy", value: `${fields.accuracy}%` });

  return points;
}

// ─── Field extractors ─────────────────────────────────────────────────────────

function extractProblem(
  sentences: NLPSentence[],
  scopeText: string
): string | null {
  const candidates = sentences.filter(
    (s) =>
      scopeText.includes(s.text) &&
      PROBLEM_SIGNALS.some((sig) => s.text.toLowerCase().includes(sig))
  );
  if (candidates.length > 0) {
    return candidates.sort((a, b) => b.score - a.score)[0].text;
  }
  const first = sentences.find((s) => scopeText.startsWith(s.text) || scopeText.includes(s.text));
  return first?.text ?? null;
}

function extractMethod(
  entities: NamedEntity[],
  methodText: string
): string | null {
  const algEntity = entities.find((e) => e.type === "ALGORITHM");
  if (algEntity) return algEntity.text;

  const snippet = methodText.slice(0, 200);
  const match = snippet.match(/[A-Z][a-zA-Z0-9\-]+(?:\s+[A-Z][a-zA-Z0-9\-]+){0,3}/);
  return match ? match[0] : null;
}

function extractDataset(entities: NamedEntity[]): string | null {
  const ds = entities.find((e) => e.type === "DATASET");
  return ds?.text ?? null;
}

function extractMetric(entities: NamedEntity[]): string | null {
  const m = entities.find((e) => e.type === "METRIC");
  return m?.text ?? null;
}

/**
 * Find a NUMBER entity that appears in the same sentence as a METRIC entity.
 * This captures "96.2% accuracy" → 96.2 (parsed as a number, per type.ts contract).
 */
function extractAccuracy(
  sentences: NLPSentence[],
  entities: NamedEntity[]
): number | null {
  const metricTexts = new Set(
    entities.filter((e) => e.type === "METRIC").map((e) => e.text.toLowerCase())
  );

  for (const sent of sentences) {
    const hasMetric = sent.entities.some(
      (e) => e.type === "METRIC" || metricTexts.has(e.text.toLowerCase())
    );
    if (!hasMetric) continue;

    const numberEntity = sent.entities.find((e) => e.type === "NUMBER");
    if (numberEntity) {
      const parsed = parseFloat(numberEntity.text.replace("%", ""));
      return Number.isNaN(parsed) ? null : parsed;
    }
  }

  return null;
}

/**
 * Find the best sentence matching a signal word list.
 * Falls back to the first 300 chars of sectionFallback if nothing found.
 */
function extractSignalText(
  sentences: NLPSentence[],
  signals: string[],
  sectionFallback: string
): string | null {
  const candidates = sentences.filter((s) =>
    signals.some((sig) => s.text.toLowerCase().includes(sig))
  );

  if (candidates.length > 0) {
    return candidates.sort((a, b) => b.score - a.score)[0].text;
  }

  if (sectionFallback.trim().length > 0) {
    return sectionFallback.trim().slice(0, 300);
  }

  return null;
}

// ─── Topic detection ──────────────────────────────────────────────────────────

function detectTopic(text: string): string | null {
  const lower = text.toLowerCase();
  const scores: Record<string, number> = {};

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    scores[topic] = keywords.filter((kw) => lower.includes(kw)).length;
  }

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deduplicateEntityTexts(entities: NamedEntity[]): string[] {
  const seen = new Set<string>();
  return entities
    .map((e) => e.text)
    .filter((text) => {
      const key = text.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}