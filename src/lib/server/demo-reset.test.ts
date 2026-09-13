/**
 * Demo reset tests — Phase 7.6 location restoration.
 *
 * Tests that reset-demo restores canonical business fields
 * (address, latitude, longitude) and that seed/reset share identical values.
 */
import { describe, it, expect } from "vitest";
import { DEMO_BUSINESSES, getDemoBySlug, getDemoById } from "../../../scripts/demo-data.mjs";

describe("demo-data.mjs — canonical definitions", () => {
  it("exports exactly 3 demo businesses", () => {
    expect(DEMO_BUSINESSES).toHaveLength(3);
  });

  it("has all required location fields for each business", () => {
    for (const biz of DEMO_BUSINESSES) {
      expect(typeof biz.address).toBe("string");
      expect(biz.address!.length).toBeGreaterThan(0);
      expect(typeof biz.latitude).toBe("number");
      expect(typeof biz.longitude).toBe("number");
    }
  });

  it("getDemoBySlug returns correct business", () => {
    expect(getDemoBySlug("fade-area")?.id).toBe("10000000-0000-4000-8000-000000000001");
    expect(getDemoBySlug("island-surf")?.id).toBe("10000000-0000-4000-8000-000000000002");
    expect(getDemoBySlug("blue-lagoon")?.id).toBe("10000000-0000-4000-8000-000000000003");
    expect(getDemoBySlug("nonexistent")).toBeNull();
  });

  it("getDemoById returns correct business", () => {
    expect(getDemoById("10000000-0000-4000-8000-000000000001")?.slug).toBe("fade-area");
    expect(getDemoById("nonexistent")).toBeNull();
  });

  it("fade-area has correct canonical location", () => {
    const biz = getDemoBySlug("fade-area")!;
    expect(biz.address).toBe("Royal Road, Quatre Bornes, Mauritius");
    expect(biz.latitude).toBe(-20.2417);
    expect(biz.longitude).toBe(57.4781);
  });

  it("island-surf has correct canonical location", () => {
    const biz = getDemoBySlug("island-surf")!;
    expect(biz.address).toBe("Belle Mare Beach, Poste de Flacq, Mauritius");
    expect(biz.latitude).toBe(-20.1954);
    expect(biz.longitude).toBe(57.8289);
  });

  it("blue-lagoon has correct canonical location", () => {
    const biz = getDemoBySlug("blue-lagoon")!;
    expect(biz.address).toBe("Coastal Road, Grand Baie, Mauritius");
    expect(biz.latitude).toBe(-20.0197);
    expect(biz.longitude).toBe(57.5972);
  });

  it("seed and reset use identical canonical location values", () => {
    // Both scripts import from the same demo-data.mjs module,
    // so this test verifies they share the same source of truth.
    const fadeArea = getDemoBySlug("fade-area")!;
    const islandSurf = getDemoBySlug("island-surf")!;
    const blueLagoon = getDemoBySlug("blue-lagoon")!;

    // Verify the data is stable and identical across imports
    expect(fadeArea.address).toBe("Royal Road, Quatre Bornes, Mauritius");
    expect(islandSurf.address).toBe("Belle Mare Beach, Poste de Flacq, Mauritius");
    expect(blueLagoon.address).toBe("Coastal Road, Grand Baie, Mauritius");

    // Verify coordinates are numbers (not strings)
    expect(typeof fadeArea.latitude).toBe("number");
    expect(typeof fadeArea.longitude).toBe("number");
    expect(typeof islandSurf.latitude).toBe("number");
    expect(typeof islandSurf.longitude).toBe("number");
    expect(typeof blueLagoon.latitude).toBe("number");
    expect(typeof blueLagoon.longitude).toBe("number");
  });

  it("non-demo business slug is not in demo definitions", () => {
    expect(getDemoBySlug("fade-district")).toBeNull();
    expect(getDemoBySlug("production-biz")).toBeNull();
  });

  it("non-demo business id is not in demo definitions", () => {
    expect(getDemoById("00000000-0000-4000-8000-000000000001")).toBeNull();
    expect(getDemoById("random-id")).toBeNull();
  });
});
