// GET /api/meta — crawler-visible <head> injector for the Vite SPA.
//
// Vercel rewrites the shareable routes (/, /t/:id, /l/:layer and their /pt and
// /es variants) to this function so social crawlers — which never run JS —
// receive real per-page <title>/canonical/OG/Twitter tags and an absolute,
// per-page /api/og image. It loads the built index.html and swaps the block
// between the <!--OG:START--> / <!--OG:END--> markers.
//
// Design guarantees:
//   • Absolute URLs are host-derived (no hardcoded domain): origin = https://
//     + the request Host header, so it is correct on any preview domain and
//     survives the solanaiceberg.com cutover with no code change.
//   • The front door never goes down: on ANY error the untouched index.html is
//     returned, so the SPA still boots.
//   • It MAY import @stbr/solana-glossary (no OG-function size limit here);
//     api/og.ts may not.

import {
  getTerm,
  getTermsByDepth,
  type Category,
  type Depth,
  type GlossaryTerm,
} from "@stbr/solana-glossary";
import { getLocalizedTerms } from "@stbr/solana-glossary/i18n";

// Single source of truth for category display names and the depth ordering —
// categoryDepthMap's only SDK import is `import type`, so nothing from the
// frontend bundle is pulled in at runtime.
import {
  categoryLabels,
  depthOrder,
  type DepthId,
} from "../src/data/categoryDepthMap.js";

export const config = { runtime: "nodejs" };

export type Locale = "en" | "pt" | "es";
const LOCALES: readonly Locale[] = ["en", "pt", "es"];

const SITE_NAME = "Solana Iceberg";

/** Bump to invalidate every cached OG image at once. */
export const OG_VERSION = "1";

const IMG_W = "1200";
const IMG_H = "630";

// ---------------------------------------------------------------------------
// Route model
// ---------------------------------------------------------------------------

export type Route =
  | { kind: "default" }
  | { kind: "term"; id?: string }
  | { kind: "layer"; layer?: string };

/**
 * Resolve the incoming request to a route. Explicit hints set by the vercel
 * rewrite destination (`?path=…&id=…&layer=…`) win; otherwise the request path
 * is parsed directly (covers local dev and direct `/api/meta` hits).
 */
export function parseRoute(pathname: string, sp: URLSearchParams): Route {
  const path = sp.get("path");
  const idHint = sp.get("id") || undefined;
  const layerHint = sp.get("layer") || undefined;

  if (path === "term" || idHint) return { kind: "term", id: idHint };
  if (path === "layer" || layerHint) return { kind: "layer", layer: layerHint };
  if (path === "home") return { kind: "default" };

  const seg = stripLocale(pathname).split("/").filter(Boolean);
  if (seg[0] === "t" && seg[1])
    return { kind: "term", id: decodeURIComponent(seg[1]) };
  if (seg[0] === "l" && seg[1])
    return { kind: "layer", layer: decodeURIComponent(seg[1]) };
  return { kind: "default" };
}

// ---------------------------------------------------------------------------
// Locale
// ---------------------------------------------------------------------------

function stripLocale(pathname: string): string {
  const m = pathname.match(/^\/(pt|es)(\/.*|$)/);
  return m ? m[2] || "/" : pathname;
}

/**
 * Precedence: explicit `?lang=` hint (set by the vercel rewrite) → path prefix
 * → Accept-Language → en.
 */
export function detectLocale(
  pathname: string,
  sp: URLSearchParams,
  acceptLanguage: string | null,
): Locale {
  const q = sp.get("lang");
  if (q === "pt" || q === "es" || q === "en") return q;

  if (/^\/pt(\/|$)/.test(pathname)) return "pt";
  if (/^\/es(\/|$)/.test(pathname)) return "es";

  const al = (acceptLanguage || "").toLowerCase().trim();
  if (al.startsWith("pt")) return "pt";
  if (al.startsWith("es")) return "es";
  return "en";
}

export function ogLocale(locale: Locale): string {
  return locale === "pt" ? "pt_BR" : locale === "es" ? "es_ES" : "en_US";
}

/** Full hreflang code used for <link rel="alternate">. */
export function hrefLang(locale: Locale): string {
  return locale === "pt" ? "pt-BR" : locale === "es" ? "es" : "en";
}

/** URL prefix for a locale — English is served unprefixed. */
export function localePrefix(locale: Locale): string {
  return locale === "en" ? "" : `/${locale}`;
}

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

/** Title-case layer names for prose; api/og.ts owns the uppercase pill copy. */
const LAYER_NAMES: Record<Locale, Record<DepthId, string>> = {
  en: {
    surface: "Surface",
    shallow: "Shallow",
    deep: "Deep",
    abyss: "Abyss",
    bottom: "Bottom",
  },
  pt: {
    surface: "Superfície",
    shallow: "Superficial",
    deep: "Profundo",
    abyss: "Abismo",
    bottom: "Fundo",
  },
  es: {
    surface: "Superficie",
    shallow: "Superficial",
    deep: "Profundo",
    abyss: "Abismo",
    bottom: "Fondo",
  },
};

const HOME_TITLE: Record<Locale, string> = {
  en: "Solana Iceberg — Interactive Glossary of 1,059 Solana Terms",
  pt: "Solana Iceberg — Glossário Interativo de 1.059 Termos Solana",
  es: "Solana Iceberg — Glosario Interactivo de 1.059 Términos Solana",
};

const HOME_DESC: Record<Locale, string> = {
  en: "Explore 1,059 Solana terms across 5 depth layers — from Surface basics to deep protocol internals. Available in English, Portuguese, and Spanish.",
  pt: "Explore 1.059 termos Solana em 5 camadas de profundidade — do básico da Superfície às entranhas do protocolo. Disponível em inglês, português e espanhol.",
  es: "Explora 1.059 términos de Solana en 5 capas de profundidad — desde lo básico en la Superficie hasta las entrañas del protocolo. Disponible en inglés, portugués y español.",
};

const HOME_IMAGE_ALT: Record<Locale, string> = {
  en: "Solana Iceberg — 1,059 Solana terms across 5 depth layers",
  pt: "Solana Iceberg — 1.059 termos Solana em 5 camadas de profundidade",
  es: "Solana Iceberg — 1.059 términos de Solana en 5 capas de profundidad",
};

const HOME_CARD_SUB: Record<Locale, string> = {
  en: "1,059 Solana terms, 5 depth layers, 14 categories — dive from the surface to the bottom.",
  pt: "1.059 termos Solana, 5 camadas de profundidade, 14 categorias — mergulhe da superfície ao fundo.",
  es: "1.059 términos de Solana, 5 capas de profundidad, 14 categorías — bucea de la superficie al fondo.",
};

function layerDescription(
  name: string,
  index: number,
  count: number,
  categories: string,
  locale: Locale,
): string {
  if (locale === "pt")
    return `${count} termos na camada ${name} — profundidade ${index} de 5 do Solana Iceberg. Cobre ${categories}.`;
  if (locale === "es")
    return `${count} términos en la capa ${name} — profundidad ${index} de 5 del Solana Iceberg. Cubre ${categories}.`;
  return `${count} terms at the ${name} layer — depth ${index} of 5 on the Solana Iceberg. Covers ${categories}.`;
}

function termImageAlt(
  title: string,
  category: string,
  index: number,
  locale: Locale,
): string {
  if (locale === "pt")
    return `${title} — ${category}, profundidade ${index} de 5 · ${SITE_NAME}`;
  if (locale === "es")
    return `${title} — ${category}, profundidad ${index} de 5 · ${SITE_NAME}`;
  return `${title} — ${category}, depth ${index} of 5 · ${SITE_NAME}`;
}

// ---------------------------------------------------------------------------
// Text + URL helpers
// ---------------------------------------------------------------------------

export function clampText(value: string, max: number): string {
  const s = value.replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface ImageParams {
  title: string;
  subtitle: string;
  kind: "default" | "term" | "layer";
  depth?: DepthId;
  depthIndex?: number;
  lang: Locale;
}

export function buildImageUrl(origin: string, p: ImageParams): string {
  const q = new URLSearchParams();
  q.set("kind", p.kind);
  q.set("title", p.title);
  if (p.subtitle) q.set("subtitle", p.subtitle);
  if (p.depth) q.set("depth", p.depth);
  if (p.depthIndex) q.set("depthIndex", String(p.depthIndex));
  q.set("lang", p.lang);
  q.set("v", OG_VERSION);
  return `${origin}/api/og?${q.toString()}`;
}

// ---------------------------------------------------------------------------
// Data lookups
// ---------------------------------------------------------------------------

const localizedIndexes = new Map<Locale, Map<string, GlossaryTerm>>();

function localized(term: GlossaryTerm, locale: Locale): GlossaryTerm {
  if (locale === "en") return term;
  let index = localizedIndexes.get(locale);
  if (!index) {
    index = new Map(getLocalizedTerms(locale).map((t) => [t.id, t]));
    localizedIndexes.set(locale, index);
  }
  return index.get(term.id) ?? term;
}

function isDepthId(value: string): value is DepthId {
  return (depthOrder as string[]).includes(value);
}

/** The three most common categories at a depth, as a human-readable list. */
function topCategories(terms: GlossaryTerm[], limit = 3): string {
  const counts = new Map<Category, number>();
  for (const t of terms) {
    if (t.category) counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([c]) => categoryLabels[c] ?? c)
    .join(", ");
}

// ---------------------------------------------------------------------------
// Field composition
// ---------------------------------------------------------------------------

export interface MetaFields {
  title: string; // <title> and og:title
  description: string;
  ogType: "website" | "article";
  /** Path relative to the origin, locale prefix included — e.g. /pt/t/amm */
  path: string;
  url: string;
  image: string;
  imageAlt: string;
  locale: Locale;
}

function composeFields(
  route: Route,
  locale: Locale,
  origin: string,
): MetaFields {
  const prefix = localePrefix(locale);

  if (route.kind === "term" && route.id) {
    const base = getTerm(route.id);
    if (base) {
      const term = localized(base, locale);
      const index = base.depth as number;
      const depthId = depthOrder[index - 1];
      const title = term.term;
      const description =
        clampText(term.definition ?? "", 200) || HOME_DESC[locale];
      const category = categoryLabels[base.category] ?? base.category;
      const path = `${prefix}/t/${base.id}`;
      return {
        title: `${title} — ${SITE_NAME}`,
        description,
        ogType: "article",
        path,
        url: `${origin}${path}`,
        image: buildImageUrl(origin, {
          title: clampText(title, 100),
          subtitle: clampText(term.definition ?? "", 180),
          kind: "term",
          depth: depthId,
          depthIndex: index,
          lang: locale,
        }),
        imageAlt: termImageAlt(title, category, index, locale),
        locale,
      };
    }
  }

  if (route.kind === "layer" && route.layer && isDepthId(route.layer)) {
    const depthId = route.layer;
    const index = depthOrder.indexOf(depthId) + 1;
    const terms = getTermsByDepth(index as Depth);
    const name = LAYER_NAMES[locale][depthId];
    const description = layerDescription(
      name,
      index,
      terms.length,
      topCategories(terms),
      locale,
    );
    const path = `${prefix}/l/${depthId}`;
    return {
      title: `${name} — ${SITE_NAME}`,
      description,
      ogType: "website",
      path,
      url: `${origin}${path}`,
      image: buildImageUrl(origin, {
        title: name,
        subtitle: clampText(description, 180),
        kind: "layer",
        depth: depthId,
        depthIndex: index,
        lang: locale,
      }),
      imageAlt: `${name} — ${SITE_NAME}`,
      locale,
    };
  }

  // Default / home — also the graceful fallback for an unknown term or layer.
  const path = `${prefix}/`;
  return {
    title: HOME_TITLE[locale],
    description: HOME_DESC[locale],
    ogType: "website",
    path,
    url: `${origin}${path}`,
    image: buildImageUrl(origin, {
      title: SITE_NAME,
      subtitle: HOME_CARD_SUB[locale],
      kind: "default",
      lang: locale,
    }),
    imageAlt: HOME_IMAGE_ALT[locale],
    locale,
  };
}

// ---------------------------------------------------------------------------
// Tag rendering + injection
// ---------------------------------------------------------------------------

/** Same route on every other locale, for hreflang alternates. */
function alternatePaths(f: MetaFields): { locale: Locale; path: string }[] {
  const bare = f.path.replace(/^\/(pt|es)(?=\/|$)/, "") || "/";
  return LOCALES.map((l) => ({
    locale: l,
    path: `${localePrefix(l)}${bare === "/" ? "/" : bare}`,
  }));
}

export function renderMetaTags(f: MetaFields, origin: string): string {
  const e = escapeHtml;
  const alternates = alternatePaths(f);
  return [
    `<title>${e(f.title)}</title>`,
    `<meta name="description" content="${e(f.description)}" />`,
    `<link rel="canonical" href="${e(f.url)}" />`,
    ...alternates.map(
      (a) =>
        `<link rel="alternate" hreflang="${hrefLang(a.locale)}" href="${e(
          `${origin}${a.path}`,
        )}" />`,
    ),
    `<link rel="alternate" hreflang="x-default" href="${e(`${origin}/`)}" />`,
    `<meta property="og:type" content="${f.ogType}" />`,
    `<meta property="og:site_name" content="${e(SITE_NAME)}" />`,
    `<meta property="og:title" content="${e(f.title)}" />`,
    `<meta property="og:description" content="${e(f.description)}" />`,
    `<meta property="og:url" content="${e(f.url)}" />`,
    `<meta property="og:image" content="${e(f.image)}" />`,
    `<meta property="og:image:type" content="image/png" />`,
    `<meta property="og:image:width" content="${IMG_W}" />`,
    `<meta property="og:image:height" content="${IMG_H}" />`,
    `<meta property="og:image:alt" content="${e(f.imageAlt)}" />`,
    `<meta property="og:locale" content="${ogLocale(f.locale)}" />`,
    ...LOCALES.filter((l) => l !== f.locale).map(
      (l) => `<meta property="og:locale:alternate" content="${ogLocale(l)}" />`,
    ),
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${e(f.title)}" />`,
    `<meta name="twitter:description" content="${e(f.description)}" />`,
    `<meta name="twitter:image" content="${e(f.image)}" />`,
    `<meta name="twitter:image:alt" content="${e(f.imageAlt)}" />`,
  ].join("\n    ");
}

export function injectMeta(html: string, tags: string, locale: Locale): string {
  const withTags = html.replace(
    /<!--OG:START-->[\s\S]*?<!--OG:END-->/,
    () => `<!--OG:START-->\n    ${tags}\n    <!--OG:END-->`,
  );
  return withTags.replace(
    /<html\s+lang="[^"]*"/i,
    () => `<html lang="${hrefLang(locale)}"`,
  );
}

// ---------------------------------------------------------------------------
// index.html loader (memoized ~5 min) + handler
// ---------------------------------------------------------------------------

const INDEX_TTL_MS = 5 * 60 * 1000;
let indexCache: { html: string; at: number } | null = null;

async function loadIndexHtml(origin: string): Promise<string> {
  const now = Date.now();
  if (indexCache && now - indexCache.at < INDEX_TTL_MS) return indexCache.html;
  const res = await fetch(`${origin}/index.html`, {
    headers: { "user-agent": "solana-iceberg-meta" },
  });
  if (!res.ok) throw new Error(`index.html fetch failed: ${res.status}`);
  const html = await res.text();
  indexCache = { html, at: now };
  return html;
}

function htmlHeaders(): Record<string, string> {
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
  };
}

const FALLBACK_HTML = `<!doctype html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${HOME_TITLE.en}</title><meta name="description" content="${HOME_DESC.en}" /></head><body><div id="root"></div></body></html>`;

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const host = req.headers.get("host");
  const origin = host ? `https://${host}` : url.origin;

  let html: string | null = null;
  try {
    html = await loadIndexHtml(origin);
    const locale = detectLocale(
      url.pathname,
      url.searchParams,
      req.headers.get("accept-language"),
    );
    const route = parseRoute(url.pathname, url.searchParams);
    const fields = composeFields(route, locale, origin);
    const out = injectMeta(html, renderMetaTags(fields, origin), locale);
    return new Response(out, { headers: htmlHeaders() });
  } catch (err) {
    // A meta bug must never take the site down: serve the untouched shell.
    console.error("[meta] error, serving untouched index.html:", err);
    if (html) return new Response(html, { headers: htmlHeaders() });
    try {
      const raw = await fetch(`${origin}/index.html`).then((r) => r.text());
      return new Response(raw, { headers: htmlHeaders() });
    } catch {
      return new Response(FALLBACK_HTML, { headers: htmlHeaders() });
    }
  }
}

// Web-standard invocation on Vercel: a bare default-exported function would be
// invoked Node-style (req, res); the { fetch } form selects the
// Request/Response path.
export default { fetch: handler };
