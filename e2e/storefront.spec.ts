import { test, expect, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const STORAGE_STATE = process.env.E2E_STORAGE_STATE;

test.use(STORAGE_STATE ? { storageState: STORAGE_STATE } : {});

/**
 * Storefront editor page (Phase 3).
 *
 * Anonymous behaviour always runs: the page is dashboard-protected and
 * must redirect to login. Authenticated assertions need
 * E2E_STORAGE_STATE and never mutate: sections are inspected, uploads
 * are not submitted, and any keystroke is reverted.
 */

async function ownedBusinessId(page: Page): Promise<string> {
  await page.goto("/dashboard");
  const link = page.locator('a[href*="/dashboard?business="]').first();
  await expect(link, "dashboard exposes an owned business").toBeVisible({ timeout: 30_000 });
  const href = (await link.getAttribute("href")) ?? "";
  const id = new URL(href, BASE_URL).searchParams.get("business");
  expect(id, "owned business id discovered").toBeTruthy();
  return id as string;
}

test.describe("storefront editor (anonymous)", () => {
  test("redirects to login with a next parameter", async ({ page }) => {
    await page.goto("/dashboard/storefront?business=00000000-0000-0000-0000-000000000000");
    await expect(page, "anonymous storefront visit lands on login").toHaveURL(
      /\/login\?.*next=%2Fdashboard%2Fstorefront/,
      { timeout: 30_000 },
    );
  });
});

test.describe("storefront editor (authenticated)", () => {
  test.skip(!STORAGE_STATE, "needs E2E_STORAGE_STATE with a logged-in session");

  test("renders header, status, sections, and completeness", async ({ page }) => {
    const businessId = await ownedBusinessId(page);
    await page.goto(`/dashboard/storefront?business=${businessId}`);
    await expect(page.getByRole("heading", { name: "Storefront" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("link", { name: "View storefront" })).toBeVisible();
    for (const name of [
      "Appearance",
      "Business content",
      "Gallery",
      "Team",
      "Social links",
      "Amenities",
      "Sections shown on your page",
    ]) {
      await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    }
    await expect(page.getByText(/Your storefront is \d+% complete/)).toBeVisible();
  });

  test("pristine saves stay disabled; typing enables without submitting", async ({
    page,
  }) => {
    const businessId = await ownedBusinessId(page);
    await page.goto(`/dashboard/storefront?business=${businessId}`);
    const headline = page.getByLabel("Headline");
    await expect(headline, "headline input renders").toBeVisible({ timeout: 30_000 });
    const section = page.locator('section:has(h2:text-is("Business content"))');
    const save = section.getByRole("button", { name: "Save changes" });
    await expect(save, "pristine Save disabled").toBeDisabled();
    const original = await headline.inputValue();
    await headline.fill(`${original} (probe)`);
    await expect(save, "dirty Save enables").toBeEnabled();
    await expect(page.getByText("Unsaved changes").first()).toBeVisible();
    // Revert without submitting: nothing is ever saved by this test.
    await headline.fill(original);
    await expect(save, "reverted Save disables again").toBeDisabled();
  });

  test("nav shell exposes the Storefront destination", async ({ page }) => {
    const businessId = await ownedBusinessId(page);
    await page.goto(`/dashboard?business=${businessId}`);
    const nav = page.getByRole("navigation", { name: "Workspace" });
    await expect(nav.getByRole("link", { name: "Storefront" })).toBeVisible({
      timeout: 30_000,
    });
  });
});
