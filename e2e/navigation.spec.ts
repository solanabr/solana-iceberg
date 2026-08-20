/**
 * The main journey: home -> layer -> term -> Back -> Back.
 *
 * This is the case unit tests cannot reach — it spans the router, the body
 * scroll lock, the stacked-modal `via` state and three components' unmount
 * paths at once. The scroll assertions read the exact offset the app stashed
 * in `body.style.top`, so they pin the restore contract rather than a pixel
 * range that layout drift could invalidate.
 */
import { expect, test } from "@playwright/test";
import {
  cards,
  expectHomeClean,
  expectLayerOpen,
  expectTermOpen,
  lockedScrollY,
  termHeading,
} from "./helpers";

test("home -> layer -> term -> Back -> Back returns to home with nothing stuck", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "ICEBERG" }),
  ).toBeVisible();

  // home -> layer
  await page.locator("#iceberg-layer-deep").click();
  await expectLayerOpen(page, "DEEP");
  await expect.poll(() => new URL(page.url()).pathname).toBe("/l/deep");

  /* The offset the app promises to restore. Captured while the overlay holds
     the body locked; window.scrollY reads 0 in that state, so this is the
     only honest source. */
  const parkedY = await lockedScrollY(page);
  expect(parkedY).toBeGreaterThan(0);

  // layer -> term
  const firstCard = cards(page).first();
  const cardTitle = (await firstCard.innerText()).split("\n")[0];
  await firstCard.click();
  await expect.poll(() => new URL(page.url()).pathname).toMatch(/^\/t\//);
  await expectTermOpen(page, cardTitle);

  // The layer stays mounted beneath a term opened from a layer.
  await expect(page.getByRole("dialog")).toBeVisible();

  // Back -> layer
  await page.goBack();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/l/deep");
  await expectLayerOpen(page, "DEEP");
  await expect(termHeading(page, cardTitle)).toHaveCount(0);

  // Back -> home
  await page.goBack();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/");
  await expectHomeClean(page);

  // ...at the position the app parked the iceberg at, not the top of the page.
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(parkedY);
});

test("a term opened from home has no layer stacked beneath it and Back returns home", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "ICEBERG" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Random term" }).click();
  await expect.poll(() => new URL(page.url()).pathname).toMatch(/^\/t\//);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.goBack();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/");
  await expectHomeClean(page);
});

test("opening a layer parks the iceberg so that layer is centred on return", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "ICEBERG" }),
  ).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));

  await page.locator("#iceberg-layer-abyss").click();
  await expectLayerOpen(page, "ABYSS");
  const parkedY = await lockedScrollY(page);

  await page.goBack();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(parkedY);

  /* The user-visible half of the same contract: the layer they opened is the
     one under their eyes when they get back. */
  const offset = await page.evaluate(() => {
    const el = document.getElementById("iceberg-layer-abyss");
    if (!el) return Number.NaN;
    const rect = el.getBoundingClientRect();
    return Math.abs(rect.top + rect.height / 2 - window.innerHeight / 2);
  });
  expect(offset).toBeLessThan(80);
});

test("Forward after Back reopens the same term", async ({ page }) => {
  await page.goto("/l/deep");
  await expectLayerOpen(page, "DEEP");

  const firstCard = cards(page).first();
  const cardTitle = (await firstCard.innerText()).split("\n")[0];
  await firstCard.click();
  await expectTermOpen(page, cardTitle);
  const termPath = new URL(page.url()).pathname;

  await page.goBack();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/l/deep");

  await page.goForward();
  await expect.poll(() => new URL(page.url()).pathname).toBe(termPath);
  await expectTermOpen(page, cardTitle);
});

test("the layer back button returns to home", async ({ page }) => {
  await page.goto("/l/deep");
  await expectLayerOpen(page, "DEEP");

  await page.getByRole("button", { name: "Back" }).first().click();

  await expect.poll(() => new URL(page.url()).pathname).toBe("/");
  await expectHomeClean(page);
});

test("body scroll is locked while an overlay is open and released on close", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "ICEBERG" }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.body.style.position)).toBe("");

  await page.locator("#iceberg-layer-deep").click();
  await expectLayerOpen(page, "DEEP");
  await expect
    .poll(() => page.evaluate(() => document.body.style.overflow))
    .toBe("hidden");

  await page.goBack();
  await expectHomeClean(page);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
});
