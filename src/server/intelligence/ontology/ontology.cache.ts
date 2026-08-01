import type {
  OntologyConcept,
  OntologyDomain,
  OntologyRelation,
  ResolvedConcept,
} from '../types';

import { ONTOLOGY_MAP } from './cs_ontology';

// ─── Levenshtein distance (iterative, no recursion) ───────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  if (m === 0) return n;
  if (n === 0) return m;

  // A full DP matrix is O(m * n) space. We only need the previous and
  // current rows to compute the next row, so this stays O(n) space.
  // A simple two-pointer approach does not work for general Levenshtein
  // distance because each cell depends on the previous row/column values.
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let curr = Array.from({ length: n + 1 }, () => 0);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;

    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1]!;
      } else {
        curr[j] =
          1 +
          Math.min(
            prev[j]!,
            curr[j - 1]!,
            prev[j - 1]!,
          );
      }
    }

    [prev, curr] = [curr, prev];
  }

  return prev[n]!;
}

// ─── Sentinel concept for "unknown" matches ────────────────────────────────────

function makeUnknownConcept(raw: string): OntologyConcept {
  return {
    id: `unknown:${raw.toLowerCase().replace(/\s+/g, '_')}`,
    label: raw,
    aliases: [],
    ancestors: [],
    relations: [],
    domain: 'ml', // required by type; semantically irrelevant for unknowns
  };
}

// ─── OntologyCache ─────────────────────────────────────────────────────────────

class OntologyCache {
  private readonly byId: Map<string, OntologyConcept> = new Map();

  // Alias lookup: lowercased alias OR id → concept id.
  // Every concept's own id is registered here too (in load()), so this
  // single map is the only lookup resolve() needs — no separate id check.
  private readonly byAlias: Map<string, string> = new Map();

  private loaded = false;

  // ── Boot ───────────────────────────────────────────────────────────────────

  load(): void {
    if (this.loaded) return;

    for (const [id, concept] of ONTOLOGY_MAP) {
      this.byId.set(id, concept);

      // Register the id itself as a lowercase alias
      this.byAlias.set(id.toLowerCase(), id);

      // Register every declared alias
      for (const alias of concept.aliases) {
        const key = alias.toLowerCase();
        if (!this.byAlias.has(key)) {
          this.byAlias.set(key, id);
        }
      }
    }

    this.loaded = true;
  }

  // ── Resolve ────────────────────────────────────────────────────────────────
  //
  // FIXED: previous version had two separate tiers (byId.get(key) then
  // byAlias.get(key)) that did the same lookup twice, because byAlias
  // already contains every id as a key (registered in load() above).
  // Collapsed into one alias-map lookup. Exact-id matches still report
  // confidence 1.0 by checking whether the matched key equals the id itself.

  resolve(raw: string): ResolvedConcept {
    this.assertLoaded();
    const key = raw.toLowerCase().trim();

    // ── Tier 1: id or alias match (single map covers both) ──────────────────
    const matchedId = this.byAlias.get(key);
    if (matchedId) {
      const concept = this.byId.get(matchedId);
      if (concept) {
        const isExactId = key === matchedId.toLowerCase();
        return {
          concept,
          confidence: isExactId ? 1.0 : 0.85,
          matchType: isExactId ? 'exact' : 'alias',
          rawInput: raw,
        };
      }
    }

    // ── Tier 2: fuzzy match (Levenshtein ≤ 2 on concept ids) ────────────────
    let bestId: string | null = null;
    let bestDist = 3; // threshold: anything > 2 is rejected

    for (const id of this.byId.keys()) {
      const dist = levenshtein(key, id);
      if (dist < bestDist || (dist === bestDist && id < (bestId ?? ''))) {
        bestDist = dist;
        bestId = id;
      }
    }

    if (bestId !== null && bestDist <= 2) {
      const fuzzyConcept = this.byId.get(bestId)!;
      return {
        concept: fuzzyConcept,
        confidence: 0.6,
        matchType: 'fuzzy',
        rawInput: raw,
      };
    }

    // ── Tier 3: unknown ──────────────────────────────────────────────────────
    return {
      concept: makeUnknownConcept(raw),
      confidence: 0.0,
      matchType: 'unknown',
      rawInput: raw,
    };
  }

  /**
   * Resolve a concept mentioned inside a longer sentence. Direct id/alias/fuzzy
   * resolution is attempted first; then declared ids and aliases are matched as
   * whole terms, preferring the longest match.
   */
  resolveFromText(raw: string): ResolvedConcept {
    const direct = this.resolve(raw);
    if (direct.matchType !== 'unknown') return direct;

    const lower = raw.toLowerCase();
    const candidates = [...this.byAlias.entries()].sort((a, b) => b[0].length - a[0].length);
    for (const [alias, conceptId] of candidates) {
      if (alias.length < 3) continue;
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, 'i');
      if (!pattern.test(lower)) continue;
      const concept = this.byId.get(conceptId);
      if (!concept) continue;
      return {
        concept,
        confidence: alias === concept.id.toLowerCase() ? 0.8 : 0.75,
        matchType: 'alias',
        rawInput: raw,
      };
    }

    return direct;
  }

  // ── Batch resolve ──────────────────────────────────────────────────────────

  resolveAll(raws: string[]): ResolvedConcept[] {
    return raws.map((r) => this.resolve(r));
  }

  // ── Ancestor helpers ───────────────────────────────────────────────────────

  getAncestors(id: string): string[] {
    this.assertLoaded();
    return this.byId.get(id)?.ancestors ?? [];
  }

  getRelations(id: string): OntologyRelation[] {
    this.assertLoaded();
    return this.byId.get(id)?.relations ?? [];
  }

  // ── Domain filter ──────────────────────────────────────────────────────────

  getByDomain(domain: OntologyDomain): OntologyConcept[] {
    this.assertLoaded();
    const results: OntologyConcept[] = [];
    for (const concept of this.byId.values()) {
      if (concept.domain === domain) results.push(concept);
    }
    return results;
  }

  // ── Direct id lookup ───────────────────────────────────────────────────────

  getById(id: string): OntologyConcept | undefined {
    this.assertLoaded();
    return this.byId.get(id);
  }

  // ── Diagnostic helpers ─────────────────────────────────────────────────────

  get size(): number {
    return this.byId.size;
  }

  get aliasCount(): number {
    return this.byAlias.size;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Validate that every relation target and ancestor id actually exists
   * in the loaded ontology. Returns a list of dangling references so they
   * can be logged at startup rather than silently producing orphan graph
   * nodes later. Call this once after load() in development.
   */
  validateIntegrity(): {
    danglingRelations: string[];
    danglingAncestors: string[];
    reservedFunctorRelations: string[];
  } {
    this.assertLoaded();
    const danglingRelations: string[] = [];
    const danglingAncestors: string[] = [];
    // FIX (audit #5 follow-up): flag any concept-level relation whose type
    // would serialise to the same Prolog functor as a paper-level fact
    // (see prolog.engine.ts's PAPER_LEVEL_FUNCTORS). prolog.engine.ts
    // already defends against this at serialisation time by renaming to
    // concept_<type>, but surfacing it here at ontology-load time makes the
    // collision visible in the data itself, not just downstream in Prolog
    // source — useful when adding new concepts/relations to cs_ontology.ts.
    const reservedFunctorRelations: string[] = [];
    const RESERVED_PAPER_FUNCTORS = new Set(['paper', 'method', 'dataset', 'accuracy', 'solves', 'mentions']);

    for (const concept of this.byId.values()) {
      for (const rel of concept.relations) {
        if (!this.byId.has(rel.target)) {
          danglingRelations.push(`${concept.id} -[${rel.type}]-> ${rel.target}`);
        }
        if (RESERVED_PAPER_FUNCTORS.has(rel.type)) {
          reservedFunctorRelations.push(`${concept.id} -[${rel.type}]-> ${rel.target}`);
        }
      }
      for (const ancestorId of concept.ancestors) {
        if (ancestorId !== concept.id && !this.byId.has(ancestorId)) {
          danglingAncestors.push(`${concept.id} → ancestor "${ancestorId}"`);
        }
      }
    }

    return { danglingRelations, danglingAncestors, reservedFunctorRelations };
  }

  // ── Guard ──────────────────────────────────────────────────────────────────

  private assertLoaded(): void {
    if (!this.loaded) {
      throw new Error(
        'OntologyCache: call load() before using the cache. ' +
          'In intelligence/engine.ts: ontologyCache.load() must run before runPipeline().',
      );
    }
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────────────

export const ontologyCache = new OntologyCache();
export default ontologyCache;