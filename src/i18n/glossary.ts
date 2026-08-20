/**
 * Glossary term translation overlay.
 * Uses the SDK's native `getLocalizedTerms()` to load pre-merged localized
 * term arrays for PT-BR and ES. English uses the default SDK data.
 * Missing translations fall back to English automatically via the SDK.
 */
import { getLocalizedTerms } from "@stbr/solana-glossary/i18n";
import type { GlossaryTerm } from "@stbr/solana-glossary";
import type { Lang } from "./context";

type TermIndex = Map<string, GlossaryTerm>;

const caches = new Map<Lang, TermIndex>();

/** Map app lang codes to SDK locale codes */
const langToLocale: Partial<Record<Lang, string>> = {
  "pt-BR": "pt",
  es: "es",
};

function loadIndex(lang: Lang): TermIndex {
  const cached = caches.get(lang);
  if (cached) return cached;

  const locale = langToLocale[lang];
  if (!locale) {
    const empty: TermIndex = new Map();
    caches.set(lang, empty);
    return empty;
  }

  // getLocalizedTerms is a synchronous SDK helper that returns
  // a pre-merged GlossaryTerm[] for the requested locale.
  const terms = getLocalizedTerms(locale);
  const index: TermIndex = new Map();
  for (const t of terms) index.set(t.id, t);
  caches.set(lang, index);
  return index;
}

function getIndex(lang: Lang): TermIndex | undefined {
  return caches.get(lang);
}

/**
 * Get the translated term name for a given termId.
 * Returns null when no translation is loaded or the term is missing.
 */
export function getTermName(lang: Lang, termId: string): string | null {
  if (lang === "en") return null;
  return getIndex(lang)?.get(termId)?.term ?? null;
}

/**
 * Get the translated definition for a given termId.
 * Returns null when no translation is loaded or the term is missing.
 */
export function getTermDefinition(lang: Lang, termId: string): string | null {
  if (lang === "en") return null;
  return getIndex(lang)?.get(termId)?.definition ?? null;
}

/**
 * Preload translations for a given language. Call when the language changes
 * so consumers can read from the synchronous getTermName/getTermDefinition
 * helpers on the next render. Safe to call multiple times — results are cached.
 */
export function preloadGlossary(lang: Lang): void {
  if (lang === "en") return;
  loadIndex(lang);
}

/** Check if glossary translations are loaded for a given language. */
export function isGlossaryLoaded(lang: Lang): boolean {
  if (lang === "en") return true;
  return caches.has(lang);
}
