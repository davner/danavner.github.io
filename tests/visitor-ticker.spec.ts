import { expect, test, type Page } from "@playwright/test";

/**
 * The landing-page hit counter reads the live total from GoatCounter and, when
 * that cross-site read fails or comes back empty - which is what a content
 * blocker does to it - falls back to a stored same-origin `visitor-count.json`,
 * baked nightly (see scripts/update-visitor-count.mjs). These tests stub both
 * sources so every branch is pinned without depending on live stats, including
 * the wedged-`0` case where the odometer must not read as a broken row of zeros.
 *
 * The counter's accessible label (`role="status"`) is the assertion target: it
 * states the same thing the odometer shows, in plain text.
 */
// Trailing `*` so the match survives the `?start=…` cache-dodge query param.
const LIVE = "**/counter/TOTAL.json*";
const STORED = "**/visitor-count.json";

/** Stub a route: a JSON body, or null to fail the request outright. */
function stub(page: Page, url: string, body: string | null, status = 200) {
  return page.route(url, (route) =>
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

  test("shows the live GoatCounter total when it is reachable", async ({ page }) => {
    await stub(page, LIVE, JSON.stringify({ count: "2,500" }));
    await stub(page, STORED, JSON.stringify({ count: 13 }));
    await page.goto("/");
    await expect(page.getByRole("status")).toHaveText("2,500 visitors and counting");
  });

  test("falls back to the stored total when the live read fails, and logs it", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await stub(page, LIVE, null); // blocked or network failure
    await stub(page, STORED, JSON.stringify({ count: 1234 }));
    await page.goto("/");
    await expect(page.getByRole("status")).toHaveText("1,234 visitors and counting");
    expect(errors.some((text) => /live read failed/i.test(text))).toBe(true);
  });

  test("falls back to the stored total when the live read is a wedged zero", async ({ page }) => {
    await stub(page, LIVE, JSON.stringify({ count: "0" }));
    await stub(page, STORED, JSON.stringify({ count: 1234 }));
    await page.goto("/");
    await expect(page.getByRole("status")).toHaveText("1,234 visitors and counting");
  });

  test("shows the offline face when both the live and stored reads fail", async ({ page }) => {
    await stub(page, LIVE, null);
    await stub(page, STORED, null);
    await page.goto("/");
    await expect(page.getByRole("status")).toHaveText("Visitor count is offline");
  });

  test("a non-200 stored response, with the live read down, shows the offline face", async ({ page }) => {
    await stub(page, LIVE, null);
    await stub(page, STORED, "nope", 500);
    await page.goto("/");
    await expect(page.getByRole("status")).toHaveText("Visitor count is offline");
  });
});
