import { useMemo } from "react";

const Bubbles = () => {
  const bubbles = useMemo(
    () =>
      Array.from({ length: 15 }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        size: Math.random() * 4 + 2,
        duration: `${Math.random() * 8 + 6}s`,
        delay: `${Math.random() * 10}s`,
      })),
    [],
  );

  return (
    /* No overflow-hidden — bubbles fade out via keyframe opacity instead of hard clipping */
    <div className="absolute inset-0 pointer-events-none z-0">
      {bubbles.map((b) => (
        <div
          key={b.id}
          className="absolute bottom-0 rounded-full"
          style={{
            left: b.left,
            width: b.size,
            height: b.size,
            background: "rgba(20, 241, 149, 0.55)",
            boxShadow: "0 0 6px rgba(20, 241, 149, 0.35)",
            animation: `bubble-rise ${b.duration} ease-out infinite`,
            animationDelay: b.delay,
          }}
        />
      ))}
    </div>
  );
};

export default Bubbles;
