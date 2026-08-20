/**
 * SearchBar behaviour tests.
 *
 * Deliberately no assertions about framer-motion: what matters is the
 * combobox contract (what opens, what closes, what Enter selects) and the
 * 50-result cap that stops a one-letter query from mounting a thousand
 * animated rows.
 *
 * The 300ms debounce is driven by controlled timers, not by sleeping: `type()`
 * advances exactly the debounce and returns with the dropdown already
 * settled, so every assertion below is synchronous and cannot race.
 * Only setTimeout/clearTimeout are faked — requestAnimationFrame is left real
 * so framer-motion keeps working.
 */
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SearchBar from "@/components/SearchBar";
import { LanguageProvider } from "@/i18n/context";
import { searchAllTerms } from "@/data/glossaryAdapter";

const MAX_RESULTS = 50;

/* Awaited: LanguageProvider bumps glossaryVersion from a promise callback on
   mount, and letting that land outside act() prints a warning per test. */
async function setup() {
  const onTermClick = vi.fn();
  await act(async () => {
    render(
      /* SearchBar renders LanguageToggle, which mirrors the language into the
         URL — so it needs a router even though nothing here navigates. */
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <LanguageProvider>
          <SearchBar onTermClick={onTermClick} inline />
        </LanguageProvider>
      </MemoryRouter>,
    );
  });
  const input = screen.getByRole("combobox") as HTMLInputElement;
  return { onTermClick, input };
}

/** SearchBar's search debounce, in ms. */
const DEBOUNCE_MS = 300;

/** Flush the debounce timer inside act so React commits the resulting render. */
async function settle() {
  await act(async () => {
    vi.advanceTimersByTime(DEBOUNCE_MS);
  });
}

/** Focus, type, and flush the debounce so the dropdown reflects `value`. */
async function type(input: HTMLInputElement, value: string) {
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value } });
  await settle();
}

const listbox = () => screen.getByRole("listbox");
const options = () => screen.queryAllByRole("option");

beforeEach(() => {
  localStorage.setItem("lang", "en");
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});
afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe("SearchBar dropdown visibility", () => {
  it("stays closed while the input is empty", async () => {
    const { input } = await setup();
    fireEvent.focus(input);
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("stays closed for a whitespace-only query", async () => {
    const { input } = await setup();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "   " } });
    await settle();
    expect(input).toHaveValue("   ");
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("opens with results once the debounce settles", async () => {
    const { input } = await setup();
    await type(input, "sealevel");
    expect(options().length).toBeGreaterThan(0);
    expect(options().some((o) => o.textContent?.includes("Sealevel"))).toBe(
      true,
    );
  });

  it("wires the combobox to the listbox it controls", async () => {
    const { input } = await setup();
    await type(input, "sealevel");

    expect(input).toHaveAttribute("aria-autocomplete", "list");
    expect(input.getAttribute("aria-controls")).toBe(listbox().id);
  });
});

describe("SearchBar empty state", () => {
  it("shows the no-results message with the query echoed back", async () => {
    const { input } = await setup();
    await type(input, "qqzzxx-no-such-term");

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(
      'No terms match "qqzzxx-no-such-term" — try another spelling',
    );
    expect(options()).toHaveLength(0);
  });

  it("does not show the no-results message while results exist", async () => {
    const { input } = await setup();
    await type(input, "sealevel");
    expect(options().length).toBeGreaterThan(0);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("SearchBar result cap", () => {
  it("renders at most 50 options for a query that matches hundreds of terms", async () => {
    const total = searchAllTerms("a").length;
    expect(total).toBeGreaterThan(MAX_RESULTS); // guard: the query must overflow

    const { input } = await setup();
    await type(input, "a");

    expect(options()).toHaveLength(MAX_RESULTS);
  });

  it("tells the user the list is truncated, with both counts", async () => {
    const total = searchAllTerms("a").length;
    const { input } = await setup();
    await type(input, "a");

    expect(options()).toHaveLength(MAX_RESULTS);
    expect(
      screen.getByText(
        `Showing ${MAX_RESULTS} of ${total} matches — keep typing to narrow`,
      ),
    ).toBeInTheDocument();
  });

  it("shows no truncation notice when the whole result set fits", async () => {
    const total = searchAllTerms("sealevel").length;
    expect(total).toBeLessThanOrEqual(MAX_RESULTS); // guard

    const { input } = await setup();
    await type(input, "sealevel");

    expect(options()).toHaveLength(total);
    expect(screen.queryByText(/keep typing to narrow/)).not.toBeInTheDocument();
  });
});

describe("SearchBar keyboard navigation", () => {
  it("highlights no option before the first ArrowDown", async () => {
    const { input } = await setup();
    await type(input, "sealevel");
    expect(options().length).toBeGreaterThan(0);

    expect(input).not.toHaveAttribute("aria-activedescendant");
  });

  it("ArrowDown moves aria-activedescendant to the first option", async () => {
    const { input } = await setup();
    await type(input, "sealevel");
    expect(options().length).toBeGreaterThan(0);

    fireEvent.keyDown(input, { key: "ArrowDown" });

    const first = options()[0];
    expect(input).toHaveAttribute("aria-activedescendant", first.id);
    expect(first).toHaveAttribute("aria-selected", "true");
  });

  it("ArrowDown twice moves to the second option", async () => {
    const { input } = await setup();
    await type(input, "validator");
    expect(options().length).toBeGreaterThan(2);

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });

    expect(input).toHaveAttribute("aria-activedescendant", options()[1].id);
  });

  it("ArrowUp from no highlight wraps to the last option", async () => {
    const { input } = await setup();
    await type(input, "validator");
    expect(options().length).toBeGreaterThan(2);

    fireEvent.keyDown(input, { key: "ArrowUp" });

    const opts = options();
    expect(input).toHaveAttribute(
      "aria-activedescendant",
      opts[opts.length - 1].id,
    );
  });

  it("ArrowDown from the last option wraps back to the first", async () => {
    const { input } = await setup();
    await type(input, "sealevel");
    expect(options().length).toBeGreaterThan(0);

    fireEvent.keyDown(input, { key: "End" });
    fireEvent.keyDown(input, { key: "ArrowDown" });

    expect(input).toHaveAttribute("aria-activedescendant", options()[0].id);
  });

  it("Home jumps to the first option and End to the last", async () => {
    const { input } = await setup();
    await type(input, "validator");
    expect(options().length).toBeGreaterThan(2);

    fireEvent.keyDown(input, { key: "End" });
    const opts = options();
    expect(input).toHaveAttribute(
      "aria-activedescendant",
      opts[opts.length - 1].id,
    );

    fireEvent.keyDown(input, { key: "Home" });
    expect(input).toHaveAttribute("aria-activedescendant", options()[0].id);
  });

  it("marks exactly one option aria-selected at a time", async () => {
    const { input } = await setup();
    await type(input, "validator");
    expect(options().length).toBeGreaterThan(2);

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });

    const selected = options().filter(
      (o) => o.getAttribute("aria-selected") === "true",
    );
    expect(selected).toHaveLength(1);
  });
});

describe("SearchBar selection", () => {
  it("Enter opens the highlighted result with its layer and term id", async () => {
    const { input, onTermClick } = await setup();
    await type(input, "sealevel");
    expect(options().length).toBeGreaterThan(0);

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onTermClick).toHaveBeenCalledTimes(1);
    expect(onTermClick).toHaveBeenCalledWith("deep", "sealevel");
  });

  it("Enter with nothing highlighted does nothing", async () => {
    const { input, onTermClick } = await setup();
    await type(input, "sealevel");
    expect(options().length).toBeGreaterThan(0);

    fireEvent.keyDown(input, { key: "Enter" });

    expect(onTermClick).not.toHaveBeenCalled();
  });

  it("clicking a result opens it", async () => {
    const { input, onTermClick } = await setup();
    await type(input, "sealevel");
    expect(options().length).toBeGreaterThan(0);

    // mousedown, not click: the component fires on mousedown so it beats the
    // input's 200ms blur timer.
    fireEvent.mouseDown(options()[0]);

    expect(onTermClick).toHaveBeenCalledWith("deep", "sealevel");
  });

  it("clears the query after a selection so the dropdown does not linger", async () => {
    const { input } = await setup();
    await type(input, "sealevel");
    expect(options().length).toBeGreaterThan(0);

    fireEvent.mouseDown(options()[0]);

    await settle();
    expect(input).toHaveValue("");
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("labels an alias-only match with the alias that matched", async () => {
    const { input } = await setup();
    await type(input, "SVM Runtime");
    expect(options().length).toBeGreaterThan(0);

    const option = options()[0];
    expect(within(option).getByText("(SVM Runtime)")).toBeInTheDocument();
  });
});

describe("SearchBar Escape", () => {
  it("closes the dropdown without clearing the query", async () => {
    const { input } = await setup();
    await type(input, "sealevel");
    expect(options().length).toBeGreaterThan(0);

    fireEvent.keyDown(input, { key: "Escape" });

    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(input).toHaveValue("sealevel");
  });

  it("drops the keyboard highlight when it closes", async () => {
    const { input } = await setup();
    await type(input, "sealevel");
    expect(options().length).toBeGreaterThan(0);

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(input).not.toHaveAttribute("aria-activedescendant");
  });

  it("reopens on the next keystroke", async () => {
    const { input } = await setup();
    await type(input, "sealevel");
    expect(options().length).toBeGreaterThan(0);

    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveAttribute("aria-expanded", "false");

    fireEvent.change(input, { target: { value: "sealeve" } });
    await settle();
    expect(input).toHaveAttribute("aria-expanded", "true");
  });

  it("reopens when the user arrows after dismissing", async () => {
    const { input } = await setup();
    await type(input, "sealevel");
    expect(options().length).toBeGreaterThan(0);

    fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.keyDown(input, { key: "ArrowDown" });

    expect(input).toHaveAttribute("aria-expanded", "true");
  });

  it("is inert when the dropdown is already closed", async () => {
    const { input, onTermClick } = await setup();
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "Escape" });

    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(onTermClick).not.toHaveBeenCalled();
  });
});

describe("SearchBar random button", () => {
  it("opens a real term with the layer id that matches its depth", async () => {
    const { onTermClick } = await setup();

    fireEvent.click(screen.getByRole("button", { name: "Random term" }));

    expect(onTermClick).toHaveBeenCalledTimes(1);
    const [layerId, termId] = onTermClick.mock.calls[0];
    expect(["surface", "shallow", "deep", "abyss", "bottom"]).toContain(
      layerId,
    );
    expect(typeof termId).toBe("string");
    expect(termId.length).toBeGreaterThan(0);
  });
});
