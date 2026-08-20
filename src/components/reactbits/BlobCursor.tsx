/**
 * BlobCursor — reactbits.dev
 * GSAP-powered blob cursor that follows the mouse with organic motion.
 * Replaces NeonCursor for a polished upgrade.
 */
import { useEffect, useRef, memo } from "react";
import gsap from "gsap";

interface BlobCursorProps {
  blobType?: "circle" | "highlight";
  fillColor?: string;
  trailColor?: string;
  size?: number;
}

const BlobCursor = memo(function BlobCursor({
  blobType = "circle",
  fillColor = "rgba(20, 241, 149, 0.25)",
  trailColor = "rgba(153, 69, 255, 0.12)",
  size = 28,
}: BlobCursorProps) {
  const blobRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const blob = blobRef.current;
    const trail = trailRef.current;
    if (!blob || !trail) return;

    // Set initial position off-screen
    gsap.set([blob, trail], { xPercent: -50, yPercent: -50, x: -100, y: -100 });

    const onMove = (e: MouseEvent) => {
      gsap.to(blob, {
        x: e.clientX,
        y: e.clientY,
        duration: 0.3,
        ease: "power2.out",
        overwrite: "auto",
      });
      gsap.to(trail, {
        x: e.clientX,
        y: e.clientY,
        duration: 0.8,
        ease: "power3.out",
        overwrite: "auto",
      });
    };

    const onDown = () => {
      gsap.to(blob, { scale: 0.75, duration: 0.15, ease: "power2.in" });
      gsap.to(trail, { scale: 1.4, duration: 0.2, ease: "power2.out" });
    };

    const onUp = () => {
      gsap.to(blob, { scale: 1, duration: 0.3, ease: "elastic.out(1, 0.4)" });
      gsap.to(trail, { scale: 1, duration: 0.4, ease: "power2.out" });
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const isHighlight = blobType === "highlight";

  return (
    <>
      {/* Trail — larger, slower follow */}
      <div
        ref={trailRef}
        className="pointer-events-none fixed z-[9999]"
        style={{
          // Anchor to viewport origin so GSAP x/y from clientX/clientY map correctly
          top: 0,
          left: 0,
          width: size * 2,
          height: size * 2,
          borderRadius: isHighlight ? "40%" : "50%",
          background: `radial-gradient(circle, ${trailColor} 0%, transparent 70%)`,
          filter: "blur(10px)",
          willChange: "transform",
        }}
      />
      {/* Main blob — tight follow */}
      <div
        ref={blobRef}
        className="pointer-events-none fixed z-[9999]"
        style={{
          top: 0,
          left: 0,
          width: size,
          height: size,
          borderRadius: isHighlight ? "40%" : "50%",
          background: `radial-gradient(circle, ${fillColor} 0%, transparent 70%)`,
          filter: "blur(4px)",
          willChange: "transform",
        }}
      />
    </>
  );
});

BlobCursor.displayName = "BlobCursor";

export default BlobCursor;
