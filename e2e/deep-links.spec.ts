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
