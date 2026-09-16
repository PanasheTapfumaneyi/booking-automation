/**
 * Tests for resource-mode copy label helpers.
 *
 * These mirror the functions in BookingFlow.tsx (isVehicleMode, resourceLabel,
 * datesHeading, availabilitySearchLabel) which are pure — we test them
 * directly here as an extracted helper so they can be validated without
 * a component harness.
 */
import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Extracted copies of the helpers from BookingFlow.tsx
// ---------------------------------------------------------------------------

interface ResourceLike {
  resourceType: string;
}

function isVehicleMode(resources: ResourceLike[]): boolean {
  if (resources.length === 0) return false;
  return resources.every((r) => r.resourceType === "vehicle");
}

function resourceLabel(
  resources: ResourceLike[],
  key: "item" | "start" | "end",
): string {
  if (isVehicleMode(resources)) {
    if (key === "item") return "Vehicle";
    if (key === "start") return "Pick-up";
    return "Return";
  }
  if (key === "item") return "Equipment / Item";
  if (key === "start") return "Start";
  return "Return";
}

function datesHeading(resources: ResourceLike[]): string {
  if (isVehicleMode(resources)) return "Pick-up & return";
  return "Start & end dates";
}

function availabilitySearchLabel(resources: ResourceLike[]): string {
  if (isVehicleMode(resources)) return "Search available vehicles";
  return "Search available items";
}

// ---------------------------------------------------------------------------
// Kivo Drive — car rental (vehicle resource type)
// ---------------------------------------------------------------------------

describe("Kivo Drive — car rental copy", () => {
  const carResources: ResourceLike[] = [
    { resourceType: "vehicle" },
    { resourceType: "vehicle" },
  ];

  it("uses Vehicle for the item label", () => {
    expect(resourceLabel(carResources, "item")).toBe("Vehicle");
  });

  it("uses Pick-up for the start label", () => {
    expect(resourceLabel(carResources, "start")).toBe("Pick-up");
  });

  it("uses Return for the end label", () => {
    expect(resourceLabel(carResources, "end")).toBe("Return");
  });

  it("uses 'Pick-up & return' as the dates heading", () => {
    expect(datesHeading(carResources)).toBe("Pick-up & return");
  });

  it("uses 'Search available vehicles' in the search sub-heading", () => {
    expect(availabilitySearchLabel(carResources)).toBe("Search available vehicles");
  });
});

// ---------------------------------------------------------------------------
// Island Surf — equipment rental (non-vehicle resource type)
// ---------------------------------------------------------------------------

describe("Island Surf — equipment rental copy (non-car)", () => {
  const surfResources: ResourceLike[] = [
    { resourceType: "equipment" },
    { resourceType: "equipment" },
  ];

  it("does NOT say 'Vehicle' for the item label", () => {
    expect(resourceLabel(surfResources, "item")).not.toContain("Vehicle");
  });

  it("uses Equipment / Item for the item label", () => {
    expect(resourceLabel(surfResources, "item")).toBe("Equipment / Item");
  });

  it("uses Start (not Pick-up) for the start label", () => {
    expect(resourceLabel(surfResources, "start")).toBe("Start");
    expect(resourceLabel(surfResources, "start")).not.toBe("Pick-up");
  });

  it("uses Return for the end label", () => {
    expect(resourceLabel(surfResources, "end")).toBe("Return");
  });

  it("does NOT say 'Pick-up' in the dates heading", () => {
    expect(datesHeading(surfResources)).not.toContain("Pick-up");
  });

  it("uses 'Start & end dates' as the dates heading", () => {
    expect(datesHeading(surfResources)).toBe("Start & end dates");
  });

  it("does NOT say 'vehicles' in the search label", () => {
    expect(availabilitySearchLabel(surfResources)).not.toContain("vehicle");
  });
});

// ---------------------------------------------------------------------------
// Generic fallback — empty or mixed resource types
// ---------------------------------------------------------------------------

describe("Generic resource fallback copy", () => {
  it("uses neutral copy for empty resource list", () => {
    expect(resourceLabel([], "item")).toBe("Equipment / Item");
    expect(datesHeading([])).toBe("Start & end dates");
  });

  it("uses neutral copy when resource types are mixed (not all vehicle)", () => {
    const mixed: ResourceLike[] = [
      { resourceType: "vehicle" },
      { resourceType: "boat" },
    ];
    expect(isVehicleMode(mixed)).toBe(false);
    expect(resourceLabel(mixed, "item")).toBe("Equipment / Item");
    expect(datesHeading(mixed)).toBe("Start & end dates");
  });

  it("isVehicleMode is true only when ALL resources are vehicles", () => {
    expect(isVehicleMode([{ resourceType: "vehicle" }])).toBe(true);
    expect(isVehicleMode([{ resourceType: "vehicle" }, { resourceType: "vehicle" }])).toBe(true);
    expect(isVehicleMode([{ resourceType: "vehicle" }, { resourceType: "boat" }])).toBe(false);
    expect(isVehicleMode([{ resourceType: "equipment" }])).toBe(false);
    expect(isVehicleMode([])).toBe(false);
  });
});
