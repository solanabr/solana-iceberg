/**
 * i18n tests.
 *
 * Two things here have already broken once and are cheap to guard:
 *   1. Dictionary drift — a key added to en.ts and forgotten in pt-BR/es.
 *   2. The async glossary overlay — `loadIndex` resolves a dynamic import and
 *      the provider bumps `glossaryVersion` in the `.then()`. Bump too early
 *      (or drop the bump) and every pt/es page silently renders in English
 *      with no error anywhere.
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/i18n/en";
import ptBR from "@/i18n/pt-BR";
import es from "@/i18n/es";
import { LanguageProvider, useTranslation } from "@/i18n/context";
import {
  getTermDefinition,
  getTermName,
  isGlossaryLoaded,
  preloadGlossary,
} from "@/i18n/glossary";

const dictionaries: Record<string, Record<string, string>> = {
  "pt-BR": ptBR,
  es,
};

/** `{placeholder}` tokens used in a string, sorted. */
function placeholders(value: string): string[] {
  return [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

describe("dictionary parity", () => {
  for (const [name, dict] of Object.entries(dictionaries)) {
    it(`${name} defines every key that en defines`, () => {
      const missing = Object.keys(en).filter((k) => !(k in dict));
      expect(missing).toEqual([]);
    });

    it(`${name} defines no key that en does not`, () => {
      const extra = Object.keys(dict).filter((k) => !(k in en));
      expect(extra).toEqual([]);
    });

    it(`${name} has no blank translations`, () => {
      const blank = Object.entries(dict)
        .filter(([, v]) => !v.trim())
        .map(([k]) => k);
      expect(blank).toEqual([]);
    });

    /* A dropped {count} or {query} does not throw — it just renders a string
       with a hole in it, or worse a literal "{count}". Only a test catches it. */
    it(`${name} keeps the same {placeholder} tokens as en`, () => {
      const mismatched = Object.entries(en)
        .filter(
          ([k, v]) =>
            k in dict &&
            placeholders(dict[k]).join(",") !== placeholders(v).join(","),
        )
        .map(([k]) => k);
      expect(mismatched).toEqual([]);
    });
  }

  it("all three dictionaries have identical key counts", () => {
    expect(Object.keys(ptBR)).toHaveLength(Object.keys(en).length);
    expect(Object.keys(es)).toHaveLength(Object.keys(en).length);
  });
});

/** Renders `t(key, vars)` so the real provider chain is exercised. */
function Translated({
  tkey,
  vars,
}: {
  tkey: string;
  vars?: Record<string, string | number>;
}) {
  const { t } = useTranslation();
  return <span data-testid="out">{t(tkey as keyof typeof en, vars)}</span>;
}

/* Awaited inside `act` because LanguageProvider bumps glossaryVersion from a
   promise callback on mount. Letting that land after the test body ends is
   what produces "not wrapped in act(...)" noise on every single case. */
async function renderWithLang(lang: string, ui: React.ReactNode) {
  localStorage.setItem("lang", lang);
  await act(async () => {
    render(<LanguageProvider>{ui}</LanguageProvider>);
  });
}

describe("t()", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("returns the active language's string", async () => {
    await renderWithLang("pt-BR", <Translated tkey="nav.back" />);
    expect(screen.getByTestId("out")).toHaveTextContent(ptBR["nav.back"]);
  });

  it("returns the English string when the active language is en", async () => {
    await renderWithLang("en", <Translated tkey="nav.back" />);
    expect(screen.getByTestId("out")).toHaveTextContent(en["nav.back"]);
  });

  it("returns the key itself for a key no dictionary defines", async () => {
    await renderWithLang("en", <Translated tkey="totally.made.up.key" />);
    expect(screen.getByTestId("out")).toHaveTextContent("totally.made.up.key");
  });

  it("interpolates a {placeholder}", async () => {
    await renderWithLang(
      "en",
      <Translated tkey="search.placeholder" vars={{ count: 1059 }} />,
    );
    expect(screen.getByTestId("out")).toHaveTextContent("Search 1059 terms...");
  });

  it("interpolates multiple placeholders in one string", async () => {
    await renderWithLang(
      "en",
      <Translated tkey="layer.termCount" vars={{ matched: 30, total: 414 }} />,
    );
    expect(screen.getByTestId("out")).toHaveTextContent("30 of 414 terms");
  });

  it("coerces numeric values to strings", async () => {
    await renderWithLang(
      "en",
      <Translated tkey="footer.copyright" vars={{ year: 2026 }} />,
    );
    expect(screen.getByTestId("out")).toHaveTextContent("© 2026");
  });

  it("leaves an un-supplied placeholder untouched rather than printing 'undefined'", async () => {
    await renderWithLang("en", <Translated tkey="search.placeholder" />);
    expect(screen.getByTestId("out")).toHaveTextContent(
      "Search {count} terms...",
    );
  });

  it("ignores vars that do not appear in the string", async () => {
    await renderWithLang(
      "en",
      <Translated tkey="nav.back" vars={{ nope: 1 }} />,
    );
    expect(screen.getByTestId("out")).toHaveTextContent(en["nav.back"]);
  });

  it("interpolates inside translated (non-English) strings too", async () => {
    await renderWithLang(
      "pt-BR",
      <Translated tkey="layer.termCount" vars={{ matched: 5, total: 9 }} />,
    );
    const out = screen.getByTestId("out").textContent ?? "";
    expect(out).toContain("5");
    expect(out).toContain("9");
    expect(out).not.toContain("{");
  });
});

describe("useTranslation", () => {
  it("throws a named error when used outside LanguageProvider", () => {
    function Orphan() {
      useTranslation();
      return null;
    }
    // React logs the caught render error; silence it so the suite output only
    // shows genuine failures.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => render(<Orphan />)).toThrow(
        /must be used within LanguageProvider/,
      );
    } finally {
      spy.mockRestore();
    }
  });
});

describe("LanguageProvider", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("reads the initial language from localStorage", async () => {
    await renderWithLang("es", <Translated tkey="nav.back" />);
    expect(screen.getByTestId("out")).toHaveTextContent(es["nav.back"]);
  });

  it("falls back to English when localStorage holds an unsupported code", async () => {
    await renderWithLang("klingon", <Translated tkey="nav.back" />);
    expect(screen.getByTestId("out")).toHaveTextContent(en["nav.back"]);
  });

  it("sets document.documentElement.lang to a valid BCP-47 tag", async () => {
    await renderWithLang("pt-BR", <Translated tkey="nav.back" />);
    await waitFor(() => expect(document.documentElement.lang).toBe("pt-BR"));
  });
});

describe("glossary overlay", () => {
  it("returns null for English, which uses the SDK data directly", () => {
    expect(getTermName("en", "proof-of-history")).toBeNull();
    expect(getTermDefinition("en", "proof-of-history")).toBeNull();
    expect(isGlossaryLoaded("en")).toBe(true);
  });

  it("populates the pt-BR index once preloadGlossary resolves", async () => {
    await preloadGlossary("pt-BR");

    expect(isGlossaryLoaded("pt-BR")).toBe(true);
    expect(getTermName("pt-BR", "proof-of-history")).toBe(
      "Prova de História (PoH)",
    );
    expect(getTermDefinition("pt-BR", "proof-of-history")).toMatch(/relógio/);
  });

  it("populates the es index independently of pt-BR", async () => {
    await preloadGlossary("es");
    expect(getTermName("es", "proof-of-history")).toBe(
      "Prueba de Historia (PoH)",
    );
  });

  it("returns null for a term id that does not exist in the overlay", async () => {
    await preloadGlossary("pt-BR");
    expect(getTermName("pt-BR", "not-a-real-term-xyz")).toBeNull();
  });

  it("shares a single import across concurrent calls and is safe to call repeatedly", async () => {
    await Promise.all([
      preloadGlossary("es"),
      preloadGlossary("es"),
      preloadGlossary("es"),
    ]);
    expect(getTermName("es", "validator")).toBe("Validador");
  });

  /* The regression this file exists for: the version counter must bump only
     AFTER the dynamic import lands, and consumers must re-render off it. If
     the bump moves out of the `.then()` this component keeps rendering the
     English name forever. */
  it("re-renders consumers with localized names after the async overlay lands", async () => {
    function TermName() {
      const { lang, glossaryVersion } = useTranslation();
      // glossaryVersion is the subscription — reading it is the whole point.
      void glossaryVersion;
      return (
        <span data-testid="term">
          {getTermName(lang, "proof-of-history") ?? "Proof of History (PoH)"}
        </span>
      );
    }

    localStorage.setItem("lang", "pt-BR");
    render(
      <LanguageProvider>
        <TermName />
      </LanguageProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("term")).toHaveTextContent(
        "Prova de História (PoH)",
      ),
    );
    localStorage.clear();
  });
});
