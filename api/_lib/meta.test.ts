import { describe, it, expect } from "vitest";
import {
  buildImageUrl,
  categoryLabel,
  clampText,
  detectLocale,
  escapeHtml,
  hrefLang,
  injectBody,
  injectMeta,
  localePrefix,
  ogLocale,
  OG_VERSION,
  parseRoute,
  renderBodyContent,
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

describe("categoryLabel", () => {
  it("localizes category names so cards never mix languages", () => {
    expect(categoryLabel("core-protocol", "en")).toBe("Core Protocol");
    expect(categoryLabel("core-protocol", "pt")).toBe("Protocolo Central");
    expect(categoryLabel("core-protocol", "es")).toBe("Protocolo Central");

    expect(categoryLabel("dev-tools", "pt")).not.toBe("Dev Tools");
    expect(categoryLabel("security", "es")).not.toBe("Security");
  });

  it("falls back to English, then to the raw slug", () => {
    // Proper nouns are intentionally identical across locales.
    expect(categoryLabel("defi", "pt")).toBe("DeFi");
    expect(categoryLabel("web3", "es")).toBe("Web3");
    // Unknown slug must not throw or render "undefined".
    expect(categoryLabel("not-a-category", "pt")).toBe("not-a-category");
  });
});

describe("renderBodyContent", () => {
  /* Mirrors index.html: /api/meta paints into #ssr-shell, a sibling ABOVE
     #root that the app removes once the matching view has rendered. Injecting
     into #root instead would be destroyed by createRoot() on mount. */
  const SHELL = `<!doctype html><html lang="en"><head></head><body><div id="ssr-shell"></div><div id="root"></div><script src="/x.js"></script></body></html>`;

  it("puts the definition and related links in the HTML for a term", () => {
    const html = renderBodyContent(
      { kind: "term", id: "proof-of-history" },
      "en",
      "",
    );
    expect(html).toContain("<h1");
    expect(html).toContain("Proof of History");
    // A real definition, not a stub — median length in the SDK is 382 chars.
    expect(html.length).toBeGreaterThan(400);
    // Related terms must be real crawlable anchors, not spans.
    expect(html).toMatch(/<a [^>]*href="\/t\/[a-z0-9-]+"/);
  });

  it("prefixes every link with the active locale", () => {
    const html = renderBodyContent({ kind: "term", id: "slot" }, "pt", "/pt");
    for (const href of html.match(/href="([^"]+)"/g) ?? []) {
      expect(href).toMatch(/href="\/pt\//);
    }
  });

  it("lists a layer's terms so no term page is an orphan", () => {
    const html = renderBodyContent({ kind: "layer", layer: "bottom" }, "en", "");
    const links = html.match(/href="\/t\/[a-z0-9-]+"/g) ?? [];
    expect(links.length).toBeGreaterThan(20);
    expect(new Set(links).size).toBe(links.length); // no dupes
  });

  it("links the five layers from home", () => {
    const html = renderBodyContent({ kind: "default" }, "es", "/es");
    for (const id of ["surface", "shallow", "deep", "abyss", "bottom"]) {
      expect(html).toContain(`href="/es/l/${id}"`);
    }
  });

  it("escapes content and never hides it (no cloaking)", () => {
    const html = renderBodyContent({ kind: "term", id: "slot" }, "en", "");
    expect(html).not.toMatch(/display:\s*none|visibility:\s*hidden|<noscript/i);
    expect(html).not.toContain("<script");
  });

  it("returns empty for an unknown term so the shell is left untouched", () => {
    expect(renderBodyContent({ kind: "term", id: "nope-not-real" }, "en", "")).toBe("");
    expect(injectBody(SHELL, "")).toBe(SHELL);
  });

  it("fills #ssr-shell without disturbing the rest of the document", () => {
    const out = injectBody(SHELL, "<h1>Hi</h1>");
    expect(out).toContain('<div id="ssr-shell"><h1>Hi</h1></div>');
    /* #root must stay empty — it belongs to React. */
    expect(out).toContain('<div id="root"></div>');
    expect(out).toContain('<script src="/x.js">');
    expect(out.startsWith("<!doctype html>")).toBe(true);
  });
});

describe("injectBody guards", () => {
  it("throws rather than silently no-op when #ssr-shell is missing", () => {
    /* A formatter splitting the tag across lines was enough to break the old
       regex: head tags still injected while the body quietly did not, and no
       test or runtime signal caught it. Failing loudly is the point. */
    const noShell = `<!doctype html><html><body><div id="root"></div></body></html>`;
    expect(() => injectBody(noShell, "<h1>x</h1>")).toThrow(/ssr-shell/);
  });

  it("still matches when other attributes precede the id", () => {
    const withAttrs = `<!doctype html><html><body><div data-x="1" id="ssr-shell" class="y"></div><div id="root"></div></body></html>`;
    expect(injectBody(withAttrs, "<h1>x</h1>")).toContain("<h1>x</h1>");
  });
});
