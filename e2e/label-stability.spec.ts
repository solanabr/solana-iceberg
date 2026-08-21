import { test, expect } from "@playwright/test";

/**
 * On iOS the browser toolbar collapses while you scroll and settles about
 * a second after you stop, firing a resize burst where window.innerHeight
 * changes but the 356vh iceberg container (sized by the stable large
 * viewport) does not. textYScale used to be derived from innerHeight, so
 * every toolbar settle produced a "new" scale, the label packing re-ran,
 * and every floating term teleported to a freshly seeded drift cell right
 * after scrolling stopped — causing misclicks on dense layers.
 *
 * The scale must come from the SVG's measured box, which is identical
 * before and after a toolbar collapse. This spec replays the iOS
 * mechanism exactly: fake an innerHeight change, fire resize, and require
 * that no term label moves beyond its slow ambient drift.
 */

test.use({ viewport: { width: 393, height: 852 } });

test("toolbar-style resize (innerHeight change, same layout box) does not teleport labels", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("svg text").first()).toBeVisible();
  await page.waitForTimeout(800); // let the drift loop settle in

  const snapshot = () =>
    page.evaluate(() => {
      const out: Record<string, { x: number; y: number }> = {};
      for (const t of document.querySelectorAll("svg text.iceberg-term-text")) {
        const bb = t.getBoundingClientRect();
        out[t.textContent ?? ""] = { x: bb.x, y: bb.y + scrollY };
      }
      return out;
    });

  const before = await snapshot();
  expect(Object.keys(before).length).toBeGreaterThan(50);

  // Replay the iOS toolbar settle: innerHeight changes, layout box doesn't.
  await page.evaluate(() => {
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: window.innerHeight - 84,
    });
    window.dispatchEvent(new Event("resize"));
  });
  await page.waitForTimeout(400);

  const after = await snapshot();

  const beforeNames = Object.keys(before).sort();
  const afterNames = Object.keys(after).sort();
  expect(afterNames, "packing re-ran: visible label set changed").toEqual(
    beforeNames,
  );

  let worst = 0;
  for (const name of beforeNames) {
    const d = Math.hypot(
      after[name].x - before[name].x,
      after[name].y - before[name].y,
    );
    if (d > worst) worst = d;
  }
  // Ambient drift moves a label a few px in 400ms; a repack moves it tens
  // to hundreds. 15px cleanly separates the two.
  expect(worst, "a label teleported").toBeLessThan(15);
});
