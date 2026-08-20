/**
 * ClickSpark — reactbits.dev
 * Spark particles burst outward from the cursor on each click.
 * No external dependencies.
 *
 */
import { useRef, useEffect, useCallback, type ReactNode } from "react";
import { onCoalescedResize } from "@/components/coalescedResize";

interface ClickSparkProps {
  sparkColor?: string;
  sparkSize?: number;
  sparkRadius?: number;
  sparkCount?: number;
  duration?: number;
  easing?: "linear" | "ease-in" | "ease-in-out" | "ease-out";
  extraScale?: number;
  /** When true, renders a fixed viewport canvas — no children wrapper needed */
  overlay?: boolean;
  children?: ReactNode;
}

interface Spark {
  x: number;
  y: number;
  angle: number;
  startTime: number;
}

const ClickSpark = ({
  sparkColor = "#fff",
  sparkSize = 10,
  sparkRadius = 15,
  sparkCount = 8,
  duration = 400,
  easing = "ease-out",
  extraScale = 1.0,
  overlay = false,
  children,
}: ClickSparkProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparksRef = useRef<Spark[]>([]);
  const startLoopRef = useRef<(() => void) | null>(null);
  /* Shared with the draw loop so a pending resize is applied before the
     frame is drawn rather than after it — see the sizing effect. */
  const flushSizeRef = useRef<(() => void) | null>(null);

  // Size canvas to viewport (overlay) or parent (wrapper)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (overlay) {
      const resizeCanvas = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
      };
      /* Resizing the backing store wipes it, so whichever runs first in the
         frame must be the one to do it — the draw loop, if it is running, and
         otherwise the coalesced callback. The dirty flag is set synchronously
         from the event so the draw loop can see it in the same frame; without
         it the loop would read window.innerWidth (a layout flush) on every
         frame of every spark burst. */
      let sizeDirty = false;
      const markDirty = () => {
        sizeDirty = true;
      };
      const flushSize = () => {
        if (!sizeDirty) return;
        sizeDirty = false;
        resizeCanvas();
      };
      flushSizeRef.current = flushSize;
      resizeCanvas();
      window.addEventListener("resize", markDirty);
      const off = onCoalescedResize(flushSize);
      return () => {
        flushSizeRef.current = null;
        window.removeEventListener("resize", markDirty);
        off();
      };
    } else {
      const parent = canvas.parentElement;
      if (!parent) return;
      const resizeCanvas = () => {
        const { width, height } = parent.getBoundingClientRect();
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
      };
      const ro = new ResizeObserver(resizeCanvas);
      ro.observe(parent);
      resizeCanvas();
      return () => ro.disconnect();
    }
  }, [overlay]);

  const easeFunc = useCallback(
    (t: number) => {
      switch (easing) {
        case "linear":
          return t;
        case "ease-in":
          return t * t;
        case "ease-in-out":
          return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        default:
          return t * (2 - t);
      }
    },
    [easing],
  );

  // Animation loop — only runs while sparks are active
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let isRunning = false;

    const draw = (timestamp: number) => {
      /* A resize queued for this frame is applied here, before the clear, so
         the sparks are redrawn onto the new backing store in the same frame.
         Applying it in its own rAF callback would land after this one — the
         reallocation wipes the canvas, so that frame would paint empty. */
      flushSizeRef.current?.();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      sparksRef.current = sparksRef.current.filter((spark) => {
        const elapsed = timestamp - spark.startTime;
        if (elapsed >= duration) return false;

        const progress = elapsed / duration;
        const eased = easeFunc(progress);
        const distance = eased * sparkRadius * extraScale;
        const lineLength = sparkSize * (1 - eased);

        const x1 = spark.x + distance * Math.cos(spark.angle);
        const y1 = spark.y + distance * Math.sin(spark.angle);
        const x2 = spark.x + (distance + lineLength) * Math.cos(spark.angle);
        const y2 = spark.y + (distance + lineLength) * Math.sin(spark.angle);

        ctx.strokeStyle = sparkColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        return true;
      });
      if (sparksRef.current.length > 0) {
        animationId = requestAnimationFrame(draw);
      } else {
        isRunning = false;
      }
    };

    startLoopRef.current = () => {
      if (!isRunning) {
        isRunning = true;
        animationId = requestAnimationFrame(draw);
      }
    };

    return () => cancelAnimationFrame(animationId);
  }, [sparkColor, sparkSize, sparkRadius, duration, easeFunc, extraScale]);

  // Spawn sparks — capped at 80 to prevent lag from rapid clicks
  const spawnSparks = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (sparksRef.current.length > 80) return;
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const now = performance.now();
      const newSparks = Array.from({ length: sparkCount }, (_, i) => ({
        x,
        y,
        angle: (2 * Math.PI * i) / sparkCount,
        startTime: now,
      }));
      sparksRef.current.push(...newSparks);
      startLoopRef.current?.();
    },
    [sparkCount],
  );

  // In overlay mode, listen for clicks on the entire window
  useEffect(() => {
    if (!overlay) return;
    const handleWindowClick = (e: MouseEvent) => {
      spawnSparks(e.clientX, e.clientY);
    };
    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  }, [overlay, spawnSparks]);

  const handleClick = (e: React.MouseEvent) => {
    spawnSparks(e.clientX, e.clientY);
  };

  const canvasStyle: React.CSSProperties = overlay
    ? {
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        display: "block",
        userSelect: "none",
        pointerEvents: "none",
        zIndex: 9999,
        willChange: "contents",
      }
    : {
        width: "100%",
        height: "100%",
        display: "block",
        userSelect: "none",
        position: "absolute",
        top: 0,
        left: 0,
        pointerEvents: "none",
        willChange: "contents",
      };

  if (overlay) {
    return <canvas ref={canvasRef} style={canvasStyle} />;
  }

  /* Wrapper mode: original behavior for wrapping specific content */
  return (
    <div
      style={{ position: "relative", width: "100%", height: "100%" }}
      onClick={handleClick}
    >
      <canvas ref={canvasRef} style={canvasStyle} />
      {children}
    </div>
  );
};

export default ClickSpark;
