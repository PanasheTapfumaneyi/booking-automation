import { defineConfig } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

/**
 * Browser interaction suite — replaces the old HTTP-status-only smoke test
 * (which could not see functional failures). Every test drives the page
 * through real browser events (fill/click/navigation); nothing mutates
 * React state directly.
 *
 * - Public tests run against any BASE_URL.
 * - Live-data tests (test-business fixture) run only when E2E_LIVE=1.
 * - Auth tests need E2E_STORAGE_STATE pointing at a logged-in storage
 *   state file; without it they verify the anonymous redirect instead.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["json", { outputFile: "e2e-results.json" }]],
  use: {
    baseURL: BASE_URL,
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
