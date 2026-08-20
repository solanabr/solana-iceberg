import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Shared e2e helpers.
 *
 * Everything here waits on a condition rather than a duration. The app has a
 * 300ms search debounce, a 260ms card-batch pace and a per-character title
 * reveal, so any fixed sleep would be either flaky or slow — usually both.
 */

/**
 * The term modal's title. Scrambles for ~half a second before it settles, so
 * always assert on it with `expect(...)`, never read it once.
 *
 * Matched by visible text rather than by accessible name on purpose: the
 * DecryptedText component wraps the entire title in `aria-hidden="true"` with
 * no screen-reader alternative, so this `<h1>` currently has an EMPTY
 * accessible name and `getByRole("heading", { name })` finds nothing. See the
 * documented failure in a11y.spec.ts.
 */
export function termHeading(page: Page, name: string): Locator {
  return page.locator("h1").filter({ hasText: name });
}

/** The layer overlay's title (SURFACE / SHALLOW / DEEP / ABYSS / BOTTOM). */
export function layerHeading(page: Page, name: string): Locator {
  return page.getByRole("heading", { level: 2, name, exact: true });
}

/** Cards rendered in the layer grid. */
export function cards(page: Page): Locator {
  return page.locator(".term-card");
}

/** The layer view's own scroll container. */
export function layerScroller(page: Page): Locator {
  return page.locator("div.overflow-y-auto").first();
}

/** Waits until the term modal for `name` is fully revealed. */
export async function expectTermOpen(page: Page, name: string): Promise<void> {
  await expect(termHeading(page, name)).toBeVisible();
}

/** Waits until the layer overlay for `name` is open. */
export async function expectLayerOpen(page: Page, name: string): Promise<void> {
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(layerHeading(page, name)).toBeVisible();
}

/**
 * Asserts the app is back on the home scene with nothing left over:
 * no layer dialog, no term cards, and the body scroll lock released.
 */
export async function expectHomeClean(page: Page): Promise<void> {
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(cards(page)).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => document.body.style.position))
    .toBe("");
}

/**
 * The scroll offset Index.tsx stashed when it locked the body for an overlay.
 * It writes `body.style.top = "-<savedScrollY>px"`, so this is the exact
 * position the app promises to restore on close — far more precise than
 * eyeballing a pixel range.
 */
export async function lockedScrollY(page: Page): Promise<number> {
  const top = await page.evaluate(() => document.body.style.top);
  const match = /^-?(\d+(?:\.\d+)?)px$/.exec(top);
  expect(
    match,
    `body.style.top was "${top}" — the scroll lock is not engaged`,
  ).not.toBeNull();
  return Number(match![1]);
}

/** Collects browser console errors and uncaught page errors for later assertion. */
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
  });
  page.on("pageerror", (err) => {
    errors.push(`pageerror: ${err.message}`);
  });
  return errors;
}

/** Types a query into the global search bar and waits for the debounce. */
export async function search(page: Page, query: string): Promise<void> {
  const input = page.getByRole("combobox").first();
  await input.click();
  await input.fill(query);
  await expect(input).toHaveAttribute("aria-expanded", "true");
}
