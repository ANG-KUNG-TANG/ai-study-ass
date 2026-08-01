import { NOTE_RULES } from "@/server/entities/note.entity";
import type { AIGenerateFn } from "@/server/intelligence/types";

const CHUNK_SIZE = 10_000;
const MAX_CHUNKS = 6;
const MIN_OUTPUT_LENGTH = 250;
const MAX_COPY_RATIO = 0.25;

export interface GenerateStudyNotesInput {
  title: string;
  sourceText: string;
}

function normaliseSource(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitByParagraph(text: string, maxLength = CHUNK_SIZE): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  const flush = (): void => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxLength) {
      flush();

      for (let start = 0; start < paragraph.length; start += maxLength) {
        chunks.push(paragraph.slice(start, start + maxLength).trim());
      }

      continue;
    }

    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;

    if (candidate.length > maxLength) {
      flush();
      current = paragraph;
    } else {
      current = candidate;
    }
  }

  flush();
  return chunks;
}

/** Select evenly distributed chunks so long papers are not represented only by the first pages. */
function sampleChunks(chunks: string[]): string[] {
  if (chunks.length <= MAX_CHUNKS) return chunks;

  const selected: string[] = [];
  const lastIndex = chunks.length - 1;

  for (let index = 0; index < MAX_CHUNKS; index += 1) {
    const sourceIndex = Math.round((index * lastIndex) / (MAX_CHUNKS - 1));
    selected.push(chunks[sourceIndex]);
  }

  return selected;
}

function buildChunkPrompt(
  title: string,
  chunk: string,
  chunkNumber: number,
  totalChunks: number,
): string {
  return `
You are creating university-level study notes from an uploaded document.

Document title: ${title}
Section: ${chunkNumber} of ${totalChunks}

Write concise intermediate notes for this section.

Rules:
- Paraphrase the ideas. Do not copy full sentences or paragraphs.
- Preserve definitions, methods, formulas, examples, evidence and conclusions.
- Ignore page numbers, headers, footers, author biographies and reference-list entries.
- Remove repetition and OCR noise.
- Use short Markdown headings and bullet points.
- Do not invent facts.
- Return notes only, without commentary about the task.

SOURCE SECTION:
${chunk}
`.trim();
}

function buildFinalPrompt(title: string, intermediateNotes: string[]): string {
  return `
You are an academic study-note assistant.

Create one coherent set of revision notes titled "${title}" by synthesising the intermediate notes below.

Strict requirements:
- Rewrite and combine the ideas; do not reproduce source paragraphs.
- Remove duplicated points.
- Use clear C1-level English suitable for a university student.
- Preserve important technical terms, definitions, processes, formulas, examples and findings.
- Distinguish claims, methods, results, limitations and future work when they are present.
- Do not invent unsupported information.
- Keep the output below 2,500 words.
- Output Markdown only.

Use this structure when the source supports it:

# ${title}

## Overview

## Main Concepts

## Methods or Processes

## Important Findings and Evidence

## Key Terms

## Limitations

## Key Takeaways

## Possible Exam Questions

INTERMEDIATE NOTES:
${intermediateNotes
  .map((notes, index) => `\n### Source Part ${index + 1}\n${notes}`)
  .join("\n")}
`.trim();
}

function normaliseForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`*_>#\-]/g, " ")
    .replace(/[^a-z0-9.%+\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function calculateCopyRatio(output: string, source: string): number {
  const sourceNormalised = normaliseForComparison(source);
  const sentences = output
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => normaliseForComparison(sentence))
    .filter((sentence) => sentence.length >= 100);

  if (sentences.length === 0) return 0;

  const copied = sentences.filter((sentence) => sourceNormalised.includes(sentence)).length;
  return copied / sentences.length;
}

function buildRewritePrompt(title: string, notes: string): string {
  return `
Rewrite the study notes below so they are clearly paraphrased and concise.

Rules:
- Keep every supported fact and technical term.
- Change sentence structure and wording substantially.
- Do not add new information.
- Keep the same Markdown organisation.
- Return only the revised notes.

Title: ${title}

NOTES TO REWRITE:
${notes}
`.trim();
}

function trimToLimit(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;

  const candidate = trimmed.slice(0, maxLength);
  const lastParagraph = candidate.lastIndexOf("\n\n");

  if (lastParagraph >= Math.floor(maxLength * 0.75)) {
    return candidate.slice(0, lastParagraph).trim();
  }

  return candidate.trim();
}

function validateGeneratedNotes(notes: string): void {
  if (notes.trim().length < MIN_OUTPUT_LENGTH) {
    throw new Error("The AI returned incomplete study notes");
  }
}

export async function generateStudyNotes(
  input: GenerateStudyNotesInput,
  generate: AIGenerateFn,
): Promise<string> {
  const sourceText = normaliseSource(input.sourceText);

  if (!sourceText) {
    throw new Error("Cannot generate notes because the extracted document text is empty");
  }

  const chunks = sampleChunks(splitByParagraph(sourceText));

  if (chunks.length === 0) {
    throw new Error("The document could not be divided into usable text sections");
  }

  const intermediateNotes: string[] = [];

  // Sequential calls reduce provider rate-limit spikes and preserve predictable ordering.
  for (let index = 0; index < chunks.length; index += 1) {
    const response = await generate(
      buildChunkPrompt(input.title, chunks[index], index + 1, chunks.length),
    );

    const notes = response.text.trim();
    validateGeneratedNotes(notes);
    intermediateNotes.push(notes);
  }

  const finalResponse = await generate(buildFinalPrompt(input.title, intermediateNotes));
  let finalNotes = finalResponse.text.trim();
  validateGeneratedNotes(finalNotes);

  // A second pass is used only when the output contains too many exact source sentences.
  if (calculateCopyRatio(finalNotes, sourceText) > MAX_COPY_RATIO) {
    const rewritten = await generate(buildRewritePrompt(input.title, finalNotes));
    const rewrittenNotes = rewritten.text.trim();
    validateGeneratedNotes(rewrittenNotes);
    finalNotes = rewrittenNotes;
  }

  return trimToLimit(finalNotes, NOTE_RULES.SUMMARY_MAX);
}
