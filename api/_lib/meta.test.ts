import { describe, it, expect } from "vitest";
import {
  buildImageUrl,
  clampText,
  detectLocale,
  escapeHtml,
  hrefLang,
  injectMeta,
  localePrefix,
  ogLocale,
  OG_VERSION,
  parseRoute,
  renderMetaTags,
  type MetaFields,
} from "../meta.js";

const sp = (q: string) => new URLSearchParams(q);

describe("clampText", () => {
  it("collapses whitespace and leaves short text intact", () => {
    expect(clampText("  hello   world ", 100)).toBe("hello world");
  });

  it("truncates with an ellipsis at the limit", () => {
    const out = clampText("a".repeat(50), 10);
    expect(out).toHaveLength(10);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("escapeHtml", () => {
  it("escapes the five HTML-significant characters", () => {
    expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe(
      "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;",
    );
  });
});

describe("detectLocale", () => {
  it("prefers the explicit ?lang hint set by the vercel rewrite", () => {
    expect(detectLocale("/api/meta", sp("lang=pt"), "en-US")).toBe("pt");
    expect(detectLocale("/pt/t/pda", sp("lang=en"), null)).toBe("en");
  });

  it("falls back to the path prefix, then Accept-Language, then en", () => {
    expect(detectLocale("/pt/t/pda", sp(""), "en-US")).toBe("pt");
    expect(detectLocale("/es", sp(""), "en-US")).toBe("es");
    expect(detectLocale("/t/pda", sp(""), "pt-BR,pt;q=0.9")).toBe("pt");
    expect(detectLocale("/t/pda", sp(""), null)).toBe("en");
  });
});

describe("ogLocale / hrefLang / localePrefix", () => {
  it("maps to Open Graph locale codes", () => {
    expect(ogLocale("en")).toBe("en_US");
    expect(ogLocale("pt")).toBe("pt_BR");
    expect(ogLocale("es")).toBe("es_ES");
  });

  it("maps to hreflang codes", () => {
    expect(hrefLang("en")).toBe("en");
    expect(hrefLang("pt")).toBe("pt-BR");
    expect(hrefLang("es")).toBe("es");
  });

  it("serves English unprefixed", () => {
    expect(localePrefix("en")).toBe("");
    expect(localePrefix("pt")).toBe("/pt");
    expect(localePrefix("es")).toBe("/es");
  });
});

describe("parseRoute", () => {
  it("honors explicit rewrite-destination hints first", () => {
    expect(parseRoute("/api/meta", sp("path=term&id=proof-of-history"))).toEqual(
      { kind: "term", id: "proof-of-history" },
    );
    expect(parseRoute("/api/meta", sp("path=layer&layer=deep"))).toEqual({
      kind: "layer",
      layer: "deep",
    });
    expect(parseRoute("/api/meta", sp("path=home"))).toEqual({
      kind: "default",
    });
  });

  it("parses the raw path for direct hits and strips a locale prefix", () => {
    expect(parseRoute("/t/amm", sp(""))).toEqual({ kind: "term", id: "amm" });
    expect(parseRoute("/l/abyss", sp(""))).toEqual({
      kind: "layer",
      layer: "abyss",
    });
    expect(parseRoute("/pt/t/pda", sp(""))).toEqual({
      kind: "term",
      id: "pda",
    });
    expect(parseRoute("/es/l/bottom", sp(""))).toEqual({
      kind: "layer",
      layer: "bottom",
    });
    expect(parseRoute("/", sp(""))).toEqual({ kind: "default" });
    expect(parseRoute("/pt", sp(""))).toEqual({ kind: "default" });
  });
});

describe("buildImageUrl", () => {
  it("builds an absolute, param-driven /api/og URL with a cache version", () => {
    const url = buildImageUrl("https://example.com", {
      title: "Proof of History (PoH)",
      subtitle: "A clock mechanism that proves the passage of time.",
      kind: "term",
      depth: "deep",
      depthIndex: 3,
      lang: "pt",
    });
    expect(url.startsWith("https://example.com/api/og?")).toBe(true);
    const q = new URL(url).searchParams;
    expect(q.get("kind")).toBe("term");
    expect(q.get("title")).toBe("Proof of History (PoH)");
    expect(q.get("depth")).toBe("deep");
    expect(q.get("depthIndex")).toBe("3");
    expect(q.get("lang")).toBe("pt");
    expect(q.get("v")).toBe(OG_VERSION);
  });

  it("omits depth params for the default card", () => {
    const url = buildImageUrl("https://example.com", {
      title: "Solana Iceberg",
      subtitle: "",
      kind: "default",
      lang: "en",
    });
    const q = new URL(url).searchParams;
    expect(q.has("depth")).toBe(false);
    expect(q.has("depthIndex")).toBe(false);
    expect(q.has("subtitle")).toBe(false);
  });
});

describe("renderMetaTags + injectMeta", () => {
  const fields: MetaFields = {
    title: "Proof of History (PoH) — Solana Iceberg",
    description: "A verifiable clock <before> consensus",
    ogType: "article",
    path: "/pt/t/proof-of-history",
    url: "https://example.com/pt/t/proof-of-history",
    image: "https://example.com/api/og?kind=term&v=1",
    imageAlt: "Proof of History (PoH) — Core Protocol · Solana Iceberg",
    locale: "pt",
  };

  it("renders escaped, complete canonical + OG + Twitter tags", () => {
    const tags = renderMetaTags(fields, "https://example.com");
    expect(tags).toContain(
      "<title>Proof of History (PoH) — Solana Iceberg</title>",
    );
    expect(tags).toContain(
      '<link rel="canonical" href="https://example.com/pt/t/proof-of-history" />',
    );
    expect(tags).toContain('property="og:type" content="article"');
    expect(tags).toContain('property="og:site_name" content="Solana Iceberg"');
    expect(tags).toContain('property="og:image:width" content="1200"');
    expect(tags).toContain('property="og:image:height" content="630"');
    expect(tags).toContain('property="og:image:type" content="image/png"');
    expect(tags).toContain('property="og:locale" content="pt_BR"');
    expect(tags).toContain('name="twitter:card" content="summary_large_image"');
    expect(tags).toContain('name="twitter:image:alt"');
    expect(tags).toContain("&lt;before&gt;");
  });

  it("emits a canonical that matches og:url exactly", () => {
    const tags = renderMetaTags(fields, "https://example.com");
    const canonical = /<link rel="canonical" href="([^"]+)"/.exec(tags)?.[1];
    const ogUrl = /property="og:url" content="([^"]+)"/.exec(tags)?.[1];
    expect(canonical).toBe(ogUrl);
  });

  it("cross-links the same route on every locale via hreflang", () => {
    const tags = renderMetaTags(fields, "https://example.com");
    expect(tags).toContain(
      '<link rel="alternate" hreflang="en" href="https://example.com/t/proof-of-history" />',
    );
    expect(tags).toContain(
      '<link rel="alternate" hreflang="pt-BR" href="https://example.com/pt/t/proof-of-history" />',
    );
    expect(tags).toContain(
      '<link rel="alternate" hreflang="es" href="https://example.com/es/t/proof-of-history" />',
    );
    expect(tags).toContain('hreflang="x-default" href="https://example.com/"');
  });

  it("keeps the home route at the locale root", () => {
    const tags = renderMetaTags(
      { ...fields, path: "/es/", url: "https://example.com/es/" },
      "https://example.com",
    );
    expect(tags).toContain(
      '<link rel="alternate" hreflang="en" href="https://example.com/" />',
    );
    expect(tags).toContain(
      '<link rel="alternate" hreflang="pt-BR" href="https://example.com/pt/" />',
    );
  });

  it("replaces the marker block and rewrites <html lang>", () => {
    const html = `<!doctype html><html lang="en"><head><!--OG:START-->\n  <title>OLD</title>\n<!--OG:END--></head><body></body></html>`;
    const out = injectMeta(html, renderMetaTags(fields, "https://example.com"), "pt");
    expect(out).toContain('<html lang="pt-BR"');
    expect(out).not.toContain("OLD");
    expect(out).toContain("<!--OG:START-->");
    expect(out).toContain("<!--OG:END-->");
    expect(out).toContain(
      "<title>Proof of History (PoH) — Solana Iceberg</title>",
    );
  });

  it("leaves markup outside the marker block untouched", () => {
    const html = `<html lang="en"><head><script type="application/ld+json">{"@type":"WebSite"}</script><!--OG:START-->OLD<!--OG:END--><link rel="icon" href="/favicon.svg" /></head></html>`;
    const out = injectMeta(html, "<title>New</title>", "en");
    expect(out).toContain('<script type="application/ld+json">');
    expect(out).toContain('<link rel="icon" href="/favicon.svg" />');
    expect(out).toContain("<title>New</title>");
  });

  it("returns the html unchanged when the markers are missing", () => {
    const html = `<html lang="en"><head><title>Untouched</title></head></html>`;
    const out = injectMeta(html, "<title>New</title>", "en");
    expect(out).toContain("<title>Untouched</title>");
    expect(out).not.toContain("<title>New</title>");
  });
});
