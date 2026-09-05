import { randomBytes } from "node:crypto";

/**
 * Booking management token.
 *
 * Cryptographically random (18 bytes ≈ 144 bits), URL-safe, unique-enforced
 * by the database (`manage_token` unique constraint). Tokens never encode
 * booking/customer IDs and are the sole authorization for public booking
 * management. Shared by all booking modes.
 */
export function generateManageToken(): string {
  return randomBytes(18).toString("base64url");
}