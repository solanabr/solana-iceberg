import { test, expect } from "@playwright/test";

/**
 * The fixed navbar is frosted glass: `bg-background/60 backdrop-blur-xl`.
 * On phones the iceberg's layer titles and term counts scroll straight
 * through the navbar band, and the 60%-alpha background alone is not enough
 * to keep the chips legible — the blur is what dissolves the text passing
 * underneath. If an ancestor of a glass element forms a backdrop root
 * (CSS filter-effects-2), the browser silently restricts `backdrop-filter`
 * to sampling inside that ancestor, the page behind is never blurred, and
 * layer names double-expose with the chip labels.
 *
 * That is not a theoretical failure: BorderGlow's hover-glow span used
 * `mix-blend-mode: plus-lighter`, which makes its parent an isolated group
 * — a backdrop root — and every browser then rendered the filter chips with
 * no blur at all (the glow itself sat at opacity 0 the whole time on touch
 * devices). This spec pins the structural invariant so a future decorative
 * wrapper cannot quietly break the glass again.
 */

/** Returns a description of every backdrop-root inducer above `el`. */
function ancestorOffenders(el: Element): string[] {
  const offenders: string[] = [];
  for (let a = el.parentElement; a; a = a.parentElement) {
    const s = getComputedStyle(a);
    const who =
      a.tagName + "." + String(a.className).split(" ").slice(0, 3).join(".");
    if (s.filter !== "none") offenders.push(who + " has filter:" + s.filter);
    if (s.backdropFilter && s.backdropFilter !== "none")
      offenders.push(who + " has backdrop-filter:" + s.backdropFilter);
    if (Number(s.opacity) < 1)
      offenders.push(who + " has opacity:" + s.opacity);
    if (s.mixBlendMode !== "normal")
      offenders.push(who + " has mix-blend-mode:" + s.mixBlendMode);
    if (s.maskImage !== "none") offenders.push(who + " has mask-image");
    if (s.clipPath !== "none") offenders.push(who + " has clip-path");
    // A 3D transform lifts the subtree into its own rendering context, a
    // spec-listed backdrop-root boundary. 2D transforms are fine (and one is
    // load-bearing: BorderGlow's wrapper needs a transform to stay the
    // containing block for its absolutely-positioned glow span).
    if (/matrix3d/.test(s.transform))
      offenders.push(who + " has 3D transform:" + s.transform);
    // A blending CHILD is what forces the ancestor itself to isolate — the
    // exact shape of the BorderGlow bug.
    for (const child of Array.from(a.children)) {
      const cb = getComputedStyle(child).mixBlendMode;
      if (cb !== "normal")
        offenders.push(
          who + " isolates: child " + child.tagName + " blends (" + cb + ")",
        );
    }
  }
  return offenders;
}

/** True when `el` overlays scrolling page content (some ancestor is fixed). */
function isFixedOverlay(el: Element): boolean {
  for (let n: Element | null = el; n; n = n.parentElement) {
    if (getComputedStyle(n).position === "fixed") return true;
  }
  return false;
}

for (const [label, viewport] of [
  ["phone", { width: 393, height: 852 }],
  ["desktop", { width: 1440, height: 900 }],
] as const) {
  test(`every fixed glass element can blur the page behind it (${label})`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const glass = page.locator(".backdrop-blur-xl");
    await expect(glass.first()).toBeVisible();

    const count = await glass.count();
    expect(count).toBeGreaterThanOrEqual(2); // search box + filter chips at minimum

    let checked = 0;
    for (let i = 0; i < count; i++) {
      const item = glass.nth(i);
      if (!(await item.evaluate(isFixedOverlay))) continue;
      checked++;
      const offenders = await item.evaluate(ancestorOffenders);
      expect(offenders, `glass element #${i} cannot blur the page`).toEqual([]);
    }
    expect(checked).toBeGreaterThanOrEqual(2);
  });
}
