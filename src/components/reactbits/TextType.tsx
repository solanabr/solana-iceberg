/**
 * TextType — reactbits.dev
 * Typewriter effect that reveals text character by character.
 * Triggers once on mount. Lightweight — no external deps.
 */
import { useState, useEffect, useRef } from "react";

interface TextTypeProps {
  text: string;
  /** Characters revealed per tick */
  speed?: number;
  /** Milliseconds between ticks */
  interval?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function TextType({
  text,
  speed = 1,
  interval = 60,
  className = "",
  style,
}: TextTypeProps) {
  const [displayed, setDisplayed] = useState("");
  const indexRef = useRef(0);

  useEffect(() => {
    /* Reset on text change */
    indexRef.current = 0;
    setDisplayed("");

    const timer = setInterval(() => {
      indexRef.current += speed;
      if (indexRef.current >= text.length) {
        setDisplayed(text);
        clearInterval(timer);
      } else {
        setDisplayed(text.slice(0, indexRef.current));
      }
    }, interval);

    return () => clearInterval(timer);
  }, [text, speed, interval]);

  return (
    <span className={className} style={style}>
      {displayed}
      {/* Blinking cursor while typing */}
      {displayed.length < text.length && (
        <span
          style={{
            display: "inline-block",
            width: "2px",
            height: "1em",
            background: "currentColor",
            marginLeft: "2px",
            verticalAlign: "text-bottom",
            animation: "twinkle 0.8s step-end infinite",
          }}
        />
      )}
    </span>
  );
}
