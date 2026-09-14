import { test, expect, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const IS_LIVE = process.env.E2E_LIVE === "1" || /vercel\.app/.test(BASE_URL);
const STORAGE_STATE = process.env.E2E_STORAGE_STATE; // logged-in session file, when available

test.use(STORAGE_STATE ? { storageState: STORAGE_STATE } : {});

function ymdPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function consoleErrors(page: Page): Promise<string[]> {
  const messages: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") messages.push(msg.text());
  });
  page.on("pageerror", (err) => messages.push(`pageerror: ${err.message}`));
  return messages;
}

async function failedRequests(page: Page): Promise<string[]> {
  const failed: string[] = [];
  page.on("requestfailed", (req) => {
    failed.push(`${req.url()} :: ${req.failure()?.errorText}`);
  });
  page.on("response", (res) => {
    if (res.status() >= 400 && !res.url().includes("favicon")) {
      failed.push(`${res.url()} :: HTTP ${res.status()}`);
    }
  });
  return failed;
}

test.describe("Kivo Drive rental interaction (failure 1)", () => {
  test("fill four native date/time inputs clears required errors, enables Check availability, reaches fleet", async ({
    page,
  }) => {
    const errors = await consoleErrors(page);
    const failed = await failedRequests(page);
    await page.goto("/book/kivo-drive");

    const pickupDate = page.locator("#pickup-date");
    const pickupTime = page.locator("#pickup-time");
    const returnDate = page.locator("#return-date");
    const returnTime = page.locator("#return-time");
    await expect(pickupDate, "pickup date input renders (catalog loaded, rental step)").toBeVisible({
      timeout: 30_000,
    });

    // Through browser events only — no React state mutation.
    const pd = ymdPlusDays(2);
    const rd = ymdPlusDays(4);
    await pickupDate.fill(pd);
    await pickupTime.fill("09:00");
    await returnDate.fill(rd);
    await returnTime.fill("09:00");

    // DOM holds what was typed (guards the values-only-in-DOM question:
    // if React reverted them, these assertions fail here, not later).
    await expect(pickupDate).toHaveValue(pd);
    await expect(pickupTime).toHaveValue("09:00");
    await expect(returnDate).toHaveValue(rd);
    await expect(returnTime).toHaveValue("09:00");

    // Each required error clears as its field becomes valid.
    await expect(page.getByText("Pick-up date is required.")).toHaveCount(0);
    await expect(page.getByText("Pick-up time is required.")).toHaveCount(0);
    await expect(page.getByText("Return date is required.")).toHaveCount(0);
    await expect(page.getByText("Return time is required.")).toHaveCount(0);

    const check = page.getByRole("button", { name: "Check availability" });
    await expect(check, "Check availability enables once the interval is valid").toBeEnabled();
    await check.click();

    await expect(
      page.getByRole("heading", { name: "Choose your vehicle" }),
      "vehicle step renders after availability search",
    ).toBeVisible({ timeout: 30_000 });

    expect(errors.filter((m) => !m.includes("favicon")), "no console/page errors").toEqual([]);
    expect(failed, "no failed sub-requests (chunks, RSC, API)").toEqual([]);
  });
});

test.describe("test-business catalog (failure 2)", () => {
  test("Mens Haircut service loads for anonymous customers", async ({ page }) => {
    test.skip(!IS_LIVE, "test-business is production seed data, not present locally");
    await page.goto("/book/test-business");
    await expect(
      page.getByText(/mens haircut/i),
      "active Mens Haircut service renders (catalog + services query healthy)",
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/couldn't load this business/i)).toHaveCount(0);
  });

  test("public catalog API returns services without embed drift", async ({ request }) => {
    test.skip(!IS_LIVE, "test-business is production seed data, not present locally");
    const res = await request.get("/api/public/businesses/test-business");
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { services?: Array<{ name?: string }> };
    expect(
      (body.services ?? []).some((s) => /haircut/i.test(s.name ?? "")),
      "API payload contains a haircut service",
    ).toBe(true);
  });
});

test.describe("invalid business IDs never fall back (failure 3)", () => {
  test("all-zero business ID does not render Test Business", async ({ page }) => {
    const ZERO = "00000000-0000-0000-0000-000000000000";
    const res = await page.goto(`/settings?business=${ZERO}`);
    if (!STORAGE_STATE) {
      // Anonymous: must redirect to login, and must not render any business.
      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByText("Test Business", { exact: true })).toHaveCount(0);
      return;
    }
    // Authenticated: supplied-but-unowned id is a 404, never Test Business.
    expect(res?.status(), "invalid business id returns 404").toBe(404);
    await expect(page.getByText("Test Business", { exact: true })).toHaveCount(0);
  });
});

test.describe("manual booking drawer (failure 4)", () => {
  test("new=1 renders the manual-booking UI for an owned business", async ({ page }) => {
    if (!STORAGE_STATE) {
      const res = await page.goto("/dashboard/bookings?new=1");
      expect(res?.status()).toBe(200);
      await expect(page, "anonymous new=1 redirects to login").toHaveURL(/\/login/);
      return;
    }
    // Self-bootstrap an owned business id from the dashboard switcher.
    await page.goto("/dashboard");
    const businessLink = page.locator('a[href*="/dashboard?business="]').first();
    await expect(businessLink).toBeVisible({ timeout: 30_000 });
    const href = (await businessLink.getAttribute("href")) ?? "";
    const businessId = new URL(href, BASE_URL).searchParams.get("business");
    expect(businessId, "owned business id discovered").toBeTruthy();

    await page.goto(`/dashboard/bookings?business=${businessId}&new=1`);
    await expect(page.getByRole("heading", { name: "New booking" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.getByRole("button", { name: "Confirm booking" }),
      "Confirm booking control exists",
    ).toBeVisible();
  });
});

test.describe("invalid resources return real 404s (failure 5)", () => {
  for (const path of [
    "/business/definitely-not-a-real-business-xyz",
    "/book/definitely-not-a-real-business-xyz",
    "/manage/definitely-not-a-real-token-xyz",
  ]) {
    test(`GET ${path} returns HTTP 404`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status(), `${path} must be a real 404, not 200-with-404-text`).toBe(404);
    });
  }
});
