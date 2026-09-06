import { describe, it, expect } from "vitest";
import { toE164, isNotifiablePhone, InvalidPhoneError } from "./phone";

describe("toE164", () => {
  it("normalizes a local Mauritius mobile number", () => {
    expect(toE164("57123456")).toBe("+23057123456");
  });

  it("normalizes a local number with formatting noise", () => {
    expect(toE164("5 71 23 456")).toBe("+23057123456");
  });

  it("rejects a local number written with a national leading 0", () => {
    expect(() => toE164("05 71 23 456")).toThrow(InvalidPhoneError);
  });

  it("keeps a national number already carrying the +230 country code", () => {
    expect(toE164("23057123456")).toBe("+23057123456");
  });

  it("keeps an explicit +230 number unchanged", () => {
    expect(toE164("+23057123456")).toBe("+23057123456");
    expect(toE164("+230 57 12 34 56")).toBe("+23057123456");
  });

  it("preserves international numbers (no blind +230 prefix)", () => {
    expect(toE164("+447700900123")).toBe("+447700900123");
    expect(toE164("447700900123")).toBe("+447700900123");
    expect(toE164("+12025550123")).toBe("+12025550123");
    expect(toE164("+971501234567")).toBe("+971501234567");
  });

  it("accepts the minimum and maximum E.164 lengths", () => {
    expect(toE164("+12345678")).toBe("+12345678"); // 8 digits (min)
    expect(toE164("+123456789012345")).toBe("+123456789012345"); // 15 digits (max)
  });

  it("rejects values that are too short to be a local number", () => {
    expect(() => toE164("12345")).toThrow(InvalidPhoneError);
    expect(() => toE164("+234")).toThrow(InvalidPhoneError);
    expect(() => toE164("")).toThrow(InvalidPhoneError);
  });

  it("rejects values that are too long for E.164", () => {
    expect(() => toE164("+230123456789012345")).toThrow(InvalidPhoneError);
  });

  it("rejects a country code beginning with 0 (not a valid E.164 prefix)", () => {
    expect(() => toE164("0571234567")).toThrow(InvalidPhoneError);
  });
});

describe("isNotifiablePhone", () => {
  it("is true for normalizable numbers and false otherwise", () => {
    expect(isNotifiablePhone("57123456")).toBe(true);
    expect(isNotifiablePhone("nope")).toBe(false);
    expect(isNotifiablePhone("+23057123456")).toBe(true);
    expect(isNotifiablePhone("230")).toBe(false);
  });
});