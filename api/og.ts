// GET /api/og — dynamic 1200×630 Open Graph image for Solana Iceberg.
//
// Purely query-param driven so it stays tiny and fast: it does NOT import
// @stbr/solana-glossary (that ~1.7 MB data set blows Vercel's OG-function size
// limit) and it does NOT import anything from src/. All copy is passed in by
// /api/meta; brand tokens are mirrored here as literals. Fonts are fetched once
// from Google's gstatic CDN and memoized at module scope for the function's
// warm lifetime. The rendered PNG is immutable and cached for a year — bump
// OG_VERSION in api/meta.ts (the `v=` param) to invalidate every card at once.
//
// Plain .ts with React.createElement, NOT .tsx: @vercel/node does not
// JSX-compile vanilla api/ .tsx functions — the file dies at parse and every
// invocation returns FUNCTION_INVOCATION_FAILED (verified in production on the
// sibling solana-glossary deployment).
//
// Contract:
//   /api/og?kind=default|term|layer&title=&subtitle=&depth=<DepthId>
//          &depthIndex=<1..5>&lang=en|pt|es&v=<OG_VERSION>

import React from "react";
import { ImageResponse } from "@vercel/og";

export const config = { runtime: "nodejs" };

const h = React.createElement;

const WIDTH = 1200;
const HEIGHT = 630;

// ---------------------------------------------------------------------------
// Brand tokens — mirror src/data/categoryDepthMap.ts + src/index.css.
// Hardcoded on purpose: api/og.ts must not import from src/.
// ---------------------------------------------------------------------------

const SKY = "#0D0D1A"; // sky / above the waterline
const WATER = "#0a1628"; // shallow water
const ABYSS = "#020408"; // bottom of the iceberg
const PURPLE = "#9945FF";
const GREEN = "#14F195";
const FG = "#FFFFFF";
const MUTED = "#8F96A3";

type DepthId = "surface" | "shallow" | "deep" | "abyss" | "bottom";

const DEPTH_ORDER: readonly DepthId[] = [
  "surface",
  "shallow",
  "deep",
  "abyss",
  "bottom",
];

const DEPTH_COLORS: Record<DepthId, string> = {
  surface: GREEN,
  shallow: "#22D3EE",
  deep: "#38BDF8",
  abyss: "#818CF8",
  bottom: PURPLE,
};

type Locale = "en" | "pt" | "es";

/** Uppercase layer names, mirroring src/i18n `depth.*`. */
const DEPTH_NAMES: Record<Locale, Record<DepthId, string>> = {
  en: {
    surface: "SURFACE",
    shallow: "SHALLOW",
    deep: "DEEP",
    abyss: "ABYSS",
    bottom: "BOTTOM",
  },
  pt: {
    surface: "SUPERFÍCIE",
    shallow: "SUPERFICIAL",
    deep: "PROFUNDO",
    abyss: "ABISMO",
    bottom: "FUNDO",
  },
  es: {
    surface: "SUPERFICIE",
    shallow: "SUPERFICIAL",
    deep: "PROFUNDO",
    abyss: "ABISMO",
    bottom: "FONDO",
  },
};

const DEPTH_WORD: Record<Locale, string> = {
  en: "DEPTH",
  pt: "PROFUNDIDADE",
  es: "PROFUNDIDAD",
};

const DEFAULT_EYEBROW: Record<Locale, string> = {
  en: "INTERACTIVE GLOSSARY",
  pt: "GLOSSÁRIO INTERATIVO",
  es: "GLOSARIO INTERACTIVO",
};

const FOOTER_STATS: Record<Locale, string> = {
  en: "1,059 terms · 5 depths",
  pt: "1.059 termos · 5 profundidades",
  es: "1.059 términos · 5 profundidades",
};

const TITLE_MAX = 100;
const SUBTITLE_MAX = 200;

type OgKind = "default" | "term" | "layer";
const KINDS: readonly OgKind[] = ["default", "term", "layer"];

// ---------------------------------------------------------------------------
// Fonts — fetched from the Google Fonts CSS API, memoized per family+weight.
// A legacy User-Agent forces a WOFF/TTF payload (Satori cannot parse WOFF2),
// and we isolate the `latin` subset whose unicode-range (U+0000-00FF) already
// covers every accent en/pt/es needs (á é í ó ú ã õ ç ñ ¿ ¡).
// ---------------------------------------------------------------------------

interface LoadedFont {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 500 | 700;
  style: "normal";
}

const LEGACY_UA =
  "Mozilla/5.0 (Windows NT 6.1; Trident/7.0; rv:11.0) like Gecko";

const FONT_FAMILY = "Space Grotesk";

const fontCache = new Map<string, Promise<LoadedFont | null>>();

function pickLatinFontUrl(css: string): string | null {
  // The CSS API emits one `@font-face` per subset, each preceded by a
  // `/* latin */`-style comment. Grab the block after the exact `latin`
  // marker (not `latin-ext`) and read its font URL. Some families (Space
  // Grotesk among them) come back as a single unsegmented block for legacy
  // UAs — the `?? css` fallback covers that.
  const segment = css.split(/\/\*\s*latin\s*\*\//)[1] ?? css;
  const match = segment.match(
    /url\((https:\/\/[^)]+)\)\s*format\('(?:woff|truetype|opentype)'\)/,
  );
  return match ? match[1] : null;
}

function loadFont(
  family: string,
  weight: 400 | 500 | 700,
): Promise<LoadedFont | null> {
  const key = `${family}:${weight}`;
  const cached = fontCache.get(key);
  if (cached) return cached;

  const promise = (async (): Promise<LoadedFont | null> => {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
      family,
    )}:wght@${weight}`;
    const cssRes = await fetch(cssUrl, { headers: { "User-Agent": LEGACY_UA } });
    if (!cssRes.ok) return null;
    const url = pickLatinFontUrl(await cssRes.text());
    if (!url) return null;
    const fontRes = await fetch(url);
    if (!fontRes.ok) return null;
    return {
      name: family,
      data: await fontRes.arrayBuffer(),
      weight,
      style: "normal",
    };
  })().catch(() => null);

  fontCache.set(key, promise);
  return promise;
}

async function loadFonts(): Promise<LoadedFont[]> {
  const fonts = await Promise.all([
    loadFont(FONT_FAMILY, 400),
    loadFont(FONT_FAMILY, 500),
    loadFont(FONT_FAMILY, 700),
  ]);
  return fonts.filter((f): f is LoadedFont => f !== null);
}

// ---------------------------------------------------------------------------
// Param parsing + helpers
// ---------------------------------------------------------------------------

function clamp(value: string, max: number): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > max
    ? `${trimmed.slice(0, max - 1).trimEnd()}…`
    : trimmed;
}

function parseKind(raw: string | null): OgKind {
  return KINDS.includes(raw as OgKind) ? (raw as OgKind) : "default";
}

function parseLocale(raw: string | null): Locale {
  return raw === "pt" || raw === "es" ? raw : "en";
}

function parseDepth(
  depthRaw: string | null,
  indexRaw: string | null,
): { id: DepthId; index: number } | null {
  if (depthRaw && DEPTH_ORDER.includes(depthRaw as DepthId)) {
    const id = depthRaw as DepthId;
    return { id, index: DEPTH_ORDER.indexOf(id) + 1 };
  }
  const n = Number(indexRaw);
  if (Number.isInteger(n) && n >= 1 && n <= 5) {
    return { id: DEPTH_ORDER[n - 1], index: n };
  }
  return null;
}

function titleSize(title: string): number {
  const n = title.length;
  if (n > 72) return 46;
  if (n > 52) return 54;
  if (n > 34) return 62;
  return 70;
}

/** #RRGGBB → rgba() so Satori never has to parse 8-digit hex. */
function rgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ---------------------------------------------------------------------------
// Iceberg glyph — inline SVG with a green→purple <linearGradient>. Inline
// gradients render reliably in Satori; CSS background-clip:text does not.
// ---------------------------------------------------------------------------

function icebergMark(): React.ReactElement {
  return h(
    "svg",
    {
      width: "34",
      height: "34",
      viewBox: "0 0 40 40",
      xmlns: "http://www.w3.org/2000/svg",
    },
    h(
      "defs",
      null,
      h(
        "linearGradient",
        {
          id: "icebergMark",
          x1: "0",
          y1: "0",
          x2: "40",
          y2: "40",
          gradientUnits: "userSpaceOnUse",
        },
        h("stop", { offset: "0", stopColor: GREEN }),
        h("stop", { offset: "1", stopColor: PURPLE }),
      ),
    ),
    // Peak above the waterline.
    h("path", { d: "M20 3 L31 18 L9 18 Z", fill: "url(#icebergMark)" }),
    // Submerged mass.
    h("path", {
      d: "M8 21 L32 21 L35 26.5 L24 37 L14 35 L6 26 Z",
      fill: "url(#icebergMark)",
      fillOpacity: "0.42",
    }),
    // Waterline.
    h("rect", {
      x: "2",
      y: "18.2",
      width: "36",
      height: "2",
      rx: "1",
      fill: rgba(GREEN, 0.7),
    }),
  );
}

// ---------------------------------------------------------------------------
// Card pieces
// ---------------------------------------------------------------------------

/** The signature element: a five-segment depth gauge down the left edge. */
function depthRail(active: DepthId | null): React.ReactElement {
  return h(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: 116,
        paddingLeft: 18,
        gap: 12,
      },
    },
    ...DEPTH_ORDER.map((id) => {
      const color = DEPTH_COLORS[id];
      const isActive = active === null || active === id;
      // Satori rejects an empty boxShadow, so the glow is spread in only when
      // a single depth is highlighted.
      const glow =
        active !== null && isActive
          ? { boxShadow: `0 0 28px ${rgba(color, 0.65)}` }
          : {};
      return h("div", {
        key: id,
        style: {
          display: "flex",
          width: 14,
          height: 74,
          borderRadius: 7,
          backgroundColor: isActive ? color : rgba(color, 0.16),
          ...glow,
        },
      });
    }),
  );
}

/**
 * Waterline rule + the soft green glow band beneath it, echoing the site's
 * WaveDivider. It bleeds past the right padding so it reads as a horizon
 * running off the card rather than a boxed divider.
 */
function waterline(): React.ReactElement {
  return h(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        marginTop: 24,
        marginRight: -70,
      },
    },
    h("div", {
      style: {
        display: "flex",
        height: 2,
        backgroundImage: `linear-gradient(90deg, ${rgba(GREEN, 0)}, ${rgba(
          GREEN,
          0.8,
        )} 10%, ${rgba(GREEN, 0.3)} 62%, ${rgba(GREEN, 0)})`,
        boxShadow: `0 0 14px ${rgba(GREEN, 0.4)}`,
      },
    }),
    h("div", {
      style: {
        display: "flex",
        height: 26,
        backgroundImage: `radial-gradient(560px 26px at 18% 0%, ${rgba(
          GREEN,
          0.18,
        )}, transparent 72%)`,
      },
    }),
  );
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

async function handler(req: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(req.url);

    const kind = parseKind(searchParams.get("kind"));
    const locale = parseLocale(searchParams.get("lang"));
    const title = clamp(searchParams.get("title") || "Solana Iceberg", TITLE_MAX);
    const subtitle = clamp(searchParams.get("subtitle") || "", SUBTITLE_MAX);
    const depth =
      kind === "default"
        ? null
        : parseDepth(searchParams.get("depth"), searchParams.get("depthIndex"));

    const accent = depth ? DEPTH_COLORS[depth.id] : GREEN;

    // Every depth tier gets a visibly different card edge; the home card gets
    // the full surface→bottom ramp instead.
    const accentBarImage = depth
      ? `linear-gradient(90deg, ${accent}, ${accent === PURPLE ? GREEN : PURPLE})`
      : `linear-gradient(90deg, ${GREEN}, ${DEPTH_COLORS.deep}, ${PURPLE})`;

    const eyebrow = depth
      ? `${DEPTH_WORD[locale]} ${depth.index} · ${DEPTH_NAMES[locale][depth.id]}`
      : DEFAULT_EYEBROW[locale];

    const fonts = await loadFonts();

    const accentBar = h("div", {
      style: {
        display: "flex",
        width: "100%",
        height: 10,
        backgroundImage: accentBarImage,
      },
    });

    const eyebrowEl = h(
      "div",
      {
        style: {
          display: "flex",
          alignSelf: "flex-start",
          alignItems: "center",
          padding: "9px 18px",
          borderRadius: 999,
          border: `1px solid ${rgba(accent, 0.34)}`,
          backgroundColor: rgba(accent, 0.12),
          color: accent,
          fontWeight: 500,
          fontSize: 21,
          letterSpacing: 2,
        },
      },
      eyebrow,
    );

    const titleEl = h(
      "div",
      {
        style: {
          display: "flex",
          fontWeight: 700,
          fontSize: titleSize(title),
          lineHeight: 1.06,
          letterSpacing: -1,
          color: FG,
          maxWidth: 900,
        },
      },
      title,
    );

    const subtitleEl = subtitle
      ? h(
          "div",
          {
            style: {
              display: "flex",
              marginTop: 24,
              fontSize: 27,
              lineHeight: 1.42,
              color: MUTED,
              maxWidth: 880,
            },
          },
          subtitle,
        )
      : null;

    const centerBlock = h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          flex: 1,
          justifyContent: "center",
        },
      },
      titleEl,
      subtitleEl,
    );

    const footer = h(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 24,
          borderTop: `1px solid ${rgba(FG, 0.1)}`,
        },
      },
      h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: 14 } },
        icebergMark(),
        h(
          "div",
          {
            style: {
              display: "flex",
              fontWeight: 500,
              fontSize: 24,
              letterSpacing: 0.5,
              color: FG,
            },
          },
          "solana iceberg",
        ),
      ),
      h(
        "div",
        { style: { display: "flex", fontWeight: 400, fontSize: 21, color: MUTED } },
        FOOTER_STATS[locale],
      ),
    );

    const content = h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          flex: 1,
          padding: "46px 70px 42px 28px",
        },
      },
      eyebrowEl,
      waterline(),
      centerBlock,
      footer,
    );

    const body = h(
      "div",
      { style: { display: "flex", flexDirection: "row", flex: 1 } },
      depthRail(depth ? depth.id : null),
      content,
    );

    const root = h(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: SKY,
          // Sky → shallow water → abyss, plus the aurora's purple/green bloom.
          backgroundImage: [
            `radial-gradient(820px 460px at 92% -10%, ${rgba(PURPLE, 0.3)}, transparent 62%)`,
            `radial-gradient(760px 520px at -8% 112%, ${rgba(GREEN, 0.18)}, transparent 60%)`,
            `linear-gradient(180deg, ${SKY} 0%, ${WATER} 48%, ${ABYSS} 100%)`,
          ].join(", "),
          fontFamily: FONT_FAMILY,
        },
      },
      accentBar,
      body,
    );

    return new ImageResponse(root, {
      width: WIDTH,
      height: HEIGHT,
      fonts: fonts.length
        ? fonts.map((f) => ({
            name: f.name,
            data: f.data,
            weight: f.weight,
            style: f.style,
          }))
        : undefined,
      headers: {
        "Cache-Control":
          "public, max-age=31536000, s-maxage=31536000, immutable",
      },
    });
  } catch (err) {
    console.error("[og] render error:", err);
    return new Response("Failed to generate image", { status: 500 });
  }
}

// Web-standard invocation on Vercel: a bare default-exported function would be
// invoked Node-style (req, res); the { fetch } form selects the
// Request/Response path.
export default { fetch: handler };
