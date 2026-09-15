/**
 * Storefront shared-config tests: presets stay readable, the contrast
 * gate behaves, and the client/server vocabularies match.
 */
import { describe, it, expect } from "vitest";
import {
  ACCENT_PRESETS,
  STOREFRONT_AMENITIES,
  contrastAgainstWhite,
  isReadableAccent,
  isStorefrontCategory,
} from "./storefront-config";

describe("accent presets", () => {
  it("every preset keeps white text comfortably readable", () => {
    for (const preset of ACCENT_PRESETS) {
      const ratio = contrastAgainstWhite(preset.value);
      expect(ratio, preset.name).not.toBeNull();
      expect(ratio as number, preset.name).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("rejects malformed colours", () => {
    expect(contrastAgainstWhite("blue")).toBeNull();
    expect(contrastAgainstWhite("#12345")).toBeNull();
    expect(isReadableAccent("#F5F5F5")).toBe(false);
    expect(isReadableAccent("#15547D")).toBe(true);
  });
});

describe("controlled vocabularies", () => {
  it("categories match the server allowlist", () => {
    expect(isStorefrontCategory("barber")).toBe(true);
    expect(isStorefrontCategory("yacht_club")).toBe(false);
    expect(isStorefrontCategory(null)).toBe(false);
  });

  it("amenities list is stable and compact", () => {
    expect(STOREFRONT_AMENITIES).toContain("Wi-Fi");
    expect(STOREFRONT_AMENITIES.length).toBeLessThanOrEqual(12);
  });
});
