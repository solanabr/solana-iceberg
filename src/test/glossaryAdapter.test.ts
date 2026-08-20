/**
 * Unit tests for the SDK -> frontend bridge.
 *
 * Everything here is a pure function over static data, so these are the
 * cheapest tests in the suite and the ones most likely to catch an SDK
 * upgrade quietly changing the shape of the iceberg underneath the app.
 */
import { describe, expect, it } from "vitest";
import {
  allTerms,
  depthOrder,
  depthToLayerId,
  getIcebergLayers,
  getRelatedTerms,
  getTermById,
  searchAllTerms,
  type Depth,
} from "@/data/glossaryAdapter";

/* The five counts the marketing copy, the OG images and the About panel all
   quote. If the SDK ships new terms these change on purpose — but they must
   change visibly, not silently. */
const EXPECTED_LAYER_SIZES = {
  surface: 110,
  shallow: 272,
  deep: 414,
  abyss: 207,
  bottom: 56,
} as const;

const TOTAL_TERMS = 1059;

describe("depthToLayerId", () => {
  it("maps every depth 1-5 to a distinct layer id", () => {
    const depths: Depth[] = [1, 2, 3, 4, 5];
    const mapped = depths.map((d) => depthToLayerId[d]);

    expect(mapped).toEqual(["surface", "shallow", "deep", "abyss", "bottom"]);
    expect(new Set(mapped).size).toBe(5);
  });

  it("covers every depth present in the dataset, so no term is unroutable", () => {
    const unmapped = allTerms.filter((t) => !depthToLayerId[t.depth]);
    expect(unmapped.map((t) => `${t.id}@depth${t.depth}`)).toEqual([]);
  });

  it("agrees with depthOrder on both membership and order", () => {
    expect(Object.values(depthToLayerId)).toEqual(depthOrder);
  });
});

describe("getIcebergLayers", () => {
  const layers = getIcebergLayers();

  it("returns exactly five layers in surface-to-bottom order", () => {
    expect(layers.map((l) => l.id)).toEqual([
      "surface",
      "shallow",
      "deep",
      "abyss",
      "bottom",
    ]);
  });

  it("puts the documented number of terms in each layer", () => {
    const sizes = Object.fromEntries(layers.map((l) => [l.id, l.terms.length]));
    expect(sizes).toEqual(EXPECTED_LAYER_SIZES);
  });

  it("partitions all 1,059 terms across the layers with no term lost or duplicated", () => {
    const ids = layers.flatMap((l) => l.terms.map((t) => t.id));

    expect(ids).toHaveLength(TOTAL_TERMS);
    expect(new Set(ids).size).toBe(TOTAL_TERMS);
    expect(new Set(ids)).toEqual(new Set(allTerms.map((t) => t.id)));
  });

  it("places every term in the layer its own depth points at", () => {
    const misplaced = layers.flatMap((layer) =>
      layer.terms
        .filter((t) => depthToLayerId[t.depth] !== layer.id)
        .map((t) => `${t.id} (depth ${t.depth}) in ${layer.id}`),
    );
    expect(misplaced).toEqual([]);
  });

  it("sorts terms alphabetically within a layer", () => {
    for (const layer of layers) {
      const names = layer.terms.map((t) => t.term);
      const sorted = [...names].sort((a, b) => a.localeCompare(b));
      expect(names, `layer ${layer.id} is not alphabetical`).toEqual(sorted);
    }
  });

  it("derives each layer's categories from the terms actually present in it", () => {
    for (const layer of layers) {
      const actual = new Set(layer.terms.map((t) => t.category));
      for (const category of layer.categories) {
        expect(
          actual.has(category),
          `layer ${layer.id} advertises category "${category}" but holds no term in it`,
        ).toBe(true);
      }
      expect(layer.categories).toEqual([...layer.categories].sort());
    }
  });

  it("returns a fresh array each call, so a caller mutating layers cannot poison the next render", () => {
    const a = getIcebergLayers();
    const b = getIcebergLayers();
    expect(a).not.toBe(b);
    expect(a[0].terms).not.toBe(b[0].terms);
  });
});

describe("getTermById", () => {
  it("resolves a canonical id", () => {
    expect(getTermById("proof-of-history")?.id).toBe("proof-of-history");
  });

  it("resolves an alias to its canonical term", () => {
    expect(getTermById("PoH")?.id).toBe("proof-of-history");
  });

  it("matches aliases case-insensitively", () => {
    expect(getTermById("poh")?.id).toBe("proof-of-history");
    expect(getTermById("POH")?.id).toBe("proof-of-history");
  });

  /* Documents current SDK behaviour, not an endorsement: ids go through an
     exact Map lookup while aliases are lowercased first. A /t/SLOT link
     therefore 404s into the home redirect even though /t/slot works. */
  it("does NOT match ids case-insensitively (documented current behaviour)", () => {
    expect(getTermById("slot")?.id).toBe("slot");
    expect(getTermById("SLOT")).toBeUndefined();
  });

  it("returns undefined for an unknown id", () => {
    expect(getTermById("not-a-real-term-xyz")).toBeUndefined();
  });

  it("returns undefined for an empty string rather than throwing", () => {
    expect(getTermById("")).toBeUndefined();
  });

  it("resolves every id in the dataset back to itself", () => {
    const broken = allTerms.filter((t) => getTermById(t.id)?.id !== t.id);
    expect(broken.map((t) => t.id)).toEqual([]);
  });
});

describe("searchAllTerms", () => {
  it("returns an empty array for an empty query", () => {
    expect(searchAllTerms("")).toEqual([]);
  });

  it("returns an empty array for a whitespace-only query", () => {
    expect(searchAllTerms("   ")).toEqual([]);
  });

  it("matches on the term name", () => {
    const ids = searchAllTerms("proof of history").map((r) => r.term.id);
    expect(ids).toContain("proof-of-history");
  });

  it("matches on the definition text, not just the name", () => {
    const term = getTermById("proof-of-history");
    const distinctive = term!.definition.split(" ").slice(0, 6).join(" ");
    const ids = searchAllTerms(distinctive).map((r) => r.term.id);
    expect(ids).toContain("proof-of-history");
  });

  it("matches on an alias and reports which alias matched", () => {
    const hit = searchAllTerms("SVM Runtime").find(
      (r) => r.term.id === "sealevel",
    );
    expect(hit).toBeDefined();
    expect(hit!.matchedAlias).toBe("SVM Runtime");
  });

  it("omits matchedAlias when the name already matched, so the UI shows no redundant '(alias)'", () => {
    const hit = searchAllTerms("Sealevel").find(
      (r) => r.term.id === "sealevel",
    );
    expect(hit).toBeDefined();
    expect(hit!.matchedAlias).toBeUndefined();
  });

  it("is case-insensitive", () => {
    const lower = searchAllTerms("validator").map((r) => r.term.id);
    const upper = searchAllTerms("VALIDATOR").map((r) => r.term.id);
    const mixed = searchAllTerms("VaLiDaToR").map((r) => r.term.id);

    expect(lower.length).toBeGreaterThan(0);
    expect(upper).toEqual(lower);
    expect(mixed).toEqual(lower);
  });

  it("tags every result with the layer its depth belongs to", () => {
    for (const r of searchAllTerms("validator")) {
      expect(r.layerId).toBe(depthToLayerId[r.term.depth]);
    }
  });

  it("returns no result for a query that matches nothing", () => {
    expect(searchAllTerms("qqzzxx-no-such-term")).toEqual([]);
  });

  /* BUG (documented, not fixed): searchAllTerms trims only for the emptiness
     guard and then hands the RAW query to the SDK matcher, so surrounding
     whitespace silently narrows the result set — at the time of writing,
     "validator" matched 164 terms and "validator " matched 84. Mobile
     keyboards and paste append a space routinely. LayerView's own filter
     already fixed exactly this; the global search bar has not.
     Rename these and flip to `toEqual` once the adapter trims. */
  it("BUG: a trailing space narrows results instead of being ignored", () => {
    const clean = searchAllTerms("validator").length;
    const trailing = searchAllTerms("validator ").length;

    expect(clean).toBeGreaterThan(0);
    expect(trailing).toBeLessThan(clean);
  });

  it("BUG: a leading space narrows results instead of being ignored", () => {
    const clean = searchAllTerms("validator").length;
    const leading = searchAllTerms(" validator").length;

    expect(clean).toBeGreaterThan(0);
    expect(leading).toBeLessThan(clean);
  });
});

describe("getRelatedTerms", () => {
  it("resolves a term's related ids into terms tagged with their layer", () => {
    const related = getRelatedTerms("proof-of-history");

    expect(related.length).toBeGreaterThan(0);
    for (const r of related) {
      expect(r.layerId).toBe(depthToLayerId[r.term.depth]);
    }
  });

  it("preserves the order declared on the source term", () => {
    const source = getTermById("proof-of-history")!;
    const resolved = getRelatedTerms("proof-of-history").map((r) => r.term.id);
    const expected = source.related!.filter((id) => getTermById(id));

    expect(resolved).toEqual(expected);
  });

  it("returns an empty array for an unknown term id", () => {
    expect(getRelatedTerms("not-a-real-term-xyz")).toEqual([]);
  });

  it("accepts an alias as the source, matching getTermById", () => {
    expect(getRelatedTerms("PoH")).toEqual(getRelatedTerms("proof-of-history"));
  });

  it("never yields a dangling reference across the whole dataset", () => {
    const dangling = allTerms.flatMap((t) =>
      (t.related ?? [])
        .filter((id) => !getTermById(id))
        .map((id) => `${t.id} -> ${id}`),
    );
    expect(dangling).toEqual([]);
  });
});

describe("dataset integrity", () => {
  it("has no duplicate term ids", () => {
    const ids = allTerms.map((t) => t.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes).toEqual([]);
  });

  it("gives every term a non-empty definition, so no card renders blank", () => {
    const empty = allTerms.filter((t) => !t.definition.trim());
    expect(empty.map((t) => t.id)).toEqual([]);
  });

  it("keeps every id URL-safe, since ids are used raw in /t/:termId", () => {
    const unsafe = allTerms.filter((t) => encodeURIComponent(t.id) !== t.id);
    expect(unsafe.map((t) => t.id)).toEqual([]);
  });
});
