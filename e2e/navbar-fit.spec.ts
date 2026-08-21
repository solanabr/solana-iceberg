import { test, expect } from "@playwright/test";

/**
 * The narrow-mode navbar is a centered fixed track; anything wider than
 * the viewport clips symmetrically off BOTH edges — with many filters
 * selected, the layer-view back button vanished off the left edge while
 * the appended "× Clear" button hung off the right. Every control in the
 * track must stay inside the viewport in the worst case: layer view
 * (back button present) + every category selected (count badge at its
 * widest) on a 393px phone.
 */

test.use({ viewport: { width: 393, height: 852 } });

test("navbar controls stay on-screen with many filters selected (phone layer view)", async ({
  page,
}) => {
  await page.goto("/l/shallow");
  await expect(page.getByRole("dialog")).toBeVisible();

  // Select every category via the layer header's pill legend.
  const pills = page.locator("div[role='dialog'] button").filter({
    has: page.locator("span + span"), // label + count badge
  });
  const n = await pills.count();
  expect(n).toBeGreaterThan(5);
  for (let i = 0; i < n; i++) {
    await pills.nth(i).click();
  }

  // Give the nav a frame to re-render with badges/clear affordances.
  await page.waitForTimeout(300);

  const clipped = await page.evaluate(() => {
    const track = [...document.querySelectorAll("div.fixed")].find((d) =>
      d.querySelector("nav"),
    );
    if (!track) return ["navbar track not found"];
    const bad: string[] = [];
    for (const el of track.querySelectorAll("nav, button, input")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue; // hidden is fine — clipped is not
      if (r.left < -1 || r.right > innerWidth + 1) {
        bad.push(
          `${el.tagName} "${(el.textContent ?? "").slice(0, 16)}" spans ${Math.round(r.left)}..${Math.round(r.right)} in ${innerWidth}px viewport`,
        );
      }
    }
    return bad;
  });
  expect(clipped, "navbar controls clipped off-screen").toEqual([]);
});
