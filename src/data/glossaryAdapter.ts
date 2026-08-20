/**
 * Bridge between the @stbr/solana-glossary SDK and the frontend.
 * All components import from here — never from the SDK directly.
 */

import {
  allTerms as sdkAllTerms,
  getTerm as sdkGetTerm,
  searchTerms as sdkSearchTerms,
  getTermsByDepth,
  getTermsByTag,
  getAllTags,
} from "@stbr/solana-glossary";
import type { GlossaryTerm, Category, Depth } from "@stbr/solana-glossary";

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

// ─── Frontend types ───

export interface IcebergLayer {
  id: string;
  name: string;
  terms: GlossaryTerm[];
  color: string;
  bgGradient: string;
  categories: Category[];
}

// ─── Build layers using SDK per-term depth ───

function buildLayers(): IcebergLayer[] {
  return depthOrder.map((depthId) => {
    const meta = depthMeta.find((m) => m.id === depthId)!;
    const depth = layerIdToDepth[depthId];

    const terms = getTermsByDepth(depth).sort((a, b) =>
      a.term.localeCompare(b.term),
    );

    // Derive categories from the actual terms present at this depth.
    // The static depthMeta.categories is only a visual fallback for empty layers.
    const seen = new Set<Category>();
    for (const t of terms) if (t.category) seen.add(t.category);
    const categories: Category[] =
      seen.size > 0 ? Array.from(seen).sort() : meta.categories;

    return {
      id: meta.id,
      name: meta.name,
      terms,
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

/** Search across all terms (names, definitions, aliases) */
export function searchAllTerms(
  query: string,
): { layerId: DepthId; term: GlossaryTerm; matchedAlias?: string }[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();

  return sdkSearchTerms(query)
    .map((t) => {
      const layerId = depthToLayerId[t.depth];
      if (!layerId) return null;

      const nameMatch = t.term.toLowerCase().includes(q);
      const aliasMatch = t.aliases?.find((a) => a.toLowerCase().includes(q));

      return {
        layerId,
        term: t,
        matchedAlias: aliasMatch && !nameMatch ? aliasMatch : undefined,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
}

/** Get related terms for a given term ID, resolved across layers */
export function getRelatedTerms(
  termId: string,
): { layerId: DepthId; term: GlossaryTerm }[] {
  const source = sdkGetTerm(termId);
  if (!source?.related) return [];

  return source.related
    .map((relId) => {
      const term = sdkGetTerm(relId);
      if (!term) return null;
      const layerId = depthToLayerId[term.depth];
      if (!layerId) return null;
      return { layerId, term };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
}

/** Get a single term by ID or alias */
export function getTermById(idOrAlias: string): GlossaryTerm | undefined {
  return sdkGetTerm(idOrAlias);
}

/** All terms flat */
export const allTerms = sdkAllTerms;

/** Re-export SDK tag functions */
export { getAllTags, getTermsByTag };

/** Re-export types and depth metadata */
export type { GlossaryTerm, Category, Depth, DepthId };
export { depthToLayerId, depthMeta, depthOrder };
export {
  categoryLabels,
  categoryColors,
  depthPillColors,
} from "./categoryDepthMap";
