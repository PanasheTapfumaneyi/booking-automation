/**
 * Storefront 2.0 dispatch + mode-safety contracts.
 *
 * - Appointment businesses render the new template from existing data
 *   (never gated on a storefront row).
 * - Resource/capacity keep the legacy experience (branches intact).
 * - No tenant is hardcoded into shared components.
 * - Service menu links preselect into the booking flow.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

function src(relative: string): string {
  return readFileSync(join(root, "src", relative), "utf8");
}

function publicSources(): string[] {
  const dir = join(root, "src", "components", "storefront-public");
  return readdirSync(dir)
    .filter(
      (file) =>
        (file.endsWith(".tsx") || file.endsWith(".ts")) && !file.endsWith(".test.ts"),
    )
    .map((file) => readFileSync(join(dir, file), "utf8").toLowerCase());
}

describe("mode dispatch", () => {
  it("appointment renders Storefront 2.0 without a storefront-row gate", () => {
    const page = src("app/business/[slug]/page.tsx");
    expect(page).toContain('business.booking_mode === "appointment"');
    expect(page).toContain("AppointmentStorefront");
    expect(page).toContain("getStorefrontBundle");
    // The bundle (gallery, team, DB reviews) loads BEFORE the mode
    // dispatch so every mode — appointment, resource, capacity — renders
    // the owner's configured content. A regression here silently hides
    // gallery/team/reviews on non-appointment storefronts.
    const dispatchAt = page.indexOf('business.booking_mode === "appointment"');
    const bundleAt = page.indexOf("getStorefrontBundle(");
    expect(bundleAt).toBeGreaterThan(-1);
    expect(bundleAt).toBeLessThan(dispatchAt);
  });

  it("resource and capacity keep their legacy render path", () => {
    const page = src("app/business/[slug]/page.tsx");
    expect(page).toContain("isUnitRatedFleet");
    expect(page).toContain("Upcoming sessions");
    expect(page).toContain("BusinessHero");
    expect(page).toContain("MobileStickyCta");
  });

  it("metadata keeps working titles plus business imagery", () => {
    const page = src("app/business/[slug]/page.tsx");
    expect(page).toContain("Book online");
    expect(page).toContain("cover_image_url");
    expect(page).toContain("logo_url");
  });
});

describe("no hardcoded tenants", () => {
  it("shared storefront code never names a real business", () => {
    for (const content of publicSources()) {
      expect(content).not.toContain("watpo");
      expect(content).not.toContain("fade-area");
      expect(content).not.toContain("kivo-drive");
      expect(content).not.toContain("island-surf");
      expect(content).not.toContain("blue-lagoon");
    }
  });

  it("the dispatching page names no tenant either", () => {
    const page = src("app/business/[slug]/page.tsx").toLowerCase();
    expect(page).not.toContain("watpo");
  });

  it("accent comes from the business theme, never a hardcoded brand", () => {
    const page = src("app/business/[slug]/page.tsx");
    expect(page).toContain("accent: theme.primary");
  });
});

describe("booking handoff", () => {
  it("service rows link with the service preselected", () => {
    const menu = src("components/storefront-public/ServiceMenu.tsx");
    expect(menu).toContain("?service=${service.id}");
  });

  it("the book page forwards the service parameter", () => {
    const page = src("app/book/[slug]/page.tsx");
    expect(page).toContain("initialServiceId");
    expect(page).toContain("query.service");
  });

  it("the booking flow accepts and applies the preselect", () => {
    const flow = src("components/BookingFlow.tsx");
    expect(flow).toContain("initialServiceId?: string");
    expect(flow).toContain('setStep("date")');
  });

  it("unknown service ids fall through to the normal list", () => {
    const flow = src("components/BookingFlow.tsx");
    expect(flow).toContain("Unknown ids fall");
  });
});

describe("reviews honesty", () => {
  it("demo showcase reviews stay demo-scoped, real rows come from the DB", () => {
    const page = src("app/business/[slug]/page.tsx");
    expect(page).toContain("getDemoReviews(slug)");
    const composer = src("components/storefront-public/AppointmentStorefront.tsx");
    expect(composer).toContain("business.is_demo ? demoReviews : dbReviews");
  });
});

describe("legacy storefront content parity", () => {
  it("resource/capacity template renders gallery and team sections", () => {
    const page = src("app/business/[slug]/page.tsx");
    expect(page).toContain("StorefrontGallery");
    expect(page).toContain("StorefrontTeam");
    expect(page).toContain("galleryImages");
    expect(page).toContain("teamMembers");
  });

  it("legacy reviews read owner-managed rows with the demo rule preserved", () => {
    const page = src("app/business/[slug]/page.tsx");
    expect(page).toContain("bundle.reviews");
    expect(page).toContain("business.is_demo === true");
  });

  it("legacy gallery/team/reviews respect visibility flags and empty data", () => {
    const page = src("app/business/[slug]/page.tsx");
    expect(page).toContain("legacyVisible");
    expect(page).toContain("resolveVisibleSections");
    expect(page).toContain("legacyVisible.gallery");
    expect(page).toContain("legacyVisible.team");
    expect(page).toContain("legacyVisible.reviews");
  });
});
