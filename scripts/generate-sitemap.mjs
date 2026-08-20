/**
 * Emits the dist/ sitemap set after `vite build`.
 *
 * Generated rather than committed because the URL set is derived from
 * @stbr/solana-glossary — a minor SDK release adds terms, and a hand-written
 * sitemap would silently go stale (and list 404s for renamed slugs).
 *
 * Every route is emitted once per locale, each carrying xhtml:link alternates
 * for all three plus x-default, which is what tells Google the pages are
 * translations of one another rather than duplicates.
 *
 *   /            /t/<id>            /l/<layer>
 *   /pt          /pt/t/<id>         /pt/l/<layer>
 *   /es          /es/t/<id>         /es/l/<layer>
 *
 * Host comes from VITE_SITE_URL so it tracks the same value the build bakes
 * into canonical/og:url — public/ files get no Vite substitution, which is why
 * this cannot just be a static file.
 *
 * ── Why a sitemap index instead of one flat file ──────────────────────────
 * sitemap.xml is a <sitemapindex> pointing at four children:
 *
 *   sitemap-core.xml       home + the 5 layers, all locales
 *   sitemap-terms-en.xml   English term pages
 *   sitemap-terms-pt.xml   Portuguese term pages
 *   sitemap-terms-es.xml   Spanish term pages
 *
 * The split is diagnostic, not cosmetic. Search Console reports indexed-vs-
 * discovered counts *per child sitemap*, so splitting the term pages by locale
 * gives a direct read on whether the pt/es translations are earning their
 * crawl budget or should be pulled. A single 3,195-URL file reports one
 * aggregate number and answers nothing.
 *
 * robots.txt already points at /sitemap.xml, which is now the index — crawlers
 * follow it to the children, so nothing there needs to change.
 *
 * ── Why no <lastmod> or <priority> ────────────────────────────────────────
 * The glossary SDK carries no date field on terms, so any <lastmod> here would
 * be the build timestamp — i.e. a claim that all 3,195 pages changed on every
 * deploy. Google discounts lastmod it finds unreliable, so a fabricated one is
 * worse than none. Omitted until there is an honest per-term source.
 * <priority> and <changefreq> are omitted because Google has stated for years
 * that it ignores both.
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { allTerms } from "@stbr/solana-glossary";

/**
 * Mirrors `depthOrder` in src/data/categoryDepthMap.ts. Duplicated rather than
 * imported because this is a plain .mjs build script and that module is .ts —
 * the five ids are a stable part of the URL contract (they appear in
 * vercel.json and api/meta.ts too), so drift is caught by the guard below.
 */
const depthOrder = ["surface", "shallow", "deep", "abyss", "bottom"];

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = resolve(ROOT, "dist");

/* Fail loudly if the app's list ever diverges from this one. */
const depthSrc = readFileSync(resolve(ROOT, "src/data/categoryDepthMap.ts"), "utf8");
for (const id of depthOrder) {
  if (!depthSrc.includes(`"${id}"`)) {
    throw new Error(
      `depth id "${id}" not found in categoryDepthMap.ts — sitemap route list is stale`,
    );
  }
}

/** "en" is served unprefixed; the others carry a path prefix. */
const LOCALES = [
  { code: "en", prefix: "", hreflang: "en" },
  { code: "pt", prefix: "/pt", hreflang: "pt-BR" },
  { code: "es", prefix: "/es", hreflang: "es" },
];

/** Sitemaps protocol caps one file at 50,000 entries / 50 MB uncompressed. */
const MAX_ENTRIES = 50000;
const MAX_BYTES = 50 * 1024 * 1024;

function siteUrl() {
  const raw = process.env.VITE_SITE_URL?.trim();
  if (raw) return raw.replace(/\/+$/, "");
  // Mirror .env.production rather than guessing, so a direct `node` run
  // produces the same output the build does.
  const envFile = resolve(ROOT, ".env.production");
  if (existsSync(envFile)) {
    const m = /^VITE_SITE_URL=(.+)$/m.exec(readFileSync(envFile, "utf8"));
    if (m) return m[1].trim().replace(/\/+$/, "");
  }
  throw new Error("VITE_SITE_URL is not set and .env.production has no value");
}

const ORIGIN = siteUrl();

/** Paths without a locale prefix. Term ids are kebab slugs — no encoding. */
const CORE_PATHS = ["", ...depthOrder.map((layer) => `/l/${layer}`)];
const TERM_PATHS = allTerms.map((t) => `/t/${t.id}`);

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Absolute URL for a locale + bare path. The English home is the only case
 * that would otherwise render as a bare origin with no path, so it gets an
 * explicit trailing slash — and every alternate uses this same function, so a
 * <loc> and the hreflang entry pointing at it are always byte-identical.
 * Mismatched trailing slashes silently break hreflang clustering.
 */
const canonical = (prefix, bare) => {
  const url = `${ORIGIN}${prefix}${bare}`;
  return url === ORIGIN ? `${ORIGIN}/` : url;
};

/**
 * The full alternate set for a route. Emitted on every locale variant of that
 * route, identically, and unchanged by the file split — an hreflang cluster is
 * not required to live in a single sitemap file, so the per-locale term files
 * still point at each other.
 */
const alternatesFor = (bare) =>
  LOCALES.map(
    ({ prefix, hreflang }) =>
      `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${esc(
        canonical(prefix, bare),
      )}" />`,
  )
    .concat(
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(
        canonical("", bare),
      )}" />`,
    )
    .join("\n");

const urlEntry = (prefix, bare) =>
  [
    "  <url>",
    `    <loc>${esc(canonical(prefix, bare))}</loc>`,
    alternatesFor(bare),
    "  </url>",
  ].join("\n");

const CHILDREN = [
  {
    file: "sitemap-core.xml",
    entries: CORE_PATHS.flatMap((bare) =>
      LOCALES.map(({ prefix }) => urlEntry(prefix, bare)),
    ),
  },
  ...LOCALES.map(({ code, prefix }) => ({
    file: `sitemap-terms-${code}.xml`,
    entries: TERM_PATHS.map((bare) => urlEntry(prefix, bare)),
  })),
];

const size = (b) =>
  b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(2)} MB`;

function write(file, xml, count, label) {
  const bytes = Buffer.byteLength(xml);
  if (count > MAX_ENTRIES || bytes > MAX_BYTES) {
    throw new Error(
      `${file}: ${count} ${label} / ${bytes} bytes exceeds the 50,000 entry / 50 MB sitemap limit`,
    );
  }
  writeFileSync(resolve(DIST, file), xml, "utf8");
  console.log(`${file}: ${count} ${label}, ${size(bytes)} -> ${ORIGIN}/${file}`);
}

mkdirSync(DIST, { recursive: true });

for (const { file, entries } of CHILDREN) {
  write(
    file,
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join("\n")}
</urlset>
`,
    entries.length,
    "urls",
  );
}

write(
  "sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${CHILDREN.map(
  ({ file }) => `  <sitemap>\n    <loc>${esc(`${ORIGIN}/${file}`)}</loc>\n  </sitemap>`,
).join("\n")}
</sitemapindex>
`,
  CHILDREN.length,
  "sitemaps",
);

console.log(
  `total: ${CHILDREN.reduce((n, c) => n + c.entries.length, 0)} urls (${allTerms.length} terms x ${LOCALES.length} locales + layers + home)`,
);
