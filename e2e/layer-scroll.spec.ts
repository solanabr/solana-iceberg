import { test, expect } from "@playwright/test";
import { cards, layerHeading, layerScroller } from "./helpers";

/**
 * On phones the layer view's header (title + count + category pills +
 * filter box) used to be pinned, so scrolling the card grid left barely
 * half a viewport of cards visible. Narrow mode now puts the header and
 * the grid in ONE scroll container: scrolling the cards pushes the whole
 * header away under the fixed navbar, and the grid gets the screen.
 */

test.use({ viewport: { width: 393, height: 852 } });

test("scrolling the phone layer view moves the header away and fills the screen with cards", async ({
  page,
}) => {
  await page.goto("/l/shallow");
  await expect(page.getByRole("dialog")).toBeVisible();
  const heading = layerHeading(page, "SHALLOW");
  await expect(heading).toBeVisible();
  await expect(cards(page).first()).toBeVisible();

  const visibleCards = () =>
    cards(page).evaluateAll(
      (els) =>
        els.filter((el) => {
          const r = el.getBoundingClientRect();
          return r.top >= 0 && r.bottom <= innerHeight;
        }).length,
    );

  const before = await visibleCards();

  // Scroll the layer's scroll container well past the header.
  await layerScroller(page).evaluate((el) => {
    el.scrollTop = 600;
  });
  await page.waitForTimeout(400);

  // The header scrolled away with the cards…
  const headingTop = await heading.evaluate(
    (el) => el.getBoundingClientRect().bottom,
  );
  expect(headingTop, "layer title should scroll off-screen").toBeLessThan(0);

  // …and the freed space shows more cards at once.
  const after = await visibleCards();
  expect(after).toBeGreaterThan(before);
  expect(after).toBeGreaterThanOrEqual(4);
});
