import { useState, useMemo, useEffect, useRef } from "react";
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
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const truncatedLabel = t("search.truncated", {
    shown: visibleResults.length,
    total: results.length,
  });

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
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
              blurTimerRef.current = setTimeout(() => setFocused(false), 200);
            }}
            placeholder={t("search.placeholder", { count: allTerms.length })}
            className="bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground w-40 md:w-52"
          />
        </div>

        {focused && results.length > 0 && (
          <div
            className={`absolute mt-2 w-72 max-w-[calc(100vw-1rem)] max-h-[50vh] overflow-y-auto rounded-xl border border-secondary/20 bg-background/90 backdrop-blur-xl p-2 ${inline ? "left-0 top-full z-[100]" : "right-0 top-full"}`}
            style={{ boxShadow: "0 0 30px rgba(20,241,149,0.1)" }}
          >
            <AnimatedList delay={0.04}>
              {visibleResults.map((r) => {
                const localized = getTermName(lang, r.term.id) ?? r.term.term;
                return (
                  <button
                    key={`${r.layerId}-${r.term.id}`}
                    onMouseDown={() => {
                      onTermClick(r.layerId, r.term.id);
                      setQuery("");
                    }}
                    onClick={() => {
                      onTermClick(r.layerId, r.term.id);
                      setQuery("");
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm text-foreground/80 hover:text-secondary hover:bg-secondary/10 transition-all"
                  >
                    {localized}
                    {r.matchedAlias && (
                      <span className="text-xs text-secondary/50 ml-1">
                        ({r.matchedAlias})
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground ml-2">
                      ({t(`term.depth.${r.layerId}` as Parameters<typeof t>[0])}
                      )
                    </span>
                  </button>
                );
              })}
            </AnimatedList>

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
