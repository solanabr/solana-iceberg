/**
 * Search -> term journey.
 *
 * The unit tests cover the combobox mechanics; this covers the one thing they
 * cannot: that picking a result actually routes the browser to that term.
 */
import { expect, test } from "@playwright/test";
import { expectTermOpen, search } from "./helpers";

test("typing a query and clicking a result lands on that term", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "ICEBERG" }),
  ).toBeVisible();

  await search(page, "sealevel");

  const first = page.getByRole("option").first();
  await expect(first).toContainText("Sealevel");
  await first.click();

  await expect.poll(() => new URL(page.url()).pathname).toBe("/t/sealevel");
  await expectTermOpen(page, "Sealevel");
});

test("selecting a result from search opens the term over home, not over a layer", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "ICEBERG" }),
  ).toBeVisible();

  await search(page, "sealevel");
  await page.getByRole("option").first().click();
  await expectTermOpen(page, "Sealevel");

  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("choosing a result with the keyboard opens the highlighted term", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "ICEBERG" }),
  ).toBeVisible();

  await search(page, "sealevel");
  const input = page.getByRole("combobox").first();

  await input.press("ArrowDown");
  await expect(input).toHaveAttribute("aria-activedescendant", /option-0$/);
  await input.press("Enter");

  await expect.poll(() => new URL(page.url()).pathname).toBe("/t/sealevel");
  await expectTermOpen(page, "Sealevel");
});

test("a query that matches nothing shows the empty state and navigates nowhere", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "ICEBERG" }),
  ).toBeVisible();

  await search(page, "qqzzxx-no-such-term");

  await expect(page.getByRole("status")).toContainText(
    'No terms match "qqzzxx-no-such-term"',
  );
  await expect(page.getByRole("option")).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe("/");
});

test("Escape closes the dropdown without leaving home", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "ICEBERG" }),
  ).toBeVisible();

  await search(page, "sealevel");
  const input = page.getByRole("combobox").first();
  await input.press("Escape");

  await expect(input).toHaveAttribute("aria-expanded", "false");
  expect(new URL(page.url()).pathname).toBe("/");
});

test("searching from inside a layer opens the term stacked over that layer", async ({
  page,
}) => {
  await page.goto("/l/deep");
  await expect(page.getByRole("dialog")).toBeVisible();

  await search(page, "sealevel");
  await page.getByRole("option").first().click();

  await expect.poll(() => new URL(page.url()).pathname).toBe("/t/sealevel");
  await expectTermOpen(page, "Sealevel");
  // via: "layer" — the layer stays mounted underneath.
  await expect(page.getByRole("dialog")).toBeVisible();
});
