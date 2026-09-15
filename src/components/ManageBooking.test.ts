/**
 * ManageBooking tenant-context regression tests (Bug pass 2, issue 1).
 *
 * "Book a different session" / "Book again" must resolve to the booking's
 * OWN business page (/book/<slug-from-manage-token>), never a hard-coded
 * tenant. These tests pin the source contract:
 *
 * 1. No hard-coded `href="/book"` remains in the manage component.
 * 2. The re-booking destination is built from the token-scoped booking's
 *    `businessSlug` (enriched server-side in withBusinessContext).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function src(relative: string): string {
  return readFileSync(join(root, "src", relative), "utf8");
}

describe("manage — re-booking stays on the booking's own tenant", () => {
  it("has no hard-coded href=\"/book\" fallback", () => {
    const page = src("components/ManageBooking.tsx");
    expect(page).not.toContain('href="/book"');
  });

  it("builds the destination from the token-scoped businessSlug", () => {
    const page = src("components/ManageBooking.tsx");
    expect(page).toContain("businessSlug");
    expect(page).toContain("`/book/${booking.businessSlug}`");
  });

  it("renders no re-booking link when the business has no public slug", () => {
    const page = src("components/ManageBooking.tsx");
    // Null slug => null href => conditional render, never another tenant.
    expect(page).toContain("bookAgainHref");
    expect(page).toContain("{bookAgainHref && (");
  });

  it("the Booking type carries the enriched slug", () => {
    const types = src("types/booking.ts");
    expect(types).toContain("businessSlug");
  });

  it("withBusinessContext attaches the slug from the business row", () => {
    const service = src("lib/server/booking-service.ts");
    expect(service).toContain("businessSlug: business.slug");
  });
});
