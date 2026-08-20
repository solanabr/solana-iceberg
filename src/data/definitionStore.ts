/**
 * Holds the lazily-loaded English definition text.
 *
 * Definitions are 74% of the glossary payload and nothing on the home screen
 * renders a single character of them, so they load in their own chunk instead
 * of on the critical path.
 *
 * `readDefinition` stays synchronous even so. The two views that read
 * definition text — TermView and LayerView's filter — are given a static edge
 * to the payload at build time (see vite.config.ts), so neither can render
 * before it has been evaluated. Everything else either does not touch
 * definitions or goes through `ensureDefinitions()` first.
 */

let definitions: Record<string, string> | null = null;
let inFlight: Promise<void> | null = null;

/** Called at module scope by the generated payload as its chunk evaluates. */
export function setDefinitions(next: Record<string, string>): void {
  definitions = next;
}

export function definitionsLoaded(): boolean {
  return definitions !== null;
}

/** Definition text for a term id, or "" while the payload is still loading. */
export function readDefinition(id: string): string {
  return definitions?.[id] ?? "";
}

/**
 * Resolves once definition text is readable. Never rejects: a failed load
 * leaves the app matching names and aliases only, and the next call retries.
 */
export function ensureDefinitions(): Promise<void> {
  if (definitions) return Promise.resolve();
  inFlight ??= import("./generated/glossaryDefinitions")
    .then(() => undefined)
    .catch(() => {
      inFlight = null;
    });
  return inFlight;
}

/* A URL that names a term or a layer lands straight on a view that reads
   definition text, so start fetching the moment this module evaluates rather
   than waiting for React to mount and that view's own chunk request to trigger
   it. Saves a cold deep-link most of a round trip on a slow connection; costs a
   home visitor nothing. */
const DEEP_LINK = /^(?:\/(?:pt|es))?\/[tl]\/[^/]+\/?$/;
if (typeof location !== "undefined" && DEEP_LINK.test(location.pathname)) {
  void ensureDefinitions();
}

let scheduled = false;

/**
 * Warms the definition chunk on the first sign of engagement.
 *
 * Deliberately not on mount: a visitor who lands and leaves should never pay
 * for 150 kB of prose they did not ask for, and keeping it off the load path is
 * the whole point of the split. But every route to a definition — opening a
 * layer, clicking a term on the iceberg, typing in search — starts with a
 * pointer, key or scroll event, so hanging the prefetch off the first one buys
 * seconds of head start while still leaving a cold home load untouched.
 */
export function scheduleDefinitionPrefetch(): void {
  if (scheduled || typeof window === "undefined") return;
  scheduled = true;

  const events = [
    "pointerdown",
    "pointermove",
    "keydown",
    "touchstart",
    "wheel",
    "scroll",
  ] as const;

  const start = () => {
    for (const event of events) window.removeEventListener(event, start);
    /* Waits for `load`, but no longer: an idle callback was costing up to its
       own timeout on a throttled CPU, and the point is to have the bytes
       already on the way by the time the first layer or term is opened. */
    if (document.readyState === "complete") void ensureDefinitions();
    else
      window.addEventListener("load", () => void ensureDefinitions(), {
        once: true,
      });
  };

  for (const event of events) {
    window.addEventListener(event, start, { once: true, passive: true });
  }
}
