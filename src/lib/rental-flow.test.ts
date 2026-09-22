import { describe, it, expect } from "vitest";
import {
  rentalEnablementReasons,
  pickPreselectedVehicle,
} from "./rental-flow";

describe("rentalEnablementReasons", () => {
  it("reports every missing field", () => {
    const reasons = rentalEnablementReasons({
      pickupDate: "",
      pickupTime: "",
      returnDate: "",
      returnTime: "",
    });
    expect(reasons).toEqual([
      "Pick-up date is required.",
      "Pick-up time is required.",
      "Return date is required.",
      "Return time is required.",
    ]);
  });

  it("accepts a fully valid interval", () => {
    const reasons = rentalEnablementReasons({
      pickupDate: "2026-10-14",
      pickupTime: "09:00",
      returnDate: "2026-10-16",
      returnTime: "17:00",
    });
    expect(reasons).toEqual([]);
  });

  it("rejects a return date before pickup", () => {
    const reasons = rentalEnablementReasons({
      pickupDate: "2026-10-16",
      pickupTime: "09:00",
      returnDate: "2026-10-14",
      returnTime: "17:00",
    });
    expect(reasons).toContain("Return date can't be before pick-up date.");
  });

  it("rejects a same-day return at or before pickup time", () => {
    const reasons = rentalEnablementReasons({
      pickupDate: "2026-10-14",
      pickupTime: "10:00",
      returnDate: "2026-10-14",
      returnTime: "09:30",
    });
    expect(reasons).toContain("Return time must be after pick-up time.");
  });

  it("does not emit the return-date rule when dates are missing", () => {
    const reasons = rentalEnablementReasons({
      pickupDate: "2026-10-14",
      pickupTime: "09:00",
      returnDate: "",
      returnTime: "",
    });
    expect(reasons).toEqual(["Return date is required.", "Return time is required."]);
  });
});

describe("pickPreselectedVehicle", () => {
  const vehicles = [
    {
      id: "v-vitz",
      name: "Toyota Vitz",
      resourceType: "car",
      active: true,
      available: false,
    },
    {
      id: "v-creta",
      name: "Hyundai Creta",
      resourceType: "car",
      active: true,
      available: true,
      imageUrl: "https://example.test/creta.jpg",
      metadata: { seats: 5 },
    },
  ];

  it("returns null when no deep link was passed", () => {
    expect(pickPreselectedVehicle(vehicles)).toBeNull();
  });

  it("returns null when the deep-linked vehicle is unavailable", () => {
    expect(pickPreselectedVehicle(vehicles, "v-vitz")).toBeNull();
  });

  it("returns the matching available vehicle", () => {
    const picked = pickPreselectedVehicle(vehicles, "v-creta");
    expect(picked).toEqual({
      id: "v-creta",
      name: "Hyundai Creta",
      description: "",
      resourceType: "car",
      imageUrl: "https://example.test/creta.jpg",
      images: [],
      metadata: { seats: 5 },
    });
  });

  it("carries the vehicle description through when present", () => {
    const picked = pickPreselectedVehicle(
      [
        {
          id: "v-creta",
          name: "Hyundai Creta",
          description: "Spacious SUV, great for the coast road.",
          resourceType: "car",
          active: true,
          available: true,
        },
      ],
      "v-creta",
    );
    expect(picked?.description).toBe("Spacious SUV, great for the coast road.");
  });

  it("returns null for an unknown id", () => {
    expect(pickPreselectedVehicle(vehicles, "v-missing")).toBeNull();
  });
});