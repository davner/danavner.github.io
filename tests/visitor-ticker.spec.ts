import { expect, test, type Page } from "@playwright/test";

/**
 * The landing-page hit counter reads the live total from GoatCounter on every
 * load. There is no stored fallback: when the read fails the odometer goes to
 * dashes and the reason is printed in red under it. These tests stub the
 * endpoint so every branch is pinned without depending on live stats, including
 * the wedged-`0` case, which is treated as a failed read rather than shown as a
 * broken row of zeros.
 *
 * The counter's accessible label (`role="status"`) is the assertion target: it
 * states the same thing the odometer shows, in plain text.
 */
// Trailing `*` so the match survives the `?start=…` cache-dodge query param.
const COUNTER = "**/counter/TOTAL.json*";

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

  test("shows the live GoatCounter total", async ({ page }) => {
    await stub(page, COUNTER, JSON.stringify({ count: "2,500" }));
    await page.goto("/");
    await expect(page.getByRole("status")).toHaveText(
      "2,500 visitors and counting",
    );
    await expect(page.getByTestId("visitor-error")).toHaveCount(0);
  });

  test("a failed read shows a red error under the counter, and logs it", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await stub(page, COUNTER, null); // blocked or network failure
    await page.goto("/");

    const message = page.getByTestId("visitor-error");
    await expect(message).toBeVisible();
    await expect(message).toContainText(/visitor count failed/i);
    expect(errors.some((text) => /read failed/i.test(text))).toBe(true);
  });

  test("the error message is actually red, in both themes", async ({
    page,
  }) => {
    await stub(page, COUNTER, null);

    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      await page.goto("/");
      // Tailwind emits `oklch()`, so paint the computed colour onto a canvas
      // and read the pixel back rather than trying to parse the string.
      const [r, g, b] = await page
        .getByTestId("visitor-error")
        .evaluate((el) => {
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = 1;
          const ctx = canvas.getContext("2d")!;
          ctx.fillStyle = getComputedStyle(el).color;
          ctx.fillRect(0, 0, 1, 1);
          return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
        });

      // Red channel clearly ahead of the other two, whatever the shade.
      const seen = `${scheme}: rgb(${r} ${g} ${b})`;
      expect(r, seen).toBeGreaterThan(g + 40);
      expect(r, seen).toBeGreaterThan(b + 40);
    }
  });

  test("an HTTP error surfaces the status code", async ({ page }) => {
    await stub(page, COUNTER, "nope", 500);
    await page.goto("/");
    await expect(page.getByTestId("visitor-error")).toContainText("500");
  });

  test("a wedged zero is an error, not a row of zeros", async ({ page }) => {
    await stub(page, COUNTER, JSON.stringify({ count: "0" }));
    await page.goto("/");
    await expect(page.getByTestId("visitor-error")).toContainText(
      /no usable total/i,
    );
    await expect(page.getByRole("status")).toHaveText(/unavailable/i);
  });

  test("nothing is left reading the removed same-origin file", async ({
    page,
  }) => {
    const stored: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("visitor-count.json"))
        stored.push(request.url());
    });
    await stub(page, COUNTER, JSON.stringify({ count: "2,500" }));
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(stored).toEqual([]);
  });
});
