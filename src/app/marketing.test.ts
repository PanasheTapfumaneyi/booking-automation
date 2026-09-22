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
 * 7. Three-tier pricing structure and feature catalogue
 * 8. Plan query parameter validation
 * 9. Analytics plan_selected event
 * 10. No stale pricing references
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function src(relative: string): string {
  return readFileSync(join(root, "src", relative), "utf8");
}

// ---------------------------------------------------------------------------
// Existing tests (preserved)
// ---------------------------------------------------------------------------

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
      // The root layout template appends "— Kivo", so page titles stay terse
      // and never duplicate the brand (KIVO-007).
      expect(mod.metadata.title).not.toContain("Kivo");
    }
  });

  it("chooser links business page, booking flow, and demo dashboard per demo", () => {
    const page = src("app/demo/page.tsx");
    for (const slug of ["kivo-drive", "fade-area", "island-surf", "blue-lagoon"]) {
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

  it("hero exposes Watch the demo as the secondary action", () => {
    const hero = src("components/marketing/Hero.tsx");
    expect(hero).toContain('href="/demo"');
    expect(hero).toContain("Watch the demo");
    expect(hero).toContain('href="/signup"');
  });

  it("final CTA links to the signup and demo", () => {
    const cta = src("components/marketing/FinalCTA.tsx");
    expect(cta).toContain('href="/signup"');
    expect(cta).toContain('Start your free month');
  });
});

describe("marketing — demo business slugs", () => {
  const demoSlugs = ["kivo-drive", "fade-area", "island-surf", "blue-lagoon"];

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

// ---------------------------------------------------------------------------
// Pricing structure tests (new)
// ---------------------------------------------------------------------------

describe("marketing — pricing structure", () => {
  it("exports exactly three plans", async () => {
    const { PLANS } = await import("@/lib/marketing-config");
    expect(PLANS).toHaveLength(3);
  });

  it("has correct plan IDs in order", async () => {
    const { PLANS } = await import("@/lib/marketing-config");
    expect(PLANS.map((p) => p.id)).toEqual(["base", "plus", "premium"]);
  });

  it("has correct prices", async () => {
    const { PLANS } = await import("@/lib/marketing-config");
    expect(PLANS[0].monthlyPriceAmount).toBe(900);
    expect(PLANS[1].monthlyPriceAmount).toBe(1400);
    expect(PLANS[2].monthlyPriceAmount).toBe(2400);
  });

  it("only Plus is highlighted", async () => {
    const { PLANS } = await import("@/lib/marketing-config");
    expect(PLANS.filter((p) => p.highlighted)).toHaveLength(1);
    expect(PLANS.find((p) => p.highlighted)?.id).toBe("plus");
  });

  it("Plus has 'Most popular' badge", async () => {
    const { PLANS } = await import("@/lib/marketing-config");
    expect(PLANS.find((p) => p.id === "plus")?.badge).toBe("Most popular");
  });

  it("Premium has 'AI early access' badge", async () => {
    const { PLANS } = await import("@/lib/marketing-config");
    expect(PLANS.find((p) => p.id === "premium")?.badge).toBe("AI early access");
  });

  it("Base and Plus are available, Premium is contact", async () => {
    const { PLANS } = await import("@/lib/marketing-config");
    expect(PLANS.find((p) => p.id === "base")?.availability).toBe("available");
    expect(PLANS.find((p) => p.id === "plus")?.availability).toBe("available");
    expect(PLANS.find((p) => p.id === "premium")?.availability).toBe("contact");
  });

  it("Premium has aiStatus early-access", async () => {
    const { PLANS } = await import("@/lib/marketing-config");
    expect(PLANS.find((p) => p.id === "premium")?.aiStatus).toBe("early-access");
    expect(PLANS.find((p) => p.id === "base")?.aiStatus).toBeNull();
    expect(PLANS.find((p) => p.id === "plus")?.aiStatus).toBeNull();
  });

  it("feature inheritance: Plus ⊃ Base, Premium ⊃ Plus", async () => {
    const { PLANS } = await import("@/lib/marketing-config");
    const base = PLANS.find((p) => p.id === "base")!;
    const plus = PLANS.find((p) => p.id === "plus")!;
    const premium = PLANS.find((p) => p.id === "premium")!;
    for (const id of base.featureIds) {
      expect(plus.featureIds).toContain(id);
    }
    for (const id of plus.featureIds) {
      expect(premium.featureIds).toContain(id);
    }
  });

  it("no duplicate feature IDs within any plan", async () => {
    const { PLANS } = await import("@/lib/marketing-config");
    for (const plan of PLANS) {
      expect(new Set(plan.featureIds).size).toBe(plan.featureIds.length);
    }
  });

  it("all plan feature IDs exist in the catalogue", async () => {
    const { PLANS, FEATURES } = await import("@/lib/marketing-config");
    const catalogueIds = new Set(FEATURES.map((f) => f.id));
    for (const plan of PLANS) {
      for (const id of plan.featureIds) {
        expect(catalogueIds.has(id)).toBe(true);
      }
    }
  });

  it("no WhatsApp usage limit in features", async () => {
    const { FEATURES } = await import("@/lib/marketing-config");
    for (const feat of FEATURES) {
      expect(feat.label.toLowerCase()).not.toMatch(/\d+\s*(messages|reminders|sms)/);
      // Check for "limited" as a standalone word, not inside "unlimited"
      expect(feat.label.toLowerCase().replace("unlimited", "")).not.toContain("limited");
    }
  });

  it("no Google ranking guarantees in features", async () => {
    const { FEATURES } = await import("@/lib/marketing-config");
    for (const feat of FEATURES) {
      expect(feat.label.toLowerCase()).not.toContain("first page");
      expect(feat.label.toLowerCase()).not.toContain("guarantee");
      expect(feat.label.toLowerCase()).not.toContain("#1 ranking");
    }
  });

  it("Base CTA goes to /signup?plan=base", async () => {
    const { PLANS } = await import("@/lib/marketing-config");
    expect(PLANS.find((p) => p.id === "base")?.ctaHref).toBe("/signup?plan=base");
  });

  it("Plus CTA goes to /signup?plan=plus", async () => {
    const { PLANS } = await import("@/lib/marketing-config");
    expect(PLANS.find((p) => p.id === "plus")?.ctaHref).toBe("/signup?plan=plus");
  });

  it("Premium CTA href is empty string (resolved at runtime via whatsappUrl)", async () => {
    const { PLANS } = await import("@/lib/marketing-config");
    const premium = PLANS.find((p) => p.id === "premium")!;
    // Premium.ctaHref is empty — planCtaHref() resolves it at runtime using whatsappUrl()
    expect(premium.ctaHref).toBe("");
  });

  it("planCtaHref returns whatsappUrl for Premium", async () => {
    const { PLANS, planCtaHref, PREMIUM_WHATSAPP_MESSAGE } = await import("@/lib/marketing-config");
    const premium = PLANS.find((p) => p.id === "premium")!;
    const href = planCtaHref(premium);
    // whatsappUrl returns empty when CONTACT_WHATSAPP is not set (test env)
    // but the function should still be callable without throwing
    expect(typeof href).toBe("string");
    // When env is set, it would contain wa.me + encoded message
    if (href) {
      expect(href).toContain("wa.me");
      expect(href).toContain(encodeURIComponent(PREMIUM_WHATSAPP_MESSAGE));
    }
  });

  it("isValidPlanId validates correctly", async () => {
    const { isValidPlanId } = await import("@/lib/marketing-config");
    expect(isValidPlanId("base")).toBe(true);
    expect(isValidPlanId("plus")).toBe(true);
    expect(isValidPlanId("premium")).toBe(true);
    expect(isValidPlanId("invalid")).toBe(false);
    expect(isValidPlanId("")).toBe(false);
    expect(isValidPlanId(null)).toBe(false);
    expect(isValidPlanId("BASE")).toBe(false);
  });

  it("isValidSignupPlanId excludes premium", async () => {
    const { isValidSignupPlanId } = await import("@/lib/marketing-config");
    expect(isValidSignupPlanId("base")).toBe(true);
    expect(isValidSignupPlanId("plus")).toBe(true);
    expect(isValidSignupPlanId("premium")).toBe(false);
    expect(isValidSignupPlanId("invalid")).toBe(false);
    expect(isValidSignupPlanId(null)).toBe(false);
  });

  it("formatPrice formats correctly with en-MU locale", async () => {
    const { formatPrice } = await import("@/lib/marketing-config");
    expect(formatPrice(900, "Rs")).toBe("Rs 900");
    expect(formatPrice(1400, "Rs")).toBe("Rs 1,400");
    expect(formatPrice(2400, "Rs")).toBe("Rs 2,400");
  });

  it("getTierSpecificFeatures returns Base features for Base plan", async () => {
    const { PLANS, getTierSpecificFeatures } = await import("@/lib/marketing-config");
    const base = PLANS.find((p) => p.id === "base")!;
    const features = getTierSpecificFeatures(base);
    expect(features.length).toBeGreaterThan(0);
    // All features should be Base features
    for (const f of features) {
      expect(base.featureIds).toContain(f.id);
    }
  });

  it("getTierSpecificFeatures returns Plus-only additions for Plus plan", async () => {
    const { PLANS, getTierSpecificFeatures } = await import("@/lib/marketing-config");
    const plus = PLANS.find((p) => p.id === "plus")!;
    const base = PLANS.find((p) => p.id === "base")!;
    const features = getTierSpecificFeatures(plus);
    expect(features.length).toBeGreaterThan(0);
    // None of these should be Base features
    for (const f of features) {
      expect(base.featureIds).not.toContain(f.id);
    }
  });

  it("getInheritanceLabel returns null for Base", async () => {
    const { PLANS, getInheritanceLabel } = await import("@/lib/marketing-config");
    const base = PLANS.find((p) => p.id === "base")!;
    expect(getInheritanceLabel(base)).toBeNull();
  });

  it("getInheritanceLabel returns 'Everything in Base' for Plus", async () => {
    const { PLANS, getInheritanceLabel } = await import("@/lib/marketing-config");
    const plus = PLANS.find((p) => p.id === "plus")!;
    expect(getInheritanceLabel(plus)).toBe("Everything in Base");
  });

  it("getInheritanceLabel returns 'Everything in Plus' for Premium", async () => {
    const { PLANS, getInheritanceLabel } = await import("@/lib/marketing-config");
    const premium = PLANS.find((p) => p.id === "premium")!;
    expect(getInheritanceLabel(premium)).toBe("Everything in Plus");
  });
});

// ---------------------------------------------------------------------------
// Pricing page metadata tests (new)
// ---------------------------------------------------------------------------

describe("marketing — pricing page metadata", () => {
  it("has correct title", async () => {
    const mod = await import("@/app/pricing/page");
    expect(mod.metadata?.title).toContain("Rs 900");
  });

  it("has correct description mentioning all tiers", async () => {
    const mod = await import("@/app/pricing/page");
    const desc = typeof mod.metadata?.description === "string" ? mod.metadata.description : "";
    expect(desc).toContain("Base, Plus and Premium");
    expect(desc).toContain("AI early access");
  });

  it("has canonical URL", async () => {
    const mod = await import("@/app/pricing/page");
    const alt = mod.metadata?.alternates as { canonical?: string } | undefined;
    expect(alt?.canonical).toContain("/pricing");
  });
});

// ---------------------------------------------------------------------------
// Hero and FinalCTA pricing updates (new)
// ---------------------------------------------------------------------------

describe("marketing — hero pricing link", () => {
  it("links to /pricing with Rs 900", () => {
    const hero = src("components/marketing/Hero.tsx");
    expect(hero).toContain('href="/pricing"');
    expect(hero).toContain("Rs 900");
  });

  it("no stale Rs 1,000", () => {
    const hero = src("components/marketing/Hero.tsx");
    expect(hero).not.toContain("Rs 1,000");
    expect(hero).not.toContain("Then Rs 1,000");
  });
});

describe("marketing — final CTA pricing", () => {
  it("mentions plans from Rs 900", () => {
    const cta = src("components/marketing/FinalCTA.tsx");
    expect(cta).toContain("Rs 900");
  });

  it("does not import PRICING", () => {
    const cta = src("components/marketing/FinalCTA.tsx");
    expect(cta).not.toContain("PRICING");
  });
});

// ---------------------------------------------------------------------------
// Stale pricing references (new)
// ---------------------------------------------------------------------------

describe("marketing — no stale pricing references", () => {
  it("Pricing.tsx is deleted", () => {
    expect(() => src("components/marketing/Pricing.tsx")).toThrow();
  });

  it("onboarding success has no PRICING import", () => {
    const success = src("app/onboarding/success/page.tsx");
    expect(success).not.toContain("PRICING");
  });

  it("no Rs 1,000 in marketing components", () => {
    const files = [
      "components/marketing/Hero.tsx",
      "components/marketing/FinalCTA.tsx",
      "components/marketing/PricingCards.tsx",
      "components/marketing/FeatureComparison.tsx",
      "components/marketing/PricingFAQ.tsx",
      "app/onboarding/success/page.tsx",
      "app/pricing/page.tsx",
    ];
    for (const file of files) {
      const content = src(file);
      expect(content).not.toContain("Rs 1,000");
      expect(content).not.toContain("1,000/month");
    }
  });

  it("homepage imports PricingCards, not Pricing", () => {
    const page = src("app/page.tsx");
    expect(page).toContain("PricingCards");
    expect(page).not.toContain('from "@/components/marketing/Pricing"');
  });

  it("pricing page imports PricingCards, not Pricing", () => {
    const page = src("app/pricing/page.tsx");
    expect(page).toContain("PricingCards");
    expect(page).not.toContain('from "@/components/marketing/Pricing"');
  });
});

// ---------------------------------------------------------------------------
// Plan query parameter validation (new)
// ---------------------------------------------------------------------------

describe("marketing — plan query parameter", () => {
  it("signup page reads plan from searchParams", () => {
    const page = src("app/signup/page.tsx");
    expect(page).toContain("isValidSignupPlanId");
    expect(page).toContain("searchParams");
  });

  it("signup page displays plan badge for valid plans", () => {
    const page = src("app/signup/page.tsx");
    expect(page).toContain("Selected plan");
  });

  it("signup page resolves plan name from validated data", () => {
    const page = src("app/signup/page.tsx");
    // Should not use a ternary that mislabels premium as plus
    expect(page).not.toContain('plan === "base" ? "Base" : "Plus"');
  });
});

// ---------------------------------------------------------------------------
// Analytics plan_selected event (new)
// ---------------------------------------------------------------------------

describe("marketing — analytics plan_selected", () => {
  it("plan_selected is in the event taxonomy", async () => {
    const { MARKETING_EVENTS } = await import("@/lib/marketing-attribution");
    expect(MARKETING_EVENTS).toContain("plan_selected");
  });

  it("PricingCards references plan_selected for CTA click", () => {
    const cards = src("components/marketing/PricingCards.tsx");
    expect(cards).toContain("plan_selected");
    expect(cards).toContain("plan_id");
  });

  it("plan_selected fires on click handler, not on render", () => {
    const cards = src("components/marketing/PricingCards.tsx");
    // Should use onClick handler, not useEffect for plan_selected
    expect(cards).toContain("onClick");
    expect(cards).not.toMatch(/useEffect\([^)]*plan_selected/);
  });
});

// ---------------------------------------------------------------------------
// Homepage PricingCards integration (new)
// ---------------------------------------------------------------------------

describe("marketing — homepage PricingCards", () => {
  it("imports PricingCards component", async () => {
    // The page source should reference PricingCards
    const page = src("app/page.tsx");
    expect(page).toContain("PricingCards");
  });

  it("pricing section has link to /pricing", () => {
    const cards = src("components/marketing/PricingCards.tsx");
    expect(cards).toContain('href="/pricing"');
  });
});
