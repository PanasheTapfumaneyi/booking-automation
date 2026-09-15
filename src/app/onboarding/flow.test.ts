/**
 * Onboarding flow contract tests (source-level guards).
 *
 * - The operator number is never hard-coded: all WhatsApp-to-Kivo links
 *   go through the central marketing-config helpers.
 * - New businesses are created inactive (public only at `live`).
 * - The marketing CTA still leads into account creation first.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function src(relative: string): string {
  return readFileSync(join(root, "src", relative), "utf8");
}

describe("onboarding — no hard-coded operator number", () => {
  it("the server lib uses the central contact config", () => {
    const lib = src("lib/server/onboarding.ts");
    expect(lib).toContain("CONTACT_WHATSAPP");
    expect(lib).toContain('from "@/lib/marketing-config"');
  });

  it("no literal wa.me link with digits in onboarding code", () => {
    for (const file of [
      "lib/server/onboarding.ts",
      "app/onboarding/success/page.tsx",
      "app/onboarding/complete/page.tsx",
      "components/onboarding/BasicsForm.tsx",
      "components/onboarding/ChoiceScreen.tsx",
      "components/admin/LeadsTable.tsx",
    ]) {
      const content = src(file);
      expect(content).not.toMatch(/wa\.me\/\d/);
    }
  });

  it("success/complete pages build WhatsApp links via whatsappUrl()", () => {
    expect(src("app/onboarding/success/page.tsx")).toContain("whatsappUrl(");
    expect(src("app/onboarding/complete/page.tsx")).toContain("whatsappUrl(");
  });
});

describe("onboarding — inactive by default", () => {
  it("the basics endpoint creates businesses inactive", () => {
    const route = src("app/api/onboarding/basics/route.ts");
    expect(route).toContain("is_active: false");
  });

  it("the admin endpoint is the activation path", () => {
    const route = src("app/api/admin/setup-requests/route.ts");
    expect(route).toContain("setBusinessActive");
  });
});

describe("onboarding — router and marketing entry", () => {
  it("the onboarding page routes by setup state", () => {
    const page = src("app/onboarding/page.tsx");
    expect(page).toContain("BasicsForm");
    expect(page).toContain("ChoiceScreen");
    expect(page).toContain("self_configuring");
    // Existing businesses (no setup row) go to the dashboard, never reclassified.
    expect(page).toContain('if (!setup) redirect("/dashboard")');
  });

  it("marketing CTAs lead to signup first (no premature setup choice)", () => {
    const hero = src("components/marketing/Hero.tsx");
    expect(hero).toContain('href="/signup"');
    expect(hero).toContain("Start free for 1 month");
  });
});
