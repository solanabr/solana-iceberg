/**
 * Pearl — a clickable glowing orb in Solana brand colors.
 *
 * - Idle floating bob (y oscillation, ~4s)
 * - Conic gradient swirl slowly rotating inside the orb
 * - Radial glow halo behind it that intensifies on hover and while
 *   the about section is open
 * - Press affordance via scale
 *
 * Hover behavior varies by state:
 * - Not engaged (isOpen=false): on hover, the pearl glows with a
 *   bright neon halo (layered green + purple glow) and scales up.
 *   Reads as "I'm a button, click me!"
 * - Engaged (isOpen=true): on hover, the active green ring pulses
 *   slightly and the halo brightens subtly — no scale change, so
 *   the orb doesn't jump around. Reads as "I'm currently active".
 *
 * Respects `prefers-reduced-motion`: when reduced motion is active
 * the float and swirl rotation are disabled but the orb still renders.
 */
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "@/i18n/context";

interface PearlProps {
  isOpen: boolean;
  onClick: () => void;
}

const PURPLE = "#9945FF";
const GREEN = "#14F195";

const Pearl = ({ isOpen, onClick }: PearlProps) => {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const [isHovered, setIsHovered] = useState(false);

  /* Animations: disabled entirely when the user prefers reduced
     motion. Framer-motion accepts `{ duration: 0 }` transitions but
     passing `undefined` for the whole `animate` is cleaner. */
  const floatAnimate = prefersReducedMotion ? undefined : { y: [0, -8, 0] };
  const floatTransition = prefersReducedMotion
    ? undefined
    : { duration: 4, ease: "easeInOut", repeat: Infinity };

  /* Swirl spins faster when the user is actively hovering a closed
     pearl — an extra cue that it's interactive. */
  const swirlAnimate = prefersReducedMotion ? undefined : { rotate: 360 };
  const swirlTransition = prefersReducedMotion
    ? undefined
    : {
        duration: isHovered && !isOpen ? 4.5 : 9,
        ease: "linear",
        repeat: Infinity,
      };

  /* ── State-driven hover visuals ──
     Closed + hover: punchy neon halo. Bigger scale. Brighter inner.
     Open   + hover: subtle ring pulse. No scale. Keep orb still so
                     the user doesn't accidentally mistrigger the
                     next click. */
  const haloOpacity = isOpen ? (isHovered ? 1.15 : 1) : isHovered ? 1.4 : 0.7;
  const haloBlur = isOpen ? 14 : isHovered ? 22 : 14;
  const targetScale = isOpen ? 1 : isHovered ? 1.12 : 1;

  return (
    <div className="relative flex items-center justify-center w-full mt-6 mb-0 z-10">
      <motion.button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-label={t("about.pearlAria")}
        aria-expanded={isOpen}
        className="relative flex items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-secondary/60"
        animate={floatAnimate}
        transition={floatTransition}
        whileTap={{ scale: isOpen ? 0.96 : 0.92 }}
        style={{
          width: 64,
          height: 64,
          background: "transparent",
          border: "none",
          cursor: "pointer",
        }}
      >
        {/* Motion wrapper drives the hover scale so it composes with
            the idle float transform above without conflicts. */}
        <motion.div
          className="absolute inset-0"
          animate={{ scale: targetScale }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          style={{ pointerEvents: "none" }}
        >
          {/* Outer halo — a soft radial gradient that intensifies
              when the pearl is hovered or the section is open. */}
          <div
            className="absolute rounded-full"
            aria-hidden="true"
            style={{
              inset: "-36px",
              background: `radial-gradient(circle, ${GREEN}66 0%, ${PURPLE}44 35%, transparent 70%)`,
              filter: `blur(${haloBlur}px)`,
              opacity: haloOpacity,
              transition: "opacity 0.25s ease-out, filter 0.25s ease-out",
            }}
          />

          {/* Neon glow ring — ONLY when closed AND hovered. This is
              the "it's alive, click me!" cue. A bright cyan-green
              ring outside the orb that fades in quickly. */}
          <motion.div
            className="absolute rounded-full"
            aria-hidden="true"
            initial={false}
            animate={{
              opacity: !isOpen && isHovered ? 1 : 0,
              scale: !isOpen && isHovered ? 1 : 0.9,
            }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            style={{
              inset: -10,
              border: `2px solid ${GREEN}`,
              boxShadow: `0 0 24px ${GREEN}cc, 0 0 48px ${GREEN}80, inset 0 0 12px ${GREEN}66`,
              pointerEvents: "none",
            }}
          />

          {/* Conic gradient swirl — "liquid" core. Rotates
              continuously; radial-gradient mask turns the flat disc
              into a glowing sphere so light falls off at the edges. */}
          <motion.div
            className="absolute rounded-full"
            aria-hidden="true"
            animate={swirlAnimate}
            transition={swirlTransition}
            style={{
              inset: 0,
              background: `conic-gradient(from 0deg, ${PURPLE}, ${GREEN}, ${PURPLE}, #ffffff, ${GREEN}, ${PURPLE})`,
              mask: "radial-gradient(circle, #000 40%, transparent 75%)",
              WebkitMask: "radial-gradient(circle, #000 40%, transparent 75%)",
              filter: "blur(0.5px)",
            }}
          />

          {/* Opaque inner sphere — glassy body against the backdrop
              so the conic swirl shows through as a color wash rather
              than a raw pinwheel. */}
          <div
            className="absolute rounded-full"
            aria-hidden="true"
            style={{
              inset: 6,
              background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,${isHovered && !isOpen ? 0.5 : 0.35}) 0%, rgba(153,69,255,0.55) 35%, rgba(10,22,40,0.85) 80%)`,
              boxShadow: `inset 0 0 12px rgba(255,255,255,${isHovered && !isOpen ? 0.4 : 0.25}), inset 0 -6px 18px rgba(0,0,0,0.5)`,
              transition:
                "background 0.25s ease-out, box-shadow 0.25s ease-out",
            }}
          />

          {/* Top specular highlight dot — sells it as a 3D orb */}
          <div
            className="absolute rounded-full"
            aria-hidden="true"
            style={{
              top: 14,
              left: 18,
              width: 10,
              height: 10,
              background: "rgba(255,255,255,0.85)",
              filter: "blur(1.5px)",
            }}
          />

          {/* Engaged state outer ring — always visible when the
              about section is open. Pulses slightly brighter on
              hover so the user gets feedback without the orb
              jumping in scale. */}
          {isOpen && (
            <motion.div
              className="absolute rounded-full"
              aria-hidden="true"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{
                opacity: isHovered ? 1 : 0.85,
                scale: 1,
              }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              style={{
                inset: -4,
                border: `1.5px solid ${GREEN}`,
                boxShadow: isHovered
                  ? `0 0 24px ${GREEN}cc, inset 0 0 8px ${GREEN}66`
                  : `0 0 16px ${GREEN}80`,
                pointerEvents: "none",
              }}
            />
          )}
        </motion.div>
      </motion.button>
    </div>
  );
};

export default Pearl;
