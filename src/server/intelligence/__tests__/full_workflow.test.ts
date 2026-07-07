// =============================================================================
// server/intelligence/__tests__/full_workflow.test.ts
//
// Jest-native end-to-end test of the ENTIRE intelligence engine:
//   NLP → Ontology → Knowledge Graph (+ algorithms) → Prolog → Gap Detection
//   → Confidence Engine → AI Fallback branch
//
// This calls runPipeline() directly — the same function note.service.ts
// calls — with no Next.js, no MongoDB, no HTTP server required. Requires
// `tau-prolog` to be installed (npm install tau-prolog) and Jest configured
// to actually understand TypeScript (see next/jest note in the repo).
//
// Run with:
//   npx jest src/server/intelligence/__tests__/full_workflow.test.ts
// =============================================================================

import { runPipeline } from '../engine';
import { ontologyCache } from '../ontology/ontology.cache';
import { RawDocument } from '../pipeline/types';
import { AIGenerateFn } from '../types';

// ─── Test fixtures ───────────────────────────────────────────────────────────

const STRONG_PAPER: RawDocument = {
  rawText: `Abstract
We propose a novel Convolutional Neural Network architecture for image classification. We evaluate our approach on CIFAR-10 and achieve 96.2% accuracy, outperforming prior baselines.

Introduction
Image classification remains a core problem in computer vision.

Methodology
Our method uses a CNN with residual connections similar to ResNet, trained end to end.

Experiments
We trained on CIFAR-10 for 200 epochs using standard data augmentation.

Results
Our model achieves 96.2% accuracy on the CIFAR-10 test set.

Conclusion
We presented a CNN-based approach for image classification that outperforms existing baselines.`,
  fileName: 'strong_paper.pdf',
  mimeType: 'application/pdf',
  fileSize: 900,
};

const WEAK_PAPER: RawDocument = {
  rawText: `Abstract
This is a short note about some machine learning stuff without much detail.

Introduction
We looked at a general classification problem.`,
  fileName: 'weak_note.pdf',
  mimeType: 'application/pdf',
  fileSize: 200,
};

const mockAIGenerate: AIGenerateFn = async () => ({
  text: JSON.stringify({
    method: 'Support Vector Machine',
    dataset: null,
    accuracy: 91.4,
    problem: 'classifying handwritten digits under noisy conditions',
  }),
  tokensUsed: 142,
  provider: 'openai',
});

const throwingAIGenerate: AIGenerateFn = async () => {
  throw new Error('simulated rate limit');
};

const garbageAIGenerate: AIGenerateFn = async () => ({
  text: 'not json at all',
});

// ─── Ontology integrity (regression check) ──────────────────────────────────

describe('Ontology integrity', () => {
  beforeAll(() => {
    ontologyCache.load();
  });

  test('has exactly 101 unique concepts (dedup fix)', () => {
    expect(ontologyCache.size).toBe(101);
  });

  test('exact match works', () => {
    expect(ontologyCache.resolve('cnn').matchType).toBe('exact');
  });

  test('alias match works', () => {
    expect(ontologyCache.resolve('CNN').confidence).toBeGreaterThanOrEqual(0.85);
  });

  test('unknown match returns confidence 0', () => {
    expect(ontologyCache.resolve('xyzzy_not_real_concept').confidence).toBe(0);
  });
});

// ─── Strong paper — symbolic pipeline should be sufficient ──────────────────

describe('Strong paper: symbolic pipeline alone should be sufficient', () => {
  it('extracts all core fields with no AI needed', async () => {
    const result = await runPipeline({
      noteId: '507f1f77bcf86cd799439011',
      document: STRONG_PAPER,
    });

    expect(result.stage).toBe('complete');
    expect(result.core.method).not.toBeNull();
    expect(result.core.dataset).not.toBeNull();
    expect(result.core.accuracy).toBe(96.2);
    expect(result.gaps.missingFields).toHaveLength(0);
    expect(result.gaps.missingSections).toHaveLength(0);
    expect(result.aiFallback.used).toBe(false);
    expect(result.confidenceBreakdown.overall).toBeGreaterThan(0.6);
    expect(result.prolog.facts.length).toBeGreaterThan(0);
  });

  it('produces a fully connected, traversable knowledge graph', async () => {
    const result = await runPipeline({
      noteId: '507f1f77bcf86cd799439011b',
      document: STRONG_PAPER,
    });

    const bfsResult = result.graph.bfs(`paper:507f1f77bcf86cd799439011b`, 5);
    expect(bfsResult.order.length).toBeGreaterThan(3);

    const components = result.graph.connectedComponents();
    expect(components).toHaveLength(1);

    const centrality = result.graph.centrality();
    expect(centrality.size).toBe(result.graph.nodes.size);
  });
});

// ─── Weak paper, no AI adapter — fallback should be skipped ─────────────────

describe('Weak paper, no AI adapter supplied', () => {
  it('completes without throwing and reports why fallback was skipped', async () => {
    const result = await runPipeline({
      noteId: '507f1f77bcf86cd799439012',
      document: WEAK_PAPER,
    });

    expect(result.stage).toBe('complete');
    expect(result.confidenceBreakdown.overall).toBeLessThan(0.7);
    expect(result.aiFallback.used).toBe(false);
    expect(result.aiFallback.skippedReason).toBeTruthy();
  });
});

// ─── Weak paper WITH AI adapter — fallback should fire ──────────────────────

describe('Weak paper with AI adapter', () => {
  it('fires the fallback and improves confidence', async () => {
    const before = await runPipeline({
      noteId: '507f1f77bcf86cd799439013',
      document: WEAK_PAPER,
    });
    const after = await runPipeline({
      noteId: '507f1f77bcf86cd799439014',
      document: WEAK_PAPER,
      aiGenerate: mockAIGenerate,
    });

    expect(after.aiFallback.used).toBe(true);
    expect(after.core.method).toBe('Support Vector Machine');
    expect(after.core.accuracy).toBe(91.4);
    expect(after.core.extras?.aiAssisted).toBe(true);
    expect(after.confidenceBreakdown.overall).toBeGreaterThan(before.confidenceBreakdown.overall);
  });

  it('never creates a method: node for an AI-filled but ontology-unknown method', async () => {
    const after = await runPipeline({
      noteId: '507f1f77bcf86cd799439014b',
      document: WEAK_PAPER,
      aiGenerate: mockAIGenerate,
    });

    const methodNodeExists = [...after.graph.nodes.keys()].some((id) => id.startsWith('method:'));
    expect(methodNodeExists).toBe(false);
  });
});

// ─── AI error paths — must never crash the pipeline ─────────────────────────

describe('AI error resilience', () => {
  it('survives the AI adapter throwing an error', async () => {
    const result = await runPipeline({
      noteId: '507f1f77bcf86cd799439015',
      document: WEAK_PAPER,
      aiGenerate: throwingAIGenerate,
    });

    expect(result.stage).toBe('complete');
    expect(result.aiFallback.used).toBe(false);
  });

  it('survives the AI adapter returning non-JSON garbage', async () => {
    const result = await runPipeline({
      noteId: '507f1f77bcf86cd799439016',
      document: WEAK_PAPER,
      aiGenerate: garbageAIGenerate,
    });

    expect(result.stage).toBe('complete');
    expect(result.core.method).toBeNull();
  });
});