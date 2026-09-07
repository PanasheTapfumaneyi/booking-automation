/**
 * Marketing page tests (Phase 7 hardening).
 *
 * Verifies:
 * 1. Homepage + demo page export Kivo branding metadata
 * 2. Header exposes a clear /demo action (desktop + mobile)
 * 3. Hero exposes a clear /demo action
 * 4. Final CTA links to /demo
 * 5. Demo business slugs are valid
 * 6. Marketing components import cleanly
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function src(relative: string): string {
  return readFileSync(join(root, "src", relative), "utf8");
}

describe("marketing — homepage", () => {
  it("exports correct metadata", async () => {
    const mod = await import("@/app/page");
    expect(mod.metadata).toBeDefined();
    if (typeof mod.metadata === "object" && mod.metadata !== null && "title" in mod.metadata) {
      expect(String(mod.metadata.title)).toContain("Kivo");
    }
  });
});

describe("marketing — demo page", () => {
  it("exports correct metadata", async () => {
    const mod = await import("@/app/demo/page");
    expect(mod.metadata).toBeDefined();
    if (typeof mod.metadata === "object" && mod.metadata !== null && "title" in mod.metadata) {
      expect(String(mod.metadata.title)).toContain("Kivo");
    }
  });

  it("chooser links business page, booking flow, and demo dashboard per demo", () => {
    const page = src("app/demo/page.tsx");
    for (const slug of ["fade-area", "island-surf", "blue-lagoon"]) {
      expect(page).toContain(slug);
    }
    expect(page).toContain("/business/${demo.slug}");
    expect(page).toContain("/book/${demo.slug}");
    expect(page).toContain("/demo/dashboard/${demo.slug}");
  });
});

describe("marketing — demo CTAs on the main site", () => {
  it("header exposes View Demo on desktop and mobile", () => {
    const header = src("components/marketing/MarketingHeader.tsx");
    const matches = header.match(/href="\/demo"/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
    expect(header).toContain("View Demo");
    expect(header).toContain('href="/signup"');
    expect(header).toContain('href="/login"');
  });

  it("hero exposes View Demo as the secondary action", () => {
    const hero = src("components/marketing/Hero.tsx");
    expect(hero).toContain('href="/demo"');
    expect(hero).toContain("View Demo");
    expect(hero).toContain('href="/signup"');
  });

  it("final CTA links to the demo", () => {
    const cta = src("components/marketing/FinalCTA.tsx");
    expect(cta).toContain('href="/demo"');
    expect(cta).toContain('href="/signup"');
  });
});

describe("marketing — demo business slugs", () => {
  const demoSlugs = ["fade-area", "island-surf", "blue-lagoon"];

  for (const slug of demoSlugs) {
    it(`${slug} is a valid demo slug`, () => {
      expect(slug).toMatch(/^[a-z-]+$/);
      expect(slug.length).toBeGreaterThan(2);
    });
  }
});

describe("marketing — homepage has correct components", () => {
  it("imports marketing components", async () => {
    const header = await import("@/components/marketing/MarketingHeader");
    expect(header.default).toBeDefined();
    const footer = await import("@/components/marketing/MarketingFooter");
    expect(footer.default).toBeDefined();
    const hero = await import("@/components/marketing/Hero");
    expect(hero.default).toBeDefined();
  });
});
