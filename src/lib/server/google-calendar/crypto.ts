import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const VERSION = "enc:v1:";
const PLAIN_PREFIX = "plain:";

/**
 * Derives a stable 32-byte AES key from GOOGLE_TOKEN_ENCRYPTION_KEY.
 * Any reasonably long string is accepted; sha256 stretches it to the exact
 * key size AES-256 requires.
 */
function getEncryptionKey(): Buffer | null {
  const secret = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!secret || secret.trim().length === 0) return null;
  return createHash("sha256").update(secret, "utf8").digest();
}

/** Encrypts a token string so it is not readable at rest in the DB. */
export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  if (!key) {
    return `${PLAIN_PREFIX}${plaintext}`;
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${VERSION}${Buffer.concat([iv, tag, encrypted]).toString("base64")}`;
}

/** Decrypts a value previously produced by encryptSecret. */
export function readSecret(stored: string): string {
  if (stored.startsWith(PLAIN_PREFIX)) {
    return stored.slice(PLAIN_PREFIX.length);
  }
  if (!stored.startsWith(VERSION)) {
    throw new Error("Unrecognized token storage format.");
  }
  const key = getEncryptionKey();
  if (!key) {
    throw new Error(
      "GOOGLE_TOKEN_ENCRYPTION_KEY is missing but stored tokens are encrypted.",
    );
  }
  const blob = Buffer.from(stored.slice(VERSION.length), "base64");
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const encrypted = blob.subarray(28);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(), // throws on wrong key / tampered data
  ]).toString("utf8");
}

/** Indicates whether at-rest encryption is active (for diagnostics). */
export function isTokenEncryptionEnabled(): boolean {
  return Boolean(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY);
}