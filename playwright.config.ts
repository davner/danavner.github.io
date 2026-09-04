import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * CI runs `playwright install chromium` and needs no help finding it. Some
 * sandboxes ship a browser at a fixed path instead; point at it with
 * PLAYWRIGHT_CHROMIUM_PATH rather than hardcoding anything here.
 */
const launch = process.env.PLAYWRIGHT_CHROMIUM_PATH
  ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } }
  : {};

/**
 * Tests run against the production build, not the dev server - the content
 * plugin behaves differently between the two (drafts), and a bug that only
 * exists in the shipped bundle is the one worth catching.
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], ...launch } },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], ...launch },
      // The width sweep sets its own viewport for every case it runs, 412 -
      // the Pixel 7's - among them, so running it here would take the same
      // measurements a second time under a device that never applies. The
      // encoder spec never opens a page, so a second device would run the
      // same arithmetic twice. Print emulation swaps the media type and the
      // ink, neither of which reads the viewport, so the print spec would
      // resolve the same computed styles a second time too.
      testIgnore: ["**/responsive.spec.ts", "**/code128.spec.ts", "**/print.spec.ts"],
    },
  ],
  webServer: {
    command: `npm run preview -- --port ${PORT} --host 127.0.0.1`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
