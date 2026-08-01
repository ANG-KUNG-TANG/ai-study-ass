/**
 * NLP pipeline — pure TypeScript, zero external dependencies.
 *
 * Implements the four stages the second-doc architecture calls for:
 *   1. Sentence tokenisation
 *   2. Word tokenisation + normalisation
 *   3. POS tagging (rule-based, good enough for keyword/entity extraction)
 *   4. Named entity recognition (pattern-based)
 *   5. TF-IDF keyword ranking
 *   6. TextRank sentence ranking (for summary extraction)
 *
 * Design principle: every function is pure and stateless.
 * The pipeline runner at the bottom wires them together.
 */

import type { SectionedDocument } from "./types";

// ─── Output types ─────────────────────────────────────────────────────────────
// FIX (audit #9): these used to be a second, structurally-identical copy of
// Token/POS/NamedEntity/NLPSentence/NLPResult, duplicated against the ones in
// intelligence/types.ts with only a code comment ("do not change one without
// the other") holding them in sync. That's a silent-drift risk with no
// compiler enforcement. Now imported from the single canonical source.
import type {
  Token,
  POS,
  NamedEntity,
  NLPSentence,
  NLPResult,
} from "../types";

export type { Token, POS, NamedEntity, NLPSentence, NLPResult };

// ─── Stop words ───────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  "a","an","the","and","or","but","if","in","on","at","to","for","of","with",
  "by","from","as","is","was","are","were","be","been","being","have","has",
  "had","do","does","did","will","would","could","should","may","might","shall",
  "can","this","that","these","those","it","its","we","our","they","their",
  "he","she","his","her","i","my","you","your","also","however","therefore",
  "thus","such","both","each","more","most","other","than","then","so","no",
  "not","only","own","same","few","very","just","into","through","during",
  "before","after","above","below","between","out","off","over","under",
  "again","further","once","here","there","when","where","which","who","what",
  "all","any","while","about","against","down","up","et","al","fig","table",
  "section","paper","work","approach","method","proposed","show","using","use",
  "used","based","results","result","data","set","model","models","note",
]);

// ─── 1. Sentence tokeniser ────────────────────────────────────────────────────

/**
 * Split text into sentences.
 * Handles common abbreviations (e.g., et al., Fig., vs.) to avoid false splits.
 */
const ABBREV_RE =
  /(?:et\s+al|Fig|fig|vs|cf|i\.e|e\.g|approx|est|Prof|Dr|Mr|Mrs|Ms|Inc|Corp|Ltd|No|pp|Vol|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\./gi;
const ABBREV_PLACEHOLDER = "ABBREVDOT";

export function tokeniseSentences(text: string): string[] {
  // Temporarily hide abbreviation dots
  const masked = text.replace(ABBREV_RE, (m) =>
    m.slice(0, -1) + ABBREV_PLACEHOLDER
  );

  // Split on sentence-ending punctuation followed by whitespace + capital
  const raw = masked
    .replace(/([.!?])\s+(?=[A-Z])/g, "$1\n")
    .split("\n")
    .map((s) => s.replace(new RegExp(ABBREV_PLACEHOLDER, "g"), ".").trim())
    .filter((s) => s.length > 10); // drop very short fragments

  return raw;
}

// ─── 2. Word tokeniser ────────────────────────────────────────────────────────

/**
 * Two token patterns:
 *   1. Words: strings starting with a letter (handles hyphenated terms like CIFAR-10)
 *   2. Numbers: integers, decimals, and percentages (96.2%, 0.961, 42)
 * Combined with | so a single match() call returns both.
 */
const WORD_RE = /[a-zA-Z](?:[a-zA-Z0-9\-']*[a-zA-Z0-9])?|\d+(?:\.\d+)?%?/g;

export function tokeniseWords(sentence: string): string[] {
  return sentence.match(WORD_RE) ?? [];
}

// ─── 3. POS tagger (rule-based) ──────────────────────────────────────────────

const GERUND_RE = /ing$/i;
const PAST_PART_RE = /(?:ed|en)$/i;
const PLURAL_RE = /(?:s|ies)$/i;
const ADJECTIVE_SUFFIXES = /(?:al|ive|ous|ful|less|ic|able|ible|ent|ant)$/i;
const ADVERB_SUFFIXES = /ly$/i;
const PREPOSITIONS = new Set([
  "in","on","at","to","for","of","with","by","from","as","into","through",
  "during","before","after","above","below","between","out","off","over",
  "under","about","against","down","up","near","around",
]);
const DETERMINERS = new Set(["a","an","the","this","that","these","those","each","every","both","all","any","some","no"]);

export function tagPOS(word: string): POS {
  const lower = word.toLowerCase();
  if (STOP_WORDS.has(lower) && DETERMINERS.has(lower)) return "DT";
  if (STOP_WORDS.has(lower) && PREPOSITIONS.has(lower)) return "IN";
  if (/^\d+(?:\.\d+)?%?$/.test(word)) return "CD";
  if (/^[^a-zA-Z0-9]+$/.test(word)) return "SYM";
  if (/^[A-Z]{2,}$/.test(word)) return "NNP"; // ALL_CAPS → proper noun / acronym
  if (/^[A-Z]/.test(word) && word.length > 1) return "NNP";
  if (ADVERB_SUFFIXES.test(lower)) return "RB";
  if (ADJECTIVE_SUFFIXES.test(lower)) return "JJ";
  if (GERUND_RE.test(lower)) return "VBG";
  if (PAST_PART_RE.test(lower)) return "VBN";
  if (PLURAL_RE.test(lower) && lower.length > 3) return "NNS";
  return "NN";
}

export function tokeniseAndTag(sentence: string): Token[] {
  return tokeniseWords(sentence).map((word) => ({
    text: word,
    lower: word.toLowerCase(),
    pos: tagPOS(word),
    isStopWord: STOP_WORDS.has(word.toLowerCase()),
  }));
}

// ─── 4. Named entity recognition ─────────────────────────────────────────────

/**
 * Known algorithm, dataset, and tool names (case-insensitive).
 * Extend this list as the project grows — or replace with a lookup
 * from the knowledge graph once it's populated.
 */
const KNOWN_ALGORITHMS = new Set([
  "cnn","lstm","rnn","gru","bert","gpt","transformer","vgg","resnet","alexnet",
  "yolo","svm","random forest","naive bayes","k-means","pca","gan","vae",
  "attention","backpropagation","gradient descent","adam","sgd","dropout",
]);

const KNOWN_DATASETS = new Set([
  "cifar","cifar-10","cifar-100","imagenet","mnist","coco","pascal","voc",
  "glue","squad","wikitext","penn treebank","conll","imdb","sst",
  "ms coco","open images","librispeech","commonvoice","voxceleb",
]);

const KNOWN_METRICS = new Set([
  "accuracy","precision","recall","f1","f-1","bleu","rouge","perplexity",
  "mAP","map","auc","roc","rmse","mae","mse","cer","wer","top-1","top-5",
  "psnr","ssim","fid","inception score",
]);

/** Matches percentage or decimal scores: 96.2%, 0.95, 94.3 */
const NUMBER_SCORE_RE = /^\d{1,3}(?:\.\d{1,4})?%?$/;

/** Matches acronyms: 2+ uppercase letters, optionally with digits */
const ACRONYM_RE = /^[A-Z][A-Z0-9]{1,}$/;

export function extractEntities(tokens: Token[]): NamedEntity[] {
  const entities: NamedEntity[] = [];
  const seen = new Set<string>();

  const add = (text: string, type: NamedEntity["type"]) => {
    const key = `${type}:${text.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      entities.push({ text, type });
    }
  };

  // Build a lowercase string of the sentence for multi-word matches
  const sentenceText = tokens.map((t) => t.text).join(" ").toLowerCase();

  const addKnownMatches = (
    terms: Set<string>,
    type: NamedEntity["type"],
  ): void => {
    const accepted: string[] = [];
    const sorted = [...terms].sort((a, b) => b.length - a.length);
    for (const term of sorted) {
      const normalized = term.toLowerCase();
      const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const termPattern = new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, "i");
      if (!termPattern.test(sentenceText)) continue;
      if (accepted.some((longer) => longer.includes(normalized))) continue;
      accepted.push(normalized);
      add(term, type);
    }
  };

  // Prefer specific names such as CIFAR-10 over generic substrings such as CIFAR.
  addKnownMatches(KNOWN_ALGORITHMS, "ALGORITHM");
  addKnownMatches(KNOWN_DATASETS, "DATASET");
  addKnownMatches(KNOWN_METRICS, "METRIC");

  // Token-level checks
  for (const token of tokens) {
    if (NUMBER_SCORE_RE.test(token.text)) {
      add(token.text, "NUMBER");
    } else if (ACRONYM_RE.test(token.text) && token.text.length >= 2) {
      add(token.text, "ACRONYM");
    }
  }

  return entities;
}

// ─── 5. TF-IDF keyword ranking ────────────────────────────────────────────────

/**
 * Compute TF-IDF scores for all content words in the document.
 * "Documents" here are individual sentences — standard for single-doc TF-IDF.
 */
export function computeTFIDF(sentences: string[][]): Map<string, number> {
  const N = sentences.length;
  const tf = new Map<string, Map<string, number>>(); // word → (sentIdx → count)
  const df = new Map<string, number>(); // word → # sentences containing it

  sentences.forEach((words, idx) => {
    const seen = new Set<string>();
    for (const word of words) {
      if (word.length < 3 || STOP_WORDS.has(word)) continue;

      const sentMap = tf.get(word) ?? new Map<string, number>();
      sentMap.set(String(idx), (sentMap.get(String(idx)) ?? 0) + 1);
      tf.set(word, sentMap);

      if (!seen.has(word)) {
        df.set(word, (df.get(word) ?? 0) + 1);
        seen.add(word);
      }
    }
  });

  const scores = new Map<string, number>();
  for (const [word, sentMap] of tf) {
    let totalTF = 0;
    for (const count of sentMap.values()) totalTF += count;
    const avgTF = totalTF / N;
    const idf = Math.log((N + 1) / ((df.get(word) ?? 0) + 1)) + 1;
    scores.set(word, avgTF * idf);
  }

  return scores;
}

// ─── 6. TextRank sentence ranking ────────────────────────────────────────────

/**
 * Rank sentences by their similarity to all other sentences (TextRank).
 * Uses Jaccard similarity on content-word sets as the graph edge weight.
 * Runs PageRank-style iteration for ITERATIONS steps.
 */
const DAMPING = 0.85;
const ITERATIONS = 20;
const TOP_SENTENCES = 5;

export function rankSentences(sentences: string[]): number[] {
  if (sentences.length === 0) return [];
  if (sentences.length === 1) return [1];

  // Build word sets for each sentence (content words only)
  const wordSets = sentences.map((s) =>
    new Set(
      tokeniseWords(s)
        .map((w) => w.toLowerCase())
        .filter((w) => !STOP_WORDS.has(w) && w.length > 2)
    )
  );

  // Build similarity matrix
  const n = sentences.length;
  const sim: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const intersection = [...wordSets[i]].filter((w) => wordSets[j].has(w)).length;
      const union = new Set([...wordSets[i], ...wordSets[j]]).size;
      sim[i][j] = union === 0 ? 0 : intersection / union;
    }
    // Normalise row
    const rowSum = sim[i].reduce((a, b) => a + b, 0);
    if (rowSum > 0) sim[i] = sim[i].map((v) => v / rowSum);
  }

  // PageRank iteration
  let scores = new Array(n).fill(1 / n);
  for (let iter = 0; iter < ITERATIONS; iter++) {
    scores = scores.map((_, i) => {
      let sum = 0;
      for (let j = 0; j < n; j++) sum += sim[j][i] * scores[j];
      return (1 - DAMPING) / n + DAMPING * sum;
    });
  }

  return scores;
}

// ─── Pipeline runner ──────────────────────────────────────────────────────────

/**
 * Run the full NLP pipeline on a sectioned document.
 * Returns keywords, entities, ranked sentences — everything
 * the knowledge extractor needs.
 */
export function runNLPPipeline(doc: SectionedDocument): NLPResult {
  // Use the full clean text — section bodies joined in order
  const fullText = doc.sections.map((s) => s.body).join("\n\n");

  // 1. Sentence tokenisation
  const rawSentences = tokeniseSentences(fullText);

  // 2 & 3. Word tokenisation + POS tagging per sentence
  const tokenisedSentences = rawSentences.map((s) => tokeniseAndTag(s));

  // 4. NER per sentence
  const sentenceEntities = tokenisedSentences.map((tokens) =>
    extractEntities(tokens)
  );

  // 5. TF-IDF
  const wordLists = tokenisedSentences.map((tokens) =>
    tokens.filter((t) => !t.isStopWord).map((t) => t.lower)
  );
  const tfidfScores = computeTFIDF(wordLists);

  // Top 20 keywords by TF-IDF
  const keywords = [...tfidfScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);

  // 6. TextRank sentence ranking
  const sentenceScores = rankSentences(rawSentences);

  // Build full sentence objects
  const sentences: NLPSentence[] = rawSentences.map((text, i) => ({
    text,
    tokens: tokenisedSentences[i],
    entities: sentenceEntities[i],
    score: sentenceScores[i],
  }));

  // Top ranked sentences
  const topSentences = [...sentences]
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_SENTENCES)
    .sort(
      (a, b) =>
        rawSentences.indexOf(a.text) - rawSentences.indexOf(b.text)
    ) // restore original order
    .map((s) => s.text);

  // Flatten all entities across sentences, deduplicate by type:text
  const allEntities = deduplicateEntities(sentences.flatMap((s) => s.entities));

  return { sentences, keywords, entities: allEntities, topSentences };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deduplicateEntities(entities: NamedEntity[]): NamedEntity[] {
  const seen = new Set<string>();
  return entities.filter((e) => {
    const key = `${e.type}:${e.text.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}