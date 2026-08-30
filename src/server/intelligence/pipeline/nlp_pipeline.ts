import type {
  NamedEntity,
  NLPResult,
  NLPSentence,
  POS,
  Token,
} from "../types";
import type { SectionedDocument } from "./types";
import { splitTextUnits } from "./text-units";
import {
  isStudyEligibleUnit,
} from "./source-hygiene";

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "then", "than", "to", "of", "in", "on", "for",
  "with", "by", "from", "as", "at", "into", "through", "during", "is", "are", "was", "were", "be",
  "been", "being", "this", "that", "these", "those", "we", "our", "they", "their", "it", "its", "can",
  "may", "might", "will", "would", "should", "could", "not", "no", "also", "using", "used", "use",
  "such", "which", "who", "what", "when", "where", "how", "more", "most", "other", "each", "all",
]);

const METHOD_TERMS = [
  "dynamic bayesian network",
  "bayesian network",
  "bayesian belief network",
  "causal model",
  "regression model",
  "random forest",
  "support vector machine",
  "neural network",
  "convolutional neural network",
  "generative adversarial network",
  "transformer",
  "decision tree",
  "k-means",
  "principal component analysis",
  "linear programming",
];

const DATASET_TERMS = [
  "cifar-10", "cifar-100", "imagenet", "mnist", "coco", "pascal voc", "squad", "glue", "conll", "imdb",
];

const METRIC_TERMS = [
  "linear correlation coefficient",
  "correlation coefficient",
  "correlation",
  "prediction inaccuracy",
  "inaccuracy",
  "accuracy",
  "precision",
  "recall",
  "f1 score",
  "f1",
  "auc",
  "roc",
  "rmse",
  "mae",
  "mse",
  "perplexity",
];

const TOOL_TERMS = [
  "AgenaRisk", "AID", "TensorFlow", "PyTorch", "Scikit-learn", "MATLAB", "SPSS", "Docker", "Kubernetes",
];

const ORG_TERMS = [
  "Philips Consumer Electronics", "Philips", "Queen Mary University of London", "QinetiQ", "Israel Aircraft Industries",
];

const DOMAIN_PHRASES = [
  "software defect prediction",
  "defect prediction",
  "residual defects",
  "defect insertion",
  "defect detection",
  "testing and rework",
  "testing process quality",
  "software lifecycle",
  "lifecycle phase",
  "quality indicators",
  "expert judgement",
  "causal modelling",
  "probability distribution",
  "decision support system",
];

const WORD_RE = /[A-Za-z](?:[A-Za-z0-9\-']*[A-Za-z0-9])?|\d+(?:\.\d+)?%?/g;
const NUMBER_RE = /^\d+(?:\.\d+)?%?$/;
const ACRONYM_RE = /^[A-Z][A-Z0-9]{1,}$/;

export function runNLPPipeline(doc: SectionedDocument): NLPResult {
  const sentences: NLPSentence[] = [];

  for (const section of doc.sections) {
    if (section.semanticRole === "references") continue;
    const rawSentences =
      splitTextUnits(
        section.analysisBody,
      )
        .filter(
          (unit) =>
            unit.text.length >= 8 &&
            isStudyEligibleUnit(
              unit.text,
              unit.kind,
            ),
        )
        .map(
          (unit) => unit.text,
        );

    rawSentences.forEach((text, index) => {
      const tokens = tokeniseAndTag(text);
      const entities = extractEntities(text, tokens);
      sentences.push({
        id: `${section.id}-sentence-${index + 1}`,
        text,
        tokens,
        entities,
        score: 0,
        sectionId: section.id,
        sectionTitle: section.rawHeading,
        pageNumber: section.pageStart,
      });
    });
  }

  const sentenceScores = rankSentences(sentences.map((sentence) => sentence.text));
  sentences.forEach((sentence, index) => {
    sentence.score = sentenceScores[index] ?? 0;
  });

  const keyPhrases = extractKeyPhrases(sentences);
  const keywords = extractKeywords(sentences, keyPhrases);
  const entities = deduplicateEntities(sentences.flatMap((sentence) => sentence.entities));
  const topSentences = [...sentences]
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .sort((a, b) => sentences.indexOf(a) - sentences.indexOf(b))
    .map((sentence) => sentence.text);

  return { sentences, keywords, keyPhrases, entities, topSentences };
}

export function tokeniseWords(sentence: string): string[] {
  return sentence.match(WORD_RE) ?? [];
}

export function tokeniseAndTag(sentence: string): Token[] {
  return tokeniseWords(sentence).map((word) => ({
    text: word,
    lower: word.toLowerCase(),
    pos: tagPOS(word),
    isStopWord: STOP_WORDS.has(word.toLowerCase()),
  }));
}

export function tagPOS(word: string): POS {
  const lower = word.toLowerCase();
  if (NUMBER_RE.test(word)) return "CD";
  if (ACRONYM_RE.test(word)) return "NNP";
  if (/^[A-Z]/.test(word)) return "NNP";
  if (/ing$/.test(lower)) return "VBG";
  if (/(ed|en)$/.test(lower)) return "VBN";
  if (/ly$/.test(lower)) return "RB";
  if (/(al|ive|ous|ful|less|ic|able|ible|ent|ant)$/.test(lower)) return "JJ";
  if (/s$/.test(lower) && lower.length > 3) return "NNS";
  if (STOP_WORDS.has(lower)) return ["in", "on", "at", "to", "for", "of", "with", "by", "from"].includes(lower) ? "IN" : "DT";
  return "NN";
}

export function extractEntities(text: string, tokens: Token[]): NamedEntity[] {
  const entities: NamedEntity[] = [];
  const seen = new Set<string>();
  const add = (entityText: string, type: NamedEntity["type"]) => {
    const key = `${type}:${entityText.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      entities.push({ text: entityText, type });
    }
  };

  addTerms(text, METHOD_TERMS, "METHOD", add);
  addTerms(text, DATASET_TERMS, "DATASET", add);
  addTerms(text, METRIC_TERMS, "METRIC", add);
  addTerms(text, TOOL_TERMS, "TOOL", add);
  addTerms(text, ORG_TERMS, "ORG", add);
  addTerms(text, DOMAIN_PHRASES, "CONCEPT", add);

  const acronymDefinition = /\b([A-Z][A-Za-z-]+(?:\s+[A-Z]?[A-Za-z-]+){1,6})\s*\(([A-Z][A-Z0-9]{1,8})\)/g;
  for (const match of text.matchAll(acronymDefinition)) {
    add(match[1].trim(), "CONCEPT");
    add(match[2], "ACRONYM");
  }

  for (const token of tokens) {
    if (NUMBER_RE.test(token.text)) add(token.text, "NUMBER");
    else if (ACRONYM_RE.test(token.text)) add(token.text, "ACRONYM");
  }

  return entities;
}

function addTerms(
  text: string,
  terms: string[],
  type: NamedEntity["type"],
  add: (text: string, type: NamedEntity["type"]) => void,
): void {
  const lower = text.toLowerCase();
  for (const term of [...terms].sort((a, b) => b.length - a.length)) {
    const escaped = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, "i").test(lower)) {
      add(term, type);
    }
  }
}

function extractKeyPhrases(sentences: NLPSentence[]): string[] {
  const counts = new Map<string, number>();

  const add = (phrase: string, weight = 1) => {
    const normalized = phrase.toLowerCase().replace(/\s+/g, " ").trim();
    if (isInvalidPhrase(normalized)) return;
    counts.set(normalized, (counts.get(normalized) ?? 0) + weight);
  };

  for (const sentence of sentences) {
    for (const entity of sentence.entities) {
      if (!["NUMBER", "METRIC", "ORG"].includes(entity.type)) add(entity.text, 4);
    }

    const content = sentence.tokens.filter(
      (token) => !token.isStopWord && !NUMBER_RE.test(token.text) && token.lower.length >= 3,
    );

    for (let size = 2; size <= 4; size += 1) {
      for (let index = 0; index <= content.length - size; index += 1) {
        const slice = content.slice(index, index + size);
        if (slice.some((token) => ["VB", "VBG", "VBN", "RB"].includes(token.pos))) continue;
        add(slice.map((token) => token.lower).join(" "));
      }
    }
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 30)
    .map(([phrase]) => phrase);
}

function extractKeywords(sentences: NLPSentence[], keyPhrases: string[]): string[] {
  const counts = new Map<string, number>();
  for (const sentence of sentences) {
    for (const token of sentence.tokens) {
      if (token.isStopWord || NUMBER_RE.test(token.text) || token.lower.length < 3) continue;
      counts.set(token.lower, (counts.get(token.lower) ?? 0) + 1);
    }
  }

  const singleWords = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([word]) => word);

  return [...keyPhrases.slice(0, 12), ...singleWords].slice(0, 20);
}

function isInvalidPhrase(phrase: string): boolean {
  return (
    phrase.length < 4 ||
    /^\d+(?:\.\d+)?%?$/.test(phrase) ||
    /^section\s+\d+/i.test(phrase) ||
    phrase.split(/\s+/).every((part) => STOP_WORDS.has(part))
  );
}

function rankSentences(sentences: string[]): number[] {
  if (sentences.length === 0) return [];
  if (sentences.length === 1) return [1];

  const sets = sentences.map(
    (sentence) => new Set(tokeniseWords(sentence).map((word) => word.toLowerCase()).filter((word) => !STOP_WORDS.has(word) && word.length > 2)),
  );
  const scores = sentences.map((_, index) => {
    let score = 0;
    for (let other = 0; other < sets.length; other += 1) {
      if (other === index) continue;
      const intersection = [...sets[index]].filter((word) => sets[other].has(word)).length;
      const union = new Set([...sets[index], ...sets[other]]).size;
      score += union === 0 ? 0 : intersection / union;
    }
    return score / Math.max(1, sentences.length - 1);
  });

  const max = Math.max(...scores, 0.0001);
  return scores.map((score) => score / max);
}

function deduplicateEntities(entities: NamedEntity[]): NamedEntity[] {
  const seen = new Set<string>();
  return entities.filter((entity) => {
    const key = `${entity.type}:${entity.text.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
