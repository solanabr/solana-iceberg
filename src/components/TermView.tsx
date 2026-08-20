import { motion } from "framer-motion";
import { useMemo, useRef, useEffect, useState } from "react";
import { ArrowLeft, Home, Link2 } from "lucide-react";
import {
  type GlossaryTerm,
  categoryLabels,
  type Category,
  depthPillColors,
} from "@/data/glossaryAdapter";
import { useTranslation } from "@/i18n/context";
import { getTermName, getTermDefinition } from "@/i18n/glossary";
import DecryptedText from "@/components/reactbits/DecryptedText";

/**
 * Rank each layer by depth so we can sort related terms top-down.
 * Lower rank = shallower = rendered higher on screen.
 */
const DEPTH_RANK: Record<string, number> = {
  surface: 0,
  shallow: 1,
  deep: 2,
  abyss: 3,
  bottom: 4,
};

interface RelatedTerm {
  layerId: string;
  term: GlossaryTerm;
}

interface Props {
  term: GlossaryTerm;
  layerId: string;
  relatedTerms: RelatedTerm[];
  onBack: () => void;
  onHome: () => void;
  /** When false, the dedicated "home" button in the top-left is
   *  hidden. Used when the term view was opened directly from the
   *  home screen (no layer view in between), since the back button
   *  would go straight home anyway and a second home button is
   *  redundant. */
  showHomeButton?: boolean;
  /** Hide TermView's own back/home buttons on narrow — they're
   *  in the unified navbar instead. */
  narrowMode?: boolean;
  onTermClick: (layerId: string, termId: string) => void;
}

const TermView = ({
  term,
  layerId,
  relatedTerms,
  onBack,
  onHome,
  showHomeButton = true,
  narrowMode = false,
  onTermClick,
}: Props) => {
  const { lang, t } = useTranslation();

  /* Translated depth labels keyed by layer id */
  const depthLabels: Record<string, string> = {
    surface: t("term.depth.surface"),
    shallow: t("term.depth.shallow"),
    deep: t("term.depth.deep"),
    abyss: t("term.depth.abyss"),
    bottom: t("term.depth.bottom"),
  };

  /* Glossary overlay: translated name + definition (PT-BR only, falls back to English) */
  const translatedName = getTermName(lang, term.id) ?? term.term;
  const translatedDefinition =
    getTermDefinition(lang, term.id) ?? term.definition;

  /* The term modal's primary chroma comes from the depth it belongs
     to — title color, border, shadow, category chip, and footer all
     read from this single value. Default falls back to Solana green
     (surface) if the layerId is somehow unknown. */
  const depthColor =
    depthPillColors[layerId as keyof typeof depthPillColors] ?? "#14F195";
  const depthRgb = (() => {
    const m = depthColor.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (!m) return { r: 20, g: 241, b: 149 };
    return {
      r: parseInt(m[1], 16),
      g: parseInt(m[2], 16),
      b: parseInt(m[3], 16),
    };
  })();
  const rgba = (a: number) =>
    `rgba(${depthRgb.r}, ${depthRgb.g}, ${depthRgb.b}, ${a})`;
  /* Ref for rAF loop to track actual card center for line origins */
  const cardRef = useRef<HTMLDivElement | null>(null);

  /* The definition box scrolls, but index.css hides scrollbars globally,
     so a long definition just stops mid-sentence with no cue that more
     text follows. Track whether anything is still below the fold to
     drive the bottom fade. */
  const defRef = useRef<HTMLParagraphElement | null>(null);
  const [defHasMore, setDefHasMore] = useState(false);

  useEffect(() => {
    const el = defRef.current;
    if (!el) return;
    const sync = () =>
      setDefHasMore(el.scrollHeight - el.scrollTop - el.clientHeight > 1);
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    /* The cap is 30vh, so a resize alone can end the overflow; a late
       webfont swap reflows the text without resizing the box. */
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    document.fonts?.ready.then(sync);
    return () => {
      el.removeEventListener("scroll", sync);
      observer.disconnect();
    };
  }, [translatedDefinition]);

  /* Measured card dimensions; orbit uses defaults until ResizeObserver fires */
  const [cardDims, setCardDims] = useState<{ w: number; h: number }>({
    w: 0,
    h: 0,
  });

  /* Track card size for orbit calculations; 2px threshold avoids sub-pixel jitter */
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setCardDims((prev) => {
        if (Math.abs(prev.w - width) < 2 && Math.abs(prev.h - height) < 2)
          return prev;
        return { w: width, h: height };
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* Related terms sorted shallowest → deepest so the one with the
     smallest DEPTH_RANK lands in the top orbit slot and the one with
     the largest lands in the bottom slot. The original `relatedTerms`
     array is left untouched for non-positional uses. */
  const orderedRelated = useMemo(() => {
    const slice = relatedTerms.slice(0, 8);
    const sortedByDepth = [...slice].sort(
      (a, b) => (DEPTH_RANK[a.layerId] ?? 99) - (DEPTH_RANK[b.layerId] ?? 99),
    );
    const count = sortedByDepth.length;
    if (count === 0) return [];
    /* Build the map from slice-index → sin(angle) so we can rank the
       eight orbit slots by vertical position (most-negative = top). */
    const slotYRanks = Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
      return { slot: i, y: Math.sin(angle) };
    })
      .sort((a, b) => a.y - b.y)
      .map((o) => o.slot);
    /* result[slot] = sortedByDepth[rankOfSlotByY]
       so shallowest goes to the top-most orbit slot. */
    const result = new Array<(typeof slice)[number]>(count);
    sortedByDepth.forEach((item, rank) => {
      result[slotYRanks[rank]] = item;
    });
    return result;
  }, [relatedTerms]);

  /* The orbit needs a lateral corridor beside the card wide enough to
     hold a pill, and below ~1100px there isn't one — at 768px it is
     127px against a 163px narrowest pill, so the solver had nowhere
     legal to put anything and pills clipped off the left edge and
     stacked on each other. `narrowMode` is the same width/orientation
     test the rest of the app uses, so those viewports get the stacked
     layout under the card instead of an unsolvable orbit. */
  const orbitRelated = narrowMode ? [] : orderedRelated;

  /* Stable animation timings — separate from positions so orbit recalcs don't reset animations */
  const termTimings = useMemo(() => {
    return orderedRelated.map(() => ({
      duration: 4 + Math.random() * 3,
      delay: Math.random() * 2,
    }));
  }, [orderedRelated]);

  const termPositions = useMemo(() => {
    const count = orderedRelated.length;
    if (count === 0) return [];

    /* ── Viewport dimensions (px) ── */
    const vw = window.innerWidth || 1280;
    const vh = window.innerHeight || 800;

    /* Card dimensions — fallback 384x300 before ResizeObserver fires */
    const cardW = cardDims.w > 0 ? cardDims.w : 384;
    const cardH = cardDims.h > 0 ? cardDims.h : 300;

    /* Card center (viewport center — flex-centered in the overlay) */
    const cx = vw / 2;
    const cy = vh / 2;
    const hw = cardW / 2;
    const hh = cardH / 2;

    /* Pill + gap constants. Pills are whitespace-nowrap and term names
       run long ("Mint Close Authority Extension" measures 280px with its
       depth label), so the half-width has to cover the widest pill, not
       an average one — under-estimating it let wide pills hang off the
       left edge and let the collision pass below call two pills clear
       when they still overlapped by ~55px. */
    const PILL_HALF_W = 140;
    const PILL_HALF_H = 20;
    const CARD_GAP = 34;

    /* Safe viewport — clears header UI, screen edges, and a bit
       more on the bottom so pills don't fall off on short screens. */
    const SAFE_TOP = 96 + PILL_HALF_H;
    const SAFE_BOTTOM = vh * 0.94 - PILL_HALF_H;
    const SAFE_LEFT = vw * 0.04 + PILL_HALF_W;
    const SAFE_RIGHT = vw * 0.96 - PILL_HALF_W;

    /* Card exclusion — a rounded rectangle the pills must never
       enter. Slightly bigger than the card to leave visual breathing
       room so pills don't feel stuck to the border. */
    const EXCL_HW = hw + CARD_GAP + PILL_HALF_W;
    const EXCL_HH = hh + CARD_GAP + PILL_HALF_H;

    const clamp = (v: number, lo: number, hi: number) =>
      Math.min(Math.max(v, lo), hi);

    /* Deterministic pseudorandom: same term id always produces the
       same number so the orbit is stable between renders. */
    const hashSeed = (s: string): number => {
      let h = 2166136261 >>> 0;
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return h >>> 0;
    };
    const prng = (seed: number): number => {
      // Mulberry32 — fast, well-distributed
      let t = (seed + 0x6d2b79f5) >>> 0;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    /* Y band per term — shallower ranks get higher bands. We preserve
       the existing Y-ordered slot mapping from `orderedRelated` so
       term[0] lands in the top band and term[count-1] in the bottom. */
    const slotYs: number[] = [];
    for (let i = 0; i < count; i++) {
      /* Normalize slot index to [0..1] then map to [SAFE_TOP..SAFE_BOTTOM].
         Per-slot tiny jitter keeps terms from sitting on an obvious grid. */
      const t = count === 1 ? 0.5 : i / (count - 1);
      slotYs.push(SAFE_TOP + t * (SAFE_BOTTOM - SAFE_TOP));
    }

    /* Assign an X for each term using pseudo-random + side alternation.
       Terms that sit near the card vertically get forced to the left
       or right of the exclusion zone (diagonal placement). Terms far
       above or below may sit anywhere horizontally. */
    const positions = orderedRelated.map((r, i) => {
      const seed = hashSeed(r.term.id);
      const r1 = prng(seed);
      const r2 = prng(seed * 33 + 7);
      /* Alternate sides by index but let the pseudo-random flip it
         occasionally (~30%) so the pattern isn't obvious. */
      let side = i % 2 === 0 ? -1 : 1;
      if (r1 < 0.3) side = -side;

      const baseY = slotYs[i];
      /* Add vertical jitter (±30% of a band) so terms aren't perfectly aligned. */
      const bandHeight =
        count <= 1 ? 0 : (SAFE_BOTTOM - SAFE_TOP) / Math.max(count - 1, 1);
      const jitterY = (r2 - 0.5) * bandHeight * 0.55;
      const y = clamp(baseY + jitterY, SAFE_TOP, SAFE_BOTTOM);

      /* X is pseudo-random within the safe lateral band on the chosen
         side. If the y is too close to the card vertically, force the
         x to be OUTSIDE the card exclusion (diagonal placement). */
      const vOffset = Math.abs(y - cy);
      const mustAvoidCardX = vOffset < EXCL_HH;
      let x: number;
      if (mustAvoidCardX) {
        /* Push to the left or right side of the card, past the
           exclusion zone, with pseudo-random extra distance. */
        const extra = 20 + prng(seed + 111) * 80;
        x = side < 0 ? cx - EXCL_HW - extra : cx + EXCL_HW + extra;
      } else {
        /* Free to wander horizontally. Use pseudo-random within a
           generous band; biased slightly toward the chosen side for
           variety. */
        const t = prng(seed + 222);
        const sideFrac = 0.25 + t * 0.7; // 0.25..0.95 of the side distance
        x =
          side < 0
            ? cx - (cx - SAFE_LEFT) * sideFrac
            : cx + (SAFE_RIGHT - cx) * sideFrac;
      }

      x = clamp(x, SAFE_LEFT, SAFE_RIGHT);

      return { x, y };
    });

    /* Post-pass: enforce exclusion zone everywhere (safety net). */
    for (const pos of positions) {
      const dx = pos.x - cx;
      const dy = pos.y - cy;
      if (Math.abs(dx) < EXCL_HW && Math.abs(dy) < EXCL_HH) {
        const scaleX = EXCL_HW / (Math.abs(dx) || 1);
        const scaleY = EXCL_HH / (Math.abs(dy) || 1);
        const scale = Math.max(scaleX, scaleY);
        pos.x = cx + dx * scale;
        pos.y = cy + dy * scale;
        pos.x = clamp(pos.x, SAFE_LEFT, SAFE_RIGHT);
        pos.y = clamp(pos.y, SAFE_TOP, SAFE_BOTTOM);
      }
    }

    /* Inter-pill collision resolution passes. */
    const PILL_W = PILL_HALF_W * 2;
    const PILL_H = 40;
    const TERM_GAP = 14;
    const MIN_DIST_X = PILL_W + TERM_GAP;
    const MIN_DIST_Y = PILL_H + TERM_GAP;

    for (let pass = 0; pass < 6; pass++) {
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const dx = positions[j].x - positions[i].x;
          const dy = positions[j].y - positions[i].y;
          const overlapX = MIN_DIST_X - Math.abs(dx);
          const overlapY = MIN_DIST_Y - Math.abs(dy);
          if (overlapX > 0 && overlapY > 0) {
            if (overlapX < overlapY) {
              const push = overlapX / 2 + 0.5;
              const sign = dx >= 0 ? 1 : -1;
              positions[i].x -= push * sign;
              positions[j].x += push * sign;
            } else {
              const push = overlapY / 2 + 0.5;
              const sign = dy >= 0 ? 1 : -1;
              positions[i].y -= push * sign;
              positions[j].y += push * sign;
            }
            for (const idx of [i, j]) {
              positions[idx].x = clamp(positions[idx].x, SAFE_LEFT, SAFE_RIGHT);
              positions[idx].y = clamp(positions[idx].y, SAFE_TOP, SAFE_BOTTOM);
              /* Re-apply card exclusion after collision push */
              const cdx = positions[idx].x - cx;
              const cdy = positions[idx].y - cy;
              if (Math.abs(cdx) < EXCL_HW && Math.abs(cdy) < EXCL_HH) {
                const scaleX = EXCL_HW / (Math.abs(cdx) || 1);
                const scaleY = EXCL_HH / (Math.abs(cdy) || 1);
                const scale = Math.max(scaleX, scaleY);
                positions[idx].x = cx + cdx * scale;
                positions[idx].y = cy + cdy * scale;
                positions[idx].x = clamp(
                  positions[idx].x,
                  SAFE_LEFT,
                  SAFE_RIGHT,
                );
                positions[idx].y = clamp(
                  positions[idx].y,
                  SAFE_TOP,
                  SAFE_BOTTOM,
                );
              }
            }
          }
        }
      }
    }

    return positions.map((pos, i) => ({
      left: (pos.x / vw) * 100,
      top: (pos.y / vh) * 100,
      ...termTimings[i],
    }));
  }, [orderedRelated, cardDims, termTimings]);

  /* rAF loop keeps SVG lines attached to floating terms during CSS animation */
  const termRefs = useRef<(HTMLDivElement | null)[]>([]);
  const lineRefs = useRef<(SVGLineElement | null)[]>([]);

  // Cached card center — stable after entry animation, updated on resize
  const cardCenterRef = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const measureCardCenter = () => {
      const el = cardRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        cardCenterRef.current = {
          x: r.left + r.width / 2,
          y: r.top + r.height / 2,
        };
      } else {
        cardCenterRef.current = {
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        };
      }
    };
    measureCardCenter();
    // Re-measure after entry animation settles (0.2s delay + 0.4s duration)
    const timerId = setTimeout(measureCardCenter, 700);
    window.addEventListener("resize", measureCardCenter);
    return () => {
      clearTimeout(timerId);
      window.removeEventListener("resize", measureCardCenter);
    };
  }, [cardDims]);

  useEffect(() => {
    let rafId = 0;
    const updateLines = () => {
      const { x: cardCx, y: cardCy } = cardCenterRef.current;

      for (let i = 0; i < lineRefs.current.length; i++) {
        const termEl = termRefs.current[i];
        const lineEl = lineRefs.current[i];
        if (!termEl || !lineEl) continue;
        const target = (termEl.firstElementChild as HTMLElement) ?? termEl;
        const rect = target.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        lineEl.setAttribute("x1", String(cardCx));
        lineEl.setAttribute("y1", String(cardCy));
        lineEl.setAttribute("x2", String(cx));
        lineEl.setAttribute("y2", String(cy));
      }
      rafId = requestAnimationFrame(updateLines);
    };
    rafId = requestAnimationFrame(updateLines);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <motion.div
      /* z-[85] above all fixed UI; only cursor effects paint higher */
      className="fixed inset-0 z-[85] overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {/* Dark overlay — layer view underneath already has its own blur
          via the `defocused` prop, so this layer just dims the content
          behind the term card. Click anywhere outside the card (except
          related term pills) pops back to the LayerView beneath. */}
      <div
        className="absolute inset-0"
        onClick={onBack}
        style={{
          background: "rgba(0, 0, 0, 0.35)",
        }}
      />

      {/* Back + Home buttons — hidden on narrow where the unified
          navbar handles navigation instead. */}
      {!narrowMode && (
        <button
          onClick={onBack}
          className="absolute z-[80] flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200 text-foreground/80 hover:text-secondary border border-border/40 hover:border-secondary/40"
          style={{
            top: "16px",
            left: "16px",
            background: "rgba(10, 22, 40, 0.6)",
            backdropFilter: "blur(8px)",
          }}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
      )}
      {showHomeButton && !narrowMode && (
        <button
          onClick={onHome}
          className="absolute z-[80] flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200 text-foreground/80 hover:text-secondary border border-border/40 hover:border-secondary/40"
          style={{
            top: "16px",
            left: "60px",
            background: "rgba(10, 22, 40, 0.6)",
            backdropFilter: "blur(8px)",
          }}
        >
          <Home className="w-4 h-4" />
        </button>
      )}

      {/* SVG connection lines — orbit only; empty when stacked, so no
          phantom lines are left pointing at pills that moved. */}
      <svg className="absolute inset-0 w-full h-full z-[64] pointer-events-none">
        {orbitRelated.map((r, i) => (
          <motion.line
            /* rAF loop updates x2/y2 each frame; initial % values are fallback */
            ref={(el) => {
              lineRefs.current[i] = el;
            }}
            key={`line-${r.term.id}`}
            x1="50%"
            y1="50%"
            x2={`${termPositions[i].left}%`}
            y2={`${termPositions[i].top}%`}
            stroke={`${depthPillColors[r.layerId as keyof typeof depthPillColors] ?? "#14F195"}55`}
            strokeWidth="1"
            strokeDasharray="4 4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 + i * 0.04, duration: 0.2 }}
          />
        ))}
      </svg>

      {/* Centering container — when narrow, a scrollable column with the
          card centered and related terms flowing below it. When wide,
          absolute centered with related terms floating around. */}
      <div
        className={`absolute inset-0 z-[65] flex items-center pointer-events-none overflow-y-auto ${
          narrowMode
            ? /* justify-start + auto margins on the children, not
                 justify-center: a centred flex column that overflows
                 pushes its first child past the scroll origin, so the
                 top of the card becomes unreachable. Auto margins
                 collapse to 0 once free space runs out, which centres
                 short cards and top-aligns tall ones. */
              "flex-col justify-start px-4 pt-14 pb-4"
            : "flex-row justify-center"
        }`}
      >
        <motion.div
          ref={cardRef}
          className={`relative pointer-events-auto shrink-0 ${narrowMode ? "mt-auto" : ""}`}
          onClick={(e) => e.stopPropagation()}
          initial={{ y: 12, opacity: 0, scale: 0.95 }}
          /* Idle floating bob — subtle y oscillation once the entry
             animation settles, so the card feels alive without
             stealing focus from the content. */
          animate={{
            y: [0, -6, 0, 6, 0],
            opacity: 1,
            scale: 1,
          }}
          transition={{
            y: {
              duration: 6,
              ease: "easeInOut",
              repeat: Infinity,
              delay: 0.4,
            },
            opacity: { duration: 0.18, ease: "easeOut" },
            scale: { duration: 0.18, ease: "easeOut" },
          }}
        >
          <div
            className="text-center max-w-sm"
            style={{
              background: "rgba(10, 22, 40, 0.85)",
              border: `1px solid ${rgba(0.5)}`,
              backdropFilter: "blur(20px)",
              borderRadius: "28px",
              padding: "1.25rem",
              /* Depth-tinted glow: tight ring + medium outer halo +
                 far ambient so the card reads as "from this layer" at
                 a glance. */
              boxShadow: `0 0 0 1px ${rgba(0.25)}, 0 20px 60px ${rgba(0.18)}, 0 0 80px ${rgba(0.12)}`,
            }}
          >
            {/* Depth indicator — always shown so users know how "deep"
                the term sits in the iceberg. Reads from the layerId prop.
                The flanking dots pick up the same depth-color palette
                used for related pills and the layer title glow, so the
                whole vertical stack of depth cues stays color-coherent. */}
            {(() => {
              const depthColor =
                depthPillColors[layerId as keyof typeof depthPillColors] ??
                "#14F195";
              return (
                <div className="flex items-center justify-center gap-1.5 mb-2 text-[10px] uppercase tracking-[0.25em] text-foreground/50">
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full"
                    style={{
                      background: depthColor,
                      boxShadow: `0 0 6px ${depthColor}99`,
                    }}
                  />
                  <span>{depthLabels[layerId] ?? layerId}</span>
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full"
                    style={{
                      background: depthColor,
                      boxShadow: `0 0 6px ${depthColor}99`,
                    }}
                  />
                </div>
              );
            })()}

            <h1
              className="text-2xl md:text-4xl font-bold mb-2"
              style={{
                color: depthColor,
                textShadow: `0 0 18px ${rgba(0.35)}`,
              }}
            >
              <DecryptedText
                text={translatedName}
                animateOn="view"
                /* Sequential mode reveals one char per `speed` ms. We
                   clamp the total animation between 600ms (so short
                   acronyms like "SOL" still read as an animation, not
                   an instant paint) and 900ms (so long names like
                   "Real-World Asset Tokenization (RWA)" never drag
                   past a full second). */
                speed={(() => {
                  const len = Math.max(translatedName.length, 1);
                  /* 30% faster: clamp total 420–630ms (was 600–900) */
                  const targetTotalMs = Math.max(
                    420,
                    Math.min(630, 21 * len + 140),
                  );
                  return Math.max(12, Math.round(targetTotalMs / len));
                })()}
                maxIterations={8}
                sequential={true}
                revealDirection="center"
              />
            </h1>

            {/* Category badge — tinted with the depth hue so the whole
                card stays visually coherent with the layer it belongs to. */}
            {term.category && (
              <span
                className="inline-block text-[10px] px-2 py-0.5 rounded-full border mb-3"
                style={{
                  color: depthColor,
                  borderColor: rgba(0.4),
                  background: rgba(0.08),
                }}
              >
                {t(`category.${term.category}` as Parameters<typeof t>[0])}
              </span>
            )}

            {/* Tags */}
            {term.tags && term.tags.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1 mb-2">
                {term.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[9px] px-2 py-0.5 rounded-full border border-secondary/20 text-secondary/50 bg-secondary/5"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Aliases — filter out ones matching the display name to avoid
                the SDK's "aka NGMI" self-reference noise on terms whose
                primary name is also listed in aliases. */}
            {(() => {
              const extraAliases =
                term.aliases?.filter(
                  (a) =>
                    a.toLowerCase() !== translatedName.toLowerCase() &&
                    a.toLowerCase() !== term.term.toLowerCase(),
                ) ?? [];
              if (extraAliases.length === 0) return null;
              return (
                <p className="text-xs text-foreground/40 mb-3">
                  {t("term.aka")} {extraAliases.join(", ")}
                </p>
              );
            })()}

            {/* max-h-[30vh] caps long definitions with scroll */}
            <div className="relative">
              <p
                ref={defRef}
                /* Definitions quote raw base58 addresses, which offer no
                   break opportunity — left to wrap normally they overflow
                   the card and the hidden scrollbar silently truncates
                   them, handing the reader a wrong address. `anywhere`
                   only kicks in for tokens that would otherwise overflow,
                   so ordinary prose still breaks between words. */
                style={{ overflowWrap: "anywhere" }}
                className="text-foreground/70 text-sm leading-relaxed max-h-[30vh] overflow-y-auto"
              >
                {translatedDefinition}
              </p>
              {/* Fade only while text remains below, so the cap never
                  reads as the end of the definition. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-8 transition-opacity duration-200"
                style={{
                  opacity: defHasMore ? 1 : 0,
                  background:
                    "linear-gradient(to bottom, rgba(10, 22, 40, 0) 0%, rgba(10, 22, 40, 0.75) 60%, rgba(10, 22, 40, 0.95) 100%)",
                }}
              />
            </div>

            {/* Footer metadata row — related-term count + term id so
                users can see how connected the term is and what its
                canonical slug is (useful for deep-linking in Phase B).
                Border and icon tint picked up from the depth hue. */}
            <div
              className="mt-3 pt-3 border-t flex items-center justify-between text-[10px] text-foreground/50"
              style={{ borderTopColor: rgba(0.18) }}
            >
              <span
                className="inline-flex items-center gap-1"
                style={{ color: rgba(0.8) }}
              >
                <Link2 className="w-3 h-3" />
                {relatedTerms.length}{" "}
                {t(
                  relatedTerms.length === 1
                    ? "term.relatedSingular"
                    : "term.relatedPlural",
                )}
              </span>
              <span className="font-mono text-foreground/30 truncate max-w-[50%]">
                {term.id}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Stacked related terms — inside the scrollable flex column,
            right below the card. Flows naturally so it never overlaps.
            User scrolls down to see them if card is long. */}
        <div
          className={`w-full px-4 pt-4 pb-8 mb-auto pointer-events-auto shrink-0 ${narrowMode ? "block" : "hidden"}`}
        >
          <div className="flex flex-wrap justify-center gap-2">
            {orderedRelated.map((r, i) => {
              const rawMColor2 =
                depthPillColors[r.layerId as keyof typeof depthPillColors] ??
                "#14F195";
              const pillColor2 = r.layerId === "abyss" ? "#A78BFA" : rawMColor2;
              return (
                <motion.div
                  key={`mob-${r.term.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: 0.2 + i * 0.04,
                    duration: 0.18,
                    ease: "easeOut",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTermClick(r.layerId, r.term.id);
                  }}
                  className="px-4 py-2 rounded-full cursor-pointer text-sm font-semibold transition-all"
                  style={{
                    background: `linear-gradient(135deg, ${pillColor2}38 0%, ${pillColor2}18 100%)`,
                    border: `1.5px solid ${pillColor2}`,
                    boxShadow: `0 0 0 1px ${pillColor2}33, 0 4px 16px ${pillColor2}33`,
                    color: pillColor2,
                  }}
                  title={getTermName(lang, r.term.id) ?? r.term.term}
                >
                  {(getTermName(lang, r.term.id) ?? r.term.term).replace(
                    /\s*\(.*?\)\s*/g,
                    "",
                  )}
                  <span className="text-[10px] ml-1.5 font-medium opacity-75">
                    {depthLabels[r.layerId] ?? r.layerId}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Related terms positioned around center — orbit layout */}
      {orbitRelated.map((r, i) => {
        /* Brighten abyss pills — the default #818CF8 is too dim on the
           dark glass backdrop. Use a lighter neon purple so they're
           readable without losing their depth identity. */
        const rawColor =
          depthPillColors[r.layerId as keyof typeof depthPillColors] ??
          "#14F195";
        const pillColor = r.layerId === "abyss" ? "#A78BFA" : rawColor;
        return (
          <motion.div
            ref={(el) => {
              termRefs.current[i] = el;
            }}
            key={r.term.id}
            className="absolute cursor-pointer z-[66]"
            style={{
              left: `${termPositions[i].left}%`,
              top: `${termPositions[i].top}%`,
              transition: "left 0.3s ease-out, top 0.3s ease-out",
            }}
            initial={{ opacity: 0, scale: 0.85, x: "-50%", y: "-50%" }}
            animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
            transition={{
              delay: 0.2 + i * 0.04,
              duration: 0.2,
              ease: "easeOut",
            }}
            onClick={(e) => {
              e.stopPropagation();
              onTermClick(r.layerId, r.term.id);
            }}
          >
            <div
              className="px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-100 hover:scale-105"
              style={{
                background: `linear-gradient(135deg, ${pillColor}38 0%, ${pillColor}18 100%)`,
                border: `1.5px solid ${pillColor}`,
                boxShadow: `0 0 0 1px ${pillColor}33, 0 4px 16px ${pillColor}33, 0 0 20px ${pillColor}22`,
                backdropFilter: "blur(8px)",
                animation: `float-term ${termPositions[i].duration}s ease-in-out infinite`,
                animationDelay: `${termPositions[i].delay}s`,
              }}
              title={getTermName(lang, r.term.id) ?? r.term.term}
            >
              <span style={{ color: pillColor }}>
                {(getTermName(lang, r.term.id) ?? r.term.term).replace(
                  /\s*\(.*?\)\s*/g,
                  "",
                )}
              </span>
              {/* Always show the depth label so users know where each
                  related term lives on the iceberg, regardless of whether
                  it matches the currently open term's own layer. */}
              <span
                className="text-[10px] ml-1.5 font-medium opacity-75"
                style={{ color: pillColor }}
              >
                {depthLabels[r.layerId] ?? r.layerId}
              </span>
            </div>
          </motion.div>
        );
      })}

      {/* (Mobile related terms moved inside the scroll container above) */}
    </motion.div>
  );
};

export default TermView;
