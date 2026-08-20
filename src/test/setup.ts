import "@testing-library/jest-dom";

/* ── Glossary definitions ────────────────────────────────────────────────
   In the browser the definition payload is a lazy chunk welded to TermView,
   so it arrives before anything that renders definition text. There are no
   chunks under vitest, so import it for its registration side effect and give
   every suite the same "definitions are readable" starting state the browser
   has. Tests that care about the loading path itself reset modules and drive
   `ensureDefinitions()` explicitly (see glossaryAdapter.test.ts). */
import "@/data/generated/glossaryDefinitions";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

/* ── jsdom gaps ──────────────────────────────────────────────────────────
   jsdom implements neither of these, and both are called on real code paths
   under test: SearchBar keeps the highlighted option in view with
   scrollIntoView, and LayerView resets its scroll container with scrollTo
   whenever the filtered set changes. Without stubs the component throws
   instead of the assertion failing, which hides what actually broke. */
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}
Element.prototype.scrollTo = function scrollTo() {};
window.scrollTo = (() => {}) as typeof window.scrollTo;

/* ── Controllable IntersectionObserver ───────────────────────────────────
   jsdom has no IntersectionObserver at all, so LayerView's progressive card
   reveal cannot even mount without one. This stub is deliberately inert: it
   never fires on its own, so a component under test renders exactly its
   first batch. Tests that want the next batch call `triggerIntersection()`,
   which is a far more honest signal than waiting on a timer.

   `observe`/`unobserve` bookkeeping is real because LayerView's re-arm
   effect relies on unobserve-then-observe replaying the current state, and a
   stub that silently accepts both would let a re-arm regression pass. */
export interface MockIntersectionObserver {
  callback: IntersectionObserverCallback;
  targets: Set<Element>;
  disconnected: boolean;
}

const observers: MockIntersectionObserver[] = [];

/** Every IntersectionObserver constructed since the last reset. */
export function getObservers(): readonly MockIntersectionObserver[] {
  return observers;
}

export function resetObservers(): void {
  observers.length = 0;
}

/** Fire `isIntersecting` on every live observer that has a target. */
export function triggerIntersection(isIntersecting = true): void {
  for (const o of observers) {
    if (o.disconnected) continue;
    for (const target of o.targets) {
      o.callback(
        [{ isIntersecting, target } as unknown as IntersectionObserverEntry],
        o as unknown as IntersectionObserver,
      );
    }
  }
}

class StubIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = "";
  readonly thresholds: ReadonlyArray<number> = [];
  private readonly record: MockIntersectionObserver;

  constructor(
    callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) {
    this.root = (options?.root as Element | Document | null) ?? null;
    this.rootMargin = options?.rootMargin ?? "";
    this.record = { callback, targets: new Set(), disconnected: false };
    observers.push(this.record);
  }

  observe(target: Element): void {
    this.record.targets.add(target);
  }

  unobserve(target: Element): void {
    this.record.targets.delete(target);
  }

  disconnect(): void {
    this.record.targets.clear();
    this.record.disconnected = true;
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

window.IntersectionObserver =
  StubIntersectionObserver as unknown as typeof IntersectionObserver;
globalThis.IntersectionObserver =
  StubIntersectionObserver as unknown as typeof IntersectionObserver;

/* framer-motion and TiltedCard both read layout geometry; jsdom reports zero
   for everything, which is fine, but ResizeObserver is missing outright. */
class StubResizeObserver implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver =
  StubResizeObserver as unknown as typeof ResizeObserver;
