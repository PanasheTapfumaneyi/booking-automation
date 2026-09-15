/**
 * Marketing instrumentation contract tests (source-level guards).
 *
 * Every major CTA must emit its taxonomy event with the location that
 * identifies WHICH placement was clicked — otherwise the admin "top CTA
 * locations" view silently loses coverage. These tests pin each call
 * site without rendering components.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

function src(relative: string): string {
  return readFileSync(join(root, "src", relative), "utf8");
}

function expectEmits(file: string, event: string, location: string): void {
  const content = src(file);
  expect(content).toContain(`"${event}"`);
  expect(content).toContain(`cta_location: "${location}"`);
}

describe("start_free_clicked locations", () => {
  it("hero", () => expectEmits("components/marketing/Hero.tsx", "start_free_clicked", "hero"));
  it("header", () =>
    expectEmits("components/marketing/MarketingHeader.tsx", "start_free_clicked", "header"));
  it("pricing", () =>
    expectEmits("components/marketing/Pricing.tsx", "start_free_clicked", "pricing"));
  it("final_cta", () =>
    expectEmits("components/marketing/FinalCTA.tsx", "start_free_clicked", "final_cta"));
  it("footer", () =>
    expectEmits("components/marketing/MarketingFooter.tsx", "start_free_clicked", "footer"));
});

describe("contact_clicked locations", () => {
  it("header whatsapp", () => {
    const content = src("components/marketing/MarketingHeader.tsx");
    expect(content).toContain('"contact_clicked"');
    expect(content).toContain('contact_type: wa ? "whatsapp" : "section"');
  });
  it("pricing whatsapp", () =>
    expectEmits("components/marketing/Pricing.tsx", "contact_clicked", "pricing"));
  it("final_cta whatsapp", () =>
    expectEmits("components/marketing/FinalCTA.tsx", "contact_clicked", "final_cta"));
  it("footer whatsapp and phone", () => {
    const content = src("components/marketing/MarketingFooter.tsx");
    expect(content).toContain('contact_type: "whatsapp"');
    expect(content).toContain('contact_type: "phone"');
  });
  it("onboarding success and complete pages", () => {
    expectEmits("app/onboarding/success/page.tsx", "contact_clicked", "onboarding_success");
    expectEmits("app/onboarding/complete/page.tsx", "contact_clicked", "complete_page");
  });
});

describe("featured business clicks", () => {
  it("emits slug, category, mode, and both actions", () => {
    const content = src("components/marketing/FeaturedBusinesses.tsx");
    expect(content).toContain('"featured_business_clicked"');
    expect(content).toContain("business_slug: business.slug");
    expect(content).toContain("booking_mode: business.mode");
    expect(content).toContain('action: "book_now"');
    expect(content).toContain('action: "view_business"');
  });
});

describe("section views", () => {
  it("pricing fires once on view", () => {
    const content = src("components/marketing/Pricing.tsx");
    expect(content).toContain("useViewedOnce");
    expect(content).toContain('"pricing_viewed"');
  });

  it("key pages mount a page-view beacon", () => {
    for (const file of [
      "app/page.tsx",
      "app/demo/page.tsx",
      "app/signup/page.tsx",
      "app/login/page.tsx",
    ]) {
      expect(src(file)).toContain("TrackMarketingPageView");
    }
  });

  it("hero secondary action is tracked", () => {
    expectEmits(
      "components/marketing/Hero.tsx",
      "see_how_it_works_clicked",
      "hero",
    );
  });
});

describe("signup and onboarding funnel", () => {
  it("signup submit and success are tracked", () => {
    const content = src("components/LoginForm.tsx");
    expect(content).toContain('"signup_started"');
    expect(content).toContain('"signup_completed"');
  });

  it("setup choice view is tracked", () => {
    expect(src("components/onboarding/ChoiceScreen.tsx")).toContain(
      '"setup_choice_viewed"',
    );
  });

  it("temporary business page click is tracked", () => {
    expectEmits(
      "app/onboarding/complete/page.tsx",
      "temporary_business_page_viewed",
      "complete_page",
    );
  });

  it("server records the reliable funnel steps", () => {
    expect(src("app/api/onboarding/basics/route.ts")).toContain(
      '"business_details_submitted"',
    );
    const choice = src("app/api/onboarding/choice/route.ts");
    expect(choice).toContain('"managed_setup_selected"');
    expect(choice).toContain('"self_setup_selected"');
    expect(choice).toContain('"onboarding_completed"');
    expect(src("app/api/onboarding/complete/route.ts")).toContain(
      '"onboarding_completed"',
    );
  });

  it("funnel steps carry the anonymous browser session through", () => {
    for (const file of [
      "components/onboarding/BasicsForm.tsx",
      "components/onboarding/ChoiceScreen.tsx",
      "components/OnboardingFlow.tsx",
    ]) {
      expect(src(file)).toContain("getMarketingSession");
    }
  });
});

describe("privacy guards in instrumentation", () => {
  it("no instrumented component sends raw form values", () => {
    for (const file of [
      "components/marketing/Hero.tsx",
      "components/marketing/Pricing.tsx",
      "components/LoginForm.tsx",
      "components/onboarding/BasicsForm.tsx",
      "components/onboarding/ChoiceScreen.tsx",
    ]) {
      const content = src(file);
      expect(content).not.toContain("trackMarketingEvent(\"signup_completed\", { email");
    }
  });

  it("booking flows stay out of marketing tracking", () => {
    expect(src("components/BookingFlow.tsx")).not.toContain("trackMarketingEvent");
    expect(src("components/ManageBooking.tsx")).not.toContain("trackMarketingEvent");
  });
});
