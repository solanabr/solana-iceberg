/**
 * Cold deep-links.
 *
 * Every one of these is a URL someone can paste into Slack. They have to open
 * on the right thing, in the right language, from a completely cold load with
 * no prior client state — which is exactly what a unit test on useViewRoute
 * cannot prove.
 */
import { expect, test } from "@playwright/test";
import { cards, expectLayerOpen, expectTermOpen, termHeading } from "./helpers";

test.describe("term deep-links", () => {
  test("/t/proof-of-history opens with the term already selected", async ({
    page,
  }) => {
    await page.goto("/t/proof-of-history");

    await expectTermOpen(page, "Proof of History (PoH)");
    expect(new URL(page.url()).pathname).toBe("/t/proof-of-history");
  });

  test("a cold term deep-link opens over home, with no layer stacked underneath", async ({
    page,
  }) => {
    await page.goto("/t/proof-of-history");

    await expectTermOpen(page, "Proof of History (PoH)");
    // `via` defaults to "home" with no history state, so no layer view mounts.
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(cards(page)).toHaveCount(0);
  });

  test("/t/<alias> resolves to the term and rewrites the URL to the canonical id", async ({
    page,
  }) => {
    await page.goto("/t/PoH");

    await expectTermOpen(page, "Proof of History (PoH)");
    await expect
      .poll(() => new URL(page.url()).pathname)
      .toBe("/t/proof-of-history");
  });
});

test.describe("layer deep-links", () => {
  test("/l/deep opens the Deep layer", async ({ page }) => {
    await page.goto("/l/deep");

    await expectLayerOpen(page, "DEEP");
    expect(new URL(page.url()).pathname).toBe("/l/deep");
  });

  test("every layer id opens its own layer", async ({ page }) => {
    const layers = [
      ["surface", "SURFACE"],
      ["shallow", "SHALLOW"],
      ["deep", "DEEP"],
      ["abyss", "ABYSS"],
      ["bottom", "BOTTOM"],
    ] as const;

    for (const [id, title] of layers) {
      await page.goto(`/l/${id}`);
      await expectLayerOpen(page, title);
    }
  });
});

test.describe("locale deep-links", () => {
  test("/pt/t/slot opens in Portuguese with <html lang='pt-BR'>", async ({
    page,
  }) => {
    await page.goto("/pt/t/slot");

    await expectTermOpen(page, "Slot");
    await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  });

  test("/pt/t/:id renders the Portuguese term name, not the English one", async ({
    page,
  }) => {
    await page.goto("/pt/t/proof-of-history");

    // Proves the async glossary overlay landed AND triggered a re-render.
    await expectTermOpen(page, "Prova de História (PoH)");
    await expect(termHeading(page, "Proof of History (PoH)")).toHaveCount(0);
  });

  test("/es/l/deep opens the layer with <html lang='es'>", async ({ page }) => {
    await page.goto("/es/l/deep");

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
  });

  test("an unprefixed URL declares English", async ({ page }) => {
    await page.goto("/t/slot");

    await expectTermOpen(page, "Slot");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });
});

test.describe("bad links", () => {
  test("an unknown term id lands on home instead of a dead end", async ({
    page,
  }) => {
    await page.goto("/t/definitely-not-a-real-term");

    await expect.poll(() => new URL(page.url()).pathname).toBe("/");
    await expect(
      page.getByRole("heading", { level: 1, name: "ICEBERG" }),
    ).toBeVisible();
    await expect(page.locator("body")).not.toContainText("404");
  });

  test("an unknown term id under a locale keeps the visitor in that locale", async ({
    page,
  }) => {
    await page.goto("/pt/t/definitely-not-a-real-term");

    await expect.poll(() => new URL(page.url()).pathname).toBe("/pt");
    await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  });

  test("an unknown layer id lands on home", async ({ page }) => {
    await page.goto("/l/mariana-trench");

    await expect.poll(() => new URL(page.url()).pathname).toBe("/");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("an unknown locale prefix 404s rather than being parsed as a locale", async ({
    page,
  }) => {
    await page.goto("/fr/t/slot");

    await expect(
      page.getByRole("heading", { level: 1, name: "404" }),
    ).toBeVisible();
    await expect(page.locator("body")).toContainText(
      "This part of the iceberg doesn't exist.",
    );
  });

  test("the 404 page links back to the surface", async ({ page }) => {
    await page.goto("/fr/t/slot");

    await page.getByRole("link", { name: "Back to the surface" }).click();

    await expect.poll(() => new URL(page.url()).pathname).toBe("/");
    await expect(
      page.getByRole("heading", { level: 1, name: "ICEBERG" }),
    ).toBeVisible();
  });
});

/**
 * Definition text on a cold deep-link — the no-flash invariant.
 *
 * Definitions load lazily (74% of the glossary; the home screen shows none of
 * them) and the payload is paired with each view's own lazy import so neither
 * view can resolve before the text exists.
 *
 * The assertion is deliberately "no frame ever shows a card with an empty
 * definition", NOT "the definition eventually appears". definitionStore also
 * prefetches on first input, so a presence check passes even with the binding
 * severed — I verified that, and it is why the weaker assertion is useless
 * here. Ordering is the property worth guarding.
 *
 * Network throttling is load-bearing: unthrottled, the payload arrives fast
 * enough that even a broken binding shows no empty frame.
 *
 * When the binding was deliberately severed, this suite caught it. Without it,
 * a severed binding renders every card with permanently empty definition text,
 * throws no error, and leaves all 198 unit and 49 other e2e tests green.
 */
test.describe("definition text is present on cold deep-links", () => {
  for (const [path, term] of [
    ["/t/proof-of-history", "Proof of History (PoH)"],
    ["/pt/t/proof-of-history", "Proof of History (PoH)"],
  ] as const) {
    test(`${path} never paints a card with an empty definition`, async ({
      page,
    }) => {
      /* Delay ONLY the definitions chunk. Throttling the whole page cannot
         work against an unbundled dev server, and would not isolate ordering
         anyway. With the binding intact the view cannot resolve until this
         resolves, so no frame can show a card without text; severed, the view
         resolves immediately and the empty frames appear. */
      await page.route("**/glossaryDefinitions*", async (route) => {
        await new Promise((r) => setTimeout(r, 2500));
        await route.continue();
      });

      await page.goto(path, { waitUntil: "commit" });

      const withCard: number[] = [];
      for (let i = 0; i < 100; i++) {
        const n = await page
          .evaluate(() => {
            /* Scoped to #root deliberately. /api/meta paints the same
               heading and definition into #ssr-shell, so querying the whole
               document would let the server-rendered copy satisfy this
               assertion and the React render could be empty without failing.
               Identify the card structurally rather than by text: on /pt the
               heading is the translated term name, and the home hero is the
               only other h1 in #root — it always reads ICEBERG. */
            const root = document.getElementById("root");
            if (!root) return -1;
            const card = [...root.querySelectorAll("h1")].some(
              (h) => !(h.textContent ?? "").includes("ICEBERG"),
            );
            if (!card) return -1;
            return Math.max(
              0,
              ...[...root.querySelectorAll("p")].map(
                (el) => (el.textContent ?? "").trim().length,
              ),
            );
          })
          .catch(() => -1);
        if (n >= 0) withCard.push(n);
        await page.waitForTimeout(60);
      }

      const empty = withCard.filter((n) => n < 50);
      expect(withCard.length, `${term}: card never appeared`).toBeGreaterThan(0);
      expect(
        empty.length,
        `${empty.length} of ${withCard.length} frames showed the card with an empty definition`,
      ).toBe(0);
    });
  }

  test("a layer filter matches definition text, not just names", async ({
    page,
  }) => {
    /* LayerView filters on `term.definition` inside a useMemo keyed on the
       term objects. If definitions arrive after the view mounts, that memo
       never re-runs and the filter silently returns only name matches. */
    await page.goto("/l/deep");
    await expectLayerOpen(page, "DEEP");

    const filter = page.getByPlaceholder(/filter/i);
    await filter.fill("cryptograph");

    await expect
      .poll(() => cards(page).count(), { timeout: 10_000 })
      .toBeGreaterThan(3);
  });
});
