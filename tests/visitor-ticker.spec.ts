import { expect, test, type Page } from "@playwright/test";

/**
 * The landing-page hit counter reads the visitor total from a same-origin
 * `visitor-count.json`, baked at build time (see scripts/bake-visitor-count.mjs)
 * so a content blocker has no cross-site GoatCounter request to drop - the bug
 * that sent us here, where the counter read as dead on any browser with a
 * blocker. These tests stub that one file so the behaviour is pinned without a
 * build, including the zero/null case where the odometer must not read as a
 * broken row of zeros.
 *
 * The counter's accessible label (`role="status"`) is the assertion target: it
 * states the same thing the odometer shows, in plain text.
 */
const COUNT = "**/visitor-count.json";

/** Stub the baked count: a JSON body, or null to fail the request outright. */
function stubCount(page: Page, body: string | null, status = 200) {
  return page.route(COUNT, (route) =>
    body == null
      ? route.abort()
      : route.fulfill({ status, contentType: "application/json", body }),
  );
}

test.describe("visitor ticker", () => {
  // Skip the spin-up animation so the final value is on screen immediately.
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("renders the real total, thousands-separated", async ({ page }) => {
    await stubCount(page, JSON.stringify({ count: 1234 }));
    await page.goto("/");
    await expect(page.getByRole("status")).toHaveText("1,234 visitors and counting");
  });

  test("a null total shows the offline face", async ({ page }) => {
    await stubCount(page, JSON.stringify({ count: null }));
    await page.goto("/");
    await expect(page.getByRole("status")).toHaveText("Visitor count is offline");
  });

  test("a zero total shows the offline face, not all zeros", async ({ page }) => {
    await stubCount(page, JSON.stringify({ count: 0 }));
    await page.goto("/");
    await expect(page.getByRole("status")).toHaveText("Visitor count is offline");
  });

  test("a read error shows the offline face", async ({ page }) => {
    await stubCount(page, null);
    await page.goto("/");
    await expect(page.getByRole("status")).toHaveText("Visitor count is offline");
  });

  test("a non-200 response shows the offline face", async ({ page }) => {
    await stubCount(page, "nope", 500);
    await page.goto("/");
    await expect(page.getByRole("status")).toHaveText("Visitor count is offline");
  });
});
