/**
 * Lightweight i18n system — React Context + hook.
 * No external dependencies. Supports EN, PT-BR, and ES with localStorage
 * persistence. Falls back to English for any missing key.
 */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from "react";
import en, { type TranslationKey } from "./en";
import ptBR from "./pt-BR";
import es from "./es";
import { preloadGlossary } from "./glossary";

/** Supported language codes. Add new languages here and in dictionaries below. */
export type Lang = "en" | "pt-BR" | "es";

/**
 * All UI string dictionaries keyed by Lang.
 * English is the fallback — if a key is missing in pt-BR or es,
 * the `t()` function returns the English value (see below).
 */
const dictionaries: Record<Lang, Record<string, string>> = {
  en,
  "pt-BR": ptBR,
  es,
};

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Translate a key. Supports {placeholder} interpolation.
   *  Falls back to English if the key is missing in the active language. */
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  /** Bumps when glossary translations finish loading — consumers that read
   *  from `getTermName` / `getTermDefinition` should depend on this so they
   *  re-render once the async overlay resolves. */
  glossaryVersion: number;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

/** Supported lang codes for localStorage validation */
const SUPPORTED_LANGS: Lang[] = ["en", "pt-BR", "es"];

function getInitialLang(): Lang {
  try {
    const stored = localStorage.getItem("lang");
    if (stored && SUPPORTED_LANGS.includes(stored as Lang))
      return stored as Lang;
  } catch {
    /* SSR or blocked localStorage — fall through */
  }
  return "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getInitialLang);
  const [glossaryVersion, setGlossaryVersion] = useState(0);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem("lang", next);
    } catch {
      /* blocked localStorage */
    }
  }, []);

  // Preload the glossary overlay whenever the language changes (no-op for en).
  // getLocalizedTerms is synchronous, so the cache is populated immediately
  // and the version bump causes consumers to re-render with localized names.
  useEffect(() => {
    preloadGlossary(lang);
    setGlossaryVersion((v) => v + 1);
  }, [lang]);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => {
      const dict = dictionaries[lang];
      let text = dict[key] ?? en[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          text = text.replace(`{${k}}`, String(v));
        }
      }
      return text;
    },
    [lang],
  );

  const value = useMemo(
    () => ({ lang, setLang, t, glossaryVersion }),
    [lang, setLang, t, glossaryVersion],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

/** Hook to access translations. Must be used inside LanguageProvider. */
export function useTranslation() {
  const ctx = useContext(LanguageContext);
  if (!ctx)
    throw new Error("useTranslation must be used within LanguageProvider");
  return ctx;
}
