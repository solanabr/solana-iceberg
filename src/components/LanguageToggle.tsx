import { useState, useRef, useEffect } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useTranslation, type Lang } from "@/i18n/context";
import { preloadGlossary } from "@/i18n/glossary";
import { useLocaleNavigate } from "@/hooks/useViewRoute";

/* Inline SVG flags — lightweight, no external assets.
   Each flag is a simplified representation of the country's flag. */

/* US flag — 13 alternating red/white stripes + blue canton with a 5x4 star
   grid (simplified from the real 50-star layout so it stays readable at 20px
   wide but still visually reads as the Stars and Stripes). */
const USFlag = () => {
  const stripeH = 14 / 13;
  const stripes = Array.from({ length: 13 }, (_, i) => (
    <rect
      key={i}
      y={i * stripeH}
      width="20"
      height={stripeH}
      fill={i % 2 === 0 ? "#b22234" : "#ffffff"}
    />
  ));
  const CANTON_W = 8;
  const CANTON_H = 7 * stripeH;
  const starRows = 4;
  const starCols = 5;
  const stars: JSX.Element[] = [];
  for (let r = 0; r < starRows; r++) {
    for (let c = 0; c < starCols; c++) {
      const cx = (CANTON_W / (starCols + 1)) * (c + 1);
      const cy = (CANTON_H / (starRows + 1)) * (r + 1);
      stars.push(
        <circle key={`${r}-${c}`} cx={cx} cy={cy} r="0.35" fill="#ffffff" />,
      );
    }
  }
  return (
    <svg viewBox="0 0 20 14" className="w-5 h-3.5 shrink-0" aria-hidden="true">
      <defs>
        <clipPath id="us-flag-clip">
          <rect width="20" height="14" rx="1" />
        </clipPath>
      </defs>
      <g clipPath="url(#us-flag-clip)">
        {stripes}
        <rect width={CANTON_W} height={CANTON_H} fill="#3c3b6e" />
        {stars}
      </g>
    </svg>
  );
};

const BrazilFlag = () => (
  <svg viewBox="0 0 20 14" className="w-5 h-3.5 shrink-0" aria-hidden="true">
    <rect width="20" height="14" rx="1" fill="#009c3b" />
    <polygon points="10,1.5 18.5,7 10,12.5 1.5,7" fill="#ffdf00" />
    <circle cx="10" cy="7" r="3.5" fill="#002776" />
    <path
      d="M6.8 7.8 Q10 5.5 13.2 7.8"
      fill="none"
      stroke="white"
      strokeWidth="0.6"
    />
  </svg>
);

const SpainFlag = () => (
  <svg viewBox="0 0 20 14" className="w-5 h-3.5 shrink-0" aria-hidden="true">
    <rect width="20" height="14" rx="1" fill="#c60b1e" />
    <rect y="3.5" width="20" height="7" fill="#ffc400" />
    {/* Simplified coat of arms — small shield */}
    <rect x="4" y="5" width="2.5" height="3" rx="0.3" fill="#c60b1e" />
    <rect x="4.3" y="5.3" width="1.9" height="1.2" rx="0.2" fill="#ffc400" />
  </svg>
);

/* Language options — flag-only, no text labels.
   Flag represents the country and is the only visual cue in both
   the trigger button and the dropdown list. `label` is kept for
   accessible title/aria attributes only. */
const LANG_OPTIONS: { id: Lang; flag: React.ReactNode; label: string }[] = [
  { id: "en", flag: <USFlag />, label: "English" },
  { id: "pt-BR", flag: <BrazilFlag />, label: "Português" },
  { id: "es", flag: <SpainFlag />, label: "Español" },
];

const LanguageToggle = () => {
  const { lang, setLang } = useTranslation();
  const localeNavigate = useLocaleNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  /* Close dropdown when clicking outside */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (next: Lang) => {
    setLang(next);
    /* Mirror the choice into the URL so the address bar — and any link the
       visitor copies from it — carries the language. */
    localeNavigate(next);
    preloadGlossary(next);
    setOpen(false);
  };

  /* Find the current language option for the trigger button */
  const current = LANG_OPTIONS.find((o) => o.id === lang) ?? LANG_OPTIONS[0];

  return (
    /* Outer wrapper matches the NavDropdown nav-bar look: glass border +
       soft secondary glow, so the language picker reads as a sibling to
       the Depth/Category/Tags rail instead of a mismatched one-off. */
    <div
      ref={ref}
      className="relative rounded-xl border border-secondary/20 bg-background/60 backdrop-blur-xl"
      style={{ boxShadow: "0 0 15px rgba(20,241,149,0.1)" }}
    >
      {/* Trigger button — matches the NavDropdown DropdownSection trigger:
         same height, same hover color, same chevron rotation. The only
         difference is the flag in place of a text label. */}
      <button
        onClick={() => setOpen(!open)}
        title={current.label}
        aria-label={current.label}
        className="flex items-center gap-1.5 px-3 text-sm font-medium text-foreground/80 hover:text-secondary transition-colors"
        style={{ height: "36px" }}
      >
        {current.flag}
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown panel — matches NavDropdown:
         same rounded-xl border, same backdrop blur, same positioning. */}
      {open && (
        <div
          className="absolute top-full right-0 mt-2 w-44 rounded-xl border border-secondary/20 bg-background/90 backdrop-blur-xl p-2 z-[100]"
          style={{ boxShadow: "0 0 30px rgba(20,241,149,0.1)" }}
        >
          {LANG_OPTIONS.map((option) => {
            const isActive = option.id === lang;
            return (
              <button
                key={option.id}
                onClick={() => handleSelect(option.id)}
                title={option.label}
                aria-label={option.label}
                /* Row matches NavDropdown item style exactly:
                   w-full, text-left, same padding, same hover, same
                   active color. The flag slots into the check position
                   and the label text reads to the right. */
                className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-all flex items-center gap-2 ${
                  isActive
                    ? "text-secondary bg-secondary/10"
                    : "text-foreground/80 hover:text-secondary hover:bg-secondary/10"
                }`}
              >
                {option.flag}
                <span className="flex-1">{option.label}</span>
                {isActive && <Check className="w-3.5 h-3.5 text-secondary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LanguageToggle;
