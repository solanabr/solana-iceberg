import { useState, useMemo, useRef, useEffect, useCallback, memo } from "react";
import { onCoalescedResize } from "@/components/coalescedResize";
import { getIcebergLayers, type Category } from "@/data/glossaryAdapter";
import { useTranslation } from "@/i18n/context";
import { getTermName } from "@/i18n/glossary";

interface Props {
  onLayerClick: (layerId: string) => void;
  onTermClick: (layerId: string, termId: string) => void;
  selectedCategories?: Set<Category>;
  selectedTags?: Set<string>;
  /** When true, the SVG switches to height-based sizing and the
   *  generateProfile function allocates ~43% of the profile to the
   *  surface layer so surface renders at 45vh regardless of
   *  viewport aspect. Driven by the parent Index.tsx narrow state. */
  narrowMode?: boolean;
}

const fullLayers = getIcebergLayers();

// ─── Iceberg shape generation ───
// Strategy: generate one cohesive silhouette from a width profile,
// then slice it horizontally into 5 layer regions.
//
// The width profile is driven by term counts — layers with more terms
// push the silhouette wider at their depth. The left and right edges
// are generated independently for asymmetry, with deterministic
// "randomness" (seeded noise) for organic irregularity.

const CX = 580; // center axis — offset left for asymmetry
const TOTAL_H = 2750;
const TIP_Y = 10;
const N_SAMPLES = 60; // vertical resolution of the silhouette
const LAYER_COUNT = 5;

// Seeded pseudo-random for deterministic wobble
function seededRand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// Generate smooth noise at a point using multiple octaves
function noise(y: number, seed: number): number {
  let val = 0;
  val += Math.sin(y * 0.008 + seed * 2.3) * 30;
  val += Math.sin(y * 0.015 + seed * 5.7) * 15;
  val += Math.sin(y * 0.035 + seed * 1.1) * 8;
  val += (seededRand(y * 0.1 + seed) - 0.5) * 12;
  return val;
}

interface IcebergProfile {
  /** Y coordinates for each sample point */
  ys: number[];
  /** Left edge x at each sample */
  lefts: number[];
  /** Right edge x at each sample */
  rights: number[];
  /** Y boundaries between layers (6 values: top of first to bottom of last) */
  layerYs: number[];
}

function generateProfile(
  termCounts: number[],
  narrowMode: boolean = false,
  wideMaxSurface: number = 385,
): IcebergProfile {
  const total = termCounts.reduce((s, c) => s + c, 0) || 1;

  // Layer heights — proportional to term count, with minimum
  const minH = 280;
  const distributable = TOTAL_H - minH * LAYER_COUNT;
  const layerHeights = termCounts.map(
    (c) => minH + (c / total) * distributable,
  );

  /* Cap surface layer so it always fits above the waterline.
     On narrow screens the parent container is 356vh (100vw × 356vh)
     with preserveAspectRatio="none", top:-56vh → tip at 44vh.
     The surface spans 44vh → 100vh = 56vh. A +20% boost is
     applied AFTER this cap, so pre-boost maxSurfaceH compensates:
       maxSurfaceH × 1.2 / 2800 × 356vh = 56vh
       → maxSurfaceH = 56 × 2800 / (356 × 1.2) ≈ 367
     Wide mode uses a dynamic value (wideMaxSurface param) computed
     from viewport dimensions so the surface always reaches the
     100vh waterline even when the container top is clamped. */
  const maxSurfaceH = narrowMode ? 367 : wideMaxSurface;
  if (layerHeights[0] < maxSurfaceH && narrowMode) {
    /* In narrow mode, forcibly grow the surface to the target. */
    const grow = maxSurfaceH - layerHeights[0];
    layerHeights[0] = maxSurfaceH;
    const deepTotal = termCounts.slice(1).reduce((s, c) => s + c, 0) || 1;
    for (let j = 1; j < LAYER_COUNT; j++) {
      layerHeights[j] -= grow * (termCounts[j] / deepTotal);
    }
  }
  if (layerHeights[0] > maxSurfaceH) {
    const excess = layerHeights[0] - maxSurfaceH;
    layerHeights[0] = maxSurfaceH;
    const deepTotal = termCounts.slice(1).reduce((s, c) => s + c, 0) || 1;
    for (let j = 1; j < LAYER_COUNT; j++) {
      layerHeights[j] += excess * (termCounts[j] / deepTotal);
    }
  }

  /* Boost bottom layer height. On narrow: surface +20% and bottom
     +50%. On wide (desktop): bottom +20%. Steal from shallow + deep
     proportionally so the total stays at TOTAL_H. */
  if (narrowMode) {
    const surfBoost = layerHeights[0] * 0.2;
    const botBoost = layerHeights[4] * 0.5;
    const totalBoost = surfBoost + botBoost;
    layerHeights[0] += surfBoost;
    layerHeights[4] += botBoost;
    const donor = layerHeights[1] + layerHeights[2];
    layerHeights[1] -= totalBoost * (layerHeights[1] / donor);
    layerHeights[2] -= totalBoost * (layerHeights[2] / donor);
  } else {
    const botBoost = layerHeights[4] * 0.2;
    layerHeights[4] += botBoost;
    const donor = layerHeights[1] + layerHeights[2];
    layerHeights[1] -= botBoost * (layerHeights[1] / donor);
    layerHeights[2] -= botBoost * (layerHeights[2] / donor);
  }

  // Layer Y boundaries
  const layerYs: number[] = [TIP_Y];
  for (const h of layerHeights) {
    layerYs.push(layerYs[layerYs.length - 1] + h);
  }

  // Build width profile: at each Y sample, compute base half-width
  // driven by the term density at that depth
  const ys: number[] = [];
  const baseWidths: number[] = [];

  for (let i = 0; i <= N_SAMPLES; i++) {
    const t = i / N_SAMPLES; // 0..1
    const y = TIP_Y + t * TOTAL_H;
    ys.push(y);

    // Which layer are we in?
    let layerIdx = 0;
    for (let li = 0; li < LAYER_COUNT; li++) {
      if (y >= layerYs[li] && y < layerYs[li + 1]) {
        layerIdx = li;
        break;
      }
      if (li === LAYER_COUNT - 1) layerIdx = li;
    }

    // Term density factor for this layer (1.0 = average)
    const density = termCounts[layerIdx] / (total / LAYER_COUNT);

    // Base envelope: sharp peak → wide mountainous surface → diamond body → tapered bottom
    // Envelope = total width in SVG units (viewBox 1200 wide)
    //
    // WIDE MODE breakpoints:   0.05 / 0.12 / 0.45 / 0.75
    // NARROW MODE breakpoints: 0.05 / 0.337 / 0.586 / 0.812
    //
    // In narrow mode the surface/shallow boundary lives at
    //   t_sea = maxSurfaceH / TOTAL_H = 933 / 2750 ≈ 0.337
    // (with maxSurfaceH=933 giving surface=50vh on a 150vh container).
    // The narrow envelope reshapes the wide-mode surface band to
    // span 0.05–0.337 and **widens** from 500 at the shoulder to
    // 560 at sea level (gentle mountain shape, no waterline waist),
    // matching the wide-mode reference's "surface-bottom width :
    // viewport width" proportion as closely as possible on phones
    // (≈58–60% on phone aspect ratios). The underwater body then
    // expands to 940 in the compressed 0.337–0.586 range. To keep
    // the Sailboat visible at this wider sea-level width, the boat
    // is shifted to left:2% on narrow mode (from 8% on wide) —
    // see Index.tsx `narrowMode` → Sailboat leftPct prop.
    let envelope: number;
    if (t < 0.01) {
      // Sharp peak point
      envelope = t * 5400;
    } else if (t < 0.05) {
      // Rapid expansion — mountain shoulders (cap at ~500 to meet surface)
      envelope = 54 + (t - 0.01) * 11150;
    } else if (narrowMode) {
      // ── Narrow-mode profile ──
      // With maxSurfaceH=367 (+20% boost → 440), effective sea level
      // t = (10+440)/2750 ≈ 0.164. Slightly past wide's t=0.14.
      //   surface band 0.05 → 0.164 (width 500 → 613)
      //   upper body   0.164 → 0.45  (width 613 → 940)
      //   lower body   0.45  → 0.75  (width 940 → 700)
      //   bottom point 0.75  → 1.00  (width 700 → ~0)
      if (t < 0.164) {
        const surfT = (t - 0.05) / 0.114;
        envelope = 500 + surfT * 113;
      } else if (t < 0.45) {
        const bodyT = (t - 0.164) / 0.286;
        envelope = 613 + bodyT * 327 + Math.sin(bodyT * Math.PI) * 40;
      } else if (t < 0.75) {
        const taperT = (t - 0.45) / 0.3;
        envelope = 940 - taperT * 240;
      } else {
        const endT = (t - 0.75) / 0.25;
        envelope = 700 - endT * endT * 680;
      }
    } else if (t < 0.12) {
      // Surface layer — max 50% screen width (600 SVG units)
      const surfT = (t - 0.05) / 0.07;
      envelope = 500 + surfT * 100;
    } else if (t < 0.45) {
      // Upper body — expands from surface (600) to widest zone (940)
      const bodyT = (t - 0.12) / 0.33;
      envelope = 600 + bodyT * 340 + Math.sin(bodyT * Math.PI) * 40;
    } else if (t < 0.75) {
      // Lower body — gradual taper
      const taperT = (t - 0.45) / 0.3;
      envelope = 940 - taperT * 240;
    } else {
      // Bottom taper to point
      const endT = (t - 0.75) / 0.25;
      envelope = 700 - endT * endT * 680;
    }

    // Modulate by term density (subtle — ±20%)
    const densityMod = 0.8 + 0.2 * Math.min(density, 2.0);
    baseWidths.push(Math.max(5, envelope * densityMod));
  }

  /* ── Surface expansion ──
     Scale the SURFACE layer wider (and therefore taller, since the SVG
     image preserves aspect ratio). The expansion factor is applied as a
     post-process multiplier on baseWidths so the original envelope shape
     is preserved — no distortion, just proportional scaling.

     The multiplier fades linearly across SHALLOW so deeper layers are
     completely unaffected:
       SURFACE zone  (y ≤ layerYs[1]): full expansion (SURFACE_SCALE)
       SHALLOW zone  (layerYs[1]..layerYs[2]): linear fade → 1.0
       Deeper layers (y ≥ layerYs[2]): no change (1.0)

     This guarantees:
     - The SURFACE SVG scales proportionally (wider + taller)
     - SHALLOW's top width matches SURFACE's bottom width exactly
       (both read from the same expanded profile at layerYs[1])
     - The waterline stays fixed (layerYs[1] doesn't move)
     - INTERMEDIATE/DEEP/ABYSS widths are unchanged */
  /* Both modes: 30% wider SURFACE (tuned for the dedicated
     iceberg-surface.svg texture and surface-term legibility).
     With the narrow-mode envelope reduced to 500 → 613 and the
     container switching to 100vw wide + preserveAspectRatio="none",
     the sea-level width lands at exactly 60% of the viewport on
     every narrow viewport, matching wide mode's reference ratio.
     The Sailboat is shifted to `leftPct: 0` on narrow (Index.tsx)
     so the iceberg's wider base doesn't overlap it. */
  const SURFACE_SCALE = 1.3;
  for (let i = 0; i <= N_SAMPLES; i++) {
    const y = ys[i];
    if (y <= layerYs[1]) {
      // Full expansion through entire SURFACE layer
      baseWidths[i] *= SURFACE_SCALE;
    } else if (y < layerYs[2]) {
      // Fade from SURFACE_SCALE → 1.0 across SHALLOW depth
      const fadeT = (y - layerYs[1]) / (layerYs[2] - layerYs[1]);
      baseWidths[i] *= 1.0 + (SURFACE_SCALE - 1.0) * (1.0 - fadeT);
    }
    // y >= layerYs[2]: no change — deeper layers untouched
  }

  // Generate asymmetric left and right edges with independent noise
  const lefts: number[] = [];
  const rights: number[] = [];
  const leftSeed = 3.7;
  const rightSeed = 7.3;
  /* Nearly-symmetric bias (52/48) — both sides feel balanced while
     independent noise seeds still give each edge its own subtle
     character. Previously the right side was 15% wider which made
     the DEEP layer bulge unnaturally far to the right once the
     layer's density modifier kicked in. */
  const leftBias = 0.48;
  const rightBias = 0.52;

  /* Safe horizontal margins — the iceberg must never touch the
     viewBox edges on either side. This prevents a dense layer (e.g.
     DEEP with the 45-term cap) from pushing the shape past the
     rendered SVG boundary, which previously caused visible overflow
     on wide screens. */
  const SAFE_LEFT_MIN = 40;
  const SAFE_RIGHT_MAX = 1160;
  for (let i = 0; i <= N_SAMPLES; i++) {
    const y = ys[i];
    const w = baseWidths[i];

    // Dampen noise near the tip so the narrow peak stays clean
    const noiseFade = Math.min(1, w / 200);
    const leftW = w * leftBias + noise(y, leftSeed) * noiseFade;
    const rightW = w * rightBias + noise(y, rightSeed) * noiseFade;

    lefts.push(Math.max(SAFE_LEFT_MIN, CX - Math.max(5, leftW)));
    rights.push(Math.min(SAFE_RIGHT_MAX, CX + Math.max(5, rightW)));
  }

  return { ys, lefts, rights, layerYs };
}

// Convert a slice of the profile into a smooth SVG path
function profileSliceToPath(
  profile: IcebergProfile,
  topY: number,
  bottomY: number,
  isFirst: boolean,
  isLast: boolean,
): string {
  const { ys, lefts, rights } = profile;

  // Find sample indices within this slice
  const indices: number[] = [];
  for (let i = 0; i < ys.length; i++) {
    if (ys[i] >= topY - 1 && ys[i] <= bottomY + 1) {
      indices.push(i);
    }
  }
  if (indices.length < 2) return "";

  // Interpolate edge positions at exact topY and bottomY
  function lerp(y: number, arr: number[]): number {
    for (let i = 0; i < ys.length - 1; i++) {
      if (y >= ys[i] && y <= ys[i + 1]) {
        const t = (y - ys[i]) / (ys[i + 1] - ys[i]);
        return arr[i] + t * (arr[i + 1] - arr[i]);
      }
    }
    return arr[arr.length - 1];
  }

  const topL = lerp(topY, lefts);
  const topR = lerp(topY, rights);
  const botL = lerp(bottomY, lefts);
  const botR = lerp(bottomY, rights);

  // Build right edge going down, then left edge going up
  const rightPoints: [number, number][] = [[topR, topY]];
  const leftPoints: [number, number][] = [[topL, topY]];

  for (const i of indices) {
    if (ys[i] > topY && ys[i] < bottomY) {
      rightPoints.push([rights[i], ys[i]]);
      leftPoints.push([lefts[i], ys[i]]);
    }
  }
  rightPoints.push([botR, bottomY]);
  leftPoints.push([botL, bottomY]);

  // Build path: top edge → right side down → bottom edge → left side up
  const parts: string[] = [];

  if (isFirst) {
    // Organic rounded mound — smooth bezier curves, slightly off-center peak
    const peakX = CX - 15; // slightly off-center
    const peakTopY = topY;
    const surfR = rightPoints[rightPoints.length - 1][0];
    const surfBottomY = rightPoints[rightPoints.length - 1][1];
    const h = surfBottomY - peakTopY; // total height of surface

    // Start at peak, smooth curve down-right with organic bumps
    parts.push(`M${peakX.toFixed(0)} ${peakTopY.toFixed(0)}`);

    // Right slope: smooth descent with subtle undulations
    // First segment — gentle shoulder with a soft bump
    parts.push(
      `C${(peakX + 60).toFixed(0)} ${(peakTopY + h * 0.05).toFixed(0)}, ` +
        `${(peakX + 100).toFixed(0)} ${(peakTopY + h * 0.12).toFixed(0)}, ` +
        `${(peakX + 130).toFixed(0)} ${(peakTopY + h * 0.18).toFixed(0)}`,
    );
    // Second segment — slight outward bump then steeper
    parts.push(
      `C${(peakX + 155).toFixed(0)} ${(peakTopY + h * 0.22).toFixed(0)}, ` +
        `${(peakX + 185).toFixed(0)} ${(peakTopY + h * 0.28).toFixed(0)}, ` +
        `${(peakX + 210).toFixed(0)} ${(peakTopY + h * 0.38).toFixed(0)}`,
    );
    // Third segment — curve into body edge
    parts.push(
      `C${(peakX + 230).toFixed(0)} ${(peakTopY + h * 0.48).toFixed(0)}, ` +
        `${(surfR - 20).toFixed(0)} ${(peakTopY + h * 0.7).toFixed(0)}, ` +
        `${surfR.toFixed(0)} ${surfBottomY.toFixed(0)}`,
    );
  } else {
    // Start at top-left, draw top edge to top-right
    parts.push(`M${topL.toFixed(0)} ${topY.toFixed(0)}`);
    parts.push(`L${topR.toFixed(0)} ${topY.toFixed(0)}`);
  }

  // Right edge going down (smooth curves through points)
  // For isFirst, the mountain ridge already traced right edge to the bottom
  if (!isFirst) {
    for (let j = 1; j < rightPoints.length; j++) {
      const prev = rightPoints[j - 1];
      const curr = rightPoints[j];
      const dy = curr[1] - prev[1];
      parts.push(
        `C${(prev[0] + 5).toFixed(0)} ${(prev[1] + dy * 0.4).toFixed(0)}, ${(curr[0] - 3).toFixed(0)} ${(curr[1] - dy * 0.3).toFixed(0)}, ${curr[0].toFixed(0)} ${curr[1].toFixed(0)}`,
      );
    }
  }

  if (isLast) {
    // Rounded bottom — curve to a point then back up
    const tipX = CX + 10 + noise(bottomY, 42) * 0.5;
    const tipY = bottomY + 15;
    parts.push(
      `Q${botR.toFixed(0)} ${(bottomY + 8).toFixed(0)}, ${tipX.toFixed(0)} ${tipY.toFixed(0)}`,
    );
    parts.push(
      `Q${botL.toFixed(0)} ${(bottomY + 8).toFixed(0)}, ${botL.toFixed(0)} ${bottomY.toFixed(0)}`,
    );
  } else {
    // Bottom edge: right to left
    parts.push(`L${botL.toFixed(0)} ${bottomY.toFixed(0)}`);
  }

  // Left edge going up (reverse order)
  // For isFirst, the closing ridge handles the left ascent
  if (!isFirst) {
    const leftReversed = [...leftPoints].reverse();
    for (let j = 1; j < leftReversed.length - 1; j++) {
      const prev = leftReversed[j - 1];
      const curr = leftReversed[j];
      const dy = prev[1] - curr[1];
      parts.push(
        `C${(prev[0] - 5).toFixed(0)} ${(prev[1] - dy * 0.4).toFixed(0)}, ${(curr[0] + 3).toFixed(0)} ${(curr[1] + dy * 0.3).toFixed(0)}, ${curr[0].toFixed(0)} ${curr[1].toFixed(0)}`,
      );
    }
  }

  if (isFirst) {
    // Close with smooth left slope back up to peak
    const peakX = CX - 15;
    const surfL = leftPoints[leftPoints.length - 1][0];
    const surfBottomY = leftPoints[leftPoints.length - 1][1];
    const h = surfBottomY - topY;

    // Left slope: mirror the organic mound (from body edge up to peak)
    // First segment — curve away from body
    parts.push(
      `C${(surfL + 20).toFixed(0)} ${(topY + h * 0.7).toFixed(0)}, ` +
        `${(peakX - 220).toFixed(0)} ${(topY + h * 0.48).toFixed(0)}, ` +
        `${(peakX - 200).toFixed(0)} ${(topY + h * 0.38).toFixed(0)}`,
    );
    // Second segment — subtle bump on left shoulder
    parts.push(
      `C${(peakX - 175).toFixed(0)} ${(topY + h * 0.28).toFixed(0)}, ` +
        `${(peakX - 145).toFixed(0)} ${(topY + h * 0.22).toFixed(0)}, ` +
        `${(peakX - 120).toFixed(0)} ${(topY + h * 0.18).toFixed(0)}`,
    );
    // Third segment — smooth ascent to peak
    parts.push(
      `C${(peakX - 90).toFixed(0)} ${(topY + h * 0.12).toFixed(0)}, ` +
        `${(peakX - 50).toFixed(0)} ${(topY + h * 0.05).toFixed(0)}, ` +
        `${peakX.toFixed(0)} ${topY.toFixed(0)}`,
    );
  }

  parts.push("Z");
  return parts.join(" ");
}

// ─── Rendering constants ───

// Darker shade of each layer's color for the layer TITLE label drop-shadow
const layerLabelShadows = [
  /* Surface: subtle and soft */
  "drop-shadow(0 1px 3px rgba(40, 70, 110, 0.3)) drop-shadow(0 0 5px rgba(30, 55, 90, 0.15))",
  "drop-shadow(0 2px 8px rgba(25, 55, 95, 0.85)) drop-shadow(0 0 12px rgba(20, 45, 80, 0.5))",
  "drop-shadow(0 2px 8px rgba(15, 40, 75, 0.85)) drop-shadow(0 0 12px rgba(10, 30, 60, 0.5))",
  "drop-shadow(0 2px 8px rgba(10, 25, 55, 0.85)) drop-shadow(0 0 12px rgba(5, 18, 40, 0.5))",
  "drop-shadow(0 2px 8px rgba(5, 12, 30, 0.9)) drop-shadow(0 0 12px rgba(2, 8, 20, 0.6))",
];

/* Softer shadow for term count text — SURFACE has none for clean readability */
const termCountShadows = [
  /* SURFACE: subtle green glow for depth on the light glacial fill */
  "drop-shadow(0 1px 3px rgba(0, 40, 30, 0.3)) drop-shadow(0 0 8px rgba(20, 241, 149, 0.15))",
  "drop-shadow(0 1px 4px rgba(25, 55, 95, 0.35)) drop-shadow(0 0 6px rgba(20, 45, 80, 0.2))",
  "drop-shadow(0 1px 4px rgba(15, 40, 75, 0.35)) drop-shadow(0 0 6px rgba(10, 30, 60, 0.2))",
  "drop-shadow(0 1px 4px rgba(10, 25, 55, 0.35)) drop-shadow(0 0 6px rgba(5, 18, 40, 0.2))",
  "drop-shadow(0 1px 4px rgba(5, 12, 30, 0.4)) drop-shadow(0 0 6px rgba(2, 8, 20, 0.25))",
];

const layerFills = [
  "rgba(200, 220, 240, 0.9)",
  "rgba(150, 180, 210, 0.75)",
  "rgba(100, 140, 180, 0.6)",
  "rgba(60, 100, 150, 0.45)",
  "rgba(30, 60, 110, 0.35)",
];

const layerFillsDimmed = [
  "rgba(200, 220, 240, 0.35)",
  "rgba(150, 180, 210, 0.28)",
  "rgba(100, 140, 180, 0.22)",
  "rgba(60, 100, 150, 0.16)",
  "rgba(30, 60, 110, 0.12)",
];

/**
 * Per-layer term TEXT colors — intentionally distinct from the iceberg
 * path fill (`layerFills`). Surface uses a medium slate so text reads
 * against the light glacial fill without being aggressively dark; the
 * layer-hover state (not per-term) gets deeper colors for interaction.
 * Deeper layers inherit a blue-ish tint that matches `layerFills`.
 */
const termTextFills = [
  "rgba(120, 145, 175, 0.9)", // surface — lighter slate on bright ice
  "rgba(150, 180, 210, 0.8)",
  "rgba(120, 160, 200, 0.7)",
  "rgba(90, 130, 180, 0.6)",
  "rgba(60, 100, 150, 0.55)",
];

/**
 * Hover / proximity fill per layer. Surface uses a dark forest green
 * (readable on light surface). Shallow uses a vivid blue that pops
 * against the shallow layer's pale-blue background without the neon
 * glare of Solana-green. Deeper layers use the signature Solana
 * green which pops against the darker backgrounds.
 */
const termTextHoverFills = [
  "rgba(20, 80, 45, 1)", // surface — dark forest green
  "rgba(20, 90, 220, 1)", // shallow — vivid blue
  "rgba(20, 241, 149, 1)",
  "rgba(20, 241, 149, 1)",
  "rgba(20, 241, 149, 1)",
];

/* Precomputed RGB triplets from termTextHoverFills — avoids running a
   regex on every frame in the physics RAF loop. */
const termTextHoverRGB: [number, number, number][] = termTextHoverFills.map(
  (c) => {
    const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    return m ? [+m[1], +m[2], +m[3]] : [20, 241, 149];
  },
);

/* ─── Floating-label layout ───
   Labels were previously scattered on a jittered grid that ignored text
   width entirely, so long terms collided with each other, with the layer
   title and with the silhouette edge (clipped mid-word). They are now
   packed deterministically into horizontal bands from real measured text
   widths, and every label gets a private drift cell. Cells tile a band
   without overlapping, so the per-frame physics keeps its cheap wall
   bounce and two labels can never collide however far they drift. */

/** Text-box metrics in em, read off rendered Space Grotesk via getBBox. */
const LABEL_ASCENT = 1.02;
const LABEL_DESCENT = 0.3;
/** Half-gap baked into every cell, in em — the minimum ink-to-ink
 *  distance between neighbours sitting at their closest drift extremes. */
const LABEL_PAD_X = 0.45;
/** Inset from the silhouette edge. The layer paths bow up to ~5 units
 *  outside the sampled profile between knots; the rest is breathing room. */
const EDGE_MARGIN = 16;

/* Canvas text measurement — an SVG <text> has no layout box until it is
   rendered, and the packer needs widths before that. Measured once per
   unique string at a reference size, then scaled to the real font size. */
const MEASURE_FS = 100;
const textWidthCache = new Map<string, number>();
let measureCtx: CanvasRenderingContext2D | null | undefined;

function textEmWidth(text: string, weight: number): number {
  const key = `${weight}:${text}`;
  const cached = textWidthCache.get(key);
  if (cached !== undefined) return cached;
  if (measureCtx === undefined) {
    measureCtx =
      typeof document === "undefined"
        ? null
        : document.createElement("canvas").getContext("2d");
  }
  let em: number;
  if (measureCtx) {
    measureCtx.font = `${weight} ${MEASURE_FS}px "Space Grotesk", sans-serif`;
    em = measureCtx.measureText(text).width / MEASURE_FS;
  } else {
    em = text.length * 0.7; // conservative fallback
  }
  textWidthCache.set(key, em);
  return em;
}

/** Parenthetical content (acronym expansions) is dropped from floating
 *  labels — the full name is shown on click. */
const labelText = (name: string) => name.replace(/\s*\(.*?\)\s*/g, "");

interface DriftCell {
  /** Seeded start position of the text anchor. */
  x: number;
  y: number;
  /** Box the anchor may drift inside — already inset by the label's own
   *  half-width/height, so the whole text box stays in the cell. */
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface Rect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

interface Span {
  a: number;
  b: number;
}

/** Vertical extent of a text box relative to its baseline. The
 *  narrow-mode counter-transform scales the box about its own centre,
 *  so the corrected extents are derived from that centre. `down` goes
 *  negative there — the shrunken box ends up entirely above the
 *  baseline. */
function textBoxExtent(fontSize: number, yScale: number) {
  const asc = LABEL_ASCENT * fontSize;
  const desc = LABEL_DESCENT * fontSize;
  const centre = (desc - asc) / 2;
  const half = ((asc + desc) / 2) * yScale;
  return { up: half - centre, down: half + centre };
}

/** Box of a centred <text> drawn at (CX, y) with SVG letter-spacing. */
function centredTextRect(
  y: number,
  text: string,
  fontSize: number,
  letterSpacing: number,
  weight: number,
  yScale: number,
): Rect {
  const w = textEmWidth(text, weight) * fontSize + text.length * letterSpacing;
  const { up, down } = textBoxExtent(fontSize, yScale);
  const pad = fontSize * 0.25;
  return {
    x0: CX - w / 2 - pad,
    x1: CX + w / 2 + pad,
    y0: y - up,
    y1: y + down,
  };
}

/** Widest x-range inside the silhouette for EVERY y in [y0, y1]. The
 *  profile is piecewise linear, so extremes sit at the ends or a knot. */
function spanInside(profile: IcebergProfile, y0: number, y1: number): Span {
  const e0 = getIcebergEdgesAtY(y0, profile);
  const e1 = getIcebergEdgesAtY(y1, profile);
  let a = Math.max(e0.left, e1.left);
  let b = Math.min(e0.right, e1.right);
  const { ys, lefts, rights } = profile;
  for (let i = 0; i < ys.length; i++) {
    if (ys[i] > y0 && ys[i] < y1) {
      if (lefts[i] > a) a = lefts[i];
      if (rights[i] < b) b = rights[i];
    }
  }
  return { a, b };
}

function subtractSpan(spans: Span[], a: number, b: number): Span[] {
  const out: Span[] = [];
  for (const s of spans) {
    if (b <= s.a || a >= s.b) {
      out.push(s);
      continue;
    }
    if (a > s.a) out.push({ a: s.a, b: a });
    if (b < s.b) out.push({ a: b, b: s.b });
  }
  return out;
}

interface LayoutOpts {
  /** Candidate label strings, in priority order. */
  names: string[];
  /** How many to place — extra candidates cover the ones that are too
   *  wide to fit anywhere at this viewport. */
  target: number;
  top: number;
  bottom: number;
  profile: IcebergProfile;
  /** Conservative inner cone of the SURFACE mound: the drawn bezier is
   *  much narrower than the profile envelope near the peak. */
  cone: {
    peakX: number;
    peakY: number;
    baseY: number;
    left: number;
    right: number;
  } | null;
  /** Boxes labels must avoid (layer title, term count, surface creature). */
  reserved: Rect[];
  fontSize: number;
  fontWeight: number;
  /** Vertical scale the narrow-mode counter-transform applies to text. */
  yScale: number;
  seed: number;
}

/**
 * Packs labels into non-overlapping drift cells.
 *
 * Rows are tried from few to many and the first row count that fits the
 * whole target wins, which keeps bands as tall — and therefore drift as
 * roomy — as possible. Terms that fit nowhere are skipped rather than
 * stacked on a neighbour: fewer legible labels beats an unreadable blob.
 */
function layoutLabels(o: LayoutOpts): { index: number; cell: DriftCell }[] {
  const { names, target, top, bottom, profile, cone, reserved } = o;
  const { fontSize, fontWeight, yScale, seed } = o;
  if (target <= 0 || names.length === 0) return [];

  const { up, down } = textBoxExtent(fontSize, yScale);
  const labelH = up + down;
  const rowGap = labelH * 0.45;
  const usableH = bottom - top;
  const maxRows = Math.floor(usableH / (labelH + rowGap));
  if (maxRows < 1) return [];

  const widths = names.map(
    (n) => textEmWidth(n, fontWeight) * fontSize + 2 * LABEL_PAD_X * fontSize,
  );

  const packRows = (rows: number) => {
    const bandH = usableH / rows;
    const bands = [];
    for (let r = 0; r < rows; r++) {
      const boxTop = top + r * bandH + rowGap / 2;
      const boxBottom = top + (r + 1) * bandH - rowGap / 2;
      let { a, b } = spanInside(profile, boxTop, boxBottom);
      if (cone) {
        const f = Math.max(
          0,
          Math.min(1, (boxTop - cone.peakY) / (cone.baseY - cone.peakY)),
        );
        a = Math.max(a, cone.peakX - f * (cone.peakX - cone.left));
        b = Math.min(b, cone.peakX + f * (cone.right - cone.peakX));
      }
      a += EDGE_MARGIN;
      b -= EDGE_MARGIN;
      let spans: Span[] = b > a ? [{ a, b }] : [];
      for (const rc of reserved) {
        if (rc.y0 < boxBottom && rc.y1 > boxTop) {
          spans = subtractSpan(spans, rc.x0, rc.x1);
        }
      }
      bands.push({
        yMin: boxTop + up,
        yMax: boxBottom - down,
        spans: spans.map((s) => ({
          ...s,
          used: 0,
          items: [] as { index: number; w: number }[],
        })),
      });
    }

    let placed = 0;
    let cursor = 0; // round-robin row, so bands fill evenly
    for (let n = 0; n < names.length && placed < target; n++) {
      const w = widths[n];
      for (let k = 0; k < rows; k++) {
        const r = (cursor + k) % rows;
        const span = bands[r].spans.find((sp) => {
          const width = sp.b - sp.a;
          /* Leave slack in every row so the labels in it keep some
             horizontal room to drift. */
          return sp.used + w <= width - Math.min(width * 0.18, 90);
        });
        if (!span) continue;
        span.items.push({ index: n, w });
        span.used += w;
        cursor = (r + 1) % rows;
        placed++;
        break;
      }
    }

    const out: { index: number; cell: DriftCell }[] = [];
    for (let r = 0; r < rows; r++) {
      const band = bands[r];
      band.spans.forEach((sp, si) => {
        if (sp.items.length === 0) return;
        const leftover = sp.b - sp.a - sp.used;
        /* Hand the slack out unevenly so a packed row never reads as a
           grid — cells stay contiguous, only their widths vary. */
        const weights = sp.items.map(
          (_, k) => 0.35 + seededRand(seed + r * 17.3 + si * 5.1 + k * 2.7),
        );
        const wsum = weights.reduce((s, v) => s + v, 0);
        let x = sp.a;
        sp.items.forEach((it, k) => {
          const cellW = it.w + (leftover * weights[k]) / wsum;
          const minX = x + it.w / 2;
          const maxX = x + cellW - it.w / 2;
          out.push({
            index: it.index,
            cell: {
              minX,
              maxX,
              minY: band.yMin,
              maxY: band.yMax,
              x: minX + (maxX - minX) * seededRand(seed + it.index * 3.9 + r),
              y:
                band.yMin +
                (band.yMax - band.yMin) *
                  seededRand(seed + it.index * 6.1 + r * 2),
            },
          });
          x += cellW;
        });
      });
    }
    return out;
  };

  let best: { index: number; cell: DriftCell }[] = [];
  for (let rows = 1; rows <= maxRows; rows++) {
    const out = packRows(rows);
    if (out.length > best.length) best = out;
    if (best.length >= target) break;
  }
  return best;
}

const MAX_TERMS_PER_LAYER_CONST = 20;
/**
 * Per-layer overrides for the floating term cap. Deeper layers get
 * bigger cards, so we bump their density to fill the extra real estate
 * without overcrowding the surface.
 *   surface: baseline (20)
 *   shallow: ~79%  → 36    (25% × 1.10 × 1.30 compounding)
 *   deep:    +125% → 45    (50% × 1.50 compounding)
 *   abyss:   +10%  → 22
 *   bottom:  baseline (20)
 */
const MAX_TERMS_PER_LAYER: Record<string, number> = {
  surface: MAX_TERMS_PER_LAYER_CONST,
  shallow: Math.round(MAX_TERMS_PER_LAYER_CONST * 1.25 * 1.1 * 1.3),
  deep: Math.round(MAX_TERMS_PER_LAYER_CONST * 1.5 * 1.5),
  abyss: Math.round(MAX_TERMS_PER_LAYER_CONST * 1.1),
  bottom: MAX_TERMS_PER_LAYER_CONST,
};
/** Drift speed in viewBox units per frame, before the per-cell clamp. */
const DRIFT_SPEED = 0.55;

/** Cap a velocity component so even a tight cell takes ~2.5s to cross —
 *  without it a label with little slack buzzes between its walls. */
function clampDrift(v: number, span: number): number {
  const cap = span * 0.006 + 0.02;
  return Math.max(-cap, Math.min(cap, v));
}

interface BallState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Drift cell walls — see layoutLabels. */
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function getIcebergEdgesAtY(
  y: number,
  profile: IcebergProfile,
): { left: number; right: number } {
  const { ys, lefts, rights } = profile;
  for (let i = 0; i < ys.length - 1; i++) {
    if (y >= ys[i] && y <= ys[i + 1]) {
      const t = (y - ys[i]) / (ys[i + 1] - ys[i]);
      return {
        left: lefts[i] + t * (lefts[i + 1] - lefts[i]),
        right: rights[i] + t * (rights[i + 1] - rights[i]),
      };
    }
  }
  return {
    left: lefts[lefts.length - 1],
    right: rights[rights.length - 1],
  };
}

// ─── Memoized term label — only re-renders when its own hover state changes ───

interface TermLabelProps {
  termKey: string;
  name: string;
  layerId: string;
  termId: string;
  layerIdx: number;
  isHovered: boolean;
  isFilterActive: boolean;
  shouldGlow: boolean;
  layerFill: string;
  /** When true (narrow viewports) the term always renders in the
   *  hover-color palette and at a larger font size. */
  narrowMode: boolean;
  /** Vertical correction factor for preserveAspectRatio="none"
   *  distortion. 1 on wide, <1 on narrow (xs/ys). */
  textYScale: number;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: (e: React.MouseEvent) => void;
  setRef: (el: SVGGElement | null) => void;
}

const TermLabel = memo(function TermLabel({
  name,
  layerIdx,
  isHovered,
  isFilterActive,
  shouldGlow,
  layerFill: _layerFill,
  narrowMode,
  textYScale,
  onMouseEnter,
  onMouseLeave,
  onClick,
  setRef,
}: TermLabelProps) {
  // Proximity-based highlighting handles per-term glow; direct hover uses hoverFill
  const hoverFill = termTextHoverFills[layerIdx] ?? "rgba(20, 241, 149, 1)";
  const baseFill = termTextFills[layerIdx] ?? _layerFill;

  /* On narrow viewports, always render in the hover-color palette so
     the floating terms stay readable against the iceberg background
     without requiring a mouse hover (most narrow screens are
     touch-only, where proximity highlight never fires). */
  const fill = isHovered || narrowMode ? hoverFill : baseFill;

  const glowShadow =
    "0 0 4px rgba(153,69,255,0.6), 0 0 8px rgba(20,241,149,0.4)";
  const hoverShadow = "0 0 6px rgba(20,241,149,0.6)";

  return (
    <g
      ref={setRef}
      className="cursor-pointer"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      <text
        x={0}
        y={0}
        textAnchor="middle"
        /* Increase fontSize by 1/textYScale so the corrected text
           renders at the same pixel height as the distorted baseline.
           The CSS scaleY undoes the vertical stretch, making the text
           uniform (both axes at x_scale) without changing apparent size. */
        fontSize={narrowMode && textYScale > 0 ? 22 / textYScale : 14}
        fontFamily="Space Grotesk, sans-serif"
        fontWeight={narrowMode ? 600 : 400}
        fill={fill}
        opacity={isHovered ? 1 : isFilterActive ? 0.5 : narrowMode ? 0.25 : 0.7}
        className="iceberg-term-text"
        style={{
          textShadow: isHovered
            ? hoverShadow
            : shouldGlow
              ? glowShadow
              : undefined,
          transition: isHovered ? "fill 0.3s, opacity 0.3s" : undefined,
          /* Counter-scale: scaleY(textYScale) cancels the outer SVG's
             non-uniform vertical stretch on this text element.
             transform-box: fill-box → scale around the text's own
             bounding box center, preserving its rendered position. */
          ...(narrowMode
            ? {
                transform: `scaleY(${textYScale})`,
                transformBox: "fill-box" as const,
                transformOrigin: "center",
              }
            : {}),
        }}
      >
        {/* Already stripped by labelText() — the layout packer measures
            the exact string that gets rendered here. */}
        {name}
      </text>
    </g>
  );
});

// ─── Component ───

const IcebergSVG = ({
  onLayerClick,
  onTermClick,
  selectedCategories,
  selectedTags,
  narrowMode = false,
}: Props) => {
  const { t, lang, glossaryVersion } = useTranslation();
  // Re-computed whenever language changes or glossary translations finish
  // loading. Consumers downstream use this helper for localized display names.
  const getLocalName = useMemo(
    () => (termId: string, fallback: string) =>
      getTermName(lang, termId) ?? fallback,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang, glossaryVersion],
  );

  const [hoveredTerm, setHoveredTerm] = useState<string | null>(null);
  const [hoveredLayer, setHoveredLayer] = useState<number | null>(null);
  /* Track hovered ball position (layerIdx, termIdx) for the physics
     loop so the hovered term freezes in place instead of drifting. */
  const hoveredBallRef = useRef<{ li: number; ti: number } | null>(null);
  // Mouse position in SVG coordinate space for proximity highlighting
  const svgRef = useRef<SVGSVGElement>(null);
  const mousePosRef = useRef<{ x: number; y: number } | null>(null);

  /* ── Text distortion correction ──
     With preserveAspectRatio="none" on narrow, the SVG has
     independent x/y scales. Text and images get stretched.
     textYScale = x_scale / y_scale — applying scaleY(textYScale)
     to text elements makes them render uniformly at x_scale in
     both axes, undoing the vertical distortion. Font sizes must
     be divided by textYScale to maintain the same screen-pixel
     height as the (distorted) baseline. */
  const [textYScale, setTextYScale] = useState(1);
  /* Wide mode: dynamic maxSurfaceH so the surface always reaches
     the 100vh waterline even when the container top is clamped on
     ultrawide screens. Recomputed on resize. */
  const [wideMaxSurfaceH, setWideMaxSurfaceH] = useState(385);
  useEffect(() => {
    if (!narrowMode) {
      const computeWide = () => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const offset = Math.min(0.33 * vw, 0.5 * vh); // max(-33vw,-50vh)
        const svgH = (Math.min(vw, 4000) * 2800) / 1200;
        const surfPx = vh - offset; // px from container top to 100vh
        const msh = Math.round((surfPx / svgH) * 2800 - 10);
        setWideMaxSurfaceH(Math.max(200, Math.min(msh, 600)));
      };
      computeWide();
      return onCoalescedResize(computeWide);
    }
    const compute = () => {
      const xs = window.innerWidth / 1200;
      const ys = (window.innerHeight * 3.56) / 2800; // 356vh container
      const ratio = ys > 0 ? xs / ys : 1;
      setTextYScale(Number.isFinite(ratio) ? ratio : 1);
    };
    compute();
    return onCoalescedResize(compute);
  }, [narrowMode]);

  const hasFilter =
    (selectedCategories && selectedCategories.size > 0) ||
    (selectedTags && selectedTags.size > 0);

  // Random surface creature — picked once on mount
  const surfaceCreature = useMemo(() => Math.floor(Math.random() * 4), []); // 0=polar bear, 1=penguins, 2=seal, 3=alien

  // Check if a term matches the active filters
  const matchesFilter = useCallback(
    (t: (typeof fullLayers)[0]["terms"][0]) => {
      if (!hasFilter) return true;
      const catOk =
        !selectedCategories?.size ||
        (t.category && selectedCategories.has(t.category));
      const tagOk =
        !selectedTags?.size || t.tags?.some((tag) => selectedTags.has(tag));
      return catOk && tagOk;
    },
    [hasFilter, selectedCategories, selectedTags],
  );

  // Term counts per layer (filtered or total)
  const termCounts = useMemo(() => {
    return fullLayers.map((layer) => {
      if (!hasFilter) return layer.terms.length;
      return layer.terms.filter(matchesFilter).length;
    });
  }, [hasFilter, matchesFilter]);

  const totalCounts = useMemo(() => fullLayers.map((l) => l.terms.length), []);

  // Generate the unified iceberg profile from term counts
  const profile = useMemo(
    () => generateProfile(termCounts, narrowMode, wideMaxSurfaceH),
    [termCounts, narrowMode, wideMaxSurfaceH],
  );

  // Slice the profile into per-layer paths
  const layerPaths = useMemo(() => {
    return profile.layerYs.slice(0, -1).map((topY, i) => {
      const bottomY = profile.layerYs[i + 1];
      return profileSliceToPath(
        profile,
        topY,
        bottomY,
        i === 0,
        i === LAYER_COUNT - 1,
      );
    });
  }, [profile]);

  // Surface triangle geometry — scaled from iceberg-surface.svg to match
  // SHALLOW's width at the junction. Both read the same profile at layerYs[1].
  const surfaceTriangle = useMemo(() => {
    const peakY = profile.layerYs[0];
    const baseY = profile.layerYs[1];
    /* Query SHALLOW's exact edges at the junction */
    const shallowEdges = getIcebergEdgesAtY(baseY, profile);
    const shallowWidth = shallowEdges.right - shallowEdges.left;
    /* iceberg-surface.svg viewBox is 0..1024.5 wide. The drawn
       polygonal fragments span from roughly x=44 (leftmost clipPath
       bound) to x=979 (rightmost), giving a shape width of ~935
       viewBox units. The image is scaled so these SHAPE edges map
       exactly to SHALLOW's left/right edges at the junction.

       viewBox x=44  → shallowEdges.left   (leftmost shape edge)
       viewBox x=979 → shallowEdges.right  (rightmost shape edge) */
    const shapeLeft = 44; // leftmost iceberg shape in viewBox
    const shapeRight = 979; // rightmost iceberg shape in viewBox
    const shapeW = shapeRight - shapeLeft; // 903 viewBox units
    const imgW = shallowWidth * (1024.5 / shapeW);
    const imgX = shallowEdges.left - shapeLeft * (imgW / 1024.5);
    /* Proportional height — no distortion */
    const imgH = imgW * (576 / 1024.5);
    const imgY = baseY - imgH;
    /* Uniform scale factor */
    const s = imgW / 1024.5;
    /* Triangle peak in screen coords */
    const triPeakX = imgX + 472 * s;
    const triPeakY = imgY + 169 * s;
    /* Triangle half-width at baseY */
    const baseHalf = 260 * ((576 - 169) / (595 - 169)) * s;
    const clipPath = `M${triPeakX} ${triPeakY} L${triPeakX + baseHalf} ${baseY} L${triPeakX - baseHalf} ${baseY} Z`;
    return {
      peakX: triPeakX,
      peakY: triPeakY,
      baseHalf,
      baseY,
      clipPath,
      imgX,
      imgY,
      imgW,
      imgH,
    };
  }, [profile]);

  // Per-layer match info for dimming
  const layerMatchInfo = useMemo(() => {
    return fullLayers.map((_, i) => {
      if (!hasFilter)
        return { total: totalCounts[i], matched: totalCounts[i], active: true };
      const matched = termCounts[i];
      return { total: totalCounts[i], matched, active: matched > 0 };
    });
  }, [termCounts, totalCounts, hasFilter]);

  /* Canvas measurements taken before Space Grotesk finishes loading use
     fallback metrics — re-pack once, and only if the widths moved. */
  const [fontEpoch, setFontEpoch] = useState(0);
  useEffect(() => {
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (cancelled) return;
      const before = textEmWidth("Tokenization", 400);
      textWidthCache.clear();
      if (textEmWidth("Tokenization", 400) !== before)
        setFontEpoch((e) => e + 1);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Candidate term pools per layer — respects category + tag filter, randomly picked
  const layerCandidates = useMemo(() => {
    return fullLayers.map((layer) => {
      let terms = layer.terms;
      if (hasFilter) {
        terms = terms.filter(matchesFilter);
      }
      // Shuffle via Fisher-Yates before slicing
      const shuffled = [...terms];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const baseCap =
        MAX_TERMS_PER_LAYER[layer.id] ?? MAX_TERMS_PER_LAYER_CONST;
      /* Narrow viewports render fewer floating terms (~55% of the
         wide-screen cap) so the larger font doesn't overlap and
         the iceberg stays readable on phones and tablets. */
      const cap = narrowMode
        ? Math.max(6, Math.round(baseCap * 0.55))
        : baseCap;
      /* Hand the packer 3× the cap: a term too wide for the silhouette
         at this viewport is skipped, and a shorter candidate takes the
         slot instead of leaving a hole. */
      return { terms: shuffled.slice(0, cap * 3), cap };
    });
  }, [hasFilter, matchesFilter, narrowMode]);

  // Title positions + the packed drift cells for every floating label
  const { labelPositions, layerLayouts } = useMemo(() => {
    const scale = narrowMode && textYScale > 0 ? textYScale : 1;
    const titleFs = 30 / scale;
    const countFs = 18 / scale;
    const termFs = narrowMode ? 22 / scale : 14;
    const termWeight = narrowMode ? 600 : 400;

    /* All layers use the same label positioning — centered horizontally
       at CX (580) and vertically at 40% of the layer height. */
    const labels = profile.layerYs.slice(0, -1).map((topY, i) => ({
      x: CX,
      y: topY + (profile.layerYs[i + 1] - topY) * 0.4,
    }));

    const surfaceEdges = getIcebergEdgesAtY(profile.layerYs[1], profile);

    const layouts = layerCandidates.map(({ terms, cap }, i) => {
      const topY = profile.layerYs[i];
      const bottomY = profile.layerYs[i + 1];
      const names = terms.map((term) =>
        labelText(getLocalName(term.id, term.term)),
      );
      const info = layerMatchInfo[i];

      /* The title and count are painted over the labels, so anything
         drifting under them is unreadable — reserve both boxes. */
      const reserved: Rect[] = [
        centredTextRect(
          labels[i].y,
          t(`depth.${fullLayers[i].id}` as Parameters<typeof t>[0]),
          titleFs,
          8,
          600,
          scale,
        ),
        centredTextRect(
          labels[i].y + 30,
          hasFilter
            ? `${info.matched} / ${info.total} ${t("iceberg.termsFiltered")}`
            : `${info.total} ${t("iceberg.terms")}`,
          countFs,
          2,
          600,
          scale,
        ),
      ];
      if (i === 0) {
        /* Footprint of the surface creature on the mound's right
           shoulder — sized for the widest variant (the penguin band). */
        const ccx = CX + 85;
        const ccy = topY + (bottomY - topY) * 0.22;
        reserved.push({
          x0: ccx - 100,
          x1: ccx + 120,
          y0: ccy - 80 * scale,
          y1: ccy + 90 * scale,
        });
      }

      const placements = layoutLabels({
        names,
        target: cap,
        top: topY + 6,
        bottom: bottomY - 6,
        profile,
        cone:
          i === 0
            ? {
                peakX: CX - 15,
                peakY: topY,
                baseY: bottomY,
                left: surfaceEdges.left,
                right: surfaceEdges.right,
              }
            : null,
        reserved,
        fontSize: termFs,
        fontWeight: termWeight,
        yScale: scale,
        seed: i * 97 + 13,
      });

      return {
        terms: placements.map((p) => terms[p.index]),
        names: placements.map((p) => names[p.index]),
        cells: placements.map((p) => p.cell),
      };
    });

    return { labelPositions: labels, layerLayouts: layouts };
    /* fontEpoch is a cache-invalidation signal, not a value read here:
       it fires when the webfont swap changes the measured text widths. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    profile,
    layerCandidates,
    layerMatchInfo,
    narrowMode,
    textYScale,
    getLocalName,
    hasFilter,
    t,
    fontEpoch,
  ]);

  // ─── Physics engine ───
  // Refs for direct DOM manipulation (bypass React render cycle)
  const termGroupRefs = useRef<(SVGGElement | null)[][]>([]);
  const ballStatesRef = useRef<BallState[][]>([]);
  const rafIdRef = useRef<number>(0);
  // Cache text child elements to avoid querySelector on every frame
  const textElCache = useRef<WeakMap<SVGGElement, SVGTextElement | null>>(
    new WeakMap(),
  );

  // Assign ref callback for each term <g> element
  const setTermRef = useCallback(
    (layerIdx: number, termIdx: number, el: SVGGElement | null) => {
      if (!termGroupRefs.current[layerIdx]) {
        termGroupRefs.current[layerIdx] = [];
      }
      termGroupRefs.current[layerIdx][termIdx] = el;
    },
    [],
  );

  // Initialize ball states from the packed drift cells
  useEffect(() => {
    const baseSpeed = DRIFT_SPEED * (narrowMode ? 0.8 : 1);
    ballStatesRef.current = layerLayouts.map((layout, li) =>
      layout.cells.map((c, ti) => {
        const angle = seededRand(li * 1000 + ti * 7.3) * Math.PI * 2;
        const speed =
          baseSpeed + seededRand(li * 500 + ti * 3.1) * baseSpeed * 0.3;
        return {
          x: c.x,
          y: c.y,
          vx: clampDrift(Math.cos(angle) * speed, c.maxX - c.minX),
          vy: clampDrift(Math.sin(angle) * speed, c.maxY - c.minY),
          minX: c.minX,
          maxX: c.maxX,
          minY: c.minY,
          maxY: c.maxY,
        };
      }),
    );
  }, [layerLayouts, narrowMode]);

  // Physics loop
  useEffect(() => {
    const step = () => {
      const states = ballStatesRef.current;
      const refs = termGroupRefs.current;

      for (let li = 0; li < states.length; li++) {
        const balls = states[li];

        // Move and collide walls
        const hb = hoveredBallRef.current;
        for (let bi = 0; bi < balls.length; bi++) {
          /* Freeze the hovered term in place — skip position update
             but keep velocity intact so it resumes drifting on
             mouseLeave when the ref clears. */
          if (hb && hb.li === li && hb.ti === bi) continue;
          const b = balls[bi];
          b.x += b.vx;
          b.y += b.vy;

          /* Each label bounces inside its own drift cell. The cells are
             packed so they never overlap, which is what keeps labels
             legible — and it costs less per frame than the old
             silhouette-edge lookup, with no pairwise test at all. */
          if (b.x < b.minX) {
            b.x = b.minX;
            b.vx = Math.abs(b.vx);
          } else if (b.x > b.maxX) {
            b.x = b.maxX;
            b.vx = -Math.abs(b.vx);
          }
          if (b.y < b.minY) {
            b.y = b.minY;
            b.vy = Math.abs(b.vy);
          } else if (b.y > b.maxY) {
            b.y = b.maxY;
            b.vy = -Math.abs(b.vy);
          }
        }

        // Write CSS transforms directly to DOM (avoids SVG layout recalc)
        const layerRefs = refs[li];
        if (!layerRefs) continue;
        const mp = mousePosRef.current;
        const cache = textElCache.current;
        for (let bi = 0; bi < balls.length; bi++) {
          const el = layerRefs[bi];
          if (el) {
            el.style.transform = `translate(${balls[bi].x}px, ${balls[bi].y}px)`;

            // Cached text element lookup (avoids querySelector on every frame)
            let textEl = cache.get(el);
            if (textEl == null && !cache.has(el)) {
              textEl = el.querySelector("text");
              cache.set(el, textEl);
            }

            if (mp && !narrowMode) {
              const dx = balls[bi].x - mp.x;
              const dy = balls[bi].y - mp.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const PROXIMITY_RADIUS = 120;
              const proximity = Math.max(0, 1 - dist / PROXIMITY_RADIUS);
              el.style.opacity = String(0.55 + proximity * 0.45);
              if (textEl && proximity > 0.1) {
                /* Proximity highlight uses the per-layer hover color
                   (dark green on surface, Solana green elsewhere)
                   fading in with proximity strength. */
                const [r, g, b] = termTextHoverRGB[li] ?? [20, 241, 149];
                {
                  textEl.setAttribute(
                    "fill",
                    `rgba(${r}, ${g}, ${b}, ${0.3 + proximity * 0.7})`,
                  );
                }
              } else if (textEl) {
                textEl.setAttribute("fill", termTextFills[li]);
              }
            } else {
              el.style.opacity = "";
              if (textEl) {
                /* Narrow viewports lock the fill to the hover color
                   palette so touch users see legible text without
                   hover interaction. */
                textEl.setAttribute(
                  "fill",
                  narrowMode ? termTextHoverFills[li] : termTextFills[li],
                );
              }
            }
          }
        }
      }

      rafIdRef.current = requestAnimationFrame(step);
    };

    rafIdRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafIdRef.current);
  }, [narrowMode]);

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 1200 2800"
      role="img"
      aria-label="Solana Iceberg — interactive glossary visualization with 5 depth layers"
      /* Sizing mode is aspect-driven:
         - Wide: width-based (w-full h-auto). SVG fills viewport
           width and its intrinsic aspect picks the height.
           preserveAspectRatio defaults to "xMidYMid meet" which
           is fine because the container shape matches the SVG's
           intrinsic 1200:2800 aspect when width is set and height
           is auto.
         - Narrow: both dimensions explicit (h-full w-full) with
           `preserveAspectRatio="none"`. The SVG is allowed to
           DEFORM non-uniformly so we can enforce two hard
           constraints simultaneously:
             1. iceberg tip at 50vh AND sea level at 100vh
                (surface/shallow boundary aligned with the
                WaveDivider and Sailboat)
             2. iceberg-width-at-sea-level / viewport-width ≈ 60%
                on every narrow viewport (matching wide mode's
                reference proportion)
           The container is 100vw × 356vh, so x-scale = viewport
           width / 1200 and y-scale = 150vh_px / 2800 — different
           scales per axis. On phones (aspect ~0.46) the iceberg
           stretches vertically ~1.39×, on tablets (aspect ~0.75)
           it compresses vertically ~0.86×. This is the intentional
           tradeoff: a recognizably-similar silhouette with both
           constraints satisfied regardless of device aspect. */
      className={narrowMode ? "h-full w-full" : "w-full h-auto"}
      preserveAspectRatio={narrowMode ? "none" : undefined}
      style={{
        maxWidth: narrowMode ? "none" : "3200px",
        filter: "drop-shadow(0 0 30px rgba(20, 241, 149, 0.1))",
        /* This element is ~1440x3360 CSS px — 19.4 megapixels at dsf2 — and
           the 143 drifting labels inside it dirty its contents every frame.
           A blur-class filter cannot be partially invalidated, so without a
           promotion hint Blink re-rasterizes and re-blurs the whole surface
           60+ times a second, which was costing 14.9ms of every frame.
           Promoting it to its own layer caches the filtered result.
           Measured: phone 390x844 p50 frame 15.5ms -> 8.3ms (vsync), desktop
           17.8 -> 9.1. Pixel-verified identical: 0.73% of subpixels differ by
           a mean of 0.008/255, all on text-antialiasing edges. Removing the
           shadow instead would change 60% of subpixels. */
        willChange: "filter",
      }}
      onMouseMove={(e) => {
        // Convert screen coords → SVG coords for proximity highlighting
        const svg = svgRef.current;
        if (!svg) return;
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const ctm = svg.getScreenCTM();
        if (ctm) {
          const svgPt = pt.matrixTransform(ctm.inverse());
          mousePosRef.current = { x: svgPt.x, y: svgPt.y };
        }
      }}
      onMouseLeave={() => {
        mousePosRef.current = null;
      }}
    >
      <defs>
        {/* All layers use the procedural profile path for term clipping —
            terms fill the full iceberg shape at every depth. */}
        {fullLayers.map((layer, i) => (
          <clipPath key={`clip-${layer.id}`} id={`clip-layer-${i}`}>
            <path d={layerPaths[i]} />
          </clipPath>
        ))}
        <filter
          id="creature-shadow"
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
        >
          <feDropShadow
            dx="0"
            dy="2"
            stdDeviation="3"
            floodColor="rgba(153,69,255,0.25)"
          />
          <feDropShadow
            dx="0"
            dy="1"
            stdDeviation="2"
            floodColor="rgba(20,241,149,0.15)"
          />
        </filter>
        {/* term-glow filter removed — replaced with CSS text-shadow for performance */}

        {/* FIX: Removed fade mask and gradient. The SVG is positioned
            so its bottom edge aligns exactly with layerYs[1] (top of
            SHALLOW). No visual effects — clean structural alignment. */}
      </defs>

      {fullLayers.map((layer, i) => {
        const isLayerHovered = hoveredLayer === i;
        const info = layerMatchInfo[i];
        const isDimmed = hasFilter && !info.active;
        const layout = layerLayouts[i];

        return (
          <g
            key={layer.id}
            id={`iceberg-layer-${layer.id}`}
            data-layer-id={layer.id}
            style={{
              opacity: isDimmed ? 0.4 : 1,
              transition: "opacity 0.4s ease",
            }}
          >
            <g
              onClick={() => onLayerClick(layer.id)}
              className="cursor-pointer iceberg-layer-group"
              style={{
                /* Shallow layer specifically uses a much softer hover
                   highlight — its background tone is already bright,
                   so the default brightness(1.12) + drop-shadow was
                   washing out the floating term text. All other layers
                   keep the punchier hover effect. */
                filter: isLayerHovered
                  ? i === 1
                    ? "brightness(1.04) drop-shadow(0 0 4px rgba(20, 241, 149, 0.08))"
                    : "brightness(1.12) drop-shadow(0 0 10px rgba(20, 241, 149, 0.15))"
                  : hasFilter && info.active
                    ? "drop-shadow(0 0 8px rgba(20, 241, 149, 0.15))"
                    : "brightness(1)",
                transition: "filter 0.3s",
              }}
              onMouseEnter={() => setHoveredLayer(i)}
              onMouseLeave={() => setHoveredLayer(null)}
            >
              {/* All layers render with the procedural profile shape.
                  Layer 0 also has the SVG image as a background texture
                  behind the shape fill. */}
              {i === 0 && (
                <image
                  href="/iceberg-surface.svg"
                  x={surfaceTriangle.imgX}
                  y={surfaceTriangle.imgY}
                  width={surfaceTriangle.imgW}
                  height={surfaceTriangle.imgH}
                  /* On narrow mode, stretch the surface art to match the
                     iceberg outline distortion. On wide, keep uniform fit. */
                  preserveAspectRatio={narrowMode ? "none" : "xMidYMid meet"}
                  clipPath={`url(#clip-layer-0)`}
                  opacity={isDimmed ? 0.35 : 0.9}
                  style={{ transition: "opacity 0.4s ease" }}
                />
              )}
              <path
                d={layerPaths[i]}
                fill={isDimmed ? layerFillsDimmed[i] : layerFills[i]}
                style={{
                  transition: "fill 0.4s ease",
                }}
              />
            </g>

            <g clipPath={`url(#clip-layer-${i})`}>
              {layout.terms.map((term, ti) => {
                const termKey = `${layer.id}-${term.id}`;
                const isHovered = hoveredTerm === termKey;
                const shouldGlow = (ti * 7 + i * 13) % 6 === 0;

                return (
                  <TermLabel
                    key={termKey}
                    termKey={termKey}
                    name={layout.names[ti]}
                    layerId={layer.id}
                    termId={term.id}
                    layerIdx={i}
                    isHovered={isHovered}
                    isFilterActive={!!(hasFilter && info.active)}
                    shouldGlow={shouldGlow}
                    layerFill={layerFills[i]}
                    narrowMode={narrowMode}
                    textYScale={textYScale}
                    onMouseEnter={() => {
                      setHoveredTerm(termKey);
                      hoveredBallRef.current = { li: i, ti };
                    }}
                    onMouseLeave={() => {
                      setHoveredTerm(null);
                      hoveredBallRef.current = null;
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTermClick(layer.id, term.id);
                    }}
                    setRef={(el) => setTermRef(i, ti, el)}
                  />
                );
              })}
            </g>

            {/* Layer title — rendered after terms so it's always on top */}
            <g
              onClick={() => onLayerClick(layer.id)}
              className="cursor-pointer"
              style={{ pointerEvents: "none" }}
            >
              <text
                x={labelPositions[i].x}
                y={labelPositions[i].y}
                textAnchor="middle"
                fill="white"
                fontSize={narrowMode && textYScale > 0 ? 30 / textYScale : 30}
                fontWeight="600"
                fontFamily="Space Grotesk, sans-serif"
                letterSpacing="8"
                style={{
                  pointerEvents: "auto",
                  filter: layerLabelShadows[i],
                  ...(narrowMode
                    ? {
                        transform: `scaleY(${textYScale})`,
                        transformBox: "fill-box" as const,
                        transformOrigin: "center",
                      }
                    : {}),
                }}
              >
                {t(`depth.${layer.id}` as Parameters<typeof t>[0])}
              </text>
              {/* Term count — rendered as <text> (not foreignObject)
                  so the scaleY correction matches the title exactly,
                  producing a stable screen-pixel gap on every viewport.
                  +30 viewBox units below the title baseline. */}
              <text
                x={labelPositions[i].x}
                y={labelPositions[i].y + 30}
                textAnchor="middle"
                fill={
                  narrowMode
                    ? "rgba(255, 255, 255, 0.85)"
                    : hasFilter && info.active
                      ? i === 0
                        ? "rgba(110, 155, 100, 0.95)"
                        : "rgba(20, 241, 149, 0.95)"
                      : i === 0
                        ? "rgba(110, 155, 100, 0.85)"
                        : "rgba(20, 241, 149, 0.7)"
                }
                fontSize={narrowMode && textYScale > 0 ? 18 / textYScale : 18}
                fontWeight="600"
                fontFamily="Space Grotesk, sans-serif"
                letterSpacing="2"
                style={{
                  pointerEvents: "auto",
                  filter: termCountShadows[i],
                  ...(narrowMode
                    ? {
                        transform: `scaleY(${textYScale})`,
                        transformBox: "fill-box" as const,
                        transformOrigin: "center",
                      }
                    : {}),
                }}
              >
                {hasFilter
                  ? `${info.matched} / ${info.total} ${t("iceberg.termsFiltered")}`
                  : `${info.total} ${t("iceberg.terms")}`}
              </text>
            </g>
          </g>
        );
      })}
      {/* ─── Surface creature (random per page load) ─── */}
      {(() => {
        // Position on the right slope of the surface mound
        const peakX = CX - 15;
        const peakY = profile.layerYs[0];
        const surfBottom = profile.layerYs[1];
        const h = surfBottom - peakY;

        // Creature sits on the right shoulder, ~30% down the slope
        const cx = peakX + 100;
        const cy = peakY + h * 0.22;
        // Slope angle for tilting creatures to match surface
        const slopeAngle = 12;

        /* On narrow mode, counter-scale creatures so they don't look
           vertically stretched by preserveAspectRatio="none". The
           correction is applied as translate→scale→translate centered
           on the creature's position so it stays in place. */
        const wrapCreature = (node: React.ReactNode) =>
          narrowMode && textYScale !== 1 ? (
            <g
              transform={`translate(${cx}, ${cy}) scale(1, ${textYScale}) translate(${-cx}, ${-cy})`}
            >
              {node}
            </g>
          ) : (
            <>{node}</>
          );

        if (surfaceCreature === 0) {
          // ── Sleeping Polar Bear ──
          return wrapCreature(
            <g
              transform={`translate(${cx}, ${cy}) rotate(${slopeAngle})`}
              opacity="0.9"
              filter="url(#creature-shadow)"
            >
              {/* Bear — external SVG asset replaces inline shapes (body,
                 head, ears, snout, nose, eyes, paws, tail, Zzz text).
                 The SVG viewBox (1024.5×576, ~1.78:1) is wider than tall.
                 The previous inline bear spanned ~58 wide × 40 tall.
                 width=120 height=68 scales the bear to a similar doubled
                 footprint. x/y offsets center the visual body on the local
                 origin so the breathing animation still works. */}
              <image
                href="/creatures/bear.svg"
                x="-60"
                y="-34"
                width="120"
                height="68"
              />
              {/* Gentle breathing animation */}
              <animateTransform
                attributeName="transform"
                type="scale"
                values="1,1; 1,1.02; 1,1"
                dur="4s"
                repeatCount="indefinite"
                additive="sum"
              />
            </g>,
          );
        }

        if (surfaceCreature === 1) {
          // ── Band of Penguins diving down the slope ──
          const penguins = [
            { x: 0, y: 0, delay: 0 },
            { x: 25, y: 12, delay: 0.4 },
            { x: 50, y: 26, delay: 0.8 },
            { x: 72, y: 42, delay: 1.2 },
            { x: 90, y: 60, delay: 1.6 },
          ];
          return wrapCreature(
            <g
              transform={`translate(${cx - 20}, ${cy - 10})`}
              filter="url(#creature-shadow)"
            >
              {penguins.map((p, i) => (
                <g
                  key={`penguin-${i}`}
                  transform={`translate(${p.x}, ${p.y}) rotate(${slopeAngle + 5})`}
                >
                  {/* Sliding animation — wobbles side to side */}
                  <animateTransform
                    attributeName="transform"
                    type="translate"
                    values={`${p.x},${p.y}; ${p.x + 3},${p.y - 2}; ${p.x},${p.y}`}
                    dur={`${1.5 + i * 0.2}s`}
                    begin={`${p.delay}s`}
                    repeatCount="indefinite"
                  />
                  {/* Penguin — external SVG asset. Doubled from 36×22 to
                     72×44 so the penguin renders ~40 units tall. x/y offsets
                     doubled to keep the visual center on the local origin. */}
                  <image
                    href="/creatures/penguin.svg"
                    x="-36"
                    y="-26"
                    width="72"
                    height="44"
                  />
                </g>
              ))}
            </g>,
          );
        }

        if (surfaceCreature === 2) {
          // ── Seal slips once then stops ──
          return wrapCreature(
            <g
              transform={`translate(${cx}, ${cy}) rotate(${slopeAngle})`}
              filter="url(#creature-shadow)"
            >
              {/* Initial slip — slides down the slope once over 2s,
                 then stays at the final position. fill="freeze" holds
                 the last keyframe value after the animation ends.
                 repeatCount="1" ensures it plays exactly once. */}
              <animateTransform
                attributeName="transform"
                type="translate"
                values={`${cx},${cy}; ${cx + 40},${cy + 20}; ${cx + 55},${cy + 28}; ${cx + 60},${cy + 30}`}
                dur="2s"
                repeatCount="1"
                fill="freeze"
              />
              {/* Seal — external SVG asset. Doubled from 60×34 to
                 120×68 so the seal renders at 2× size. x/y offsets
                 doubled to keep the visual center on the local origin. */}
              <image
                href="/creatures/seal.svg"
                x="-60"
                y="-34"
                width="120"
                height="68"
              />
            </g>,
          );
        }

        // surfaceCreature === 3
        // ── Solana Alien chilling and smoking ──
        return wrapCreature(
          <g
            transform={`translate(${cx + 10}, ${cy - 5})`}
            opacity="0.9"
            filter="url(#creature-shadow)"
          >
            {/* Alien — external SVG asset. Doubled from 70×50 to
               140×100 so the alien renders at 2× size. x/y offsets
               doubled to keep the visual center on the local origin. */}
            <image
              href="/creatures/alien.svg"
              x="-70"
              y="-56"
              width="140"
              height="100"
            />

            {/* Idle bob animation */}
            <animateTransform
              attributeName="transform"
              type="translate"
              values={`${cx + 10},${cy - 5}; ${cx + 10},${cy - 8}; ${cx + 10},${cy - 5}`}
              dur="5s"
              repeatCount="indefinite"
            />
          </g>,
        );
      })()}
    </svg>
  );
};

/* Memoised on props. One render of this component re-runs the band packer for
   all five layers and rebuilds 143 labels, so it must not be dragged along by
   a parent re-render that changed nothing it reads. The default shallow
   compare is exactly right here: `narrowMode` is a boolean, the two Sets are
   replaced (never mutated) by Index, and both callbacks are useCallback'd, so
   a genuine change to any of them still re-renders. */
export default memo(IcebergSVG);
