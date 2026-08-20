/**
 * Accessibility contracts that only a real browser's accessibility tree can
 * check. These are behaviour assertions, not an audit — one of them documents
 * a live bug rather than asserting the desired behaviour.
 */
import { expect, test } from "@playwright/test";
import { expectLayerOpen, expectTermOpen } from "./helpers";

/* BUG (documented, not fixed): the term modal's <h1> has an EMPTY accessible
   name. DecryptedText renders the title inside `<span aria-hidden="true">`
   (so the per-character scramble is not read out) but provides no
   screen-reader alternative, so the page's main heading is invisible to
   assistive tech and to `getByRole("heading", { name })`.

   Fix by adding a visually-hidden `<span className="sr-only">{text}</span>`
   sibling inside DecryptedText, then change this test to assert the heading
   IS found by role+name. The layer title does not have this problem —
   TextType leaves its text readable — which is asserted below as the
   contrast case. */
test("BUG: the term title h1 has no accessible name (DecryptedText is fully aria-hidden)", async ({
  page,
}) => {
  await page.goto("/t/proof-of-history");
  await expectTermOpen(page, "Proof of History (PoH)");

  // The text is on screen...
  await expect(
    page.locator("h1", { hasText: "Proof of History (PoH)" }),
  ).toBeVisible();

  // ...but carries no accessible name, so this finds nothing.
  await expect(
    page.getByRole("heading", { level: 1, name: "Proof of History (PoH)" }),
  ).toHaveCount(0);

  // Confirms the cause rather than just the symptom.
  const hidden = await page
    .locator("h1", { hasText: "Proof of History (PoH)" })
    .locator("[aria-hidden='true']")
    .count();
  expect(hidden).toBeGreaterThan(0);
});

test("the layer title is exposed to assistive tech", async ({ page }) => {
  await page.goto("/l/deep");
  await expectLayerOpen(page, "DEEP");

  await expect(
    page.getByRole("heading", { level: 2, name: "DEEP" }),
  ).toBeVisible();
});

test("the layer overlay is announced as a modal dialog named after its layer", async ({
  page,
}) => {
  await page.goto("/l/abyss");

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(dialog).toHaveAccessibleName("ABYSS");
});

test("every button on the home screen has an accessible name", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "ICEBERG" }),
  ).toBeVisible();

  const unnamed: string[] = [];
  for (const button of await page.getByRole("button").all()) {
    const name = (await button.evaluate((el) => el.textContent ?? "")).trim();
    const aria = await button.getAttribute("aria-label");
    if (!name && !aria)
      unnamed.push(await button.evaluate((el) => el.outerHTML.slice(0, 120)));
  }

  expect(unnamed, `unnamed buttons:\n${unnamed.join("\n")}`).toEqual([]);
});

test("the search input is a combobox wired to its listbox", async ({
  page,
}) => {
  await page.goto("/");
  const input = page.getByRole("combobox").first();

  await expect(input).toHaveAttribute("aria-autocomplete", "list");
  await expect(input).toHaveAttribute("aria-expanded", "false");

  await input.click();
  await input.fill("sealevel");
  await expect(input).toHaveAttribute("aria-expanded", "true");

  /* Attribute selector, not `#id`: React's useId emits ":r0:" and colons are
     not legal in a CSS id selector. */
  const controls = await input.getAttribute("aria-controls");
  await expect(page.locator(`[id="${controls}"]`)).toHaveAttribute(
    "role",
    "listbox",
  );
});
