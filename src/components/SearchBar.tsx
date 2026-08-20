import {
  useState,
  useMemo,
  useEffect,
  useRef,
  useId,
  type KeyboardEvent,
} from "react";
import { Search, Shuffle } from "lucide-react";
import {
  searchAllTerms,
  allTerms,
  depthToLayerId,
} from "@/data/glossaryAdapter";
import { useTranslation } from "@/i18n/context";
import { getTermName } from "@/i18n/glossary";
import LanguageToggle from "@/components/LanguageToggle";
import AnimatedList from "@/components/reactbits/AnimatedList";

interface Props {
  onTermClick: (layerId: string, termId: string) => void;
  /** When true, the component renders inline (no fixed positioning)
   *  because a parent wrapper handles the fixed positioning. */
  inline?: boolean;
}

/** searchAllTerms matches definitions too, so a single letter returns ~1,000
 *  terms. Each one mounts an animated motion.div while ~10 are ever visible,
 *  and the stagger would take ~42s to finish. Cap the render and tell the
 *  user the list is truncated. */
const MAX_RESULTS = 50;

const SearchBar = ({ onTermClick, inline }: Props) => {
  const { t, lang } = useTranslation();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [focused, setFocused] = useState(false);
  /** Escape hides the dropdown without blurring the input. Cleared on the next
   *  keystroke or refocus so the results come back. */
  const [dismissed, setDismissed] = useState(false);
  /** Keyboard highlight; -1 means "no option highlighted" (mouse-only state). */
  const [activeIndex, setActiveIndex] = useState(-1);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Index renders two SearchBars (inline + fixed), so the ids must be unique
  // per instance or aria-activedescendant would resolve to the wrong list.
  const listboxId = `search-results-${useId()}`;

  // Debounce search: input stays responsive, search runs after 300ms idle
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const results = useMemo(() => {
    return searchAllTerms(debouncedQuery);
  }, [debouncedQuery]);

  const visibleResults = useMemo(
    () => results.slice(0, MAX_RESULTS),
    [results],
  );

  // A new result set invalidates the highlight — dropping it also keeps
  // activeIndex from pointing past the end of a now-shorter list.
  useEffect(() => setActiveIndex(-1), [visibleResults]);

  // Keep the highlighted row inside the max-h-[50vh] scroll container.
  useEffect(() => {
    if (activeIndex < 0) return;
    document
      .getElementById(`${listboxId}-option-${activeIndex}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, listboxId]);

  const truncatedLabel = t("search.truncated", {
    shown: visibleResults.length,
    total: results.length,
  });

  /* Only judge emptiness once the debounce has caught up, otherwise the empty
     state flashes on the first keystroke of every query. */
  const hasQuery = debouncedQuery.trim().length > 0;
  const isOpen = focused && !dismissed && hasQuery;

  const openResult = (index: number) => {
    const result = visibleResults[index];
    if (!result) return;
    onTermClick(result.layerId, result.term.id);
    setQuery("");
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const { key } = e;

    if (key === "Escape") {
      if (!isOpen) return;
      e.preventDefault();
      setDismissed(true);
      setActiveIndex(-1);
      return;
    }

    if (key === "Enter") {
      // No highlight means no change to the pre-existing behaviour (nothing).
      if (activeIndex < 0) return;
      e.preventDefault();
      openResult(activeIndex);
      return;
    }

    if (
      key !== "ArrowDown" &&
      key !== "ArrowUp" &&
      key !== "Home" &&
      key !== "End"
    )
      return;

    e.preventDefault(); // stop the caret from jumping while navigating rows
    setDismissed(false); // arrowing after Escape reopens the list

    const count = visibleResults.length;
    if (count === 0) return;

    setActiveIndex((i) => {
      if (key === "Home") return 0;
      if (key === "End") return count - 1;
      if (key === "ArrowDown") return i + 1 >= count ? 0 : i + 1;
      return i <= 0 ? count - 1 : i - 1;
    });
  };

  const handleRandom = () => {
    const pick = allTerms[Math.floor(Math.random() * allTerms.length)];
    if (pick) {
      const layerId = depthToLayerId[pick.depth];
      onTermClick(layerId, pick.id);
    }
  };

  return (
    /* Order left-to-right: search bar → random term → language toggle */
    <div
      className={
        inline
          ? "flex items-center gap-2"
          : "fixed top-4 right-4 z-[90] flex items-center gap-2"
      }
    >
      {/* Search bar */}
      <div className="relative">
        <div
          className="flex items-center gap-2 rounded-xl border border-secondary/20 bg-background/60 backdrop-blur-xl px-3"
          style={{ boxShadow: "0 0 15px rgba(20,241,149,0.1)", height: "36px" }}
        >
          <Search className="w-4 h-4 text-secondary/60 shrink-0" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setDismissed(false);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              // Cancel a pending close, otherwise refocusing within 200ms of a
              // blur still snaps the dropdown shut.
              if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
              setFocused(true);
              setDismissed(false);
            }}
            onBlur={() => {
              if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
              blurTimerRef.current = setTimeout(() => setFocused(false), 200);
            }}
            placeholder={t("search.placeholder", { count: allTerms.length })}
            role="combobox"
            aria-expanded={isOpen}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={
              activeIndex >= 0
                ? `${listboxId}-option-${activeIndex}`
                : undefined
            }
            className="bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground w-40 md:w-52"
          />
        </div>

        {isOpen && (
          <div
            className={`absolute mt-2 w-72 max-w-[calc(100vw-1rem)] max-h-[50vh] overflow-y-auto rounded-xl border border-secondary/20 bg-background/90 backdrop-blur-xl p-2 ${inline ? "left-0 top-full z-[100]" : "right-0 top-full"}`}
            style={{ boxShadow: "0 0 30px rgba(20,241,149,0.1)" }}
          >
            <div id={listboxId} role="listbox">
              <AnimatedList delay={0.04}>
                {visibleResults.map((r, i) => {
                  const localized = getTermName(lang, r.term.id) ?? r.term.term;
                  const active = i === activeIndex;
                  return (
                    <button
                      key={`${r.layerId}-${r.term.id}`}
                      id={`${listboxId}-option-${i}`}
                      role="option"
                      aria-selected={active}
                      /* Focus stays on the input: this is an
                         aria-activedescendant listbox, not a roving tabindex. */
                      tabIndex={-1}
                      // mousedown, not click — it has to beat the blur timer
                      onMouseDown={() => openResult(i)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                        active
                          ? "bg-secondary/15 text-secondary ring-1 ring-secondary/40"
                          : "text-foreground/80 hover:text-secondary hover:bg-secondary/10"
                      }`}
                    >
                      {localized}
                      {r.matchedAlias && (
                        <span className="text-xs text-secondary/50 ml-1">
                          ({r.matchedAlias})
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground ml-2">
                        (
                        {t(
                          `term.depth.${r.layerId}` as Parameters<typeof t>[0],
                        )}
                        )
                      </span>
                    </button>
                  );
                })}
              </AnimatedList>
            </div>

            {visibleResults.length === 0 && (
              <div
                role="status"
                className="px-3 py-2 text-xs text-muted-foreground break-words"
              >
                {t("search.noResults", { query: debouncedQuery })}
              </div>
            )}

            {/* Sticky so the truncation is visible without scrolling 50 rows */}
            {results.length > visibleResults.length && (
              <div className="sticky bottom-0 mt-1 rounded-lg border-t border-secondary/10 bg-background/95 backdrop-blur-xl px-3 py-2 text-xs text-muted-foreground">
                {truncatedLabel}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Random term button */}
      <button
        onClick={handleRandom}
        className="flex items-center justify-center rounded-xl border border-secondary/20 bg-background/60 backdrop-blur-xl px-3 text-foreground/60 hover:text-secondary transition-colors"
        style={{ boxShadow: "0 0 15px rgba(20,241,149,0.1)", height: "36px" }}
        title={t("search.random")}
        aria-label={t("search.random")}
      >
        <Shuffle className="w-4 h-4" />
      </button>

      {/* Language toggle */}
      <LanguageToggle />
    </div>
  );
};

export default SearchBar;
