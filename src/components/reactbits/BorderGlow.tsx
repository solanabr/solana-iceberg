/**
 * BorderGlow — reactbits.dev (simplified)
 * Animated pulsing glow around a container, reacting to cursor position.
 * No external dependencies — pure React + CSS.
 */
import {
  useRef,
  useCallback,
  useMemo,
  useState,
  memo,
  type ReactNode,
  type CSSProperties,
} from "react";

interface BorderGlowProps {
  children?: ReactNode;
  className?: string;
  glowColor?: string;
  borderRadius?: number;
  glowIntensity?: number;
  /* Opt-out of overflow:hidden so absolutely-positioned children
     (like dropdown menus) can render outside the glow wrapper. */
  clipOverflow?: boolean;
  /* When `colors` is provided, renders a multi-color conic-gradient glow
     instead of the single-color cursor-angle mask. */
  colors?: string[];
  /* Width of the visible glow ring from border inward (0-100%).
     30 = outer 30% glows, center stays clear. */
  edgeSensitivity?: number;
  /* Glow blur radius in pixels — higher = softer spread. */
  glowRadius?: number;
  /* If false, skips cursor-reactive hover (no pointer listeners). */
  animated?: boolean;
}

function parseHSL(hslStr: string): { h: number; s: number; l: number } {
  const match = hslStr.match(/([\d.]+)\s*([\d.]+)%?\s*([\d.]+)%?/);
  if (!match) return { h: 40, s: 80, l: 80 };
  return {
    h: parseFloat(match[1]),
    s: parseFloat(match[2]),
    l: parseFloat(match[3]),
  };
}

function buildBoxShadow(glowColor: string, intensity: number): string {
  const { h, s, l } = parseHSL(glowColor);
  const base = `${h}deg ${s}% ${l}%`;
  /* All layers inset — glow stays within card boundary.
     Progression (3→8→16→28→45px) tapers from hairline to soft outer wash. */
  const layers: [number, number, number, number, number, boolean][] = [
    [0, 0, 0, 1, 100, true], // crisp 1px hairline border
    [0, 0, 3, 0, 70, true], // tight inner glow
    [0, 0, 8, 0, 55, true], // near soft
    [0, 0, 16, 0, 40, true], // medium spread
    [0, 0, 28, 0, 25, true], // wide soft
    [0, 0, 45, 0, 15, true], // very soft outer wash
  ];
  return layers
    .map(([x, y, blur, spread, alpha, inset]) => {
      const a = Math.min(alpha * intensity, 100);
      return `${inset ? "inset " : ""}${x}px ${y}px ${blur}px ${spread}px hsl(${base} / ${a}%)`;
    })
    .join(", ");
}

const BorderGlow: React.FC<BorderGlowProps> = memo(
  ({
    children,
    className = "",
    glowColor = "155 90 60", // HSL for Solana green
    borderRadius = 16,
    glowIntensity = 0.4,
    clipOverflow = true,
    colors,
    edgeSensitivity = 30,
    glowRadius = 40,
    animated = true,
  }) => {
    // All hooks called unconditionally (rules-of-hooks) before early return
    const cardRef = useRef<HTMLDivElement>(null);
    const [isHovered, setIsHovered] = useState(false);
    const [cursorAngle, setCursorAngle] = useState(45);
    const [edgeProximity, setEdgeProximity] = useState(0);
    const lastMoveTime = useRef(0);

    const handlePointerEnter = useCallback(() => setIsHovered(true), []);
    const handlePointerLeave = useCallback(() => setIsHovered(false), []);

    const getCenterOfElement = useCallback((el: HTMLElement) => {
      const { width, height } = el.getBoundingClientRect();
      return [width / 2, height / 2];
    }, []);

    const handlePointerMove = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        const now = performance.now();
        if (now - lastMoveTime.current < 16) return;
        lastMoveTime.current = now;

        const card = cardRef.current;
        if (!card) return;
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const [cx, cy] = getCenterOfElement(card);
        const dx = x - cx;
        const dy = y - cy;

        let kx = Infinity;
        let ky = Infinity;
        if (dx !== 0) kx = cx / Math.abs(dx);
        if (dy !== 0) ky = cy / Math.abs(dy);
        setEdgeProximity(Math.min(Math.max(1 / Math.min(kx, ky), 0), 1));

        const radians = Math.atan2(dy, dx);
        let degrees = radians * (180 / Math.PI) + 90;
        if (degrees < 0) degrees += 360;
        setCursorAngle(degrees);
      },
      [getCenterOfElement],
    );

    // Memoize box shadow — only recomputes when glowColor/glowIntensity change
    // Must be above the early return to satisfy rules-of-hooks
    const boxShadow = useMemo(
      () => buildBoxShadow(glowColor, glowIntensity),
      [glowColor, glowIntensity],
    );

    /* Gradient mode — static conic-gradient halo, no cursor interactivity */
    if (colors && colors.length > 0) {
      const gradientStops = [...colors, colors[0]].join(", ");
      const glowInset = -glowRadius;
      const glowBorderRadius = borderRadius + glowRadius;
      const innerRingMask = `radial-gradient(ellipse at center, transparent ${Math.max(0, 100 - edgeSensitivity)}%, black 100%)`;
      return (
        <div
          className={className}
          style={
            {
              position: "relative",
              borderRadius: `${borderRadius}px`,
              overflow: "hidden",
            } as CSSProperties
          }
        >
          <span
            aria-hidden="true"
            className="absolute pointer-events-none"
            style={
              {
                inset: `${glowInset}px`,
                borderRadius: `${glowBorderRadius}px`,
                background: `conic-gradient(from 45deg, ${gradientStops})`,
                filter: `blur(${glowRadius}px)`,
                opacity: glowIntensity * 0.45,
              } as CSSProperties
            }
          />
          <span
            aria-hidden="true"
            className="absolute pointer-events-none"
            style={
              {
                inset: 0,
                borderRadius: "inherit",
                background: `conic-gradient(from 45deg, ${gradientStops})`,
                filter: `blur(${Math.round(glowRadius / 4)}px)`,
                opacity: glowIntensity * 0.9,
                maskImage: innerRingMask,
                WebkitMaskImage: innerRingMask,
                overflow: "hidden",
              } as CSSProperties
            }
          />
          <div className="relative z-[1]" style={{ borderRadius: "inherit" }}>
            {children}
          </div>
        </div>
      );
    }

    /* Single-color, cursor-reactive render path (nav bar) */
    void animated;

    const glowOpacity = isHovered
      ? Math.max(0, (edgeProximity * 100 - 30) / 70)
      : 0;

    const angleDeg = `${cursorAngle.toFixed(3)}deg`;

    return (
      <div
        ref={cardRef}
        onPointerMove={handlePointerMove}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        className={className}
        style={
          {
            borderRadius: `${borderRadius}px`,
            // Clips glow to border-radius; gated by clipOverflow for dropdown escape
            overflow: clipOverflow ? "hidden" : "visible",
            /* 2D on purpose. A transform (any) makes this div the containing
               block for the absolute glow span — `position` can't do that job
               here because callers pass `fixed` via className and an inline
               position would override it. It must NOT be 3D (translate3d/
               translateZ): a 3D-transformed ancestor forms a backdrop root,
               which silently disables backdrop-filter on the glass children.
               Guarded by e2e/glass-nav.spec.ts. */
            transform: "translate(0, 0)",
          } as CSSProperties
        }
      >
        {/* Inner glow layer */}
        <span
          className="absolute pointer-events-none z-0"
          style={
            {
              inset: "0px",
              borderRadius: "inherit",
              overflow: "hidden",
              maskImage: `conic-gradient(from ${angleDeg} at center, black 5%, transparent 15%, transparent 85%, black 95%)`,
              WebkitMaskImage: `conic-gradient(from ${angleDeg} at center, black 5%, transparent 15%, transparent 85%, black 95%)`,
              opacity: glowOpacity,
              /* No mix-blend-mode here: a blending child makes this span's
                 parent an isolated group — a backdrop root — and the glass
                 nav inside loses its backdrop blur entirely (even while the
                 span idles at opacity 0). Guarded by e2e/glass-nav.spec.ts. */
              transition: isHovered
                ? "opacity 0.25s ease-out"
                : "opacity 0.75s ease-in-out",
            } as CSSProperties
          }
        >
          <span
            className="absolute"
            style={{
              inset: "0px",
              borderRadius: "inherit",
              boxShadow,
            }}
          />
        </span>

        <div className="relative z-[1]">{children}</div>
      </div>
    );
  },
);

BorderGlow.displayName = "BorderGlow";

export default BorderGlow;
