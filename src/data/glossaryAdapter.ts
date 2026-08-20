/**
 * Bridge between the @stbr/solana-glossary data and the frontend.
 * All components import from here — never from the SDK directly.
 *
 * The SDK's bare specifier is deliberately NOT imported at runtime. It ships
 * one array in which every term carries its full definition, and definition
 * text is 74% of those bytes while the home screen renders none of it. Instead
 * a prebuild step (scripts/generate-glossary-payloads.mjs) splits the same data
 * into an eager metadata payload and a lazy definition payload; only the type
 * declarations still come from the package, and those are erased at build time.
 *
 * The split is invisible to callers except in one place: `searchAllTerms`
 * matches definition text, so it is async and awaits the payload.
 */

import type { GlossaryTerm, Category, Depth } from "@stbr/solana-glossary";

import { glossaryMeta, type TermMeta } from "./generated/glossaryMeta";
import { ensureDefinitions, readDefinition } from "./definitionStore";
import { depthMeta, depthOrder, type DepthId } from "./categoryDepthMap";

// ─── Depth ↔ Layer mapping ───

const depthToLayerId: Record<Depth, DepthId> = {
  1: "surface",
  2: "shallow",
  3: "deep",
  4: "abyss",
  5: "bottom",
};

const layerIdToDepth: Record<DepthId, Depth> = {
  surface: 1,
  shallow: 2,
  deep: 3,
  abyss: 4,
  bottom: 5,
};

// ─── Term hydration ───

/**
 * `definition` is a live getter rather than a copied string, so the objects
 * handed out before the payload lands are the same objects that carry the text
 * afterwards — no cache to invalidate and no stale duplicate anywhere.
 * It reads "" while the payload is in flight.
 */
function hydrate(meta: TermMeta): GlossaryTerm {
  const term: TermMeta = { ...meta };
  Object.defineProperty(term, "definition", {
    get(): string {
      return readDefinition(meta.id);
    },
    enumerable: true,
    configurable: true,
  });
  return term as GlossaryTerm;
}

const terms: GlossaryTerm[] = glossaryMeta.map(hydrate);

const termMap = new Map(terms.map((t) => [t.id, t]));
const aliasMap = new Map<string, string>();
for (const t of terms) {
  for (const alias of t.aliases ?? []) aliasMap.set(alias.toLowerCase(), t.id);
}

// ─── Frontend types ───

export interface IcebergLayer {
  id: string;
  name: string;
  terms: GlossaryTerm[];
  color: string;
  bgGradient: string;
  categories: Category[];
}

export interface SearchResult {
  layerId: DepthId;
  term: GlossaryTerm;
  matchedAlias?: string;
}

// ─── Build layers using per-term depth ───

function buildLayers(): IcebergLayer[] {
  return depthOrder.map((depthId) => {
    const meta = depthMeta.find((m) => m.id === depthId)!;
    const depth = layerIdToDepth[depthId];

    const layerTerms = terms
      .filter((t) => t.depth === depth)
      .sort((a, b) => a.term.localeCompare(b.term));

    // Derive categories from the actual terms present at this depth.
    // The static depthMeta.categories is only a visual fallback for empty layers.
    const seen = new Set<Category>();
    for (const t of layerTerms) if (t.category) seen.add(t.category);
    const categories: Category[] =
      seen.size > 0 ? Array.from(seen).sort() : meta.categories;

    return {
      id: meta.id,
      name: meta.name,
      terms: layerTerms,
      color: meta.color,
      bgGradient: meta.bgGradient,
      categories,
    };
  });
}

/** All terms grouped by depth layer */
export function getIcebergLayers(): IcebergLayer[] {
  return buildLayers();
}

/**
 * Substring match over name, definition, id and aliases — the same predicate
 * the SDK's `searchTerms` applies, kept character-for-character so the result
 * set does not shift. `q` is expected pre-trimmed and lowercased.
 */
function matches(term: GlossaryTerm, q: string): boolean {
  return (
    term.term.toLowerCase().includes(q) ||
    readDefinition(term.id).toLowerCase().includes(q) ||
    term.id.includes(q) ||
    (term.aliases?.some((a) => a.toLowerCase().includes(q)) ?? false)
  );
}

/**
 * Search across all terms (names, definitions, ids, aliases).
 *
 * Async because it reads definition text, which is not on the critical path and
 * loads on demand. SearchBar prefetches on focus, so the existing 300 ms
 * debounce absorbs the wait; call `prefetchDefinitions()` from any other call
 * site that can predict a search.
 */
export async function searchAllTerms(query: string): Promise<SearchResult[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  await ensureDefinitions();

  const results: SearchResult[] = [];
  for (const term of terms) {
    if (!matches(term, q)) continue;
    const layerId = depthToLayerId[term.depth];
    if (!layerId) continue;

    const nameMatch = term.term.toLowerCase().includes(q);
    const aliasMatch = term.aliases?.find((a) => a.toLowerCase().includes(q));

    results.push({
      layerId,
      term,
      matchedAlias: aliasMatch && !nameMatch ? aliasMatch : undefined,
    });
  }
  return results;
}

/** Get related terms for a given term ID, resolved across layers */
export function getRelatedTerms(
  termId: string,
): { layerId: DepthId; term: GlossaryTerm }[] {
  const source = getTermById(termId);
  if (!source?.related) return [];

  return source.related
    .map((relId) => {
      const term = getTermById(relId);
      if (!term) return null;
      const layerId = depthToLayerId[term.depth];
      if (!layerId) return null;
      return { layerId, term };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
}

/**
 * Get a single term by ID or alias.
 *
 * Ids go through an exact lookup while aliases are lowercased first — the
 * SDK's behaviour, preserved because /t/:termId links depend on it.
 */
export function getTermById(idOrAlias: string): GlossaryTerm | undefined {
  return (
    termMap.get(idOrAlias) ??
    termMap.get(aliasMap.get(idOrAlias.toLowerCase()) ?? "")
  );
}

/** All unique tags across the dataset, sorted */
export function getAllTags(): string[] {
  const tags = new Set<string>();
  for (const t of terms) for (const tag of t.tags ?? []) tags.add(tag);
  return [...tags].sort();
}

/** All terms flat */
export const allTerms: GlossaryTerm[] = terms;

/** Definition payload controls, re-exported so components import one module */
export {
  definitionsLoaded,
  ensureDefinitions,
  scheduleDefinitionPrefetch,
} from "./definitionStore";

/** Re-export types and depth metadata */
export type { GlossaryTerm, Category, Depth, DepthId };
export { depthToLayerId, depthMeta, depthOrder };
export {
  categoryLabels,
  categoryColors,
  depthPillColors,
} from "./categoryDepthMap";
