/**
 * Progressive card reveal in a real browser.
 *
 * The jsdom tests drive the IntersectionObserver by hand; only a browser can
 * prove the observer, its rootMargin, the scroll container and the 260ms
 * re-arm actually cooperate. Waits are on the card count, never on a clock.
 */
import { expect, test } from "@playwright/test";
import { cards, layerScroller } from "./helpers";

const CARD_BATCH = 30;
const DEEP_TOTAL = 414;

/** Parks the scroll container at the bottom until `predicate` holds. */
async function scrollUntil(
  page: import("@playwright/test").Page,
  target: number,
  timeout = 25_000,
) {
  const scroller = layerScroller(page);
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if ((await cards(page).count()) >= target) return;
    await scroller.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
    await page.waitForTimeout(150);
  }
  expect(
    await cards(page).count(),
    `never reached ${target} cards`,
  ).toBeGreaterThanOrEqual(target);
}

test("opening a layer renders a first batch, not all 414 cards", async ({
  page,
}) => {
  await page.goto("/l/deep");
  await expect(page.getByRole("dialog")).toBeVisible();

  await expect(cards(page)).toHaveCount(CARD_BATCH);
  // The header still advertises the full set.
  await expect(
    page.getByText(`${DEEP_TOTAL} of ${DEEP_TOTAL} terms`),
  ).toBeVisible();
});

test("scrolling the layer loads more cards, up to the full 414", async ({
  page,
}) => {
  await page.goto("/l/deep");
  await expect(cards(page)).toHaveCount(CARD_BATCH);

  await scrollUntil(page, CARD_BATCH * 2);
  expect(await cards(page).count()).toBeGreaterThanOrEqual(CARD_BATCH * 2);

  await scrollUntil(page, DEEP_TOTAL);
  await expect(cards(page)).toHaveCount(DEEP_TOTAL);

  // And it stops there — no runaway or duplicated batch.
  await page.waitForTimeout(600);
  await expect(cards(page)).toHaveCount(DEEP_TOTAL);
});

test("the live region reports the revealed count", async ({ page }) => {
  await page.goto("/l/deep");
  await expect(cards(page)).toHaveCount(CARD_BATCH);

  await expect(page.getByRole("status")).toHaveText(
    `Showing ${CARD_BATCH} of ${DEEP_TOTAL} terms`,
  );
});

test("filtering restarts the reveal at one batch and updates the count", async ({
  page,
}) => {
  await page.goto("/l/deep");
  await expect(cards(page)).toHaveCount(CARD_BATCH);
  await scrollUntil(page, CARD_BATCH * 3);

  /* "transaction" narrows the layer but still matches far more than one
     batch, so a component that failed to reset would keep showing the 90 it
     had already scrolled to. */
  await page.getByPlaceholder("Filter terms...").fill("transaction");

  await expect(cards(page)).toHaveCount(CARD_BATCH);

  const countLine = await page
    .locator("p", { hasText: new RegExp(`^\\d+ of ${DEEP_TOTAL} terms$`) })
    .first()
    .innerText();
  const matched = Number(countLine.split(" ")[0]);
  expect(matched).toBeGreaterThan(CARD_BATCH);
  expect(matched).toBeLessThan(DEEP_TOTAL);
});

test("a filter matching nothing renders no cards and a zero count", async ({
  page,
}) => {
  await page.goto("/l/deep");
  await expect(cards(page)).toHaveCount(CARD_BATCH);

  await page.getByPlaceholder("Filter terms...").fill("qqzzxx-no-such-term");

  await expect(cards(page)).toHaveCount(0);
  await expect(page.getByText(`0 of ${DEEP_TOTAL} terms`)).toBeVisible();
});

test("a trailing space in the filter does not change the result count", async ({
  page,
}) => {
  await page.goto("/l/deep");
  await expect(cards(page)).toHaveCount(CARD_BATCH);
  const filter = page.getByPlaceholder("Filter terms...");

  await filter.fill("validator");
  const clean = await page
    .locator("p", { hasText: new RegExp(`^\\d+ of ${DEEP_TOTAL} terms$`) })
    .first()
    .innerText();

  await filter.fill("validator ");
  await expect(
    page
      .locator("p", { hasText: new RegExp(`^\\d+ of ${DEEP_TOTAL} terms$`) })
      .first(),
  ).toHaveText(clean);
});
