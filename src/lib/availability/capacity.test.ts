import { describe, it, expect } from "vitest";
import {
  hasRemainingCapacity,
  remainingCapacity,
  clampQuantity,
} from "./capacity";

describe("capacity helpers", () => {
  describe("hasRemainingCapacity", () => {
    it("allows exactly the remaining quantity", () => {
      expect(hasRemainingCapacity(10, 7, 3)).toBe(true);
    });

    it("rejects one over the remaining quantity", () => {
      expect(hasRemainingCapacity(10, 7, 4)).toBe(false);
    });

    it("rejects any quantity when the session is full", () => {
      expect(hasRemainingCapacity(10, 10, 1)).toBe(false);
    });
  });

  describe("remainingCapacity", () => {
    it("never returns a negative number", () => {
      expect(remainingCapacity(5, 9)).toBe(0);
    });

    it("returns the difference", () => {
      expect(remainingCapacity(10, 3)).toBe(7);
    });
  });

  describe("clampQuantity", () => {
    it("keeps a valid in-range quantity unchanged", () => {
      expect(clampQuantity(4, 10)).toBe(4);
    });

    it("clamps down to the remaining seats", () => {
      expect(clampQuantity(12, 10)).toBe(10);
    });

    it("floors at one guest (never zero)", () => {
      expect(clampQuantity(0, 10)).toBe(1);
      expect(clampQuantity(-3, 10)).toBe(1);
    });

    it("returns one when no capacity is shown yet", () => {
      expect(clampQuantity(5, 0)).toBe(5);
    });

    it("sanitizes non-finite input", () => {
      expect(clampQuantity(Number.NaN, 10)).toBe(1);
      expect(clampQuantity(Number.POSITIVE_INFINITY, 10)).toBe(1);
    });
  });
});