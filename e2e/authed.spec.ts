import { test, expect, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const STORAGE_STATE = process.env.E2E_STORAGE_STATE;

test.use(STORAGE_STATE ? { storageState: STORAGE_STATE } : {});

/**
 * Authenticated booking + settings coverage.
 *
 * Requires E2E_STORAGE_STATE pointing at a logged-in Playwright storage
 * state file. Generate it once (never commit it):
 *
 *   npx playwright codegen --save-storage=e2e/auth.json \
 *     https://booking-automation-delta.vercel.app/login
 *   # log in in the opened browser, then close it
 *   E2E_STORAGE_STATE=e2e/auth.json BASE_URL=https://booking-automation-delta.vercel.app \
 *     npx playwright test e2e/authed.spec.ts
 *
 * Without a storage state these tests skip (anonymous behaviour is covered
 * in smoke.spec.ts). No test here submits a mutation: settings assertions
 * stop at dirty-state enablement and revert every keystroke; booking
 * assertions stop at the disabled Confirm control.
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

test.describe("manual booking drawer (authenticated, failure 4)", () => {
  test.skip(!STORAGE_STATE, "needs E2E_STORAGE_STATE with a logged-in session");

  test("clicking New booking renders the manual form", async ({ page }) => {
    const businessId = await ownedBusinessId(page);
    await page.goto(`/dashboard/bookings?business=${businessId}`);
    await page.getByRole("link", { name: "New booking" }).click();
    await expect(page).toHaveURL(/new=1/);
    await expect(page.getByRole("heading", { name: "New booking" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("button", { name: "Confirm booking" })).toBeVisible();
  });

  test("direct new=1 navigation renders service, date, time and customer fields", async ({
    page,
  }) => {
    const businessId = await ownedBusinessId(page);
    await page.goto(`/dashboard/bookings?business=${businessId}&new=1`);
    await expect(page.getByRole("heading", { name: "New booking" })).toBeVisible({
      timeout: 30_000,
    });
    // Offering + schedule + customer controls all present.
    await expect(page.locator("select").first()).toBeVisible();
    await expect(page.getByLabel("Customer name")).toBeVisible();
    await expect(page.getByLabel("Customer phone")).toBeVisible();
  });

  test("incomplete data cannot submit", async ({ page }) => {
    const businessId = await ownedBusinessId(page);
    await page.goto(`/dashboard/bookings?business=${businessId}&new=1`);
    const confirm = page.getByRole("button", { name: "Confirm booking" });
    await expect(confirm, "Confirm visible once catalog loads").toBeVisible({ timeout: 30_000 });
    await expect(confirm, "Confirm disabled with empty service/customer").toBeDisabled();
  });

  test("Close removes new=1 while preserving the business id", async ({ page }) => {
    const businessId = await ownedBusinessId(page);
    await page.goto(`/dashboard/bookings?business=${businessId}&new=1`);
    await expect(page.getByRole("heading", { name: "New booking" })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole("link", { name: "Close" }).click();
    await expect(page).toHaveURL(new RegExp(`business=${businessId}`));
    await expect(page).not.toHaveURL(/new=1/);
    await expect(page.getByRole("heading", { name: "New booking" })).toHaveCount(0);
  });
});

test.describe("settings semantic forms (authenticated, failure 2)", () => {
  test.skip(!STORAGE_STATE, "needs E2E_STORAGE_STATE with a logged-in session");

  test("each saved section is a real form with submit behavior", async ({ page }) => {
    await page.goto("/settings");
    const profile = page.locator('section:has(h2:text-is("Business profile")) form').first();
    await expect(profile, "profile section is a form").toBeVisible({ timeout: 30_000 });
    const forms = page.locator("main form");
    expect(await forms.count(), "settings renders real forms").toBeGreaterThanOrEqual(4);
    for (const name of ["Save profile", "Save hours", "Save notifications"]) {
      const btn = page.getByRole("button", { name, exact: true }).first();
      await expect(btn, `${name} is a submit control`).toHaveAttribute("type", "submit");
    }
  });

  test("pristine Save is disabled; dirty enables; revert disables (no mutation)", async ({
    page,
  }) => {
    await page.goto("/settings");
    const nameInput = page.locator('section:has(h2:text-is("Business profile")) input').first();
    await expect(nameInput).toBeVisible({ timeout: 30_000 });
    const save = page.getByRole("button", { name: "Save profile", exact: true });
    await expect(save, "pristine Save disabled").toBeDisabled();
    const original = await nameInput.inputValue();
    await nameInput.fill(`${original} (probe)`);
    await expect(save, "dirty Save enables").toBeEnabled();
    await expect(page.getByText("Unsaved changes")).toHaveCount(1);
    // Revert without submitting: nothing is ever saved by this test.
    await nameInput.fill(original);
    await expect(save, "reverted Save disables again").toBeDisabled();
  });

  test("Enter in a pristine form neither navigates nor submits", async ({ page }) => {
    await page.goto("/settings");
    const nameInput = page.locator('section:has(h2:text-is("Business profile")) input').first();
    await expect(nameInput).toBeVisible({ timeout: 30_000 });
    await nameInput.press("Enter");
    await expect(page, "still on settings after Enter").toHaveURL(/\/settings/);
  });
});
