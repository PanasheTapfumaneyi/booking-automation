/**
 * Notification-settings save contract tests (Bug pass 2, issue 3).
 *
 * Root cause of the production 405: the settings form sent POST to
 * /api/businesses/[id]/notifications, but the route only exports
 * GET + PATCH (partial-update semantics). These tests pin the contract
 * on both sides so client and route can never drift apart again:
 *
 * 1. The route exports GET + PATCH and no POST.
 * 2. The settings form saves notifications with PATCH.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { GET, PATCH } from "./route";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..", "..");

function src(relative: string): string {
  return readFileSync(join(root, "src", relative), "utf8");
}

describe("notifications route — method contract", () => {
  it("exports GET and PATCH handlers", () => {
    expect(typeof GET).toBe("function");
    expect(typeof PATCH).toBe("function");
  });

  it("exports no POST handler (saves go through PATCH)", async () => {
    const mod = (await import("./route")) as unknown as Record<string, unknown>;
    expect(mod.POST).toBeUndefined();
  });
});

describe("settings form — notification save method", () => {
  it("sends PATCH (not the POST default) to the notifications endpoint", () => {
    const form = src("components/SettingsForm.tsx");
    const start = form.indexOf("`/api/businesses/${business.id}/notifications`");
    expect(start).toBeGreaterThan(-1);
    // The requestJson call spanning the endpoint must pass "PATCH".
    const window = form.slice(start, start + 600);
    expect(window).toContain('"PATCH"');
  });

  it("scopes the generic failure message to notification settings", () => {
    const form = src("components/SettingsForm.tsx");
    expect(form).toContain("We couldn't save your notification settings. Please try again.");
  });
});
