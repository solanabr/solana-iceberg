/**
 * No console errors across the whole journey.
 *
 * Worth asserting on its own: React key collisions, effect cleanup bugs and
 * failed dynamic imports all show up here first and nowhere else — the page
 * keeps rendering and every other assertion still passes.
 *
 * Only `console.error` and uncaught page errors count. Warnings are excluded
 * deliberately: React Router v6 prints two v7 upgrade notices on every load,
 * and failing on those would say nothing about this app's code.
 */
import { expect, test } from "@playwright/test";
import {
  cards,
  collectConsoleErrors,
  expectHomeClean,
  expectLayerOpen,
  expectTermOpen,
  search,
} from "./helpers";

test("the full journey produces no console errors", async ({ page }) => {
  const errors = collectConsoleErrors(page);

  // home
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "ICEBERG" }),
  ).toBeVisible();

  // home -> layer
  await page.locator("#iceberg-layer-deep").click();
  await expectLayerOpen(page, "DEEP");

  // filter inside the layer
  await page.getByPlaceholder("Filter terms...").fill("validator");
  await expect(cards(page).first()).toBeVisible();
  await page.getByPlaceholder("Filter terms...").fill("");
  await expect(cards(page)).toHaveCount(30);

  // layer -> term
  const firstCard = cards(page).first();
  const cardTitle = (await firstCard.innerText()).split("\n")[0];
  await firstCard.click();
  await expectTermOpen(page, cardTitle);

  // back out to home
  await page.goBack();
  await expectLayerOpen(page, "DEEP");
  await page.goBack();
  await expectHomeClean(page);

  // search -> term
  await search(page, "sealevel");
  await page.getByRole("option").first().click();
  await expectTermOpen(page, "Sealevel");

  expect(
    errors,
    `console errors during the journey:\n${errors.join("\n")}`,
  ).toEqual([]);
});

test("a cold deep-link in each locale produces no console errors", async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);

  await page.goto("/t/proof-of-history");
  await expectTermOpen(page, "Proof of History (PoH)");

  await page.goto("/pt/t/proof-of-history");
  await expectTermOpen(page, "Prova de História (PoH)");

  await page.goto("/es/t/proof-of-history");
  await expectTermOpen(page, "Prueba de Historia (PoH)");

  // "BOTTOM" is "FONDO" in Spanish — the layer title is translated too.
  await page.goto("/es/l/bottom");
  await expectLayerOpen(page, "FONDO");

  expect(
    errors,
    `console errors during locale deep-links:\n${errors.join("\n")}`,
  ).toEqual([]);
});

test("the 404 page and the unknown-id redirect produce no console errors", async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);

  await page.goto("/fr/t/slot");
  await expect(
    page.getByRole("heading", { level: 1, name: "404" }),
  ).toBeVisible();

  await page.goto("/t/definitely-not-a-real-term");
  await expect.poll(() => new URL(page.url()).pathname).toBe("/");

  await page.goto("/l/mariana-trench");
  await expect.poll(() => new URL(page.url()).pathname).toBe("/");

  expect(
    errors,
    `console errors on error paths:\n${errors.join("\n")}`,
  ).toEqual([]);
});

test("revealing every card in the deepest layer produces no console errors", async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);

  await page.goto("/l/deep");
  await expect(cards(page)).toHaveCount(30);

  const scroller = page.locator("div.overflow-y-auto").first();
  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline && (await cards(page).count()) < 414) {
    await scroller.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
    await page.waitForTimeout(150);
  }
  await expect(cards(page)).toHaveCount(414);

  expect(
    errors,
    `console errors while revealing 414 cards:\n${errors.join("\n")}`,
  ).toEqual([]);
});
