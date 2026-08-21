import { test, expect } from "@playwright/test";

/**
 * The background diver tracks the viewport center between the waterline
 * and the bottom of the iceberg. Its travel used to stop at 65% of the
 * page — on phones that meant it floated off the top of the screen well
 * before the Solana Trenches section — and its 8vw width rendered a
 * barely-visible 31px sprite on a 393px phone. It now clamps at the
 * measured iceberg bottom (so it escorts the scroll all the way down to
 * the trenches) and never renders below 56px wide.
 */

test.use({ viewport: { width: 393, height: 852 } });

test("diver stays visible down to the trenches and is legible on phones", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("img[src*='diver']")).toBeAttached();

  // Scroll to the very bottom — the trenches/footer area.
  await page.evaluate(() =>
    window.scrollTo(0, document.body.scrollHeight - innerHeight),
  );
  await page.waitForTimeout(500);

  const diver = await page.evaluate(() => {
    const img = document.querySelector("img[src*='diver']");
    const box = img?.closest("div.fixed");
    const r = box?.getBoundingClientRect();
    return r
      ? { top: r.top, bottom: r.bottom, width: r.width }
      : null;
  });
  expect(diver).not.toBeNull();
  // Visible in the viewport (not stranded above it)…
  expect(diver!.bottom).toBeGreaterThan(0);
  expect(diver!.top).toBeLessThan(852);
  // …and big enough to read as a character on a phone.
  expect(diver!.width).toBeGreaterThanOrEqual(56);
});
