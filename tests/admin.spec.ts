import { expect, test } from "@playwright/test";

/**
 * The CMS page, which is the one address on this site that is not the site.
 *
 * It is deliberately absent from `tests/routes.ts`: every sweep there assumes
 * the SPA shell - one `h1`, the site header, the footer's list of sections -
 * and this is a static file under `public/` that hands a third-party editor the
 * whole viewport. So the one thing worth holding is the thing the shell would
 * otherwise have provided, which is a way out. Without it a visitor who
 * followed the footer link meets a sign-in prompt naming a repository, with the
 * browser's back button as the only exit.
 */
test.describe("the CMS page", () => {
  test.beforeEach(async ({ page }) => {
    /*
     * The editor itself is fetched from a CDN. A test that reaches the network
     * fails when the network does, and the way back is markup above the editor's
     * root that renders whether or not the script ever arrives - which is also
     * what makes it a way back rather than a feature of the editor.
     */
    await page.route(/unpkg\.com/, (route) => route.abort());
    await page.goto("/admin/");
  });

  test("offers a way back to the site", async ({ page }) => {
    const back = page.getByRole("link", { name: /back to/i });

    await expect(back).toBeVisible();

    await back.click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Dan/);
  });

  test("the way back is the first thing a keyboard reaches", async ({ page }) => {
    // There is nothing above it and nothing else on the page leads anywhere,
    // so a keyboard should not have to hunt through the editor to leave.
    await page.keyboard.press("Tab");

    await expect(page.getByRole("link", { name: /back to/i })).toBeFocused();
  });
});
