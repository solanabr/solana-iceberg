/**
 * Language toggle <-> URL mirroring.
 *
 * The URL -> app sync in useViewRoute is one-directional, so without the
 * mirror the address bar would still read /t/slot after switching to
 * Portuguese and any copied link would silently lose the language.
 */
import { expect, test } from "@playwright/test";
import { expectLayerOpen, expectTermOpen, termHeading } from "./helpers";

/** Opens the flag picker and chooses a language. The trigger is labelled with
 *  the CURRENT language, and the same label reappears as an option once open,
 *  so the trigger must be clicked before the options exist. */
async function switchLanguage(
  page: import("@playwright/test").Page,
  from: string,
  to: string,
) {
  await page.getByRole("button", { name: from }).first().click();
  await page.getByRole("button", { name: to }).click();
}

test("switching to Portuguese mirrors into the URL and keeps the open term", async ({
  page,
}) => {
  await page.goto("/t/slot");
  await expectTermOpen(page, "Slot");

  await switchLanguage(page, "English", "Português");

  await expect.poll(() => new URL(page.url()).pathname).toBe("/pt/t/slot");
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  await expectTermOpen(page, "Slot");
});

test("switching language translates the open term's title", async ({
  page,
}) => {
  await page.goto("/t/proof-of-history");
  await expectTermOpen(page, "Proof of History (PoH)");

  await switchLanguage(page, "English", "Português");

  await expect
    .poll(() => new URL(page.url()).pathname)
    .toBe("/pt/t/proof-of-history");
  await expectTermOpen(page, "Prova de História (PoH)");
});

/* Regression guard: switching language from the English home must produce the
   canonical "/es", not "/es/". useLocaleNavigate strips the lone slash left by
   `pathname.slice(prefix.length)` on "/", because the sitemap and the
   vercel.json rewrite ("source": "/:lang(pt|es)") both use the unsuffixed
   form. Every other transition already produced a clean path. */
test("switching language on the English home yields the canonical '/es'", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "ICEBERG" }),
  ).toBeVisible();

  await switchLanguage(page, "English", "Español");

  await expect.poll(() => new URL(page.url()).pathname).toBe("/es");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
});

test("switching language from a locale home yields a clean path (no trailing slash)", async ({
  page,
}) => {
  await page.goto("/pt");
  await expect(
    page.getByRole("heading", { level: 1, name: "ICEBERG" }),
  ).toBeVisible();

  await switchLanguage(page, "Português", "Español");

  await expect.poll(() => new URL(page.url()).pathname).toBe("/es");
});

test("switching language keeps the open layer", async ({ page }) => {
  await page.goto("/l/deep");
  await expectLayerOpen(page, "DEEP");

  await switchLanguage(page, "English", "Português");

  await expect.poll(() => new URL(page.url()).pathname).toBe("/pt/l/deep");
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("switching from a locale back to English drops the prefix", async ({
  page,
}) => {
  await page.goto("/pt/t/slot");
  await expectTermOpen(page, "Slot");

  await switchLanguage(page, "Português", "English");

  await expect.poll(() => new URL(page.url()).pathname).toBe("/t/slot");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("language switching is replace-only, so Back does not walk through it", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "ICEBERG" }),
  ).toBeVisible();
  await page.locator("#iceberg-layer-deep").click();
  await expectLayerOpen(page, "DEEP");

  await switchLanguage(page, "English", "Português");
  await expect.poll(() => new URL(page.url()).pathname).toBe("/pt/l/deep");

  // One Back must land on home, not on the pre-switch /l/deep entry.
  await page.goBack();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/");
});

test("the chosen language survives a reload of an unprefixed URL", async ({
  page,
}) => {
  await page.goto("/t/proof-of-history");
  await expectTermOpen(page, "Proof of History (PoH)");
  await switchLanguage(page, "English", "Português");
  await expect
    .poll(() => new URL(page.url()).pathname)
    .toBe("/pt/t/proof-of-history");

  /* A missing prefix deliberately does NOT force English — the stored
     preference wins, so a pt-BR visitor who lands on "/" stays in pt-BR. */
  await page.goto("/t/proof-of-history");
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  await expectTermOpen(page, "Prova de História (PoH)");
  await expect(termHeading(page, "Proof of History (PoH)")).toHaveCount(0);
});
