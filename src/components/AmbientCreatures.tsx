import { useState, useEffect, useCallback } from "react";

/* ─── Ambient Aquatic Creatures ───
   Decorative underwater creatures that spawn at random intervals, swim across
   the screen, and fade away. CSS keyframe animations handle movement + fade.
   Global MAX_CONCURRENT and per-type caps limit density. MIN_Y_GAP prevents
   vertical overlap. Flip (scaleX) is on a separate layer from creature-specific
   animations to avoid CSS transform override conflicts. */

const MAX_CONCURRENT = 6;

/* Minimum vertical gap (%) between creatures, enforced at spawn time */
const MIN_Y_GAP = 8;

/* ─── Helpers ─── */
const randFloat = (min: number, max: number) =>
  min + Math.random() * (max - min);
const randInt = (min: number, max: number) =>
  Math.floor(randFloat(min, max + 1));

/* ─── Creature configs ─── */

type CreatureType =
  | "lanternfish"
  | "shark"
  | "submarine"
  | "jellyfish"
  | "kraken"
  | "leviathan";

interface CreatureConfig {
  type: CreatureType;
  sizeMin: number;
  sizeMax: number;
  intervalMin: number;
  intervalMax: number;
  durationMin: number;
  durationMax: number;
  opacityMin: number;
  opacityMax: number;
  direction: "horizontal" | "vertical";
  yMin: number;
  yMax: number;
  groupMin: number;
  groupMax: number;
  maxActive?: number;
}

const CONFIGS: CreatureConfig[] = [
  /* ── Abyss layer ──────────────────────────────────────────────── */

  /* Lanternfish — small schooling fish, abyss layer */
  {
    type: "lanternfish",
    sizeMin: 5,
    sizeMax: 8,
    intervalMin: 3,
    intervalMax: 6,
    durationMin: 12,
    durationMax: 20,
    opacityMin: 0.5,
    opacityMax: 0.8,
    direction: "horizontal",
    yMin: 72,
    yMax: 88,
    groupMin: 2,
    groupMax: 4,
    maxActive: 3,
  },

  /* ── Mid-water layer ──────────────────────────────────────────── */

  /* Jellyfish — vertical floater, mid-water */
  {
    type: "jellyfish",
    sizeMin: 8,
    sizeMax: 12,
    intervalMin: 6,
    intervalMax: 12,
    durationMin: 18,
    durationMax: 30,
    opacityMin: 0.35,
    opacityMax: 0.6,
    direction: "vertical",
    yMin: 62,
    yMax: 78,
    groupMin: 1,
    groupMax: 1,
  },

  /* Shark — fast horizontal swimmer, mid-water */
  {
    type: "shark",
    sizeMin: 10,
    sizeMax: 15,
    intervalMin: 12,
    intervalMax: 25,
    durationMin: 14,
    durationMax: 22,
    opacityMin: 0.45,
    opacityMax: 0.7,
    direction: "horizontal",
    yMin: 58,
    yMax: 76,
    groupMin: 1,
    groupMax: 1,
  },

  /* Submarine — steady cruiser, mid-water. SVG faces RIGHT. */
  {
    type: "submarine",
    sizeMin: 12,
    sizeMax: 18,
    intervalMin: 15,
    intervalMax: 30,
    durationMin: 22,
    durationMax: 35,
    opacityMin: 0.4,
    opacityMax: 0.6,
    direction: "horizontal",
    yMin: 60,
    yMax: 78,
    groupMin: 1,
    groupMax: 1,
    maxActive: 2,
  },

  /* ── Bottom layer (deepest) ───────────────────────────────────── */

  /* Kraken — large rare deep-sea presence, bottom layer */
  {
    type: "kraken",
    sizeMin: 20,
    sizeMax: 30,
    intervalMin: 25,
    intervalMax: 40,
    durationMin: 30,
    durationMax: 45,
    opacityMin: 0.3,
    opacityMax: 0.5,
    direction: "horizontal",
    yMin: 82,
    yMax: 93,
    groupMin: 1,
    groupMax: 1,
  },

  /* Leviathan — very large sea serpent, bottom layer. SVG faces RIGHT. */
  {
    type: "leviathan",
    sizeMin: 30,
    sizeMax: 40,
    intervalMin: 30,
    intervalMax: 50,
    durationMin: 35,
    durationMax: 55,
    opacityMin: 0.2,
    opacityMax: 0.35,
    direction: "horizontal",
    yMin: 84,
    yMax: 95,
    groupMin: 1,
    groupMax: 1,
  },
];

/* ─── Instance tracking ─── */

interface CreatureInstance {
  id: string;
  spawnGroup: string;
  type: CreatureType;
  y: number;
  x: number;
  size: number;
  opacity: number;
  duration: number;
  direction: "left" | "right" | "up";
  delay: number;
}

/* Collision-resistant ID — survives HMR reloads */
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/* ─── SVG asset paths ─── */
const CREATURE_ASSETS: Record<CreatureType, string> = {
  lanternfish: "/creatures/lanternfish.svg",
  shark: "/creatures/shark.svg",
  submarine: "/creatures/submarine.svg",
  jellyfish: "/creatures/jellyfish.svg",
  kraken: "/creatures/kraken.svg",
  leviathan: "/creatures/leviathan.svg",
};

/* ─── Main Component ─── */

const AmbientCreatures = () => {
  const [instances, setInstances] = useState<CreatureInstance[]>([]);

  /* Spawning system — 1s tick checks per-type timers */
  useEffect(() => {
    let mounted = true;

    const nextSpawn: Record<string, number> = {};
    CONFIGS.forEach((c) => {
      /* First spawn at half interval for initial ocean life */
      nextSpawn[c.type] =
        Date.now() + randFloat(c.intervalMin * 500, c.intervalMax * 500);
    });

    const interval = setInterval(() => {
      if (!mounted) return;
      const now = Date.now();

      CONFIGS.forEach((config) => {
        if (now < nextSpawn[config.type]) return;

        nextSpawn[config.type] =
          now + randFloat(config.intervalMin, config.intervalMax) * 1000;

        /* Pre-generate outside state updater to avoid strict-mode duplicate IDs */
        const group = uid();
        const dir =
          config.direction === "vertical"
            ? ("up" as const)
            : Math.random() > 0.5
              ? ("right" as const)
              : ("left" as const);
        const count = randInt(config.groupMin, config.groupMax);

        const newCreatures: CreatureInstance[] = Array.from(
          { length: count },
          (_, i) => ({
            id: uid() + `-${i}`,
            spawnGroup: group,
            type: config.type,
            y: randFloat(config.yMin, config.yMax),
            x: randFloat(10, 80),
            size: randFloat(config.sizeMin, config.sizeMax),
            opacity: randFloat(config.opacityMin, config.opacityMax),
            duration: randFloat(config.durationMin, config.durationMax),
            direction: dir,
            delay: i * randFloat(0.3, 1.5),
          }),
        );

        setInstances((prev) => {
          /* Global concurrent limit */
          const groups = new Set(prev.map((p) => p.spawnGroup));
          if (groups.size >= MAX_CONCURRENT) return prev;

          /* Per-type cap — truncate batch to available capacity */
          let batch = newCreatures;
          if (config.maxActive !== undefined) {
            const typeCount = prev.filter((p) => p.type === config.type).length;
            if (typeCount >= config.maxActive) return prev;
            const available = config.maxActive - typeCount;
            batch = newCreatures.slice(0, available);
          }

          /* Enforce MIN_Y_GAP with size-aware clamping */
          const occupiedYs = prev.map((p) => p.y);
          const spaced = batch.map((c) => {
            let y = c.y;
            /* Safe y bounds based on creature size relative to container */
            const sizeMarginPct = c.size / 4 + 2;
            const safeYMin = sizeMarginPct;
            const safeYMax = 100 - sizeMarginPct;
            for (let attempt = 0; attempt < 3; attempt++) {
              const conflict = occupiedYs.some(
                (oy) => Math.abs(oy - y) < MIN_Y_GAP,
              );
              if (!conflict) break;
              y += MIN_Y_GAP * (Math.random() > 0.5 ? 1 : -1);
              y = Math.max(safeYMin, Math.min(safeYMax, y));
            }
            y = Math.max(safeYMin, Math.min(safeYMax, y));
            occupiedYs.push(y);
            return { ...c, y };
          });

          return [...prev, ...spaced];
        });
      });
    }, 1000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  /* Remove creature after its CSS animation completes */
  const handleEnd = useCallback((id: string) => {
    setInstances((prev) => prev.filter((c) => c.id !== id));
  }, []);

  /* Movement keyframe name from direction */
  const getKeyframe = (dir: "left" | "right" | "up") => {
    if (dir === "right") return "ambient-right";
    if (dir === "left") return "ambient-left";
    return "ambient-up";
  };

  /* Per-creature animation on separate element to avoid transform conflicts */
  const getCreatureAnim = (type: CreatureType): string | undefined => {
    if (type === "leviathan") return "serpent-swim 4s ease-in-out infinite";
    if (type === "kraken") return "kraken-breathe 5s ease-in-out infinite";
    return undefined;
  };

  return (
    /* No overflow-hidden — creatures fade via keyframe opacity instead of hard clipping */
    <div className="absolute inset-0 pointer-events-none">
      {instances.map((inst) => (
        /* Layer 1 — Positioning + peak opacity */
        <div
          key={inst.id}
          className="absolute"
          style={
            inst.direction === "up"
              ? {
                  top: `${inst.y}%`,
                  left: `${inst.x}%`,
                  opacity: inst.opacity,
                }
              : { top: `${inst.y}%`, opacity: inst.opacity }
          }
        >
          {/* Layer 2 — Movement + opacity fade */}
          <div
            style={{
              opacity: 0,
              animation: `${getKeyframe(inst.direction)} ${inst.duration}s ease-in-out ${inst.delay}s both`,
            }}
            onAnimationEnd={() => handleEnd(inst.id)}
          >
            {/* Layer 3 — Sizing + brightness + direction flip
               (separate from Layer 4 animation to avoid transform override) */}
            <div
              style={{
                width: `${inst.size}vw`,
                filter: "brightness(1.2) contrast(1.1)",
                /* Flip when movement opposes SVG's native facing direction */
                transform: (() => {
                  const facesRight =
                    inst.type === "submarine" || inst.type === "leviathan";
                  const needsFlip = facesRight
                    ? inst.direction === "left"
                    : inst.direction === "right";
                  return needsFlip ? "scaleX(-1)" : undefined;
                })(),
              }}
            >
              {/* Layer 4 — Creature-specific animation (isolated from flip) */}
              <div style={{ animation: getCreatureAnim(inst.type) }}>
                <img
                  src={CREATURE_ASSETS[inst.type]}
                  alt=""
                  draggable={false}
                  style={{ width: "100%", height: "auto" }}
                />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AmbientCreatures;
