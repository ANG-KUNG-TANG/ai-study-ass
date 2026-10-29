import { describe, expect, it } from "@jest/globals";
import {
  computeConfidenceBreakdown,
  type ConfidenceInputs,
} from "./confidence.engine";
import type {
  KnowledgeCore,
  KnowledgeGap,
  KnowledgeGraph,
  NLPResult,
} from "../types";

function createInputs(prologAnswerCount: number): ConfidenceInputs {
  const core = {
    concepts: [],
    claims: [],
    validation: {
      groundedClaimRatio: 0,
      numericClaimRatio: 0,
      consistencyScore: 0,
    },
  } as unknown as KnowledgeCore;

  const gaps = {
    coverageScore: 0,
  } as KnowledgeGap;

  const graph = {
    nodes: new Map(),
    edges: [],
  } as unknown as KnowledgeGraph;

  return {
    nlp: {} as NLPResult,
    ontology: [],
    graph,
    core,
    prologAnswerCount,
    gaps,
  };
}

describe("computeConfidenceBreakdown", () => {
  it("returns zero reasoning confidence when there are no key-fact categories", () => {
    const result = computeConfidenceBreakdown(createInputs(0));

    expect(result.reasoning).toBe(0);
    expect(result.prolog).toBe(0);
  });

  it("scores four distinct key-fact categories as four ninths", () => {
    const result = computeConfidenceBreakdown(createInputs(4));

    expect(result.reasoning).toBeCloseTo(4 / 9);
  });

  it("scores eight distinct key-fact categories as eight ninths", () => {
    const result = computeConfidenceBreakdown(createInputs(8));

    expect(result.reasoning).toBeCloseTo(8 / 9);
  });

  it("caps reasoning confidence at one for nine categories", () => {
    const result = computeConfidenceBreakdown(createInputs(9));

    expect(result.reasoning).toBe(1);
    expect(result.prolog).toBe(result.reasoning);
  });
});
