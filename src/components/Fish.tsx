import { useMemo } from "react";

const Fish = () => {
  const fishes = useMemo(
    () => [
      {
        top: "15%",
        duration: "12s",
        delay: "0s",
        size: 20,
        dir: "right",
        opacity: 0.3,
      },
      {
        top: "35%",
        duration: "18s",
        delay: "3s",
        size: 16,
        dir: "left",
        opacity: 0.2,
      },
      {
        top: "55%",
        duration: "10s",
        delay: "6s",
        size: 24,
        dir: "right",
        opacity: 0.25,
      },
      {
        top: "25%",
        duration: "15s",
        delay: "2s",
        size: 14,
        dir: "left",
        opacity: 0.15,
      },
      {
        top: "70%",
        duration: "20s",
        delay: "8s",
        size: 18,
        dir: "right",
        opacity: 0.2,
      },
      {
        top: "45%",
        duration: "14s",
        delay: "5s",
        size: 22,
        dir: "left",
        opacity: 0.18,
      },
      {
        top: "80%",
        duration: "16s",
        delay: "1s",
        size: 12,
        dir: "right",
        opacity: 0.12,
      },
    ],
    [],
  );

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {fishes.map((fish, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            top: fish.top,
            animation: `${fish.dir === "right" ? "swim-right" : "swim-left"} ${fish.duration} linear infinite`,
            animationDelay: fish.delay,
            opacity: fish.opacity,
          }}
        >
          {/* Fish shape from fish.svg — elliptical body, geometric
             play-button tail, and circle eye. ViewBox 48×24 preserves
             the original 2:1 aspect ratio. Colors kept lighter than the
             source SVG (#0d1824/#182d36) for visibility on dark bg. */}
          <svg
            width={fish.size}
            height={fish.size * 0.5}
            viewBox="0 0 48 24"
            fill="none"
          >
            {/* Body — horizontal ellipse */}
            <ellipse
              cx="28"
              cy="12"
              rx="20"
              ry="12"
              fill="hsl(210, 25%, 65%)"
            />
            {/* Tail — play-button triangle extending left from body */}
            <path
              d="M15 6 L3 0.5 C1.5 -0.2 0 0.8 0 2.5 L0 21.5 C0 23.2 1.5 24.2 3 23.5 L15 18 C16.5 17 17 15 17 12 C17 9 16.5 7 15 6Z"
              fill="hsl(210, 25%, 65%)"
            />
            {/* Eye — circle on right side */}
            <circle cx="36" cy="12" r="5" fill="hsl(200, 30%, 90%)" />
          </svg>
        </div>
      ))}
    </div>
  );
};

export default Fish;
