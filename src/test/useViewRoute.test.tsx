/**
 * URL <-> View bridge tests.
 *
 * This hook is the only thing standing between a shareable link and a blank
 * screen, and almost all of its interesting behaviour is in effects that run
 * after the first render (alias canonicalisation, unknown-id redirects,
 * URL -> language sync). Rendered inside a MemoryRouter with the same route
 * table App.tsx declares, so the params this hook reads are real.
 */
import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LanguageProvider, useTranslation } from "@/i18n/context";
import {
  useViewRoute,
  useLocaleNavigate,
  type View,
} from "@/hooks/useViewRoute";

/** Serialises the hook's output plus the live URL into the DOM for assertions. */
function Probe({
  onReady,
}: {
  onReady?: (setView: (v: View) => void) => void;
}) {
  const [view, setView] = useViewRoute();
  const location = useLocation();
  const { lang } = useTranslation();
  const localeNavigate = useLocaleNavigate();

  onReady?.(setView);
  probeHandles.setView = setView;
  probeHandles.localeNavigate = localeNavigate;

  return (
    <>
      <span data-testid="view">{JSON.stringify(view)}</span>
      <span data-testid="path">{location.pathname}</span>
      <span data-testid="state">{JSON.stringify(location.state ?? null)}</span>
      <span data-testid="lang">{lang}</span>
    </>
  );
}

const probeHandles: {
  setView?: (v: View) => void;
  localeNavigate?: (lang: "en" | "pt-BR" | "es") => void;
} = {};

/** The exact route table from App.tsx, minus the NotFound catch-all. */
async function renderAt(
  initialEntry: string | { pathname: string; state: unknown },
) {
  await act(async () => {
    render(
      <LanguageProvider>
        <MemoryRouter
          initialEntries={[initialEntry as string]}
          /* Silences the v6 upgrade warnings so the suite output stays
             readable. Neither flag changes what these tests assert. */
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route path="/" element={<Probe />} />
            <Route path="/t/:termId" element={<Probe />} />
            <Route path="/l/:layerId" element={<Probe />} />
            <Route path="/pt" element={<Probe />} />
            <Route path="/pt/t/:termId" element={<Probe />} />
            <Route path="/pt/l/:layerId" element={<Probe />} />
            <Route path="/es" element={<Probe />} />
            <Route path="/es/t/:termId" element={<Probe />} />
            <Route path="/es/l/:layerId" element={<Probe />} />
            <Route path="*" element={<span data-testid="notfound">404</span>} />
          </Routes>
        </MemoryRouter>
      </LanguageProvider>,
    );
  });
}

const view = () => JSON.parse(screen.getByTestId("view").textContent ?? "null");
const path = () => screen.getByTestId("path").textContent;
const state = () =>
  JSON.parse(screen.getByTestId("state").textContent ?? "null");
const lang = () => screen.getByTestId("lang").textContent;

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("URL -> View", () => {
  it("maps / to the home view", async () => {
    await renderAt("/");
    expect(view()).toEqual({ type: "home" });
  });

  it("maps /l/:layerId to the layer view", async () => {
    await renderAt("/l/deep");
    expect(view()).toEqual({ type: "layer", layerId: "deep" });
  });

  it("maps every known layer id", async () => {
    for (const id of ["surface", "shallow", "deep", "abyss", "bottom"]) {
      await renderAt(`/l/${id}`);
      expect(view(), `/l/${id} did not resolve to a layer view`).toEqual({
        type: "layer",
        layerId: id,
      });
      cleanup();
    }
  });

  it("maps /t/:termId to the term view and derives the layer from the term's depth", async () => {
    await renderAt("/t/slot");
    // "slot" is depth 2 -> shallow.
    expect(view()).toEqual({
      type: "term",
      termId: "slot",
      layerId: "shallow",
      via: "home",
    });
  });

  /* Two terms at different depths must land in different layers — a hook that
     hard-coded a layer, or dropped the depth lookup, would still pass the
     single-term case above. */
  it("derives the layer from depth rather than returning a constant", async () => {
    await renderAt("/t/proof-of-history");
    expect(view().layerId).toBe("abyss");
    cleanup();

    await renderAt("/t/slot");
    expect(view().layerId).toBe("shallow");
  });

  it("defaults `via` to home for a cold deep-link with no history state", async () => {
    await renderAt("/t/slot");
    expect(view().via).toBe("home");
  });

  it("reads `via: layer` out of history state", async () => {
    await renderAt({ pathname: "/t/slot", state: { via: "layer" } });
    expect(view().via).toBe("layer");
  });

  it("narrows an unexpected `via` value in history state to home", async () => {
    await renderAt({ pathname: "/t/slot", state: { via: "sideways" } });
    expect(view().via).toBe("home");
  });
});

describe("locale prefixes", () => {
  it("maps /pt to home and switches the app language to pt-BR", async () => {
    await renderAt("/pt");
    expect(view()).toEqual({ type: "home" });
    expect(lang()).toBe("pt-BR");
  });

  it("maps /es/t/:termId to the term view and switches to es", async () => {
    await renderAt("/es/t/slot");
    expect(view()).toEqual({
      type: "term",
      termId: "slot",
      layerId: "shallow",
      via: "home",
    });
    expect(lang()).toBe("es");
  });

  it("maps /pt/l/:layerId to the layer view", async () => {
    await renderAt("/pt/l/abyss");
    expect(view()).toEqual({ type: "layer", layerId: "abyss" });
    expect(lang()).toBe("pt-BR");
  });

  it("does NOT force English on an unprefixed URL, so a stored pt-BR preference survives", async () => {
    localStorage.setItem("lang", "pt-BR");
    await renderAt("/t/slot");
    expect(lang()).toBe("pt-BR");
    expect(path()).toBe("/t/slot");
  });
});

describe("fallbacks", () => {
  it("redirects an unknown term id to the locale home instead of dead-ending", async () => {
    await renderAt("/t/not-a-real-term-xyz");
    expect(path()).toBe("/");
    expect(view()).toEqual({ type: "home" });
  });

  it("redirects an unknown term id under a locale prefix to that locale's home", async () => {
    await renderAt("/pt/t/not-a-real-term-xyz");
    expect(path()).toBe("/pt");
    expect(view()).toEqual({ type: "home" });
  });

  it("redirects an unknown layer id to the locale home", async () => {
    await renderAt("/l/mariana-trench");
    expect(path()).toBe("/");
    expect(view()).toEqual({ type: "home" });
  });

  it("redirects an unknown layer id under a locale prefix to that locale's home", async () => {
    await renderAt("/es/l/mariana-trench");
    expect(path()).toBe("/es");
  });

  it("treats an uppercase term id as unknown and redirects home (documents the case-sensitive id lookup)", async () => {
    await renderAt("/t/SLOT");
    expect(path()).toBe("/");
  });
});

describe("alias canonicalisation", () => {
  it("resolves /t/<alias> to the term and rewrites the URL to the canonical id", async () => {
    await renderAt("/t/PoH");
    expect(view().termId).toBe("proof-of-history");
    expect(path()).toBe("/t/proof-of-history");
  });

  it("canonicalises under a locale prefix without losing the prefix", async () => {
    await renderAt("/pt/t/PoH");
    expect(path()).toBe("/pt/t/proof-of-history");
    expect(lang()).toBe("pt-BR");
  });

  it("preserves `via` across the canonicalising redirect, so the layer stays stacked underneath", async () => {
    await renderAt({ pathname: "/t/PoH", state: { via: "layer" } });
    expect(path()).toBe("/t/proof-of-history");
    expect(view().via).toBe("layer");
  });

  it("leaves an already-canonical id alone", async () => {
    await renderAt("/t/proof-of-history");
    expect(path()).toBe("/t/proof-of-history");
  });
});

describe("View -> URL (setView)", () => {
  it("navigates home to a layer", async () => {
    await renderAt("/");
    await act(async () =>
      probeHandles.setView!({ type: "layer", layerId: "deep" }),
    );
    expect(path()).toBe("/l/deep");
    expect(view()).toEqual({ type: "layer", layerId: "deep" });
  });

  it("navigates to a term and round-trips `via` through history state", async () => {
    await renderAt("/l/deep");
    await act(async () =>
      probeHandles.setView!({
        type: "term",
        layerId: "deep",
        termId: "slot",
        via: "layer",
      }),
    );

    expect(path()).toBe("/t/slot");
    expect(state()).toEqual({ via: "layer" });
    expect(view().via).toBe("layer");
  });

  it("round-trips `via: home` too", async () => {
    await renderAt("/");
    await act(async () =>
      probeHandles.setView!({
        type: "term",
        layerId: "shallow",
        termId: "slot",
        via: "home",
      }),
    );
    expect(state()).toEqual({ via: "home" });
    expect(view().via).toBe("home");
  });

  it("navigates back to home", async () => {
    await renderAt("/l/deep");
    await act(async () => probeHandles.setView!({ type: "home" }));
    expect(path()).toBe("/");
  });

  it("keeps the locale prefix on every navigation", async () => {
    await renderAt("/pt");
    await act(async () =>
      probeHandles.setView!({ type: "layer", layerId: "deep" }),
    );
    expect(path()).toBe("/pt/l/deep");

    await act(async () =>
      probeHandles.setView!({
        type: "term",
        layerId: "shallow",
        termId: "slot",
        via: "home",
      }),
    );
    expect(path()).toBe("/pt/t/slot");

    await act(async () => probeHandles.setView!({ type: "home" }));
    expect(path()).toBe("/pt");
  });

  it("ignores a re-selection of the current view so Back does not have to unwind duplicates", async () => {
    await renderAt("/l/deep");
    const before = path();
    await act(async () =>
      probeHandles.setView!({ type: "layer", layerId: "deep" }),
    );
    expect(path()).toBe(before);
    expect(view()).toEqual({ type: "layer", layerId: "deep" });
  });

  it("still navigates when only `via` changes on the same term", async () => {
    await renderAt("/t/slot");
    expect(view().via).toBe("home");
    await act(async () =>
      probeHandles.setView!({
        type: "term",
        layerId: "shallow",
        termId: "slot",
        via: "layer",
      }),
    );
    expect(view().via).toBe("layer");
  });
});

describe("useLocaleNavigate", () => {
  it("mirrors a language change into the URL while keeping the open term", async () => {
    await renderAt("/t/slot");
    await act(async () => probeHandles.localeNavigate!("pt-BR"));

    expect(path()).toBe("/pt/t/slot");
    expect(view().termId).toBe("slot");
  });

  it("swaps one locale prefix for another rather than stacking them", async () => {
    await renderAt("/pt/l/deep");
    await act(async () => probeHandles.localeNavigate!("es"));
    expect(path()).toBe("/es/l/deep");
  });

  it("drops the prefix entirely when switching back to English", async () => {
    await renderAt("/pt/t/slot");
    await act(async () => probeHandles.localeNavigate!("en"));
    expect(path()).toBe("/t/slot");
  });

  it("maps the locale home to '/' rather than an empty path when switching to English", async () => {
    await renderAt("/pt");
    await act(async () => probeHandles.localeNavigate!("en"));
    expect(path()).toBe("/");
  });

  it("carries `via` across the language switch, so a stacked term modal stays stacked", async () => {
    await renderAt({ pathname: "/t/slot", state: { via: "layer" } });
    await act(async () => probeHandles.localeNavigate!("es"));

    expect(path()).toBe("/es/t/slot");
    expect(view().via).toBe("layer");
  });
});

describe("structurally invalid paths", () => {
  it("falls through to the catch-all route rather than reaching this hook", async () => {
    await renderAt("/foo/bar");
    expect(screen.getByTestId("notfound")).toBeInTheDocument();
  });

  it("treats an unknown locale prefix as an invalid path, not a locale", async () => {
    await renderAt("/fr/t/slot");
    expect(screen.getByTestId("notfound")).toBeInTheDocument();
  });
});
