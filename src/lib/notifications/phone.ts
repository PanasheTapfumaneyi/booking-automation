/**
 * Canonical E.164 phone normalization for notification destinations.
 *
 * Independent from `database.ts::normalizePhone` (which only strips
 * non-digits for customer matching). This module decides how an arbitrary
 * user-supplied number becomes a canonical, internationally dialable number
 * (e.g. `+23057123456`) that is stored in `notifications.destination` and fed
 * to providers.
 *
 * Policy:
 *  - an explicit `+` keeps the provided country code;
 *  - a Mauritius mobile number given locally (8 digits starting with `5`)
 *    gets the `+230` country code;
 *  - a national number already carrying the `230` country code is left intact;
 *  - anything else 9–15 digits long is treated as already containing a country
 *    code and returned unchanged (international numbers are preserved — we
 *    never blindly prepend `+230`).
 */

/** Raised when a value cannot be interpreted as an E.164 number. */
export class InvalidPhoneError extends Error {
  constructor(phone: string) {
    super(`Invalid phone number: ${JSON.stringify(phone)}`);
    this.name = "InvalidPhoneError";
  }
}

/** Digits only, preserving an explicit leading `+` marker. */
function extractDigitString(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    return `+${digits}`;
  }
  return trimmed.replace(/\D/g, "");
}

export function isValidE164(digits: string): boolean {
  if (!/^[1-9][0-9]{7,14}$/.test(digits)) return false;
  return digits.length >= 8 && digits.length <= 15;
}

/**
 * Normalizes `phone` to a canonical E.164 string, or throws
 * `InvalidPhoneError` when it cannot be interpreted reliably.
 */
export function toE164(phone: string): string {
  const value = extractDigitString(phone.trim());

  // Explicit international notation: "+5700 0000" style.
  if (value.startsWith("+")) {
    const digits = value.slice(1);
    if (!isValidE164(digits)) throw new InvalidPhoneError(phone);
    return value;
  }

  // Mauritius mobile number in local form: 8 digits starting with 5.
  if (/^[5-7][0-9]{7}$/.test(value)) {
    return `+230${value}`;
  }

  // National number that already carries the +230 country code.
  if (/^230[0-9]{8}$/.test(value)) {
    return `+${value}`;
  }

  // Otherwise the number must already include its country code.
  if (isValidE164(value)) {
    return `+${value}`;
  }

  throw new InvalidPhoneError(phone);
}

/** True when `phone` can be normalized to a canonical E.164 value. */
export function isNotifiablePhone(phone: string): boolean {
  try {
    toE164(phone);
    return true;
  } catch {
    return false;
  }
}