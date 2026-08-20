/**
 * LayerView behaviour tests.
 *
 * Two things are worth real money here:
 *   1. The progressive reveal — a layer holds up to 414 terms and mounting
 *      them all up front is a long frame. The first paint must be one batch.
 *   2. The local filter — trailing whitespace silently narrowing the result
 *      set was a real bug ("validator " matched 31 where "validator" matched
 *      55). The trim is now in place; these tests keep it there.
 *
 * Nothing here asserts on framer-motion. Card counts, the term-count line and
 * the callbacks are the contract.
 */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LayerView from "@/components/LayerView";
import { LanguageProvider } from "@/i18n/context";
import { getIcebergLayers, type Category } from "@/data/glossaryAdapter";
import { getObservers, resetObservers, triggerIntersection } from "./setup";

const CARD_BATCH = 30;

const layers = getIcebergLayers();
const deep = layers.find((l) => l.id === "deep")!;

interface Options {
  selectedCategories?: Set<Category>;
  selectedTags?: Set<string>;
  defocused?: boolean;
}

/* Awaited: LanguageProvider bumps glossaryVersion from a promise callback on
   mount, and letting that land outside act() prints a warning per test. */
async function setup(options: Options = {}) {
  const onBack = vi.fn();
  const onTermClick = vi.fn();
  const onCategoryClick = vi.fn();
  const onClearCategories = vi.fn();

  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <LanguageProvider>
          <LayerView
            layer={deep}
            selectedCategories={options.selectedCategories ?? new Set()}
            selectedTags={options.selectedTags ?? new Set()}
            defocused={options.defocused}
            onBack={onBack}
            onTermClick={onTermClick}
            onCategoryClick={onCategoryClick}
            onClearCategories={onClearCategories}
          />
        </LanguageProvider>
      </MemoryRouter>,
    );
  });

  return {
    ...view,
    onBack,
    onTermClick,
    onCategoryClick,
    onClearCategories,
    cards: () => view.container.querySelectorAll(".term-card").length,
    filterInput: () =>
      screen.getByPlaceholderText("Filter terms...") as HTMLInputElement,
  };
}

/** Types into the layer's local filter. Not debounced, so this is synchronous. */
function filterBy(input: HTMLInputElement, value: string) {
  fireEvent.change(input, { target: { value } });
}

/** How many of this layer's terms a query matches, computed independently of
 *  the component so the assertions are not just restating the implementation. */
function expectedMatches(query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return deep.terms.length;
  return deep.terms.filter(
    (t) =>
      t.term.toLowerCase().includes(q) ||
      t.definition.toLowerCase().includes(q) ||
      t.aliases?.some((a) => a.toLowerCase().includes(q)),
  ).length;
}

beforeEach(() => {
  localStorage.setItem("lang", "en");
  resetObservers();
});
afterEach(() => localStorage.clear());

describe("LayerView progressive reveal", () => {
  it("renders only the first batch, not all 414 terms", async () => {
    const { cards } = await setup();

    expect(deep.terms.length).toBe(414); // guard: the layer must overflow a batch
    expect(cards()).toBe(CARD_BATCH);
  });

  it("still reports the full term count while showing only a batch", async () => {
    await setup();
    expect(
      screen.getByText(`${deep.terms.length} of ${deep.terms.length} terms`),
    ).toBeInTheDocument();
  });

  it("observes a sentinel so more batches can arrive", async () => {
    await setup();
    const live = getObservers().filter((o) => o.targets.size > 0);
    expect(live.length).toBeGreaterThan(0);
  });

  it("reveals one more batch each time the sentinel comes into view", async () => {
    const { cards } = await setup();
    expect(cards()).toBe(CARD_BATCH);

    act(() => triggerIntersection(true));
    expect(cards()).toBe(CARD_BATCH * 2);

    act(() => triggerIntersection(true));
    expect(cards()).toBe(CARD_BATCH * 3);
  });

  it("never reveals more cards than the layer holds", async () => {
    const { cards, filterInput } = await setup();
    // Narrow to a set smaller than one batch, then push the sentinel hard.
    filterBy(filterInput(), "sealevel");
    const matches = expectedMatches("sealevel");
    expect(matches).toBeLessThan(CARD_BATCH); // guard

    act(() => triggerIntersection(true));
    act(() => triggerIntersection(true));

    expect(cards()).toBe(matches);
  });

  it("restarts the reveal at one batch when the filter changes", async () => {
    const { cards, filterInput } = await setup();

    act(() => triggerIntersection(true));
    act(() => triggerIntersection(true));
    expect(cards()).toBe(CARD_BATCH * 3);

    filterBy(filterInput(), "a");
    expect(expectedMatches("a")).toBeGreaterThan(CARD_BATCH); // guard
    expect(cards()).toBe(CARD_BATCH);
  });

  it("announces the revealed count on a live region once the reveal settles", async () => {
    await setup();
    await waitFor(
      () =>
        expect(screen.getByRole("status")).toHaveTextContent(
          `Showing ${CARD_BATCH} of ${deep.terms.length} terms`,
        ),
      { timeout: 3000 },
    );
  });
});

describe("LayerView local filter", () => {
  it("narrows the rendered cards and the term count together", async () => {
    const { cards, filterInput } = await setup();
    expect(cards()).toBe(CARD_BATCH);

    filterBy(filterInput(), "sealevel");

    const matches = expectedMatches("sealevel");
    expect(matches).toBeGreaterThan(0); // guard
    expect(cards()).toBe(matches);
    expect(
      screen.getByText(`${matches} of ${deep.terms.length} terms`),
    ).toBeInTheDocument();
  });

  it("is case-insensitive", async () => {
    const { filterInput } = await setup();
    const matches = expectedMatches("validator");

    filterBy(filterInput(), "VALIDATOR");
    expect(
      screen.getByText(`${matches} of ${deep.terms.length} terms`),
    ).toBeInTheDocument();
  });

  /* The regression. A mobile keyboard or a paste routinely appends a space;
     an untrimmed query used to cut the result set roughly in half with no
     visible cause. */
  it("ignores a trailing space: 'validator ' matches exactly as many as 'validator'", async () => {
    const { cards, filterInput } = await setup();

    filterBy(filterInput(), "validator");
    const clean = cards();
    const cleanTotal = expectedMatches("validator");

    filterBy(filterInput(), "validator ");
    expect(cards()).toBe(clean);
    expect(
      screen.getByText(`${cleanTotal} of ${deep.terms.length} terms`),
    ).toBeInTheDocument();
  });

  it("ignores a leading space", async () => {
    const { filterInput } = await setup();
    const matches = expectedMatches("validator");

    filterBy(filterInput(), " validator");
    expect(
      screen.getByText(`${matches} of ${deep.terms.length} terms`),
    ).toBeInTheDocument();
  });

  it("treats a whitespace-only query as no filter at all", async () => {
    const { cards, filterInput } = await setup();

    filterBy(filterInput(), "   ");

    expect(cards()).toBe(CARD_BATCH);
    expect(
      screen.getByText(`${deep.terms.length} of ${deep.terms.length} terms`),
    ).toBeInTheDocument();
  });

  it("matches definition text, not just term names", async () => {
    const { filterInput } = await setup();
    const term = deep.terms[0];
    const phrase = term.definition.split(" ").slice(1, 5).join(" ");

    filterBy(filterInput(), phrase);

    const matches = expectedMatches(phrase);
    expect(matches).toBeGreaterThan(0);
    expect(
      screen.getByText(`${matches} of ${deep.terms.length} terms`),
    ).toBeInTheDocument();
  });

  it("matches aliases", async () => {
    const withAlias = deep.terms.find((t) =>
      t.aliases?.some((a) => !t.term.toLowerCase().includes(a.toLowerCase())),
    )!;
    const alias = withAlias.aliases!.find(
      (a) => !withAlias.term.toLowerCase().includes(a.toLowerCase()),
    )!;

    const { filterInput } = await setup();
    filterBy(filterInput(), alias);

    const matches = expectedMatches(alias);
    expect(matches).toBeGreaterThan(0);
    expect(
      screen.getByText(`${matches} of ${deep.terms.length} terms`),
    ).toBeInTheDocument();
  });

  it("renders no cards and a zero count for a query that matches nothing", async () => {
    const { cards, filterInput } = await setup();

    filterBy(filterInput(), "qqzzxx-no-such-term");

    expect(cards()).toBe(0);
    expect(
      screen.getByText(`0 of ${deep.terms.length} terms`),
    ).toBeInTheDocument();
  });

  it("restores the full set when the filter is cleared", async () => {
    const { cards, filterInput } = await setup();

    filterBy(filterInput(), "qqzzxx-no-such-term");
    expect(cards()).toBe(0);

    filterBy(filterInput(), "");
    expect(cards()).toBe(CARD_BATCH);
    expect(
      screen.getByText(`${deep.terms.length} of ${deep.terms.length} terms`),
    ).toBeInTheDocument();
  });
});

describe("LayerView category filter", () => {
  it("shows only terms in the selected category", async () => {
    const category = deep.categories[0];
    const inCategory = deep.terms.filter((t) => t.category === category).length;

    await setup({ selectedCategories: new Set([category]) });

    expect(
      screen.getByText(`${inCategory} of ${deep.terms.length} terms`),
    ).toBeInTheDocument();
  });

  it("combines the category filter with the local text filter", async () => {
    const category = deep.categories[0];
    const { filterInput } = await setup({
      selectedCategories: new Set([category]),
    });

    filterBy(filterInput(), "a");

    const expected = deep.terms.filter(
      (t) =>
        t.category === category &&
        (t.term.toLowerCase().includes("a") ||
          t.definition.toLowerCase().includes("a") ||
          t.aliases?.some((al) => al.toLowerCase().includes("a"))),
    ).length;

    expect(
      screen.getByText(`${expected} of ${deep.terms.length} terms`),
    ).toBeInTheDocument();
  });
});

describe("LayerView callbacks", () => {
  it("calls onBack from the labelled back button", async () => {
    const { onBack } = await setup();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("hands a clicked card off to onTermClick with the term id", async () => {
    const { container, onTermClick } = await setup();

    const first = container.querySelector(".term-card") as HTMLElement;
    fireEvent.click(first);

    // The click flash is held briefly before the modal opens.
    await waitFor(() => expect(onTermClick).toHaveBeenCalledTimes(1));
    expect(deep.terms.map((t) => t.id)).toContain(onTermClick.mock.calls[0][0]);
  });
});

describe("LayerView accessibility", () => {
  it("is announced as a modal dialog named after its layer", async () => {
    await setup();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName("DEEP");
  });

  it("suppresses the live region while a term modal is stacked on top", async () => {
    await setup({ defocused: true });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
