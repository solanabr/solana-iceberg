/**
 * DecryptedText — reactbits.dev
 * Text starts as scrambled cipher characters and "decrypts" into the real string.
 * Adapted for framer-motion v11.
 */
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { motion } from "framer-motion";

interface DecryptedTextProps {
  text: string;
  speed?: number;
  maxIterations?: number;
  sequential?: boolean;
  revealDirection?: "start" | "end" | "center";
  useOriginalCharsOnly?: boolean;
  characters?: string;
  className?: string;
  encryptedClassName?: string;
  parentClassName?: string;
  animateOn?: "view" | "hover";
}

export default function DecryptedText({
  text,
  speed = 50,
  maxIterations = 10,
  sequential = false,
  revealDirection = "start",
  useOriginalCharsOnly = false,
  characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*()_+",
  className = "",
  parentClassName = "",
  encryptedClassName = "",
  animateOn = "view",
}: DecryptedTextProps) {
  const [displayText, setDisplayText] = useState<string>(text);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [revealedIndices, setRevealedIndices] = useState<Set<number>>(
    new Set(),
  );
  const [hasAnimated, setHasAnimated] = useState<boolean>(false);
  const [isDecrypted, setIsDecrypted] = useState<boolean>(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  const availableChars = useMemo<string[]>(() => {
    return useOriginalCharsOnly
      ? Array.from(new Set(text.split(""))).filter((char) => char !== " ")
      : characters.split("");
  }, [useOriginalCharsOnly, text, characters]);

  const shuffleText = useCallback(
    (originalText: string, currentRevealed: Set<number>) => {
      return originalText
        .split("")
        .map((char, i) => {
          if (char === " ") return " ";
          if (currentRevealed.has(i)) return originalText[i];
          return availableChars[
            Math.floor(Math.random() * availableChars.length)
          ];
        })
        .join("");
    },
    [availableChars],
  );

  const triggerDecrypt = useCallback(() => {
    setRevealedIndices(new Set());
    setIsAnimating(true);
  }, []);

  // Auto-trigger on view
  useEffect(() => {
    if (animateOn !== "view") return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated) {
            triggerDecrypt();
            setHasAnimated(true);
          }
        });
      },
      { threshold: 0.1 },
    );
    const el = containerRef.current;
    if (el) observer.observe(el);
    /* disconnect(), not just unobserve(): unobserve clears the target but
       leaves the observer itself alive, so every mount leaked one. Term views
       mount this per heading, so it accumulated across open/close cycles. */
    return () => observer.disconnect();
  }, [animateOn, hasAnimated, triggerDecrypt]);

  // Animation loop
  useEffect(() => {
    if (!isAnimating) return;
    let currentIteration = 0;

    const getNextIndex = (revealedSet: Set<number>): number => {
      const len = text.length;
      if (revealDirection === "start") return revealedSet.size;
      if (revealDirection === "end") return len - 1 - revealedSet.size;
      // center
      const middle = Math.floor(len / 2);
      const offset = Math.floor(revealedSet.size / 2);
      const nextIndex =
        revealedSet.size % 2 === 0 ? middle + offset : middle - offset - 1;
      if (nextIndex >= 0 && nextIndex < len && !revealedSet.has(nextIndex))
        return nextIndex;
      for (let i = 0; i < len; i++) if (!revealedSet.has(i)) return i;
      return 0;
    };

    const interval = setInterval(() => {
      setRevealedIndices((prev) => {
        if (sequential) {
          if (prev.size < text.length) {
            const nextIndex = getNextIndex(prev);
            const newRevealed = new Set(prev);
            newRevealed.add(nextIndex);
            setDisplayText(shuffleText(text, newRevealed));
            return newRevealed;
          } else {
            clearInterval(interval);
            setIsAnimating(false);
            setIsDecrypted(true);
            return prev;
          }
        } else {
          setDisplayText(shuffleText(text, prev));
          currentIteration++;
          if (currentIteration >= maxIterations) {
            clearInterval(interval);
            setIsAnimating(false);
            setDisplayText(text);
            setIsDecrypted(true);
          }
          return prev;
        }
      });
    }, speed);

    return () => clearInterval(interval);
  }, [
    isAnimating,
    text,
    speed,
    maxIterations,
    sequential,
    revealDirection,
    shuffleText,
  ]);

  // Hover handlers
  const triggerHoverDecrypt = useCallback(() => {
    if (isAnimating) return;
    setRevealedIndices(new Set());
    setIsDecrypted(false);
    setDisplayText(text);
    setIsAnimating(true);
  }, [isAnimating, text]);

  const resetToPlainText = useCallback(() => {
    setIsAnimating(false);
    setRevealedIndices(new Set());
    setDisplayText(text);
    setIsDecrypted(true);
  }, [text]);

  const animateProps =
    animateOn === "hover"
      ? { onMouseEnter: triggerHoverDecrypt, onMouseLeave: resetToPlainText }
      : {};

  // Initialize
  useEffect(() => {
    setDisplayText(text);
    setIsDecrypted(animateOn !== "view");
  }, [animateOn, text]);

  return (
    <motion.span
      ref={containerRef}
      className={`inline-block whitespace-pre-wrap ${parentClassName}`}
      {...animateProps}
    >
      <span aria-hidden="true">
        {displayText.split("").map((char, index) => {
          const isRevealed =
            revealedIndices.has(index) || (!isAnimating && isDecrypted);
          return (
            <span
              key={index}
              className={isRevealed ? className : encryptedClassName}
            >
              {char}
            </span>
          );
        })}
      </span>
    </motion.span>
  );
}
