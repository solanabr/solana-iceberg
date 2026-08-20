import { defineConfig, devices } from "@playwright/test";
import os from "os";
import path from "path";

/**
 * The `chrome` channel is broken on this machine, so the suite points at the
 * bundled Chrome for Testing build in the Playwright browser cache directly.
 * That keeps `npm run test:e2e` runnable without `npx playwright install`.
 * Override with PLAYWRIGHT_CHROMIUM_PATH if your cache holds another build.
 */
const CHROMIUM_EXECUTABLE =
  process.env.PLAYWRIGHT_CHROMIUM_PATH ??
  path.join(
    os.homedir(),
    "Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64",
    "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
  );

/* Kept off the default 8080 so a dev server someone else is already running
   is never disturbed. */
const PORT = Number(process.env.E2E_PORT ?? 8330);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  /* The app animates a lot; a deep-link still has to settle well inside this. */
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: [["list"]],

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        /* Explicit path replaces the (broken) channel lookup. */
        channel: undefined,
        launchOptions: { executablePath: CHROMIUM_EXECUTABLE },
      },
    },
  ],

  webServer: {
    /* --strictPort matters: vite.config.ts sets strictPort:false, so without
       it a busy 8330 would silently move the server and every test would hit
       the wrong origin. */
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
