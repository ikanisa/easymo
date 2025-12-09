/**
 * Cryptographic utilities for PII encryption and masking
 *
 * This module provides functions for:
 * - AES-256-GCM encryption/decryption of sensitive data (phone numbers, IDs)
 * - SHA-256 hashing for secure lookups without exposing plaintext
 * - Masking for safe display of sensitive information
 *
 * All encryption uses the KMS_DATA_KEY_BASE64 environment variable, which must be
 * a 32-byte key encoded in base64. Generate with: `openssl rand -base64 32`
 *
 * @module crypto
 */

const encoder = new TextEncoder();

/**
 * Convert ArrayBuffer or Uint8Array to base64 string
 */
const toBase64 = (buffer: ArrayBuffer | Uint8Array) => {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

/**
 * Convert base64 string to Uint8Array
 */
const fromBase64 = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

// Cache the imported crypto key to avoid repeated imports
let cachedKey: CryptoKey | null = null;

/**
 * Get or import the AES-256-GCM encryption key from environment
 * Key is cached after first import for performance
 * @throws Error if KMS_DATA_KEY_BASE64 is not configured or invalid
 */
const getKey = async () => {
  if (cachedKey) {
    return cachedKey;
  }

  const secret = Deno.env.get("KMS_DATA_KEY_BASE64") ?? Deno.env.get("FIELD_ENCRYPTION_KEY");

  if (!secret) {
    throw new Error("KMS_DATA_KEY_BASE64 not configured");
  }

  const raw = fromBase64(secret.trim());

  if (raw.length !== 32) {
    throw new Error("KMS_DATA_KEY_BASE64 must be a 32-byte base64 string");
  }

  cachedKey = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
  return cachedKey;
};

/**
 * Encrypt a field value using AES-256-GCM
 *
 * Returns a string in format: `{iv_base64}:{ciphertext_base64}`
 * The IV (initialization vector) is randomly generated for each encryption
 * to ensure the same plaintext produces different ciphertexts.
 *
 * @param value - Plaintext value to encrypt (phone number, national ID, etc.)
 * @returns Encrypted value as "iv:ciphertext" or null if value is empty
 *
 * @example
 * const encrypted = await encryptField("+250788123456");
 * // Returns something like: "aGVsbG8xMjM0NTY=:ZW5jcnlwdGVkX2RhdGE="
 */
export const encryptField = async (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(value)
  );
  const ciphertext = toBase64(cipherBuffer);
  const ivEncoded = toBase64(iv);
  return `${ivEncoded}:${ciphertext}`;
};

/**
 * Decrypt a field value encrypted with encryptField
 *
 * @param value - Encrypted value in format "iv:ciphertext"
 * @returns Decrypted plaintext or null if value is empty
 * @throws Error if ciphertext format is invalid or decryption fails
 *
 * @example
 * const plaintext = await decryptField(encrypted);
 * // Returns: "+250788123456"
 */
export const decryptField = async (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const [ivEncoded, cipher] = value.split(":");

  if (!ivEncoded || !cipher) {
    throw new Error("Invalid ciphertext format");
  }

  const key = await getKey();
  const iv = fromBase64(ivEncoded);
  const ciphertext = fromBase64(cipher);
  const plainBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  const decoder = new TextDecoder();
  return decoder.decode(plainBuffer);
};

/**
 * Create a SHA-256 hash of a field value
 *
 * Used for secure lookups without storing plaintext.
 * The hash is deterministic (same input always produces same hash)
 * but cannot be reversed to recover the original value.
 *
 * @param value - Value to hash (typically a phone number or ID)
 * @returns Hex-encoded SHA-256 hash or null if value is empty
 *
 * @example
 * const hash = await hashField("+250788123456");
 * // Returns: "a7f3b2c1d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6"
 */
export const hashField = async (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

/**
 * Mask a phone number for safe display
 *
 * Shows first 5 digits (including country code) and last 3 digits,
 * masking the middle with bullets (••••).
 *
 * @param value - Phone number to mask
 * @returns Masked phone number or "••••" if too short
 *
 * @example
 * maskMsisdn("+250788123456")  // Returns: "+2507••••456"
 * maskMsisdn("788123456")      // Returns: "78812••••456"
 */
export const maskMsisdn = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const digits = value.replace(/[^0-9+]/g, "");
  if (digits.length < 4) {
    return "••••";
  }

  const prefix = digits.slice(0, 5);
  const suffix = digits.slice(-3);
  return `${prefix}••••${suffix}`;
};

/**
 * Mask a national ID for safe display
 *
 * Shows only the last 4 digits, masking all others with bullets.
 *
 * @param value - National ID to mask
 * @returns Masked ID or "••••" if too short
 *
 * @example
 * maskNationalId("1198012345678901")  // Returns: "••••••••••••8901"
 */
export const maskNationalId = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const clean = value.replace(/[^0-9]/g, "");
  if (clean.length <= 4) {
    return "••••";
  }

  return `${"•".repeat(clean.length - 4)}${clean.slice(-4)}`;
};
