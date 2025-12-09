import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from "crypto";
import { config } from "../config.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypt a string using AES-256-GCM
 * Returns format: iv:authTag:encryptedData (all hex encoded)
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return "";

  const iv = randomBytes(IV_LENGTH);
  const key = Buffer.from(config.PII_ENCRYPTION_KEY.slice(0, 32).padEnd(32, "0"));
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt a string encrypted with encrypt()
 */
export function decrypt(ciphertext: string): string {
  if (!ciphertext) return "";

  const [ivHex, authTagHex, encrypted] = ciphertext.split(":");
  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error("Invalid ciphertext format");
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const key = Buffer.from(config.PII_ENCRYPTION_KEY.slice(0, 32).padEnd(32, "0"));

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Create a SHA-256 hash of a value (for lookups)
 * Normalizes phone numbers by removing non-digits
 */
export function hash(value: string): string {
  if (!value) return "";
  const normalized = value.replace(/\D/g, "");
  return createHash("sha256").update(normalized).digest("hex");
}

/**
 * Mask a phone number for display (e.g., 0781234567 -> 078****567)
 */
export function maskPhone(phone: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6) return "***";
  return `${digits.slice(0, 3)}****${digits.slice(-3)}`;
}

/**
 * Mask a national ID for display (e.g., 1199012345678901 -> 11****8901)
 */
export function maskNationalId(id: string): string {
  if (!id) return "";
  const clean = id.replace(/\s/g, "");
  if (clean.length < 6) return "***";
  return `${clean.slice(0, 2)}****${clean.slice(-4)}`;
}

/**
 * Process PII field - returns encrypted, hashed, and masked versions
 */
export function processPII(
  value: string | null,
  type: "phone" | "national_id"
): {
  encrypted: string | null;
  hash: string | null;
  masked: string | null;
} {
  if (!value) {
    return { encrypted: null, hash: null, masked: null };
  }

  return {
    encrypted: encrypt(value),
    hash: hash(value),
    masked: type === "phone" ? maskPhone(value) : maskNationalId(value),
  };
}
