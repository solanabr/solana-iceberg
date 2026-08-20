import {
  useState,
  useCallback,
  useEffect,
  useRef,
  lazy,
  Suspense,
} from "react";
import solanaLogo from "@/assets/solanaWordMark.svg";
import { AnimatePresence } from "framer-motion";
import SoftAurora from "@/components/reactbits/SoftAurora";
import Stars from "@/components/Stars";
import ShootingStars from "@/components/ShootingStars";
import Sailboat from "@/components/Sailboat";
import WaveDivider from "@/components/WaveDivider";
import Fish from "@/components/Fish";
import DeepSeaCreatures from "@/components/DeepSeaCreatures";
import AmbientCreatures from "@/components/AmbientCreatures";
import Diver from "@/components/Diver";
import Bubbles from "@/components/Bubbles";
import IcebergSVG from "@/components/IcebergSVG";
/**
 * Both of these views read definition text, and neither has a loading state:
 * TermView renders `term.definition` straight into the card, and LayerView's
 * filter matches it inside a useMemo keyed on the term objects — a later
 * arrival would not re-run it, so a cold /l/:layerId link would quietly filter
 * on names alone and return half the matches.
 *
 * Definition prose is 74% of the glossary and the home screen shows none of
 * it, so it loads on demand. Pairing the payload with the view's own import
 * means the browser fetches both in parallel and neither view can resolve
 * before the text exists — the first frame either one paints is already
 * correct, with no empty body, no half-empty filter and no second render.
 *
 * The .catch is load-bearing. Without it a failed definitions request rejects
 * the lazy promise and takes the entire view down to the app-level error
 * boundary; with it the view still mounts and degrades to names and aliases,
 * which is what definitionStore's never-reject contract intends. A stale
 * index.html requesting a hashed chunk that no longer exists after a deploy is
 * the realistic trigger.
 */
const withDefinitions =
  <T,>(load: () => Promise<T>) =>
  async (): Promise<T> => {
    const [mod] = await Promise.all([
      load(),
      import("@/data/generated/glossaryDefinitions").catch(() => {}),
    ]);
    return mod;
  };

const LayerView = lazy(withDefinitions(() => import("@/components/LayerView")));
const TermView = lazy(withDefinitions(() => import("@/components/TermView")));
import NavDropdown from "@/components/NavDropdown";
import SearchBar from "@/components/SearchBar";
import BlobCursor from "@/components/reactbits/BlobCursor";
import Footer from "@/components/Footer";
import Pearl from "@/components/Pearl";
const AboutSection = lazy(() => import("@/components/AboutSection"));
import ShinyText from "@/components/reactbits/ShinyText";
import ClickSpark from "@/components/reactbits/ClickSpark";
import BorderGlow from "@/components/reactbits/BorderGlow";
import { useTranslation } from "@/i18n/context";
import { useViewRoute } from "@/hooks/useViewRoute";
import {
  getIcebergLayers,
  getRelatedTerms,
  getTermById,
  type Category,
} from "@/data/glossaryAdapter";

/* ── Z-INDEX HIERARCHY (ascending) ──
   z-[1]   Diver (behind everything, subtle ghost)
   z-10    WaveDivider (h-[80px] strip at sky/underwater boundary)
   z-20    Iceberg SVG container (procedural profile + floating terms)
   z-25    WaveDivider overlay (pointer-events-none decorative)
   z-30    (reserved)
   z-50    NavDropdown (wide mode, fixed top-left)
   z-[55]  LayerView defocus wrapper
   z-[60]  LayerView title / category pills
   z-[64]  TermView SVG connection lines
   z-[65]  TermView card centering container
   z-[66]  TermView related term pills
   z-[80]  TermView back/home buttons
   z-[85]  TermView main card
   z-[90]  SearchBar (wide mode, fixed top-right)
   z-[90]  Narrow mode unified navbar wrapper
   z-[100] Search results dropdown + language picker dropdown */

const icebergLayers = getIcebergLayers();

/* Narrow-viewport back arrow. Rendered in the unified top navbar for both
   the term view (row 1) and the layer view (row 2) — identical chrome,
   only the destination differs. */
const NarrowBackButton = ({ onClick }: { onClick: () => void }) => (
  <button
    onClick={onClick}
    className="flex items-center justify-center w-9 h-9 rounded-lg border border-secondary/20 bg-background/60 backdrop-blur-xl text-foreground/80 hover:text-secondary transition-colors shrink-0"
    style={{ boxShadow: "0 0 15px rgba(20,241,149,0.1)" }}
    aria-label="Back to home"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  </button>
);

const Index = () => {
  const { t } = useTranslation();
  /* `view` is derived from the URL and `setView` navigates — see
     useViewRoute for the route table. The tuple shape is identical to
     the useState it replaced, so every call site below is unchanged. */
  const [view, setView] = useViewRoute();
  const [selectedCategories, setSelectedCategories] = useState<Set<Category>>(
    new Set(),
  );
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [aboutOpen, setAboutOpen] = useState(false);

  /* Narrow viewport detection — drives iceberg container sizing so
     the iceberg fills enough vertical space on phones/tablets for
     the surface layer to remain readable at ~45vh. */
  const [narrowMode, setNarrowMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 1100 || window.innerHeight > window.innerWidth;
  });
  useEffect(() => {
    const handler = () => {
      setNarrowMode(
        window.innerWidth < 1100 || window.innerHeight > window.innerWidth,
      );
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const handleLayerClick = useCallback(
    (layerId: string) => {
      /* On home, park the iceberg so the clicked layer sits behind the
         overlay before it opens, and so closing the layer returns the
         user to that layer rather than to wherever they were.
         On other views, skip the scroll — body is already locked.

         The scroll is deliberately instant, not smooth. The body
         scroll-lock effect below snapshots window.scrollY the moment
         the overlay mounts, and its `position: fixed` aborts any
         in-flight smooth scroll. Smooth scrolling on this 350vh page
         takes 400-800ms, so the old 280ms handoff snapshotted an
         arbitrary midpoint AND killed the animation — the "reveal at
         the layer's position" never actually completed, and closing
         dropped the user somewhere they never chose. window.scrollTo
         with behavior "auto" updates scrollY synchronously, so by the
         time setView commits, the snapshot is exact and no timer is
         needed. */
      if (view.type === "home" && typeof window !== "undefined") {
        const el = document.getElementById(`iceberg-layer-${layerId}`);
        if (el) {
          const rect = el.getBoundingClientRect();
          const targetY =
            window.scrollY +
            rect.top -
            window.innerHeight / 2 +
            rect.height / 2;
          window.scrollTo({ top: Math.max(0, targetY), behavior: "auto" });
        }
      }
      setView({ type: "layer", layerId });
    },
    [view.type, setView],
  );

  const handleTermClick = useCallback(
    (layerId: string, termId: string) => {
      /* Inherit `via` from the current view:
       *   - home or term-from-home → "home" (stays over home background)
       *   - layer or term-from-layer → "layer" (stays over layer view)
       * This lets clicks from the iceberg / search / random land on
       * the term modal directly without a layer view underneath, while
       * clicks from inside a layer preserve the stacked modal pattern. */
      const via: "home" | "layer" =
        view.type === "layer" || (view.type === "term" && view.via === "layer")
          ? "layer"
          : "home";
      setView({ type: "term", layerId, termId, via });
    },
    [view, setView],
  );

  const handleCategoryClick = useCallback((category: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category as Category)) next.delete(category as Category);
      else next.add(category as Category);
      return next;
    });
  }, []);

  const handleTagClick = useCallback((tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }, []);

  const currentLayer =
    view.type !== "home"
      ? icebergLayers.find((l) => l.id === view.layerId)
      : null;

  const currentTerm = view.type === "term" ? getTermById(view.termId) : null;

  const relatedTerms = view.type === "term" ? getRelatedTerms(view.termId) : [];

  /* Lock body scroll when overlay is open.

     The dep is the derived BOOLEAN `isOverlay`, not `view`. That is
     load-bearing: stacking layer → term → layer must not re-run this,
     because by then the body is already `position: fixed` and
     window.scrollY reads 0, which would overwrite savedScrollY and drop
     the user at the top of the page on close. `locked` enforces that
     invariant explicitly so widening the dep can't silently reintroduce
     the bug. */
  const savedScrollY = useRef(0);
  const locked = useRef(false);
  const isOverlay = view.type !== "home";

  useEffect(() => {
    if (isOverlay && !locked.current) {
      locked.current = true;
      savedScrollY.current = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${savedScrollY.current}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.overflow = "hidden";
      return () => {
        locked.current = false;
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.left = "";
        document.body.style.right = "";
        document.body.style.overflow = "";
        window.scrollTo(0, savedScrollY.current);
      };
    }
  }, [isOverlay]);

  /* When a term modal is opened directly from the home screen (no
     layer view in between), we want to softly blur the home content
     so the focus sits on the term card. Detected by
     view.type === "term" && view.via === "home". The blur is applied
     to a wrapper that sits UNDER the overlay so only the background
     content gets blurred — the overlay stays crisp. */
  const homeContentBlurred = view.type === "term" && view.via === "home";

  /* Same dropdown in both layouts — only the BorderGlow wrapper differs
     (the wide variant is fixed to the top-left corner). */
  const navDropdown = (
    <NavDropdown
      onLayerClick={handleLayerClick}
      onCategoryClick={handleCategoryClick}
      selectedCategories={selectedCategories}
      onClearCategories={() => setSelectedCategories(new Set())}
      onTagClick={handleTagClick}
      selectedTags={selectedTags}
      onClearTags={() => setSelectedTags(new Set())}
    />
  );

  return (
    <div className="relative w-full min-h-screen overflow-x-hidden bg-background">
      <ClickSpark
        overlay
        sparkColor="#14F195"
        sparkSize={12}
        sparkRadius={25}
        sparkCount={8}
        duration={500}
      />
      {/* ── Top navigation bar ──
          On wide: two fixed groups (left filters + right search).
          On narrow (< 640px): a single centered bar that wraps
          filters → search into two rows when they can't fit in one.
          Hidden entirely when a term modal is open from home. */}
      {narrowMode ? (
        /* Narrow: single centered container, two rows.
           Row 1 (top): search bar + random + language toggle.
           Row 2 (bottom): filter dropdowns (Depth / Category / Tags).
           flex-wrap + order classes achieve the row swap without
           duplicating components.

           left-0/right-0, not left-4/right-4: this div paints nothing, it
           is only the centring track. Both rows are justify-center, so the
           inset buys no visible margin — it just costs 32px of headroom.
           The term-view row needs 378px and was overflowing the 343px
           track at 375px wide, clipping the back button and the language
           chevron off the screen edges. Widening the track is rendered
           pixel-identical wherever the row already fitted, and lets the
           row give up 3px instead of 35px where it did not. */
        <div className="fixed top-2 left-0 right-0 z-[90] flex flex-wrap items-center justify-center gap-2">
          {/* Search row first (order-1 = top). z-10 so the search
              results dropdown and language picker overlay the filter
              row below. */}
          <div className="order-1 flex items-center justify-center w-full z-10 relative gap-2">
            {/* Back button in term view on mobile (both from-home and from-layer) */}
            {view.type === "term" && (
              <NarrowBackButton
                onClick={() =>
                  view.via === "layer"
                    ? setView({ type: "layer", layerId: view.layerId })
                    : setView({ type: "home" })
                }
              />
            )}
            <SearchBar onTermClick={handleTermClick} inline />
          </div>
          {/* Filters row second (order-2 = bottom).
              Hidden when a term view is open (no need for filters
              while reading a term definition — saves vertical space).
              When in layer view, prepend a back button. */}
          {view.type !== "term" && !homeContentBlurred && (
            <div className="order-2 flex items-center gap-2">
              {view.type === "layer" && (
                <NarrowBackButton onClick={() => setView({ type: "home" })} />
              )}
              <BorderGlow
                glowColor="155 90 60"
                glowIntensity={0.3}
                borderRadius={12}
                clipOverflow={false}
              >
                {navDropdown}
              </BorderGlow>
            </div>
          )}
        </div>
      ) : (
        /* Wide: original split layout */
        <>
          {!homeContentBlurred && (
            <BorderGlow
              glowColor="155 90 60"
              glowIntensity={0.3}
              borderRadius={12}
              className="fixed top-4 left-4 z-50"
              clipOverflow={false}
            >
              {navDropdown}
            </BorderGlow>
          )}
          <SearchBar onTermClick={handleTermClick} />
        </>
      )}

      {/* Home content wrapper — filter:blur is applied here (not on the
          outer div) so the AnimatePresence overlays outside this wrapper
          stay sharp. The transition is short so the blur kicks in in
          sync with the term modal's entry animation. */}
      {/* While a layer or term overlay is open this scene is visually behind a
          dialog but was still fully in the accessibility tree and the tab
          order: 13 focusable controls and ~143 iceberg term labels remained
          reachable, so keyboard and screen-reader users could wander into a
          page they cannot see. `inert` removes it from both at once; the
          aria-hidden is belt-and-braces for engines without inert support. */}
      <div
        {...(isOverlay ? { inert: "", "aria-hidden": true } : {})}
        style={{
          filter: homeContentBlurred ? "blur(6px)" : "blur(0px)",
          transform: homeContentBlurred ? "scale(0.995)" : "scale(1)",
          transition: "filter 0.2s ease-out, transform 0.2s ease-out",
        }}
      >
        {/* ─── SKY SECTION ─── */}
        <div
          className="relative w-full h-screen"
          style={{
            background: "linear-gradient(180deg, #0D0D1A 0%, #0a1628 100%)",
          }}
        >
          <div className="absolute z-0" style={{ inset: "-1px 0 0 0" }}>
            <SoftAurora
              colorStops={["#9945FF", "#14F195", "#9945FF"]}
              amplitude={1.0}
              blend={0.5}
              speed={0.8}
            />
          </div>
          <Stars />
          <ShootingStars />

          <div
            className="absolute left-1/2 -translate-x-1/2 z-30 flex flex-col items-center text-center"
            style={{ top: "18%" }}
          >
            <img
              src={solanaLogo}
              alt="Solana"
              className="h-10 md:h-16 w-auto"
            />
            <h1 className="text-4xl md:text-6xl font-bold tracking-[0.2em] mt-3 relative">
              <ShinyText
                text="ICEBERG"
                speed={3}
                color="#14F195"
                shineColor="#ffffff"
                className="text-secondary relative"
              />
            </h1>
            <p className="text-muted-foreground/50 text-base md:text-lg mt-2 tracking-widest uppercase">
              {t("index.subtitle")}
            </p>
            <div
              className="absolute -inset-12 -z-10 rounded-full blur-[20px]"
              style={{
                background:
                  "radial-gradient(ellipse at center, rgba(20,241,149,0.15) 0%, rgba(153,69,255,0.08) 40%, transparent 70%)",
              }}
            />
          </div>

          <div className="absolute bottom-0 left-0 right-0">
            {/* Narrow viewports stretch the iceberg to 60% of
                viewport width (via preserveAspectRatio="none"), so
                the iceberg base lands around x=76 on a 390px phone.
                Shift the boat to the very left edge (0%) on narrow
                so it stays fully clear of the iceberg on every
                common phone width including 320×568. */}
            <Sailboat leftPct={narrowMode ? 0 : 8} />
            <div
              className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none translate-y-full"
              style={{
                background:
                  "linear-gradient(180deg, rgba(20, 241, 149, 0.08) 0%, rgba(10, 22, 40, 0.4) 40%, rgba(10, 22, 40, 0.8) 100%)",
              }}
            />
          </div>
          <div className="absolute bottom-0 left-0 right-0 z-[25] pointer-events-none">
            <WaveDivider />
          </div>
        </div>

        {/* ─── UNDERWATER SECTION ─── */}
        <div className="relative w-full">
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(180deg, #0A1628 0%, #020408 100%)",
              contain: "paint",
            }}
          >
            <Fish />
            <DeepSeaCreatures />
          </div>

          <AmbientCreatures />

          {/* Iceberg container — two sizing modes, one shared invariant:
              the iceberg TIP is always pinned to page Y = 50vh (the
              vertical midpoint of the first screen). Since the
              underwater section starts at 100vh in flow, the container
              `top` within the underwater section is `-50vh`, which
              places the container top edge at page Y = 100vh - 50vh =
              50vh. The SVG's peak (viewBox y=10 out of 2800) adds a
              ~0.36% offset on top of that — ~0.5vh on narrow, ~1–3vh
              on wide — close enough that the tip effectively lands at
              50vh on every aspect ratio.

              - Wide desktop: width-based sizing. SVG fills viewport
                width (up to the 3200px SVG / 4000px container caps),
                and intrinsic height = width × 2800/1200 = 233.33vw.
                The surface layer's height scales with viewport width
                and ends up around 51–76vh.
              - Narrow (mobile / tablet / portrait): height-based. The
                container fixes SVG height at 150vh so that the
                surface layer is exactly 50vh (tip 50vh → sea level
                100vh) and the underwater body has a full 100vh of
                vertical real estate for the shallow/deep/abyss/bottom
                layers — ~20–30vh each instead of the cramped 12–15vh
                they got with the previous 105vh container. The
                container uses `width: auto` (no maxWidth) so the SVG
                renders at its intrinsic 1200:2800 aspect (width =
                height × 3/7). On narrow viewports the SVG can be
                wider than 100vw at its widest body regions — the
                outer wrapper's `overflow-x-hidden` clips the sides
                cleanly, and the widest iceberg regions are below the
                fold anyway. The above-water surface layer stays
                centered with a narrow waterline waist that leaves
                clear space for the boat on the left. */}
          <div
            className="absolute left-1/2 -translate-x-1/2 z-20"
            style={
              narrowMode
                ? {
                    top: "-56vh",
                    height: "356vh",
                    width: "100vw",
                  }
                : {
                    /* Two constraints on the container top:
                       1. calc(-33vw): aligns surface/shallow boundary
                          with the 100vh waterline on normal aspects.
                       2. calc(-50vh): prevents the tip from rising
                          above ~50vh on ultrawide screens.
                       max() picks the less-negative (= lower tip).
                       When the clamp activates (ultrawide), the
                       surface won't reach 100vh from the SVG alone —
                       but the waterline visual (WaveDivider) is at a
                       fixed 100vh regardless, so the slight gap is
                       only in the iceberg fill, not the scene. */
                    top: "max(calc(-33vw), calc(-50vh))",
                    width: "100%",
                    maxWidth: "4000px",
                  }
            }
          >
            <IcebergSVG
              onLayerClick={handleLayerClick}
              onTermClick={handleTermClick}
              selectedCategories={selectedCategories}
              selectedTags={selectedTags}
              narrowMode={narrowMode}
            />
          </div>

          <div
            style={{
              /* Spacer height = container_bottom_within_underwater
                 = container_top (-50vh) + container_height.
                 With tip pinned at 50vh, the iceberg container bottom
                 sits at -50vh + container_height in underwater coords,
                 and the spacer fills that vertical space so Trenches
                 picks up directly below the iceberg in the flow.
                 Narrow: -50vh + 150vh = 100vh (underwater section
                 becomes 110vh tall with the h-[10vh] buffer).
                 Wide:   -50vh + 233.33vw = intrinsic SVG height minus
                 the abs-top offset. */
              height: narrowMode
                ? "calc(356vh - 56vh)"
                : "calc(233.33vw - 33vw)",
            }}
          />
          <div className="h-[10vh]" />
        </div>

        {/* ─── SOLANA TRENCHES ─── */}
        <div
          className="relative w-full flex flex-col items-center justify-center pt-20 pb-8"
          style={{
            background: "linear-gradient(180deg, #020408 0%, #0D0D1A 100%)",
          }}
        >
          <Bubbles />
          <img
            src={solanaLogo}
            alt="Solana"
            className="h-8 md:h-12 w-auto relative z-10"
          />
          <h2 className="text-3xl md:text-5xl font-bold tracking-[0.2em] mt-3 relative z-10">
            <ShinyText
              text="TRENCHES"
              speed={3}
              color="#14F195"
              shineColor="#ffffff"
              className="text-secondary relative"
            />
          </h2>
          <div
            className="absolute -inset-12 -z-10 rounded-full blur-[20px]"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(20,241,149,0.1) 0%, rgba(153,69,255,0.06) 40%, transparent 70%)",
            }}
          />
          {/* Pearl sits in the same container as TRENCHES so it reads
              as part of the same band. Clicking it toggles the
              expandable AboutSection below. */}
          <Pearl isOpen={aboutOpen} onClick={() => setAboutOpen((v) => !v)} />
        </div>

        {/* Expandable "About solana-glossary" section — mounts only
            when the user clicks the pearl above. AnimatePresence
            drives a smooth height + opacity transition. */}
        <AnimatePresence initial={false}>
          {aboutOpen && (
            <Suspense fallback={null}>
              <AboutSection />
            </Suspense>
          )}
        </AnimatePresence>

        <Footer />
      </div>

      {/* Diver must be OUTSIDE the homeContentBlurred wrapper because
          that wrapper has filter:blur(0px) which creates a containing
          block and breaks position:fixed on descendants. */}
      <Diver />

      <Suspense fallback={null}>
        <AnimatePresence mode="sync">
          {/* LayerView stays mounted while TermView is stacked on top ONLY
            when the user arrived at the term view from a layer view
            (via === "layer"). If the user tapped a term directly from
            home (iceberg, search, random), there's no layer view
            beneath — the term modal renders over the home background. */}
          {(view.type === "layer" ||
            (view.type === "term" && view.via === "layer")) &&
            currentLayer && (
              <LayerView
                key={`layer-${currentLayer.id}`}
                layer={currentLayer}
                selectedCategories={selectedCategories}
                selectedTags={selectedTags}
                defocused={view.type === "term"}
                narrowMode={narrowMode}
                onBack={() => setView({ type: "home" })}
                onTermClick={(termId) =>
                  handleTermClick(currentLayer.id, termId)
                }
                onCategoryClick={handleCategoryClick}
                onClearCategories={() => setSelectedCategories(new Set())}
              />
            )}
          {view.type === "term" && currentTerm && (
            <TermView
              key={`term-${currentTerm.id}`}
              term={currentTerm}
              layerId={view.layerId}
              relatedTerms={relatedTerms}
              /* Back from a term opened from layer → return to the
               layer. Back from a term opened from home → return to
               home directly. */
              onBack={() =>
                view.via === "layer"
                  ? setView({ type: "layer", layerId: view.layerId })
                  : setView({ type: "home" })
              }
              onHome={() => setView({ type: "home" })}
              /* No home button when the term was opened directly from
               home — back already goes home in that case. */
              showHomeButton={view.via === "layer"}
              narrowMode={narrowMode}
              onTermClick={handleTermClick}
            />
          )}
        </AnimatePresence>
      </Suspense>

      <BlobCursor />
    </div>
  );
};

export default Index;
