/**
 * The `dict[key] ?? en[key] ?? key` fallback chain, tested against a
 * deliberately incomplete pt-BR dictionary.
 *
 * This lives in its own file because `vi.mock` is hoisted per-file: the real
 * dictionaries must stay untouched for the parity assertions in i18n.test.tsx.
 * Together the two files pin both halves of the contract — parity is enforced
 * today, and if it ever breaks the app degrades to English rather than
 * rendering raw key strings at the user.
 */
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/pt-BR", () => ({
  default: {
    "nav.back": "Voltar",
    "layer.termCount": "{matched} de {total} termos",
    // "nav.depth" and everything else deliberately absent
  },
}));

import en from "@/i18n/en";
import { LanguageProvider, useTranslation } from "@/i18n/context";

function Out({
  tkey,
  vars,
}: {
  tkey: string;
  vars?: Record<string, string | number>;
}) {
  const { t } = useTranslation();
  return <span data-testid="out">{t(tkey as keyof typeof en, vars)}</span>;
}

async function renderPt(ui: React.ReactNode) {
  localStorage.setItem("lang", "pt-BR");
  await act(async () => {
    render(<LanguageProvider>{ui}</LanguageProvider>);
  });
}

describe("t() fallback chain", () => {
  it("step 1: uses the active dictionary when the key is present", async () => {
    await renderPt(<Out tkey="nav.back" />);
    expect(screen.getByTestId("out")).toHaveTextContent("Voltar");
  });

  it("step 2: falls back to English when the key is missing from the active dictionary", async () => {
    await renderPt(<Out tkey="nav.depth" />);
    expect(screen.getByTestId("out")).toHaveTextContent(en["nav.depth"]);
  });

  it("step 3: returns the raw key when it is missing from English too", async () => {
    await renderPt(<Out tkey="nav.nonexistent" />);
    expect(screen.getByTestId("out")).toHaveTextContent("nav.nonexistent");
  });

  it("interpolates into an English fallback string, not just a translated one", async () => {
    await renderPt(<Out tkey="search.placeholder" vars={{ count: 7 }} />);
    expect(screen.getByTestId("out")).toHaveTextContent("Search 7 terms...");
  });

  it("interpolates into the translated string when the key is present", async () => {
    await renderPt(
      <Out tkey="layer.termCount" vars={{ matched: 3, total: 9 }} />,
    );
    expect(screen.getByTestId("out")).toHaveTextContent("3 de 9 termos");
  });
});
