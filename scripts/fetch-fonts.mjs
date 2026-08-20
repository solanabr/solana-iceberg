/**
 * Re-fetches the self-hosted Space Grotesk webfont from Google Fonts.
 *
 * The site used to load the font with a render-blocking
 * <link rel="stylesheet" href="fonts.googleapis.com/css2?…"> plus two
 * preconnects — two extra DNS+TLS handshakes to third-party origins on the
 * FCP path. The file now ships from public/fonts/ and is declared in
 * src/index.css. This script exists so that file is reproducible rather than
 * an unexplained binary in the repo: run it and you get the same bytes back,
 * or a loud failure saying Google changed them.
 *
 * ── What is actually downloaded ───────────────────────────────────────────
 * Space Grotesk on Google Fonts is a *variable* font (one wght axis, 300–700).
 * All five weights in the old ?wght@300;400;500;600;700 query resolve to the
 * SAME woff2 URL per subset — the browser instances it. So "which weights do
 * we ship" does not change a single byte; it only changes which @font-face
 * declarations exist in src/index.css. Verify with:
 *
 *   node scripts/fetch-fonts.mjs --print-css
 *
 * ── Why only the `latin` subset ───────────────────────────────────────────
 * Google splits the font into latin / latin-ext / vietnamese and the browser
 * downloads only the subsets whose unicode-range matches text on the page. A
 * scan of every string this app renders (glossary terms and definitions in
 * en/pt-BR/es, plus all UI copy) found 26 distinct non-ASCII codepoints and
 * every one of them — á â ã é ê í ñ ó ô õ ú à Á Ã É Í Ú ¿ © ± ² · × – —
 * sits inside the latin unicode-range (U+0000-00FF plus the punctuation
 * ranges). latin-ext and vietnamese were therefore never requested at runtime
 * and are not shipped. `SUBSETS` below is the knob if that ever changes.
 *
 * ── Reproducibility ───────────────────────────────────────────────────────
 * Google varies its payload by User-Agent, so the UA is pinned to a modern
 * Chrome. Older Chrome (<=~123) gets a build carrying a 7-byte legacy `prep`
 * hinting table; every current engine (Chrome/Edge/Safari/Firefox, desktop and
 * mobile) gets the file pinned here. The two are otherwise identical — same
 * glyf, hmtx, gvar, HVAR, avar, cmap and OS/2 — so metrics do not depend on
 * which one a visitor would have received.
 *
 * Usage:
 *   node scripts/fetch-fonts.mjs              verify the committed files
 *   node scripts/fetch-fonts.mjs --write      re-download and overwrite
 *   node scripts/fetch-fonts.mjs --print-css  dump Google's CSS and exit
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "public", "fonts");

/** Matches the ?family= query the old index.html <link> used. */
const CSS_URL =
  "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap";

/** Pinned so the response is the woff2 build current engines receive. */
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

/**
 * Subset -> committed filename. `v22` is Google's font version, taken from the
 * gstatic path; public/ files get no build hash, so the version lives in the
 * name and a bump is a new URL rather than a stale cache.
 */
const SUBSETS = {
  latin: {
    file: "space-grotesk-v22-latin.woff2",
    sha256: "a0d054c4af557de20afd6ca59f47ab353bcaec49c63ff04b6c9d39d0f8910557",
    bytes: 22320,
  },
};

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.text();
}

/**
 * Google emits one `/* subset *\/`-commented @font-face block per weight per
 * subset. Returns the src url and unicode-range for each subset; the blocks
 * for a given subset are asserted identical across weights, which is what
 * proves the file is variable rather than five static cuts.
 */
function parseCss(css) {
  const blocks = new Map();
  const re =
    /\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{([\s\S]*?)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const [, subset, body] = m;
    const url = /src:\s*url\(([^)]+)\)/.exec(body)?.[1];
    const range = /unicode-range:\s*([^;]+);/.exec(body)?.[1]?.trim();
    const weight = /font-weight:\s*([^;]+);/.exec(body)?.[1]?.trim();
    if (!url || !range || !weight) throw new Error(`unparsable @font-face:\n${body}`);
    const prev = blocks.get(subset);
    if (prev) {
      if (prev.url !== url || prev.range !== range) {
        throw new Error(
          `subset "${subset}" is no longer one file across weights — ` +
            `${prev.weight} and ${weight} differ. src/index.css assumes a ` +
            `single variable file per subset and must be revisited.`,
        );
      }
      prev.weights.push(weight);
    } else {
      blocks.set(subset, { url, range, weight, weights: [weight] });
    }
  }
  if (!blocks.size) throw new Error("no @font-face blocks in Google's CSS");
  return blocks;
}

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

async function main() {
  const write = process.argv.includes("--write");
  const css = await fetchText(CSS_URL);

  if (process.argv.includes("--print-css")) {
    process.stdout.write(css);
    return;
  }

  const blocks = parseCss(css);
  let failed = false;

  for (const [subset, { file, sha256: expected, bytes }] of Object.entries(SUBSETS)) {
    const block = blocks.get(subset);
    if (!block) throw new Error(`Google no longer serves a "${subset}" subset`);

    console.log(`${subset}: one file for weights ${block.weights.join(", ")}`);
    console.log(`  url           ${block.url}`);
    console.log(`  unicode-range ${block.range}`);

    const res = await fetch(block.url, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`GET ${block.url} -> ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const digest = sha256(buf);
    console.log(`  ${buf.byteLength} bytes  sha256 ${digest}`);

    if (digest !== expected) {
      console.error(
        `  MISMATCH: pinned ${expected} (${bytes} bytes).\n` +
          `  Google changed the file. Re-verify metrics before accepting it — ` +
          `the iceberg label packer measures text with canvas measureText and ` +
          `a metric shift makes labels overlap. Then update SUBSETS above.`,
      );
      failed = true;
    }

    const dest = path.join(OUT_DIR, file);
    if (write) {
      await mkdir(OUT_DIR, { recursive: true });
      await writeFile(dest, buf);
      console.log(`  wrote ${path.relative(ROOT, dest)}`);
    } else {
      const onDisk = await readFile(dest).catch(() => null);
      if (!onDisk) {
        console.error(`  MISSING: ${path.relative(ROOT, dest)} — run with --write`);
        failed = true;
      } else if (sha256(onDisk) !== digest) {
        console.error(
          `  DRIFT: ${path.relative(ROOT, dest)} does not match the download`,
        );
        failed = true;
      } else {
        console.log(`  ${path.relative(ROOT, dest)} matches`);
      }
    }
  }

  if (failed) process.exitCode = 1;
}

await main();
