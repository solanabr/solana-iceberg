import { motion } from "framer-motion";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { ArrowLeft, Search } from "lucide-react";
import {
  type IcebergLayer,
  type Category,
  categoryColors,
  depthPillColors,
} from "@/data/glossaryAdapter";
import { useTranslation } from "@/i18n/context";
import { getTermName } from "@/i18n/glossary";
import TiltedCard from "@/components/reactbits/TiltedCard";
import TextType from "@/components/reactbits/TextType";

/* Cards revealed per batch. Sized to comfortably overfill the widest grid
   (5 columns) so the first paint always fills the viewport. */
const CARD_BATCH = 30;

/* Pause between auto-loaded batches while the sentinel stays in view (i.e.
   the user is parked at the bottom rather than scrolling). Scrolling is not
   gated by this — the observer fires on its own. */
const BATCH_INTERVAL_MS = 260;

/* Viewports too short to fit this view's pinned header — landscape phones.
   Bounded on width too so a deliberately short desktop window keeps the
   layout it has today. */
const isShortViewport = (): boolean =>
  typeof window !== "undefined" &&
  window.innerHeight <= 500 &&
  window.innerWidth <= 1024;

/**
 * Split "Primary (Expansion)" strings into head + tail so the card can
 * show the short primary label prominently and the parenthesized
 * expansion subtly on a second line. Matches only the FINAL
 * parenthesized block (with no nested parens), so terms whose primary
 * name itself contains parens still split correctly:
 *
 *   "API (Application Programming Interface)"
 *     → { head: "API", tail: "Application Programming Interface" }
 *   "Layer 1 (L1)"
 *     → { head: "Layer 1", tail: "L1" }
 *   "#[account(zero_copy)] (Anchor)"
 *     → { head: "#[account(zero_copy)]", tail: "Anchor" }
 *   "Blockchain"
 *     → { head: "Blockchain", tail: null }
 */
function splitAcronym(displayName: string): {
  head: string;
  tail: string | null;
} {
  const match = displayName.match(/^(.+?)\s*\(([^()]+)\)\s*$/);
  if (!match) return { head: displayName, tail: null };
  return { head: match[1].trim(), tail: match[2].trim() };
}

interface Props {
  layer: IcebergLayer;
  selectedCategories: Set<Category>;
  selectedTags: Set<string>;
  /** When true, the layer view is pushed back behind a stacked TermView
   *  modal and rendered with blur + scale-down so it reads as a defocused
   *  background layer (similar to the home defocus under LayerView). */
  defocused?: boolean;
  /** When true, the back button is rendered in the unified navbar
   *  (Index.tsx) instead of LayerView's own top-left corner. */
  narrowMode?: boolean;
  onBack: () => void;
  onTermClick: (termId: string) => void;
  onCategoryClick: (category: Category) => void;
  onClearCategories: () => void;
}

const TermCard = ({
  displayName,
  categoryLabel,
  categoryColor,
  depthColor,
  tags,
  isClicked,
  onClick,
}: {
  displayName: string;
  categoryLabel?: string;
  categoryColor?: string;
  /** Depth color for this card — drives the click flash background
   *  via the `--click-color` CSS variable. Each layer's cards use
   *  their own hue so active feedback reads as "from this layer". */
  depthColor?: string;
  tags?: string[];
  isClicked: boolean;
  onClick: () => void;
}) => {
  const { head, tail } = splitAcronym(displayName);
  /* Convert the hex depth color into an rgba-with-alpha string for the
     --click-color CSS variable. Falls back to the default green in
     .term-card.is-clicked when depthColor is absent. */
  const clickColor = (() => {
    if (!depthColor) return undefined;
    const m = depthColor.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (!m) return undefined;
    const r = parseInt(m[1], 16);
    const g = parseInt(m[2], 16);
    const b = parseInt(m[3], 16);
    return `rgba(${r}, ${g}, ${b}, 0.5)`;
  })();
  return (
    <div
      onClick={(e) => {
        /* Interactive element — stop propagation so the layer view's
           outer click-outside-to-home handler doesn't fire. */
        e.stopPropagation();
        onClick();
      }}
      className={`term-card cursor-pointer rounded-xl flex flex-col items-center justify-between h-[128px] py-3 px-3 text-center overflow-hidden${isClicked ? " is-clicked" : ""}`}
      style={{
        ...(categoryColor ? { borderColor: `${categoryColor}33` } : undefined),
        ...(clickColor
          ? ({ "--click-color": clickColor } as React.CSSProperties)
          : undefined),
      }}
    >
      {/* Title block — `head` is the short primary name (e.g. "API").
          `tail` (the parenthesized expansion) shows as a tooltip on
          hover so the card stays compact and unclipped. */}
      <div
        className="flex-1 flex flex-col items-center justify-center min-h-0 w-full group relative"
        title={tail ? `${head} (${tail})` : undefined}
      >
        <span
          className="term-card-name text-base font-semibold text-foreground/95 leading-snug block max-w-full overflow-hidden"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
          title={tail ? `${head} (${tail})` : head}
        >
          {head}
        </span>
        {/* Hover tooltip for acronym expansion — appears above the card
            on mouse hover, hidden on touch (title attr covers that). */}
        {tail && (
          <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap px-2.5 py-1 rounded-lg bg-background/95 border border-secondary/20 text-[11px] text-foreground/70 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 backdrop-blur-sm shadow-lg">
            {tail}
          </span>
        )}
      </div>

      {/* Footer: category label tinted with the brand color + optional
          tag chips. Kept on its own row so the title always has breathing
          room above. */}
      <div className="w-full mt-2 flex flex-col items-center gap-1.5">
        {categoryLabel && (
          <span
            className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full border"
            style={{
              color: categoryColor ?? "rgba(230,235,245,0.6)",
              borderColor: categoryColor
                ? `${categoryColor}66`
                : "rgba(230,235,245,0.15)",
              background: categoryColor
                ? `${categoryColor}18`
                : "rgba(255,255,255,0.03)",
            }}
          >
            {categoryLabel}
          </span>
        )}
        {tags && tags.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1 max-w-full">
            {tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-1.5 py-0.5 rounded-full border border-secondary/20 text-secondary/70 bg-secondary/5 truncate max-w-[80px]"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const LayerView = ({
  layer,
  selectedCategories,
  selectedTags,
  defocused = false,
  narrowMode = false,
  onBack,
  onTermClick,
  onCategoryClick,
  onClearCategories,
}: Props) => {
  const { lang, t } = useTranslation();
  const [clickedTerm, setClickedTerm] = useState<string | null>(null);
  const [localSearch, setLocalSearch] = useState("");

  /* Clear the transient click highlight whenever the layer view
     becomes the active (non-defocused) view again — e.g. when the
     user closes a stacked TermView and returns to the layer grid.
     Without this the previously-clicked card would stay highlighted
     in its "clicked" state indefinitely. */
  useEffect(() => {
    if (!defocused) setClickedTerm(null);
  }, [defocused]);

  /* Escape closes the layer. Skipped while a TermView is stacked on top —
     that modal owns the key then, and closing the layer out from under it
     would leave the term floating over the home scene. */
  useEffect(() => {
    if (defocused) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [defocused, onBack]);

  /* Progressive reveal. The deep layer alone is 414 terms, and each card is a
     TiltedCard with its own springs and pointer handlers, so mounting the whole
     grid up front costs a long frame on open and most of it is below the fold.
     Cards are revealed a batch at a time as a sentinel near the bottom of the
     scroll container comes into view. */
  const [visibleCount, setVisibleCount] = useState(CARD_BATCH);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  /* Landscape phones are shorter than this view's own header: navbar
     clearance (pt-28) + title + count + the category chip rows + the 46px
     filter box measure ~400px against a 375–430px viewport. The header is an
     unshrinkable flex item, so the `flex-1` grid below it collapses to a zero
     height content box — every card sits below the fold and nothing on screen
     scrolls to reach them. On those viewports only, the header and the grid
     share ONE scroll container (the wrapper) so the header can scroll away.
     Everything taller than 500px keeps the pinned-header layout untouched. */
  const [compact, setCompact] = useState(isShortViewport);
  useEffect(() => {
    const onResize = () => setCompact(isShortViewport());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /* Count terms per category within this layer — used to show a live
     term count beside each category chip and to sort them by popularity. */
  const categoryStats = useMemo(() => {
    const counts = new Map<Category, number>();
    for (const term of layer.terms) {
      if (term.category) {
        counts.set(term.category, (counts.get(term.category) ?? 0) + 1);
      }
    }
    return layer.categories
      .map((cat) => ({ id: cat, count: counts.get(cat) ?? 0 }))
      .sort((a, b) => b.count - a.count);
  }, [layer.terms, layer.categories]);

  const filteredTerms = useMemo(() => {
    let terms = layer.terms;

    if (selectedCategories.size > 0) {
      terms = terms.filter(
        (t) => t.category && selectedCategories.has(t.category),
      );
    }

    if (selectedTags.size > 0) {
      terms = terms.filter((t) => t.tags?.some((tag) => selectedTags.has(tag)));
    }

    /* Trim before matching, not just before the emptiness check. Mobile
       keyboards and paste routinely append a space, and an untrimmed query
       silently narrows the result set — "validator " matched 31 terms where
       "validator" matches 55. */
    if (localSearch.trim()) {
      const q = localSearch.trim().toLowerCase();
      terms = terms.filter(
        (t) =>
          t.term.toLowerCase().includes(q) ||
          t.definition.toLowerCase().includes(q) ||
          t.aliases?.some((a) => a.toLowerCase().includes(q)),
      );
    }

    return terms;
  }, [layer.terms, selectedCategories, selectedTags, localSearch]);

  const visibleTerms = filteredTerms.slice(0, visibleCount);
  const remaining = filteredTerms.length - visibleTerms.length;

  /* Any change to the filtered set restarts the reveal, so switching category
     or typing in the local search never leaves a stale offset behind. Also
     scrolls back to the top, otherwise the user is stranded mid-list looking
     at a shorter result set. */
  useEffect(() => {
    setVisibleCount(CARD_BATCH);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [selectedCategories, selectedTags, localSearch, layer.id]);

  const observerRef = useRef<IntersectionObserver | null>(null);
  /* True while the sentinel is within the trigger range, i.e. a batch really is
     on its way. Gates the skeletons so they never shimmer for content that
     nothing is fetching. */
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    /* Created ONCE per filtered set, not per batch. Rebuilding it on every
       append re-observes a sentinel that is still inside the root margin,
       which fires immediately and cascades the whole layer into the DOM in
       one synchronous burst — the exact thing this is meant to avoid.

       rootMargin pre-loads slightly ahead of the viewport so a steady scroll
       rarely catches the skeletons. */
    const io = new IntersectionObserver(
      ([entry]) => {
        setLoadingMore(entry.isIntersecting);
        if (entry.isIntersecting) {
          /* Bound against the committed list rather than a ref written during
             render — same guard, but legal under concurrent rendering. */
          setVisibleCount((c) =>
            c < filteredTerms.length ? c + CARD_BATCH : c,
          );
        }
      },
      { root: scrollRef.current, rootMargin: "400px 0px" },
    );
    io.observe(sentinel);
    observerRef.current = io;
    return () => {
      io.disconnect();
      observerRef.current = null;
      setLoadingMore(false);
    };
    /* `compact` moves scrollRef onto a different element, so the observer has
       to be rebuilt against the new root — otherwise rotating the phone
       leaves it rooted on a node that no longer scrolls and the reveal
       silently dead-ends. */
  }, [filteredTerms, compact]);

  /* Re-arm after each batch. Without this the list dead-ends: a user parked at
     the very bottom keeps the sentinel permanently intersecting, so the
     observer never sees another transition and nothing more ever loads.
     Re-observing replays the current intersection state, so a new batch
     arrives while the sentinel is still in view.

     The delay paces that. Re-arming on an animation frame technically works
     but fills the whole layer in a few hundred milliseconds, which reads as a
     jump rather than a load. At this cadence the skeletons are actually
     legible and the grid grows visibly, while a normal scroll still outruns
     it — scrolling triggers the observer directly and never waits on this.

     Paused while a TermView is stacked on top: the layer is blurred and
     inert, so mounting hundreds more cards behind it is pure waste. */
  useEffect(() => {
    if (remaining <= 0 || defocused) return;
    const id = window.setTimeout(() => {
      /* Resolved at fire time, NOT captured. A timer scheduled before the
         observer was rebuilt would otherwise re-observe with the stale `io`,
         and since disconnect() only clears targets, that revives a dead
         observer — leaving two live observers on one sentinel, doubling every
         batch, and leaking one more on each recurrence. */
      const io = observerRef.current;
      const sentinel = sentinelRef.current;
      if (!io || !sentinel) return;
      io.unobserve(sentinel);
      io.observe(sentinel);
    }, BATCH_INTERVAL_MS);
    return () => window.clearTimeout(id);
  }, [visibleCount, remaining, defocused, filteredTerms]);

  /* Announce only once the reveal settles. Announcing every batch queues a
     dozen "Showing N of M" messages during a single scroll. */
  const [announcedCount, setAnnouncedCount] = useState(0);
  useEffect(() => {
    const id = window.setTimeout(
      () => setAnnouncedCount(Math.min(visibleCount, filteredTerms.length)),
      800,
    );
    return () => window.clearTimeout(id);
  }, [visibleCount, filteredTerms.length]);

  /* The 70ms handoff below is held in a ref and cancelled on re-entry,
     on unmount, and — critically — on any history change. Without the
     last one an orphaned timer fires onTermClick after the user has
     already navigated away: tapping a card then hitting Back within
     70ms forced them into the term view anyway. Unmount alone is too
     late, because AnimatePresence keeps this component mounted for its
     180ms exit animation, well past the timer. `location.key` changes
     on every push/replace/pop, so it is the exact signal for "whatever
     handoff is in flight is now stale". */
  const handoffTimer = useRef<number | null>(null);
  const { key: historyKey } = useLocation();
  useEffect(
    () => () => {
      if (handoffTimer.current !== null) {
        window.clearTimeout(handoffTimer.current);
        handoffTimer.current = null;
      }
    },
    [historyKey],
  );

  const handleTermClick = useCallback(
    (termId: string) => {
      setClickedTerm(termId);
      /* Keep the click highlight visible briefly, but hand off to the
         term modal quickly so the stacked transition feels snappy. */
      if (handoffTimer.current !== null)
        window.clearTimeout(handoffTimer.current);
      handoffTimer.current = window.setTimeout(() => {
        handoffTimer.current = null;
        onTermClick(termId);
      }, 70);
    },
    [onTermClick],
  );

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col"
      /* Announced as a dialog so assistive tech treats it as a layer over the
         page rather than more of the same document. `aria-modal` is only half
         the story — Index.tsx also marks the home scene inert while an overlay
         is open, otherwise the ~143 iceberg labels behind stay reachable. */
      role="dialog"
      aria-modal="true"
      aria-label={t(`depth.${layer.id}` as Parameters<typeof t>[0])}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      /* Block interaction while defocused so clicks fall through to
         the stacked TermView modal behind which sits at a higher z.
         NOTE: applying `filter: blur(...)` on this outer motion.div
         would break the backdrop-filter on the child backdrop (filter
         creates a containing block and makes backdrop-filter reference
         this element instead of the document behind). Blur + scale for
         the defocus effect is therefore applied on the inner content
         wrapper below, leaving the real backdrop unchanged. */
      style={{ pointerEvents: defocused ? "none" : "auto" }}
    >
      {/* Blur backdrop - click to go back */}
      {/* Home backdrop — this blurs the document behind the LayerView.
          It's a motion element so that when TermView stacks on top
          (defocused=true), we can ramp the blur + dim up without
          touching the inner content wrapper. When the layer view is
          defocused under TermView, the HOME behind us gets blurred
          MORE (so term view gives full isolation) while the layer
          content itself is blurred LESS (so users can still read it). */}
      <motion.div
        className="absolute inset-0"
        onClick={onBack}
        animate={{
          /* Home still reads through as a soft underwater backdrop — colour
             and movement survive — but blur(10px)+0.18 was too light to
             suppress *shapes*: the hero "SOLANA" wordmark ghosted through the
             layer title and category pills, and the home nav bar rendered as
             an unreadable grey smear behind the back button. Raised until
             recognisable text stops resolving, while staying well short of
             the opaque dim used for the stacked-modal state. */
          backdropFilter: defocused ? "blur(28px)" : "blur(22px)",
          WebkitBackdropFilter: defocused ? "blur(28px)" : "blur(22px)",
          backgroundColor: defocused
            ? "rgba(0, 0, 0, 0.5)"
            : "rgba(6, 12, 24, 0.55)",
        }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      />

      {/* Back button — outside the defocus wrapper so it stays crisp.
          Hidden on narrow mode where it's integrated into the unified
          navbar (Index.tsx renders it left of the filter dropdowns). */}
      {!narrowMode && (
        <button
          onClick={onBack}
          /* Icon-only, so it needs its own name — this was the single
             unlabelled button in the app, announced as just "button". */
          aria-label={t("nav.back")}
          className="absolute z-[80] flex items-center justify-center w-9 h-9 rounded-lg transition-colors duration-200 text-foreground/80 hover:text-secondary border border-border/40 hover:border-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/60"
          style={{
            top: "16px",
            left: "16px",
            background: "rgba(10, 22, 40, 0.6)",
            backdropFilter: "blur(8px)",
          }}
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        </button>
      )}

      {/* Defocus wrapper — blur + scale applied here (not on the
          outer motion.div) so the real backdrop-filter above keeps
          referencing the document behind. When term view is stacked
          on top, this wrapper gets blurred and pushed back slightly. */}
      <motion.div
        ref={compact ? scrollRef : undefined}
        className={`relative z-[55] flex flex-col flex-1 min-h-0${compact ? " overflow-y-auto will-change-scroll" : ""}`}
        /* Any click that bubbles up to this wrapper (i.e. not stopped
           by an interactive child like a term card, filter pill, search
           input, or the back button) exits to home. */
        onClick={onBack}
        animate={{
          scale: defocused ? 0.98 : 1,
          /* Much lighter blur on the layer content when defocused — the
             stacked term modal already isolates focus via its own dim
             backdrop. 2px is enough to signal "background" without
             making the layer grid illegible. */
          filter: defocused ? "blur(2px)" : "blur(0px)",
          opacity: defocused ? 0.72 : 1,
        }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        {/* Layer title */}
        <motion.div
          className={`relative z-[60] text-center pb-4 px-4 ${narrowMode ? "pt-28" : "pt-20"}`}
          /* No stopPropagation here on purpose — empty space around
             the title / pills / search should fall through to the
             defocus wrapper onClick that returns to home. */
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.22 }}
        >
          <h2
            className="text-3xl md:text-5xl font-bold tracking-[0.3em]"
            style={(() => {
              /* Layer title glow uses the same depth-color palette as
                 the related-term pills in TermView, so the layer title
                 reads as "the color of everything that lives here". */
              const glow =
                depthPillColors[layer.id as keyof typeof depthPillColors] ??
                "#14F195";
              const r = parseInt(glow.slice(1, 3), 16);
              const g = parseInt(glow.slice(3, 5), 16);
              const b = parseInt(glow.slice(5, 7), 16);
              return {
                color: "rgba(230, 235, 245, 0.98)",
                /* Four-stop glow: tight inner glow + medium ring +
                   outer halo + drop shadow for legibility against any
                   backdrop. Higher alphas than before so the depth
                   color is clearly legible. */
                textShadow: `0 0 8px rgba(${r},${g},${b},0.95), 0 0 24px rgba(${r},${g},${b},0.7), 0 0 56px rgba(${r},${g},${b},0.45), 0 4px 30px rgba(0,0,0,0.8)`,
              };
            })()}
          >
            <TextType
              text={t(`depth.${layer.id}` as Parameters<typeof t>[0])}
              speed={1}
              interval={80}
            />
          </h2>
          <p className="text-base text-foreground/60 mt-2 font-medium tabular-nums">
            {t("layer.termCount", {
              matched: String(filteredTerms.length),
              total: String(layer.terms.length),
            })}
          </p>

          {/* Clickable category filter pills — each wears its own brand
            color (from `categoryColors`) so the row reads as a proper
            legend. Click toggles the same `selectedCategories` set the
            top-nav Category dropdown uses so filter state stays in sync
            across the UI. Active chips fill in with the category color;
            dimmed chips drop to a neutral outline. */}
          <div className="flex flex-wrap justify-center gap-2 mt-3 px-4">
            {categoryStats.map(({ id: cat, count }) => {
              const isSelected = selectedCategories.has(cat);
              const isNeutral = selectedCategories.size === 0;
              const isDimmed = !isNeutral && !isSelected;
              const color = categoryColors[cat];
              const style = isDimmed
                ? undefined
                : isSelected
                  ? {
                      color: color,
                      borderColor: `${color}aa`,
                      background: `${color}26`,
                      boxShadow: `0 0 12px ${color}33`,
                    }
                  : {
                      color: color,
                      borderColor: `${color}55`,
                      background: `${color}10`,
                    };
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCategoryClick(cat);
                  }}
                  className={`group text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all duration-75 flex items-center gap-1.5 ${
                    isDimmed
                      ? "border-foreground/10 text-foreground/40 hover:border-foreground/40 hover:text-foreground/70"
                      : ""
                  }`}
                  style={style}
                >
                  <span>{t(`category.${cat}` as Parameters<typeof t>[0])}</span>
                  <span
                    className="inline-flex items-center justify-center min-w-[18px] h-[16px] px-1 rounded-full text-[10px] font-bold tabular-nums"
                    style={
                      isDimmed
                        ? {
                            background: "rgba(10,22,40,0.7)",
                            color: "rgba(230,235,245,0.6)",
                          }
                        : {
                            background: `${color}33`,
                            color: color,
                          }
                    }
                  >
                    {count}
                  </span>
                </button>
              );
            })}
            {selectedCategories.size > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClearCategories();
                }}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-red-400/40 text-red-400/80 hover:bg-red-500/10 hover:text-red-300 transition-all duration-75"
              >
                {t("nav.clearFilters")}
              </button>
            )}
          </div>

          {/* Local search — larger than before so it reads as the
              primary input on the layer view and is easy to click. */}
          <div className="flex justify-center mt-4">
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-3 rounded-xl border border-secondary/25 bg-background/50 backdrop-blur-xl px-4 w-full"
              style={{
                height: "46px",
                maxWidth: "460px",
                boxShadow: "0 0 20px rgba(20,241,149,0.08)",
              }}
            >
              <Search className="w-5 h-5 text-secondary/60 shrink-0" />
              <input
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder={t("layer.filterPlaceholder")}
                className="bg-transparent border-none outline-none text-base text-foreground placeholder:text-muted-foreground/70 w-full"
              />
            </div>
          </div>
        </motion.div>

        <div
          ref={compact ? undefined : scrollRef}
          className={`relative z-[60] pt-4 px-6 pb-6${compact ? " shrink-0" : " flex-1 min-h-0 overflow-y-auto will-change-scroll"}`}
          /* No stopPropagation — clicks on gaps between cards should
             reach the defocus wrapper onClick and return to home. Term
             card onClicks already call e.stopPropagation() themselves. */
        >
          {/* Grid with narrower columns — cards become taller (160px) so
            acronym head + expansion lines + footer meta all fit without
            truncation. Column count caps at 5 on xl so individual cards
            stay legible on ultra-wide screens. */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 max-w-6xl mx-auto pb-4 p-2">
            {visibleTerms.map((term) => (
              <TiltedCard key={term.id} scaleOnHover={1.05} rotateAmplitude={0}>
                <TermCard
                  displayName={getTermName(lang, term.id) ?? term.term}
                  tags={term.tags}
                  categoryLabel={
                    term.category
                      ? t(
                          `category.${term.category}` as Parameters<
                            typeof t
                          >[0],
                        )
                      : undefined
                  }
                  categoryColor={
                    term.category ? categoryColors[term.category] : undefined
                  }
                  /* All cards in a given layer share one depth color —
                     the click flash uses this color so the active state
                     visually belongs to the current layer. */
                  depthColor={
                    depthPillColors[layer.id as keyof typeof depthPillColors]
                  }
                  isClicked={clickedTerm === term.id}
                  onClick={() => handleTermClick(term.id)}
                />
              </TiltedCard>
            ))}

            {/* Placeholders for the batch being revealed. Same footprint as a
                real card so the grid never reflows when they are replaced.
                Shown only while a batch is genuinely in flight — a shimmer
                means "loading", so it must not sit there for terms that
                nothing is currently fetching. */}
            {loadingMore &&
              remaining > 0 &&
              Array.from({
                length: Math.min(remaining, CARD_BATCH),
              }).map((_, i) => (
                <div
                  key={`skeleton-${i}`}
                  aria-hidden="true"
                  className="term-card-skeleton rounded-xl h-[128px]"
                />
              ))}
          </div>

          {/* Sentinel: crossing into view (plus rootMargin) pulls the next
              batch. Always rendered so the observer keeps a stable target —
              unmounting it at the end of the list would force the observer to
              be rebuilt when filters bring more terms back. */}
          <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />

          {/* role="status" already implies aria-live="polite". Suppressed while
              a TermView is stacked on top, so it cannot talk over the modal. */}
          {!defocused && (
            <p className="sr-only" role="status">
              {t("layer.loaded", {
                shown: String(announcedCount),
                total: String(filteredTerms.length),
              })}
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default LayerView;
