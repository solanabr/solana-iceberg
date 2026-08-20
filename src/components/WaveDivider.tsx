import { memo } from "react";

const WaveDivider = memo(() => (
  <div
    className="absolute left-0 right-0 h-[80px] z-10 overflow-hidden"
    style={{ bottom: "-40px" }}
  >
    {/* Top wavy edge */}
    <svg
      className="absolute top-0 left-0 w-[200%] h-1/2"
      style={{ animation: "wave-move 8s linear infinite" }}
      viewBox="0 0 2400 40"
      preserveAspectRatio="none"
    >
      <path
        d="M0 20 Q150 0 300 20 Q450 40 600 20 Q750 0 900 20 Q1050 40 1200 20 Q1350 0 1500 20 Q1650 40 1800 20 Q1950 0 2100 20 Q2250 40 2400 20 V40 H0Z"
        fill="rgba(20, 241, 149, 0.15)"
      />
    </svg>
    <svg
      className="absolute top-0 left-0 w-[200%] h-1/2"
      style={{
        animation: "wave-move 12s linear infinite",
        animationDelay: "-3s",
      }}
      viewBox="0 0 2400 40"
      preserveAspectRatio="none"
    >
      <path
        d="M0 25 Q150 5 300 25 Q450 40 600 25 Q750 5 900 25 Q1050 40 1200 25 Q1350 5 1500 25 Q1650 40 1800 25 Q1950 5 2100 25 Q2250 40 2400 25 V40 H0Z"
        fill="rgba(20, 241, 149, 0.1)"
      />
    </svg>
    {/* Bottom wavy edge */}
    <svg
      className="absolute bottom-0 left-0 w-[200%] h-1/2"
      style={{
        animation: "wave-move 10s linear infinite",
        animationDelay: "-2s",
      }}
      viewBox="0 0 2400 40"
      preserveAspectRatio="none"
    >
      <path
        d="M0 0 H2400 V20 Q2250 40 2100 20 Q1950 0 1800 20 Q1650 40 1500 20 Q1350 0 1200 20 Q1050 40 900 20 Q750 0 600 20 Q450 40 300 20 Q150 0 0 20Z"
        fill="rgba(20, 241, 149, 0.12)"
      />
    </svg>
    <svg
      className="absolute bottom-0 left-0 w-[200%] h-1/2"
      style={{
        animation: "wave-move 14s linear infinite",
        animationDelay: "-5s",
      }}
      viewBox="0 0 2400 40"
      preserveAspectRatio="none"
    >
      <path
        d="M0 0 H2400 V25 Q2250 40 2100 25 Q1950 5 1800 25 Q1650 40 1500 25 Q1350 5 1200 25 Q1050 40 900 25 Q750 5 600 25 Q450 40 300 25 Q150 5 0 25Z"
        fill="rgba(20, 241, 149, 0.08)"
      />
    </svg>
  </div>
));

WaveDivider.displayName = "WaveDivider";

export default WaveDivider;
