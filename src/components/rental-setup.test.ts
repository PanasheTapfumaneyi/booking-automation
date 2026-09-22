/**
 * Rental setup UX contracts (source-level guards).
 *
 * Pins the intuitive rental flow without rendering components:
 * - dashboard hides the Services CRUD in rental mode and edits cars
 *   with rates, specs, photos and delete
 * - onboarding stores the daily rate on the resource (not the service)
 * - fleet cards price per car with period breakdowns and photo lightbox
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function src(relative: string): string {
  return readFileSync(join(root, "src", relative), "utf8");
}

describe("rental dashboard", () => {
  it("hides the Services CRUD in rental mode", () => {
    const form = src("components/SettingsForm.tsx");
    expect(form).toContain('mode !== "resource"');
  });

  it("edits cars with daily, weekly and monthly rates", () => {
    const form = src("components/SettingsForm.tsx");
    expect(form).toContain("Daily rate in rupees");
    expect(form).toContain("Weekly rate in rupees");
    expect(form).toContain("Monthly rate in rupees");
    expect(form).toContain("daily_rate: editDaily.trim()");
    expect(form).toContain("weekly_rate: editWeekly.trim()");
    expect(form).toContain("monthly_rate: editMonthly.trim()");
  });

  it("edits car specs and type", () => {
    const form = src("components/SettingsForm.tsx");
    expect(form).toContain("RESOURCE_TYPES");
    expect(form).toContain("editSeats");
    expect(form).toContain("editTransmission");
    expect(form).toContain("editFuel");
    expect(form).toContain("editCategory");
  });

  it("manages car photos with upload, URL paste, cover and reorder", () => {
    const photos = src("components/ResourcePhotos.tsx");
    expect(photos).toContain('"resource"');
    expect(photos).toContain("Set as cover");
    expect(photos).toContain("Add URL");
    expect(photos).toContain("Upload photos");
    const form = src("components/SettingsForm.tsx");
    expect(form).toContain("ResourcePhotos");
  });

  it("supports deleting a rental item with two-tap confirm", () => {
    const form = src("components/SettingsForm.tsx");
    expect(form).toContain("Confirm delete");
    expect(form).toContain("deleteResourceItem");
    expect(form).toContain("Deactivate");
  });

  it("shows a per-row price recap", () => {
    const form = src("components/SettingsForm.tsx");
    expect(form).toContain("resourcePriceSummary");
    expect(form).toContain("No daily rate set");
  });
});

describe("rental onboarding", () => {
  it("stores the daily rate on the resource, not the service", () => {
    const flow = src("components/OnboardingFlow.tsx");
    expect(flow).toContain("daily_rate: price.trim()");
    expect(flow).toContain("weekly_rate: weeklyPrice.trim()");
    expect(flow).toContain("monthly_rate: monthlyPrice.trim()");
  });

  it("labels the rate per day, never per rental", () => {
    const flow = src("components/OnboardingFlow.tsx");
    expect(flow).toContain("Daily rate (Rs)");
    expect(flow).not.toContain("per rental");
  });
});

describe("rental fleet cards", () => {
  it("prices each car independently with a contact fallback", () => {
    const flow = src("components/BookingFlow.tsx");
    expect(flow).toContain("Contact for price");
    expect(flow).toContain("readWeeklyRate");
    expect(flow).toContain("readMonthlyRate");
  });

  it("shows period breakdowns and a photo lightbox", () => {
    const flow = src("components/BookingFlow.tsx");
    expect(flow).toContain("formatBreakdown");
    expect(flow).toContain("breakdownRentalTotal");
    expect(flow).toContain("GalleryLightbox");
    expect(flow).toContain("setLightbox");
  });

  it("business page fleets rate per car with week/month lines", () => {
    const page = src("app/business/[slug]/page.tsx");
    expect(page).toContain("weekly_rate");
    expect(page).toContain("monthly_rate");
    expect(page).toContain("Contact for price");
    expect(page).toContain("+{extraPhotos}");
  });
});

describe("rental storage + engine wiring", () => {
  it("media pipeline accepts the resource slot", () => {
    expect(src("lib/server/storefront.ts")).toContain('"resource"');
    expect(src("components/storefront/MediaField.tsx")).toContain('"resource"');
    expect(src("components/storefront/api.ts")).toContain('"resource"');
  });

  it("availability selects images for the fleet", () => {
    const engine = src("lib/server/strategies/resource.ts");
    expect(engine).toContain("images");
  });
});
