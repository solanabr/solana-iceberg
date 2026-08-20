/**
 * Glossary term translation overlay.
 * Uses the SDK's native `getLocalizedTerms()` to load pre-merged localized
 * term arrays for PT-BR and ES. English uses the default SDK data.
 * Missing translations fall back to English automatically via the SDK.
 *
 * The `@stbr/solana-glossary/i18n` subpath carries ~1.1 MB of PT-BR + ES
 * term data, so it is imported dynamically: English users (the default)
 * never download it.
 */
import type { GlossaryTerm } from "@stbr/solana-glossary";
import type { Lang } from "./context";

type TermIndex = Map<string, GlossaryTerm>;

const caches = new Map<Lang, TermIndex>();
/** In-flight loads, so concurrent calls for the same lang share one import. */
const pending = new Map<Lang, Promise<TermIndex>>();

/** Map app lang codes to SDK locale codes */
const langToLocale: Partial<Record<Lang, string>> = {
  "pt-BR": "pt",
  es: "es",
};

function loadIndex(lang: Lang): Promise<TermIndex> {
  const cached = caches.get(lang);
  if (cached) return Promise.resolve(cached);

  const inFlight = pending.get(lang);
  if (inFlight) return inFlight;

  const locale = langToLocale[lang];
  if (!locale) {
    const empty: TermIndex = new Map();
    caches.set(lang, empty);
    return Promise.resolve(empty);
  }

  const promise = import("@stbr/solana-glossary/i18n")
    .then(({ getLocalizedTerms }) => {
      const index: TermIndex = new Map();
      for (const t of getLocalizedTerms(locale)) index.set(t.id, t);
      caches.set(lang, index);
      return index;
    })
    .finally(() => {
      pending.delete(lang);
    });

  pending.set(lang, promise);
  return promise;
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
 * Preload translations for a given language. Call when the language changes,
 * then re-render *after the returned promise resolves* — only then do the
 * synchronous getTermName/getTermDefinition helpers return localized strings.
 * Safe to call multiple times — results are cached and concurrent calls share
 * one import. Never rejects: on failure the overlay stays empty and callers
 * fall back to English.
 */
export async function preloadGlossary(lang: Lang): Promise<void> {
  if (lang === "en") return;
  try {
    await loadIndex(lang);
  } catch {
    /* overlay unavailable — getTermName/getTermDefinition fall back to English */
  }
}

/** Check if glossary translations are loaded for a given language. */
export function isGlossaryLoaded(lang: Lang): boolean {
  if (lang === "en") return true;
  return caches.has(lang);
}
