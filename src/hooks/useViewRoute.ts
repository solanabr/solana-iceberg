/**
 * URL <-> View bridge.
 *
 * The app used to keep the whole navigation state in a single
 * `useState<View>` inside Index.tsx, so nothing was linkable and the
 * browser Back button left the site. This hook keeps the exact same
 * `[view, setView]` tuple signature but derives `view` from the URL and
 * makes `setView` a router navigation, so every call site in Index.tsx
 * is unchanged while terms and layers become shareable links.
 *
 * Route table (mirrors vercel.json rewrites):
 *
 *   /                    /pt                  /es                  → home
 *   /t/:termId           /pt/t/:termId        /es/t/:termId        → term
 *   /l/:layerId          /pt/l/:layerId       /es/l/:layerId       → layer
 *
 * The term URL carries only the term id — the layer it belongs to is
 * derived from the term's own depth, so `/t/slot` and `/l/deep` stay
 * independent and neither needs url-encoding (term ids are kebab slugs).
 */
import { useCallback, useEffect, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  depthOrder,
  depthToLayerId,
  getTermById,
} from "@/data/glossaryAdapter";
import { useTranslation, type Lang } from "@/i18n/context";

export type View =
  | { type: "home" }
  | { type: "layer"; layerId: string }
  /* `via` records how the term view was opened:
   *   - "layer": the user was browsing a layer and tapped a card →
   *     LayerView stays mounted under the stacked term modal so
   *     backdrop clicks return to it.
   *   - "home": the user tapped a term directly from the home
   *     iceberg, the search bar, or the random button → no layer
   *     view is mounted and the term modal renders over the home
   *     background. Backdrop clicks return straight to home.
   *
   * `via` is not derivable from the URL, so it travels in history state.
   * A cold deep-link into /t/:termId has no history state and defaults
   * to "home", which is the correct read: the visitor never opened a
   * layer, so there is nothing to stack the modal on top of. */
  | { type: "term"; layerId: string; termId: string; via: "home" | "layer" };

/** URL locale segment → app language. No segment means "leave the
 *  language alone" (see the sync effect below), not "force English". */
const SEGMENT_TO_LANG: Record<string, Lang> = { pt: "pt-BR", es: "es" };

/** Leading locale segment of a pathname, as a path prefix ("", "/pt", "/es"). */
function localePrefix(pathname: string): string {
  const first = pathname.split("/")[1];
  return first in SEGMENT_TO_LANG ? `/${first}` : "";
}

function buildPath(view: View, prefix: string): string {
  switch (view.type) {
    case "layer":
      return `${prefix}/l/${view.layerId}`;
    case "term":
      return `${prefix}/t/${view.termId}`;
    default:
      return prefix || "/";
  }
}

const isLayerId = (id: string): boolean =>
  (depthOrder as readonly string[]).includes(id);

/** App language → URL locale segment. English is the unprefixed default. */
const LANG_TO_SEGMENT: Record<Lang, string> = {
  en: "",
  "pt-BR": "/pt",
  es: "/es",
};

/**
 * Mirrors a language change into the URL, keeping the current view.
 *
 * The URL -> app sync in `useViewRoute` is deliberately one-directional, so
 * without this the address bar would still read `/t/slot` after switching to
 * Portuguese and a copied link would silently lose the language. Navigating
 * with `replace` keeps language toggling out of the history stack, and
 * `location.state` is carried over so an open term modal keeps its `via`
 * (and therefore the layer stacked beneath it).
 */
export function useLocaleNavigate(): (next: Lang) => void {
  const location = useLocation();
  const navigate = useNavigate();

  return useCallback(
    (next: Lang) => {
      const rest = location.pathname.slice(
        localePrefix(location.pathname).length,
      );
      const target = `${LANG_TO_SEGMENT[next]}${rest}` || "/";
      navigate(`${target}${location.search}`, {
        replace: true,
        state: location.state,
      });
    },
    [location, navigate],
  );
}

export function useViewRoute(): [View, (next: View) => void] {
  const { termId, layerId } = useParams<{
    termId?: string;
    layerId?: string;
  }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { lang, setLang } = useTranslation();

  const prefix = localePrefix(location.pathname);

  /* Resolves aliases too — `getTermById` accepts an id or an alias, so a
     hand-written /t/<alias> link still opens the right term (and is then
     rewritten to the canonical id by the effect below). */
  const term = termId ? getTermById(termId) : undefined;
  const layerValid = layerId ? isLayerId(layerId) : false;

  /* history.state.via, narrowed. Anything unexpected reads as "home". */
  const via: "home" | "layer" =
    (location.state as { via?: unknown } | null)?.via === "layer"
      ? "layer"
      : "home";

  /* Memoized so the object identity is as stable as the old useState
     value was — Index.tsx feeds `view` into useCallback deps that reach
     memoized children (IcebergSVG, SearchBar). */
  const view = useMemo<View>(() => {
    if (term) {
      return {
        type: "term",
        termId: term.id,
        layerId: depthToLayerId[term.depth],
        via,
      };
    }
    if (layerId && layerValid) return { type: "layer", layerId };
    return { type: "home" };
  }, [term, layerId, layerValid, via]);

  /* Unknown ids: redirect to the locale home instead of rendering a 404.
     A term that was renamed or a mistyped slug still lands somewhere
     usable, and `replace: true` keeps it out of the history stack so
     Back doesn't bounce through the dead link. Structurally invalid
     paths (/foo/bar) never reach this hook — they hit the `*` route and
     render NotFound.
     Same effect canonicalizes /t/<alias> → /t/<canonical-id> so shared
     links and the OG endpoint agree on one URL per term. */
  const resolvedTermId = term?.id;
  useEffect(() => {
    if (termId && !resolvedTermId) {
      navigate(prefix || "/", { replace: true });
    } else if (resolvedTermId && resolvedTermId !== termId) {
      navigate(`${prefix}/t/${resolvedTermId}`, {
        replace: true,
        state: { via },
      });
    } else if (layerId && !layerValid) {
      navigate(prefix || "/", { replace: true });
    }
  }, [termId, resolvedTermId, layerId, layerValid, prefix, via, navigate]);

  /* URL → language, one direction only. Depending on `prefix` alone (not
     `lang`) means switching language from the picker never fights the
     URL. A missing prefix deliberately does NOT force English, so a
     visitor whose stored preference is pt-BR keeps it on "/". */
  useEffect(() => {
    const urlLang = SEGMENT_TO_LANG[prefix.slice(1)];
    if (urlLang && urlLang !== lang) setLang(urlLang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefix]);

  const setView = useCallback(
    (next: View) => {
      const path = buildPath(next, prefix);
      /* Re-selecting the current view would otherwise push a duplicate
         history entry, making Back look broken. */
      if (
        path === location.pathname &&
        (next.type !== "term" || next.via === via)
      )
        return;
      navigate(path, next.type === "term" ? { state: { via: next.via } } : {});
    },
    [navigate, prefix, location.pathname, via],
  );

  return [view, setView];
}
