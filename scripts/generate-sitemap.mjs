/**
 * Emits dist/sitemap.xml after `vite build`.
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
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
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

/* Fail loudly if the app's list ever diverges from this one. */
const depthSrc = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "../src/data/categoryDepthMap.ts"),
  "utf8",
);
for (const id of depthOrder) {
  if (!depthSrc.includes(`"${id}"`)) {
    throw new Error(
      `depth id "${id}" not found in categoryDepthMap.ts — sitemap route list is stale`,
    );
  }
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "dist/sitemap.xml");

/** "en" is served unprefixed; the others carry a path prefix. */
const LOCALES = [
  { code: "en", prefix: "", hreflang: "en" },
  { code: "pt", prefix: "/pt", hreflang: "pt-BR" },
  { code: "es", prefix: "/es", hreflang: "es" },
];

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
const BARE_PATHS = [
  "",
  ...depthOrder.map((layer) => `/l/${layer}`),
  ...allTerms.map((t) => `/t/${t.id}`),
];

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const lastmod = new Date().toISOString().slice(0, 10);

/**
 * Absolute URL for a locale + bare path. The English home is the only case
 * that would otherwise render as a bare origin with no path, so it gets an
 * explicit trailing slash — and every alternate uses this same function, so a
 * <loc> and the hreflang entry pointing at it are always byte-identical.
 * Mismatched trailing slashes silently break hreflang clustering.
 */
const urlFor = (prefix, bare) => `${ORIGIN}${prefix}${bare}` || ORIGIN;
const canonical = (prefix, bare) => {
  const u = urlFor(prefix, bare);
  return u === ORIGIN ? `${ORIGIN}/` : u;
};

const urls = [];
for (const bare of BARE_PATHS) {
  // Home gets top priority, layers next, individual terms below that.
  const priority = bare === "" ? "1.0" : bare.startsWith("/l/") ? "0.8" : "0.6";

  const alternates = LOCALES.map(
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

  for (const { prefix } of LOCALES) {
    urls.push(
      [
        "  <url>",
        `    <loc>${esc(canonical(prefix, bare))}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        `    <priority>${priority}</priority>`,
        alternates,
        "  </url>",
      ].join("\n"),
    );
  }
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join("\n")}
</urlset>
`;

writeFileSync(OUT, xml, "utf8");

const bytes = Buffer.byteLength(xml);
console.log(
  `sitemap.xml: ${urls.length} urls (${allTerms.length} terms x ${LOCALES.length} locales + layers + home), ${(bytes / 1024 / 1024).toFixed(2)} MB -> ${ORIGIN}/sitemap.xml`,
);

// Sitemaps protocol caps a single file at 50,000 URLs / 50 MB uncompressed.
if (urls.length > 50000 || bytes > 50 * 1024 * 1024) {
  console.error(
    `sitemap exceeds the 50,000 URL / 50 MB limit — split into a sitemap index`,
  );
  process.exit(1);
}
