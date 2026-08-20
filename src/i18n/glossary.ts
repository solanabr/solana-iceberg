/**
 * Glossary term translation overlay.
 *
 * Loads the SDK's raw per-locale data files — `@stbr/solana-glossary/data/i18n/
 * {pt,es}.json`, each a plain `{ [termId]: { term, definition } }` map — rather
 * than the `/i18n` JS entry point.
 *
 * That entry point re-exports `getLocalizedTerms()`, which merges the locale
 * data over the SDK's English base and therefore drags the entire English term
 * array in with it. While the app also imported the bare specifier the two
 * shared a chunk and it cost nothing; now that the adapter no longer does,
 * importing it would hand every PT and ES visitor a second, redundant copy of
 * the English definitions (measured: the i18n chunk grows 346.7 -> 524.5 kB
 * gzip). Reading the data files keeps each locale to its own translations, and
 * splits PT from ES so a Portuguese visitor no longer downloads Spanish too.
 *
 * Missing translations simply have no entry here, and callers fall back to the
 * English text on the term itself.
 */
import type { Lang } from "./context";

interface LocaleEntry {
  term: string;
  definition: string;
}
type LocaleIndex = Record<string, LocaleEntry>;

const caches = new Map<Lang, LocaleIndex>();
/** In-flight loads, so concurrent calls for the same lang share one import. */
const pending = new Map<Lang, Promise<LocaleIndex>>();

/* Static specifiers, not a template string: the bundler can only split what it
   can see, and these are what produce one lazy chunk per locale. */
const loaders: Partial<Record<Lang, () => Promise<{ default: LocaleIndex }>>> =
  {
    "pt-BR": () => import("@stbr/solana-glossary/data/i18n/pt.json"),
    es: () => import("@stbr/solana-glossary/data/i18n/es.json"),
  };

const EMPTY: LocaleIndex = {};

function loadIndex(lang: Lang): Promise<LocaleIndex> {
  const cached = caches.get(lang);
  if (cached) return Promise.resolve(cached);

  const inFlight = pending.get(lang);
  if (inFlight) return inFlight;

  const load = loaders[lang];
  if (!load) {
    caches.set(lang, EMPTY);
    return Promise.resolve(EMPTY);
  }

  const promise = load()
    .then((mod) => {
      const index = mod.default;
      caches.set(lang, index);
      return index;
    })
    .finally(() => {
      pending.delete(lang);
    });

  pending.set(lang, promise);
  return promise;
}

function getIndex(lang: Lang): LocaleIndex | undefined {
  return caches.get(lang);
}

/**
 * Get the translated term name for a given termId.
 * Returns null when no translation is loaded or the term is missing.
 */
export function getTermName(lang: Lang, termId: string): string | null {
  if (lang === "en") return null;
  return getIndex(lang)?.[termId]?.term ?? null;
}

/**
 * Get the translated definition for a given termId.
 * Returns null when no translation is loaded or the term is missing.
 */
export function getTermDefinition(lang: Lang, termId: string): string | null {
  if (lang === "en") return null;
  return getIndex(lang)?.[termId]?.definition ?? null;
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
