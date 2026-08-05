import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from "node:module";
import type {
  KnowledgeGraph,
  PrologAnswer,
  PrologEngineInstance,
  PrologFact,
  PrologResult,
} from '../types';

// tau-prolog ships no TypeScript types — declare the minimal surface used
// here. Keeps the file strict-mode clean without depending on @types/tau-prolog
// (which doesn't exist on npm).
const loadCommonJsModule = createRequire(import.meta.url);

let cachedTauProlog: TauProlog | null = null;

function getTauProlog(): TauProlog {
  if (cachedTauProlog) return cachedTauProlog;
  try {
     
    cachedTauProlog = loadCommonJsModule("tau-prolog") as TauProlog;
    return cachedTauProlog;
  } catch (error) {
    throw new Error(
      `tau-prolog is unavailable. Install it with npm install tau-prolog. ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

interface TauProlog {
  create(): TauSession;
  format_answer(term: unknown, session?: TauSession): string;
}

interface TauSession {
  consult(
    program: string,
    callbacks: { success: () => void; error: (err: unknown) => void },
  ): void;
  query(
    goal: string,
    callbacks: { success: () => void; error: (err: unknown) => void },
  ): void;
  answer(callbacks: {
    success: (term: unknown) => void;
    fail: () => void;
    error: (err: unknown) => void;
    limit: () => void;
  }): void;
}

// ─── Ruleset ────────────────────────────────────────────────────────────────────
// Loaded lazily, memoized after first successful read. Every PrologEngine
// instance shares the same rule text, only the per-note facts differ
// between sessions.
//
// FIX (two compounding bugs found via a real production error):
//
// 1. __dirname does not survive Turbopack/webpack bundling. Next.js bundles
//    this file's JS into .next/server/..., but does NOT copy arbitrary
//    non-JS assets (like cs.rules.pl) alongside it unless explicitly told
//    to (see next.config.ts's outputFileTracingIncludes below). So
//    `join(__dirname, 'cs.rules.pl')` resolves to a path next to the
//    *bundled* output, where the .pl file was never placed — ENOENT.
//    process.cwd()-relative paths are more stable for this reason: your
//    project root doesn't move, even though the bundled file's directory
//    does. __dirname is kept as a fallback candidate since it still works
//    correctly in dev/test (ts-node, jest) where nothing gets bundled.
//
// 2. This used to be a synchronous read AT MODULE SCOPE (top of file, runs
//    the instant this module is imported by anything). That meant a single
//    missing/misplaced .pl file crashed the ENTIRE import chain for any
//    route that transitively imports prolog.engine.ts — which is how
//    GET /api/notes (a route that has nothing to do with Prolog reasoning)
//    ended up 500ing: note.controller → note.service → flashcard.service →
//    intelligence.service → engine.ts → prolog.engine.ts all get eagerly
//    loaded together. Deferring the read to first actual use (inside
//    load()) means unrelated routes stay up even if the Prolog layer is
//    misconfigured; only code paths that actually need Prolog reasoning
//    fail, with a clear error naming every path that was tried.

let cachedRulesSource: string | null = null;

const RULES_PATH = join(
  /* turbopackIgnore: true */ process.cwd(),
  "src/server/intelligence/prolog/cs.rules.pl",
);

function resolveRulesSource(): string {
  if (cachedRulesSource !== null) return cachedRulesSource;

  if (!existsSync(RULES_PATH)) {
    throw new Error(
      `prolog.engine.ts: could not find cs.rules.pl at ${RULES_PATH}. ` +
        "Ensure next.config.ts includes the Prolog asset in outputFileTracingIncludes.",
    );
  }

  cachedRulesSource = readFileSync(RULES_PATH, "utf8");
  return cachedRulesSource;
}

// ─── Graph → Facts ──────────────────────────────────────────────────────────────
// Converts every node and edge in a KnowledgeGraph into PrologFact objects.
// Node-type-specific functors come first (paper/method/dataset/accuracy/solves),
// then every edge becomes a functor named after its RelationType.
//
// Mapping (matches the comment block at the top of cs.rules.pl):
//   paper node            → paper(noteId).
//   method node + 'uses' edge from paper → method(noteId, conceptId).
//   dataset node + 'trained_on' edge     → dataset(noteId, conceptId).
//   metric:accuracy node                 → accuracy(noteId, value).
//   task node + 'solves' edge            → solves(noteId, taskId).
//   every other edge (is_a, part_of, uses, related_to)
//                                         → <type>(from, to).
//
// Node ids carry a "prefix:slug" convention (see types.ts) — the prefix is
// stripped before the slug becomes a Prolog atom, since Prolog atoms don't
// need the type info once they're inside a typed functor.

function stripPrefix(nodeId: string): string {
  const idx = nodeId.indexOf(':');
  return idx === -1 ? nodeId : nodeId.slice(idx + 1);
}


export function graphToFacts(graph: KnowledgeGraph, noteId: string): PrologFact[] {
  const facts: PrologFact[] = [];
  const seen = new Set<string>();

  function pushFact(functor: string, args: string[]): void {
    const key = `${functor}(${args.join(',')})`;
    if (seen.has(key)) return;
    seen.add(key);
    facts.push({ functor, args });
  }

  const paperNodeId = `paper:${noteId}`;
  if (graph.getNode(paperNodeId)) pushFact('paper', [noteId]);

  for (const edge of graph.edges) {
    const sourceNode = graph.getNode(edge.from);
    const targetNode = graph.getNode(edge.to);
    if (!sourceNode || !targetNode) continue;

    if (edge.from === paperNodeId) {
      const targetSlug = stripPrefix(edge.to);

      if (edge.type === 'uses' && targetNode.type === 'method') {
        pushFact('method', [noteId, targetSlug]);
        continue;
      }
      if (edge.type === 'trained_on' && targetNode.type === 'dataset') {
        pushFact('dataset', [noteId, targetSlug]);
        continue;
      }
      if (edge.type === 'evaluated_on' && targetNode.type === 'dataset') {
        pushFact('dataset', [noteId, targetSlug]);
        continue;
      }
      if (edge.type === 'evaluated_on' && targetNode.type === 'sample') {
        const sampleValue = targetNode.properties?.value;
        pushFact('sample', [noteId, targetSlug, typeof sampleValue === 'number' ? String(sampleValue) : 'unknown']);
        continue;
      }
      if (edge.type === 'uses_tool' && targetNode.type === 'tool') {
        pushFact('tool', [noteId, targetSlug]);
        continue;
      }
      if (edge.type === 'has_problem') {
        pushFact('problem', [noteId, targetSlug]);
        continue;
      }
      if (edge.type === 'mentions' && targetNode.type === 'concept') {
        pushFact('mentions', [noteId, targetSlug]);
        continue;
      }
      if (edge.type === 'achieves' && targetNode.type === 'metric') {
        const value = targetNode.properties?.value;
        if (typeof value === 'number') pushFact('accuracy', [noteId, String(value)]);
        continue;
      }
      if (edge.type === 'reports' && targetNode.type === 'metric') {
        const metric = String(targetNode.properties?.metric ?? targetNode.label).toLowerCase();
        const value = targetNode.properties?.value;
        pushFact('metric', [noteId, stripPrefix(edge.to)]);
        if (metric === 'accuracy' && typeof value === 'number') {
          pushFact('accuracy', [noteId, String(value)]);
        }
        continue;
      }
      if ((edge.type === 'reports' || edge.type === 'contains') && (targetNode.type === 'claim' || targetNode.type === 'result')) {
        const claimType = String(targetNode.properties?.claimType ?? targetNode.type);
        pushFact('claim', [noteId, claimType, targetSlug]);
        const numericValue = targetNode.properties?.numericValue;
        const metric = targetNode.properties?.metric;
        if (targetNode.type === 'result') {
          pushFact('result', [
            noteId,
            targetSlug,
            typeof numericValue === 'number' ? String(numericValue) : 'unknown',
            typeof metric === 'string' ? metric : 'unspecified',
          ]);
          if (String(metric).toLowerCase() === 'accuracy' && typeof numericValue === 'number') {
            pushFact('accuracy', [noteId, String(numericValue)]);
          }
        }
        continue;
      }
    }

    if (edge.from === paperNodeId) continue;
    const fromSlug = stripPrefix(edge.from);
    const toSlug = stripPrefix(edge.to);
    if (fromSlug === toSlug) continue;

    const reserved = new Set([
      'paper', 'method', 'dataset', 'accuracy', 'solves', 'mentions',
      'claim', 'result', 'metric', 'sample', 'tool', 'problem',
    ]);
    const functor = reserved.has(edge.type) ? `concept_${edge.type}` : edge.type;
    pushFact(functor, [fromSlug, toSlug]);
  }

  return facts;
}

// ─── Facts → Prolog source ──────────────────────────────────────────────────────
// Serialises PrologFact[] to ground Prolog clauses.
// Numeric args (e.g. accuracy values) are emitted unquoted; everything else
// must be emitted as a properly-quoted Prolog atom.
//
// FIX (audit #1 — critical): the previous version had
//   f.args.map((a) => (isNumericLiteral(a) ? a : a))
// — both ternary branches returned `a` unchanged, so every non-numeric arg
// was written as a bare, unquoted atom. Mongo ObjectId strings are 24-char
// hex and very often start with a digit (e.g. '507f1f77bcf86cd799439011').
// tau-prolog's tokenizer reads a leading digit as the start of a number
// literal, then fails on the embedded hex letters — session.consult() would
// throw a syntax error for a large share of real notes. A bare atom is only
// safe if it matches ^[a-z][a-zA-Z0-9_]*$; anything else (leading digit,
// uppercase, hyphen, embedded ':', etc.) must be single-quoted with internal
// quotes/backslashes escaped.

const SAFE_BARE_ATOM_RE = /^[a-z][a-zA-Z0-9_]*$/;

function isNumericLiteral(value: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(value);
}

export function quoteAtom(value: string): string {
  if (isNumericLiteral(value)) return value;
  if (SAFE_BARE_ATOM_RE.test(value)) return value;
  // Escape backslashes first, then single quotes, per Prolog quoted-atom rules.
  const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return `'${escaped}'`;
}

function factsToSource(facts: PrologFact[]): string {
  return facts
    .map((f) => {
      const args = f.args.map((a) => quoteAtom(a)).join(', ');
      return `${f.functor}(${args}).`;
    })
    .join('\n');
}

// ─── Answer formatting ──────────────────────────────────────────────────────────
// tau-prolog returns a `Substitution` per answer. We pull variable bindings
// into plain strings via the session's own term formatter, and we attach
// the subset of loaded facts that mention any of the bound atoms as
// evidence — a heuristic but a reasonable one for the explanation trace.

interface RawAnswer {
  bindings: Record<string, string>;
}

function buildEvidence(answer: RawAnswer, facts: PrologFact[]): PrologFact[] {
  const boundValues = new Set(Object.values(answer.bindings));
  return facts.filter((f) => f.args.some((a) => boundValues.has(a)));
}

function buildExplanation(goal: string, answers: PrologAnswer[]): string {
  if (answers.length === 0) {
    return `No solutions found for goal: ${goal}`;
  }

  const lines = answers.map((ans) => {
    const bindingsStr = Object.entries(ans.bindings)
      .map(([k, v]) => `${k} = ${v}`)
      .join(', ');
    const evidenceStr = ans.evidence
      .map((f) => `${f.functor}(${f.args.join(', ')})`)
      .join(', ');
    return bindingsStr
      ? `${bindingsStr} — derived from: ${evidenceStr || 'rule inference'}`
      : `goal satisfied — derived from: ${evidenceStr || 'rule inference'}`;
  });

  return lines.join('; ');
}

// ─── Confidence scoring ──────────────────────────────────────────────────────────
// Matches the contract documented on PrologResult.confidence in types.ts:
//   1.0 — direct facts only (every evidence fact has args matching loaded
//         ground facts with no rule-only predicates involved)
//   0.7 — satisfied via rule inference (belongs_to, key_fact, etc. — anything
//         not a 1:1 ground fact lookup)
//   0.4 — partially matched (some answer has fewer bindings than goal variables)
//   0.0 — no answers at all
//
// We approximate "direct vs inferred" by checking whether the goal's functor
// matches a known ground-fact functor (paper/method/dataset/accuracy/solves/
// is_a/part_of/uses/related_to/trained_on) — those are 1:1 facts loaded from
// the graph. Anything else (belongs_to, key_fact, outperforms, etc.) is a
// rule and scores 0.7 even on success.

const GROUND_FACT_FUNCTORS = new Set([
  'paper', 'method', 'dataset', 'accuracy', 'solves', 'mentions',
  'is_a', 'part_of', 'uses', 'related_to', 'trained_on', 'concept_solves',
]);

function scoreConfidence(goal: string, answers: PrologAnswer[]): number {
  if (answers.length === 0) return 0.0;

  const functorMatch = goal.match(/^\s*([a-z_][a-zA-Z0-9_]*)\s*\(/);
  const functor = functorMatch ? functorMatch[1] : '';

  // Extract the argument list and count how many distinct Prolog variables
  // (identifiers starting with an uppercase letter or underscore) it declares.
  // This is the correct test for "does this goal have variables at all" —
  // checking bindings.length on a ground goal (zero variables) is not partial,
  // it's a complete match, so it must not be confused with a goal that HAS
  // variables but failed to bind all of them.
  const argsMatch = goal.match(/\(([^)]*)\)/);
  const argList = argsMatch ? argsMatch[1].split(',').map((a) => a.trim()) : [];
  const declaredVars = argList.filter((a) => /^[A-Z_][a-zA-Z0-9_]*$/.test(a));

  if (declaredVars.length === 0) {
    // Ground goal — no variables to bind. Success is a complete match.
    return GROUND_FACT_FUNCTORS.has(functor) ? 1.0 : 0.7;
  }

  // Goal has variables — check whether every answer bound all of them.
  const allFullyBound = answers.every(
    (a) => declaredVars.every((v) => v in a.bindings),
  );

  if (!allFullyBound) return 0.4;

  return GROUND_FACT_FUNCTORS.has(functor) ? 1.0 : 0.7;
}

// ─── PrologEngine ───────────────────────────────────────────────────────────────

export class PrologEngine implements PrologEngineInstance {
  private session: TauSession | null = null;
  private loadedFacts: PrologFact[] = [];
  private loadedNoteId = '';

  // ── Load ───────────────────────────────────────────────────────────────────
  // Converts the graph to facts, appends cs.rules.pl, consults the combined
  // program into a fresh tau-prolog session. Must be called once per note
  // before query()/queryAll() — mirrors the design doc's per-note session model.

  async load(graph: KnowledgeGraph, noteId: string): Promise<void> {
    const facts = graphToFacts(graph, noteId);
    const program = `${factsToSource(facts)}\n\n${resolveRulesSource()}`;

    const pl = getTauProlog();
    const session = pl.create();

    await new Promise<void>((resolve, reject) => {
      session.consult(program, {
        success: () => resolve(),
        error: (err: unknown) =>
          reject(new Error(`PrologEngine.load: consult failed — ${pl.format_answer(err)}`)),
      });
    });

    this.session = session;
    this.loadedFacts = facts;
    this.loadedNoteId = noteId;
  }

  // ── Query ──────────────────────────────────────────────────────────────────
  // Runs one goal, collects every answer via backtracking, formats bindings
  // as plain strings, attaches heuristic evidence, scores confidence, and
  // builds a human-readable explanation.

  async query(goal: string): Promise<PrologResult> {
    this.assertLoaded();
    const normalizedGoal = goal.trim().endsWith('.') ? goal.trim() : `${goal.trim()}.`;

    const rawAnswers = await this.collectAnswers(normalizedGoal);

    const answers: PrologAnswer[] = rawAnswers.map((raw) => ({
      bindings: raw.bindings,
      evidence: buildEvidence(raw, this.loadedFacts),
    }));

    const confidence = scoreConfidence(goal, answers);
    const explanation = buildExplanation(goal, answers);

    return {
      goal,
      answers,
      explanation,
      confidence,
      resolvedBy: answers.length > 0 ? 'prolog' : 'fallback',
    };
  }

  // ── QueryAll ───────────────────────────────────────────────────────────────
  // Runs each goal independently against the same loaded session.
  // Order of results matches order of input goals.

  async queryAll(goals: string[]): Promise<PrologResult[]> {
    this.assertLoaded();
    const results: PrologResult[] = [];
    for (const goal of goals) {
      results.push(await this.query(goal));
    }
    return results;
  }

  // ── Facts accessor ───────────────────────────────────────────────────────────
  // Exposes the facts loaded into this session, for IntelligenceResult.prolog.facts
  // and for inspection/testing per the design doc's documented contract.
  // Returns a shallow copy — callers should not mutate the engine's internal state.

  getFacts(): PrologFact[] {
    return [...this.loadedFacts];
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private assertLoaded(): void {
    if (!this.session) {
      throw new Error(
        `PrologEngine: call load(graph, noteId) before query(). ` +
          `(noteId context: ${this.loadedNoteId || 'none loaded'})`,
      );
    }
  }

  private collectAnswers(goal: string): Promise<RawAnswer[]> {
    const session = this.session!;
    return new Promise((resolve) => {
      session.query(goal, {
        success: () => {
          const answers: RawAnswer[] = [];

          const next = (): void => {
            session.answer({
              success: (term: unknown) => {
                answers.push({ bindings: this.extractBindings(term) });
                next();
              },
              fail: () => resolve(answers),
              error: () => resolve(answers), // stop on error, return what we have
              limit: () => resolve(answers),
            });
          };

          next();
        },
        // Syntax error in the goal itself — return zero answers rather than throw,
        // so a malformed goal from a feature service degrades to AI fallback
        // instead of crashing the request.
        error: () => resolve([]),
      });
    });
  }

  // Converts a tau-prolog answer term into { VarName: 'value' } pairs.
  // Uses the session's own formatter so atoms/numbers print exactly as
  // tau-prolog would render them, then strips the trailing '.' format_answer adds.
  private extractBindings(term: unknown): Record<string, string> {
    const pl = getTauProlog();
    const bindings: Record<string, string> = {};
    const session = this.session!;

    // pl.format_answer(term) renders the whole substitution as
    // "X = cnn, Y = cifar10" (or "true" if no free variables).
    const formatted = pl.format_answer(term, session).replace(/\.\s*$/, '');

    if (formatted === 'true' || formatted.trim() === '') {
      return bindings; // ground goal, no free variables to bind
    }

    for (const pair of formatted.split(',')) {
      const eq = pair.indexOf('=');
      if (eq === -1) continue;
      const key = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (key) bindings[key] = value;
    }

    return bindings;
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────────
// intelligence/index.ts calls this once per pipeline run — a fresh engine
// per note, not a shared singleton (unlike OntologyCache, sessions hold
// per-note state and must not leak across notes).

export function createPrologEngine(): PrologEngine {
  return new PrologEngine();
}