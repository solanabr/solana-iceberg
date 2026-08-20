/**
 * Unit tests for the glossary -> frontend bridge.
 *
 * Almost everything here is a pure function over static data, so these are the
 * cheapest tests in the suite and the ones most likely to catch an SDK
 * upgrade quietly changing the shape of the iceberg underneath the app.
 *
 * The one moving part is definition text. It is 74% of the dataset and no
 * first-paint pixel uses it, so it loads separately and `searchAllTerms` — the
 * only lookup that reads it — is async. `src/test/setup.ts` registers the
 * payload up front so the rest of the suite sees what a browser sees once the
 * chunk has landed; the "still loading" state is driven explicitly at the
 * bottom of this file against a freshly isolated module graph.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  allTerms,
  definitionsLoaded,
  depthOrder,
  depthToLayerId,
  ensureDefinitions,
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
  it("returns an empty array for an empty query", async () => {
    await expect(searchAllTerms("")).resolves.toEqual([]);
  });

  it("returns an empty array for a whitespace-only query", async () => {
    await expect(searchAllTerms("   ")).resolves.toEqual([]);
  });

  it("matches on the term name", async () => {
    const results = await searchAllTerms("proof of history");
    expect(results.map((r) => r.term.id)).toContain("proof-of-history");
  });

  it("matches on the definition text, not just the name", async () => {
    const term = getTermById("proof-of-history");
    const distinctive = term!.definition.split(" ").slice(0, 6).join(" ");
    expect(distinctive.length).toBeGreaterThan(10); // guard: a real phrase

    const results = await searchAllTerms(distinctive);
    expect(results.map((r) => r.term.id)).toContain("proof-of-history");
  });

  /* The whole point of the async signature: a caller that does not await gets
     a promise, never a silently definition-blind result set. */
  it("returns a promise rather than a synchronous array", () => {
    expect(searchAllTerms("validator")).toBeInstanceOf(Promise);
  });

  it("loads the definition payload on demand, without the caller asking", async () => {
    const results = await searchAllTerms("validator");
    expect(definitionsLoaded()).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  it("matches on an alias and reports which alias matched", async () => {
    const results = await searchAllTerms("SVM Runtime");
    const hit = results.find((r) => r.term.id === "sealevel");
    expect(hit).toBeDefined();
    expect(hit!.matchedAlias).toBe("SVM Runtime");
  });

  it("omits matchedAlias when the name already matched, so the UI shows no redundant '(alias)'", async () => {
    const results = await searchAllTerms("Sealevel");
    const hit = results.find((r) => r.term.id === "sealevel");
    expect(hit).toBeDefined();
    expect(hit!.matchedAlias).toBeUndefined();
  });

  it("is case-insensitive", async () => {
    const lower = (await searchAllTerms("validator")).map((r) => r.term.id);
    const upper = (await searchAllTerms("VALIDATOR")).map((r) => r.term.id);
    const mixed = (await searchAllTerms("VaLiDaToR")).map((r) => r.term.id);

    expect(lower.length).toBeGreaterThan(0);
    expect(upper).toEqual(lower);
    expect(mixed).toEqual(lower);
  });

  it("tags every result with the layer its depth belongs to", async () => {
    for (const r of await searchAllTerms("validator")) {
      expect(r.layerId).toBe(depthToLayerId[r.term.depth]);
    }
  });

  it("returns no result for a query that matches nothing", async () => {
    await expect(searchAllTerms("qqzzxx-no-such-term")).resolves.toEqual([]);
  });

  /* Was a bug, now fixed: the emptiness guard trimmed but the matcher got the
     RAW query, so surrounding whitespace silently narrowed the result set —
     "validator" matched 164 terms, "validator " only 84. Mobile keyboards and
     paste append a space routinely. LayerView's filter had already been fixed;
     this is the global search half of the same fix. */
  it("ignores a trailing space instead of narrowing the result set", async () => {
    const clean = (await searchAllTerms("validator")).map((r) => r.term.id);
    const trailing = (await searchAllTerms("validator ")).map((r) => r.term.id);

    expect(clean.length).toBeGreaterThan(0);
    expect(trailing).toEqual(clean);
  });

  it("ignores a leading space instead of narrowing the result set", async () => {
    const clean = (await searchAllTerms("validator")).map((r) => r.term.id);
    const leading = (await searchAllTerms(" validator")).map((r) => r.term.id);

    expect(clean.length).toBeGreaterThan(0);
    expect(leading).toEqual(clean);
  });

  it("ignores whitespace on both sides at once", async () => {
    const clean = (await searchAllTerms("validator")).map((r) => r.term.id);
    const padded = (await searchAllTerms("  validator  ")).map(
      (r) => r.term.id,
    );

    expect(padded).toEqual(clean);
  });

  /* Pins the matcher to the SDK's own predicate. Losing definition or id
     matching would still leave a plausible-looking dropdown, so compare
     against the four-clause rule rather than a hand-picked expectation. */
  it("matches exactly the terms whose name, definition, id or alias contains the query", async () => {
    for (const query of ["validator", "ledger", "PoH"]) {
      const q = query.toLowerCase();
      const expected = allTerms
        .filter(
          (t) =>
            t.term.toLowerCase().includes(q) ||
            t.definition.toLowerCase().includes(q) ||
            t.id.includes(q) ||
            t.aliases?.some((a) => a.toLowerCase().includes(q)),
        )
        .map((t) => t.id);

      const actual = (await searchAllTerms(query)).map((r) => r.term.id);
      expect(actual, `query "${query}"`).toEqual(expected);
    }
  });
});

/* The state a real browser is in between first paint and the definition chunk
   landing. `setup.ts` has already registered the payload for the rest of the
   suite, so this rebuilds the module graph from scratch to get it back. */
describe("searchAllTerms before the definition payload lands", () => {
  let isolated: typeof import("@/data/glossaryAdapter");

  beforeAll(async () => {
    vi.resetModules();
    isolated = await import("@/data/glossaryAdapter");
  });

  it("starts with no definitions loaded", () => {
    expect(isolated.definitionsLoaded()).toBe(false);
  });

  it("still resolves every term id and name, so the iceberg and cards paint", () => {
    expect(isolated.allTerms).toHaveLength(TOTAL_TERMS);
    expect(isolated.getTermById("proof-of-history")?.term).toBe(
      "Proof of History (PoH)",
    );
  });

  it("reads an empty definition rather than undefined, so callers never throw", () => {
    expect(isolated.getTermById("proof-of-history")!.definition).toBe("");
  });

  it("awaits the payload and then matches definition text", async () => {
    const results = await isolated.searchAllTerms(
      "cryptographically proves the passage of time",
    );
    expect(isolated.definitionsLoaded()).toBe(true);
    expect(results.map((r) => r.term.id)).toContain("proof-of-history");
  });

  it("fills in definitions on the term objects already handed out", () => {
    /* Same object identity as before the load — the getter is live, so nothing
       that captured a term early is left holding a stale empty string. */
    expect(isolated.getTermById("proof-of-history")!.definition).toMatch(
      /clock mechanism/,
    );
  });

  it("resolves ensureDefinitions immediately once loaded", async () => {
    await expect(isolated.ensureDefinitions()).resolves.toBeUndefined();
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

  it("gives every term a non-empty definition, so no card renders blank", async () => {
    /* Explicit rather than relying on setup.ts: this is the assertion that
       would silently pass on an empty payload if the split ever broke. */
    await ensureDefinitions();
    expect(definitionsLoaded()).toBe(true);

    const empty = allTerms.filter((t) => !t.definition.trim());
    expect(empty.map((t) => t.id)).toEqual([]);
  });

  it("covers every term id in the definition payload", async () => {
    await ensureDefinitions();
    const missing = allTerms.filter((t) => t.definition === "");
    expect(missing.map((t) => t.id)).toEqual([]);
  });

  it("keeps every id URL-safe, since ids are used raw in /t/:termId", () => {
    const unsafe = allTerms.filter((t) => encodeURIComponent(t.id) !== t.id);
    expect(unsafe.map((t) => t.id)).toEqual([]);
  });
});
