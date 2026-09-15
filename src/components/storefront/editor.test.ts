/**
 * Storefront editor contract tests (source-level guards).
 *
 * Pins the Phase 3 architecture without rendering: one data layer (the
 * Phase 2 APIs), shared vocabulary (no drifting client duplicates),
 * per-section saves with dirty gating, and tenant-safe remounting.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function src(relative: string): string {
  return readFileSync(join(root, "src", relative), "utf8");
}

describe("editor structure", () => {
  it("shell renders header, status, public link, and all sections", () => {
    const editor = src("components/storefront/StorefrontEditor.tsx");
    for (const section of [
      "AppearanceSection",
      "ContentSection",
      "GallerySection",
      "TeamSection",
      "SocialSection",
      "AmenitiesSection",
      "VisibilitySection",
      "CompletenessCard",
    ]) {
      expect(editor).toContain(section);
    }
    expect(editor).toContain("View storefront");
    expect(editor).toContain("Inactive");
  });

  it("remounts per business so tenants never leak state", () => {
    const editor = src("components/storefront/StorefrontEditor.tsx");
    expect(editor).toContain("key={business.id}");
    const page = src("app/dashboard/storefront/page.tsx");
    expect(page).toContain("key={business.id}");
  });

  it("shell has a Storefront nav entry", () => {
    const shell = src("components/dashboard/DashboardShell.tsx");
    expect(shell).toContain('"/dashboard/storefront"');
    expect(shell).toContain("Storefront");
  });
});

describe("single data layer", () => {
  it("sections call the Phase 2 APIs through one client module", () => {
    for (const file of [
      "components/storefront/AppearanceSection.tsx",
      "components/storefront/ContentSection.tsx",
      "components/storefront/GallerySection.tsx",
      "components/storefront/TeamSection.tsx",
      "components/storefront/SocialSection.tsx",
      "components/storefront/AmenitiesSection.tsx",
      "components/storefront/VisibilitySection.tsx",
    ]) {
      const content = src(file);
      expect(content).toContain("storefrontApi");
      expect(content).not.toContain("/api/businesses/${businessId}/storefront");
    }
  });

  it("amenities and socials reuse the shared vocabulary", () => {
    expect(src("components/storefront/AmenitiesSection.tsx")).toContain(
      "STOREFRONT_AMENITIES",
    );
    expect(src("components/storefront/SocialSection.tsx")).toContain("SOCIAL_NETWORKS");
    expect(src("components/storefront/AppearanceSection.tsx")).toContain("ACCENT_PRESETS");
    expect(src("components/storefront/ContentSection.tsx")).toContain("STOREFRONT_CATEGORIES");
  });

  it("no direct storage or service-role access from editor code", () => {
    for (const file of [
      "components/storefront/api.ts",
      "components/storefront/MediaField.tsx",
      "components/storefront/GallerySection.tsx",
      "components/storefront/TeamSection.tsx",
    ]) {
      const content = src(file);
      expect(content).not.toContain("service_role");
      expect(content).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
      expect(content).not.toContain(".storage.");
    }
  });
});

describe("save model and safety", () => {
  it("text sections use dirty-gated saves with restrained feedback", () => {
    expect(src("components/storefront/SectionCard.tsx")).toContain("disabled={!dirty");
    for (const file of [
      "components/storefront/ContentSection.tsx",
      "components/storefront/SocialSection.tsx",
      "components/storefront/AmenitiesSection.tsx",
      "components/storefront/VisibilitySection.tsx",
    ]) {
      const content = src(file);
      expect(content).toContain("SectionCard");
      expect(content).toContain("dirty={dirty}");
      expect(content).toContain("Storefront updated.");
    }
  });

  it("media uploads validate before sending", () => {
    const api = src("components/storefront/api.ts");
    expect(api).toContain("5 * 1024 * 1024");
    expect(api).toContain("image/jpeg");
  });

  it("team profiles never wire logins or staff booking", () => {
    const team = src("components/storefront/TeamSection.tsx");
    expect(team).toContain("never creates a login");
    expect(team).not.toContain("requireBusinessOwner");
    expect(team).not.toContain("getMyMemberships");
    expect(team).not.toContain("Book with");
  });

  it("no manual review-entry UI exists", () => {
    const editor = src("components/storefront/StorefrontEditor.tsx");
    expect(editor).not.toMatch(/addReview|createReview|ReviewForm/i);
  });

  it("template selection stays internal (single real template)", () => {
    const editor = src("components/storefront/StorefrontEditor.tsx");
    expect(editor).not.toContain("template");
    const appearance = src("components/storefront/AppearanceSection.tsx");
    expect(appearance).not.toContain("STOREFRONT_TEMPLATES");
  });
});
