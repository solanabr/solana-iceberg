import { useMemo } from "react";

const DeepSeaCreatures = () => {
  const creatures = useMemo(
    () => [
      // Lanternfish
      {
        type: "lanternfish",
        top: "85%",
        duration: "16s",
        delay: "0s",
        size: 28,
        dir: "right",
        opacity: 0.25,
      },
      {
        type: "lanternfish",
        top: "92%",
        duration: "20s",
        delay: "4s",
        size: 22,
        dir: "left",
        opacity: 0.2,
      },
      {
        type: "lanternfish",
        top: "88%",
        duration: "14s",
        delay: "8s",
        size: 18,
        dir: "right",
        opacity: 0.18,
      },
      /* [Removed] Giant squid (polvo) entries removed — replaced by
         AmbientCreatures kraken using actual designed SVG assets. */
    ],
    [],
  );

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {creatures.map((c, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            top: c.top,
            animation: `${c.dir === "right" ? "swim-right" : "swim-left"} ${c.duration} linear infinite`,
            animationDelay: c.delay,
            opacity: c.opacity,
          }}
        >
          {/* [Simplified] Only lanternfish remain after squid removal */}
          <svg
            width={c.size}
            height={c.size * 0.6}
            viewBox="0 0 40 24"
            fill="none"
          >
            {/* Body */}
            <path
              d="M2 12 Q10 2 26 6 Q36 9 38 12 Q36 15 26 18 Q10 22 2 12Z"
              fill="hsl(200, 40%, 25%)"
            />
            {/* Bioluminescent spots */}
            <circle cx="10" cy="10" r="1.5" fill="rgba(80, 200, 255, 0.9)">
              <animate
                attributeName="opacity"
                values="0.4;1;0.4"
                dur="2s"
                repeatCount="indefinite"
              />
            </circle>
            <circle cx="16" cy="13" r="1.2" fill="rgba(80, 200, 255, 0.8)">
              <animate
                attributeName="opacity"
                values="0.3;0.9;0.3"
                dur="2.5s"
                repeatCount="indefinite"
              />
            </circle>
            <circle cx="22" cy="11" r="1" fill="rgba(80, 200, 255, 0.7)">
              <animate
                attributeName="opacity"
                values="0.5;1;0.5"
                dur="1.8s"
                repeatCount="indefinite"
              />
            </circle>
            {/* Eye */}
            <circle cx="30" cy="12" r="2" fill="rgba(150, 255, 255, 0.9)" />
            {/* Lantern (light organ) */}
            <circle cx="6" cy="6" r="2.5" fill="rgba(80, 220, 255, 0.6)">
              <animate
                attributeName="r"
                values="2;3;2"
                dur="3s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.4;0.8;0.4"
                dur="3s"
                repeatCount="indefinite"
              />
            </circle>
            <line
              x1="8"
              y1="7"
              x2="6"
              y2="6"
              stroke="hsl(200, 40%, 35%)"
              strokeWidth="0.5"
            />
          </svg>
        </div>
      ))}
    </div>
  );
};

export default DeepSeaCreatures;
