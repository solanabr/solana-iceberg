import { test, expect } from "@playwright/test";

/**
 * Narrow mode stretches the iceberg SVG with preserveAspectRatio="none",
 * and every text element carries a counter-scale so glyphs render
 * undistorted. That correction was originally written as a CSS transform
 * with `transform-box: fill-box; transform-origin: center` — which WebKit
 * mis-anchors on positioned SVG <text>: the reference box is sized from
 * the glyph box but left at the coordinate origin, so every label is
 * scaled about a common point near the viewBox top instead of about
 * itself. On a real iPhone all five layer titles collapsed toward the
 * middle of the iceberg and each term count landed on top of its title.
 *
 * The correction must therefore be an SVG attribute transform
 * (translate·scale with a numerically computed fixed point) — attribute
 * transforms have no box-resolution ambiguity in any engine. This spec
 * bans the CSS variant and pins the rendered geometry in Chromium.
 */

const TITLES = ["SURFACE", "SHALLOW", "DEEP", "ABYSS", "BOTTOM"];

test.use({ viewport: { width: 393, height: 852 } });

test("no SVG text relies on CSS transform-box for the narrow-mode counter-scale", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("svg text").first()).toBeVisible();

  const offenders = await page.evaluate(() =>
    [...document.querySelectorAll("svg text")]
      .filter((t) => {
        const s = (t as SVGTextElement).style;
        return s.transformBox !== "" || s.transform !== "";
      })
      .map((t) => (t.textContent ?? "").slice(0, 20)),
  );
  expect(offenders, "SVG text with CSS transform/transform-box").toEqual([]);
});

test("layer titles sit in their layers and never overlap their term counts", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("svg text").first()).toBeVisible();

  const boxes = await page.evaluate((titles) => {
    const all = [...document.querySelectorAll("svg text")];
    return titles.map((title) => {
      const t = all.find((x) => x.textContent === title);
      const c = t?.nextElementSibling; // count <text> in the same group
      const tb = t?.getBoundingClientRect();
      const cb = c?.getBoundingClientRect();
      return {
        title,
        count: (c?.textContent ?? "").slice(0, 20),
        titleTop: (tb?.top ?? NaN) + scrollY,
        titleBottom: (tb?.bottom ?? NaN) + scrollY,
        countTop: (cb?.top ?? NaN) + scrollY,
      };
    });
  }, TITLES);

  for (const b of boxes) {
    expect(b.count, `${b.title} has a count sibling`).toMatch(/terms/);
    // The count starts below the title's ink — no overlap.
    expect(
      b.countTop,
      `${b.title} count overlaps its title`,
    ).toBeGreaterThanOrEqual(b.titleBottom - 2);
  }
  // Titles are spread down the iceberg, not collapsed toward one point.
  for (let i = 1; i < boxes.length; i++) {
    expect(
      boxes[i].titleTop - boxes[i - 1].titleTop,
      `${TITLES[i - 1]} → ${TITLES[i]} spacing`,
    ).toBeGreaterThan(200);
  }
});
