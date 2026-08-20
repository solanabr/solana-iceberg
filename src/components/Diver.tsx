import { useState, useEffect, useRef, memo } from "react";

/* ─── Scroll-Following Diver ───
   Fixed-position diver that sits behind the iceberg (z-10, under
   the iceberg's z-20). Tracks the viewport center vertically but
   clamps at the waterline (top) and bottom-layer boundary (bottom)
   instead of vanishing. Horizontal side-switching and iceberg-facing
   always stay active.

   IMPORTANT: Must be rendered OUTSIDE any ancestor with CSS `filter`
   or `transform` — those create containing blocks that break
   `position: fixed`. */

const SIDE_INTERVAL = 18_000;
const LEFT_X = "10%";
const RIGHT_X = "88%";

const Diver = memo(() => {
  const diverRef = useRef<HTMLDivElement>(null);
  const flipRef = useRef<HTMLDivElement>(null);
  const [side, setSide] = useState<"left" | "right">("right");

  /* Scroll-based vertical position: tracks viewport center (50%)
     within the valid underwater zone, clamping at boundaries
     rather than hiding. Always visible once loaded. */
  useEffect(() => {
    let rafId = 0;
    const update = () => {
      const diver = diverRef.current;
      if (!diver) return;
      const scrollY = window.scrollY;
      const vh = window.innerHeight;
      const pageH = document.body.scrollHeight;

      /* Underwater zone in page-Y coords:
         top = waterline (~1.0× viewport height)
         bottom = ~70% of page (before trenches/pearl/footer) */
      const zoneTop = vh * 1.0;
      const zoneBottom = pageH * 0.65;

      /* Viewport center in page-Y */
      const viewCenter = scrollY + vh * 0.5;

      /* Clamp the diver's page-Y to the valid zone */
      const clampedY = Math.max(
        zoneTop + vh * 0.1,
        Math.min(zoneBottom, viewCenter),
      );

      /* Convert clamped page-Y back to viewport-% */
      const viewportPct = ((clampedY - scrollY) / vh) * 100;
      diver.style.top = `${viewportPct}%`;
    };
    const onScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        update();
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(rafId);
    };
  }, []);

  /* Timer-based side alternation */
  useEffect(() => {
    const interval = setInterval(() => {
      setSide((prev) => (prev === "left" ? "right" : "left"));
    }, SIDE_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  /* rAF loop flips diver to face the iceberg center */
  useEffect(() => {
    let rafId: number;
    let currentFacing: "left" | "right" | null = null;
    const update = () => {
      const diver = diverRef.current;
      const flipEl = flipRef.current;
      if (diver && flipEl) {
        const rect = diver.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const vcx = window.innerWidth / 2;
        const t = window.innerWidth * 0.02;
        if (cx < vcx - t && currentFacing !== "right") {
          flipEl.style.transform = "scaleX(1)";
          currentFacing = "right";
        } else if (cx > vcx + t && currentFacing !== "left") {
          flipEl.style.transform = "scaleX(-1)";
          currentFacing = "left";
        }
      }
      rafId = requestAnimationFrame(update);
    };
    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div
      ref={diverRef}
      className="fixed pointer-events-none z-[1]"
      style={{
        top: "50%",
        left: side === "right" ? RIGHT_X : LEFT_X,
        transform: "translate(-50%, -50%)",
        width: "8vw",
        opacity: 0.25,
        transition: "left 10s ease-in-out",
      }}
    >
      <div ref={flipRef} style={{ transform: "scaleX(-1)" }}>
        <div
          style={{
            filter: "brightness(3) contrast(1.2)",
            animation: "diver-float 6s ease-in-out infinite",
          }}
        >
          <img
            src="/creatures/diver.svg"
            alt=""
            draggable={false}
            style={{ width: "100%", height: "auto" }}
          />
        </div>
      </div>
    </div>
  );
});

Diver.displayName = "Diver";

export default Diver;
