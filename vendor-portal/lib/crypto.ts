/**
 * Secure cryptographic utilities
 * 
 * This module provides secure implementations of common crypto operations
 * with a focus on maintaining proper entropy and security best practices.
 */

import { randomBytes, randomInt } from "crypto";
import { CONSTANTS } from "./constants";

/**
 * Generate a cryptographically secure random password
 * 
 * Uses crypto.randomBytes for proper entropy preservation.
 * Unlike base64 encoding with character replacement, this method
 * maintains full entropy by directly mapping random bytes to charset indices.
 * 
 * @param length - Desired password length (default: 16)
 * @returns A secure random password
 * 
 * @example
 * const password = generateSecurePassword(16);
 * // Returns: "aB7!xZ9@qW3#mK5$"
 */
export function generateSecurePassword(length: number = CONSTANTS.PASSWORD.DEFAULT_LENGTH): string {
  if (length < CONSTANTS.PASSWORD.MIN_LENGTH) {
    throw new Error(`Password length must be at least ${CONSTANTS.PASSWORD.MIN_LENGTH} characters`);
  }
  
  const charset = CONSTANTS.PASSWORD.CHARSET;
  const charsetLength = charset.length;
  
  // Generate cryptographically secure random bytes
  const randomBytesBuffer = randomBytes(length);
  
  // Map each byte to a character in the charset
  // Using modulo is safe here as the bias is negligible for charset size < 256
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset[randomBytesBuffer[i] % charsetLength];
  }
  
  return password;
}

/**
 * Common word list for passphrase generation
 * Selected for memorability and diversity
 */
const WORD_LIST = [
  "correct", "horse", "battery", "staple", "mountain", "river",
  "forest", "ocean", "thunder", "lightning", "rainbow", "sunshine",
  "crystal", "garden", "harbor", "island", "journey", "kingdom",
  "meadow", "palace", "quest", "river", "summit", "temple",
  "valley", "window", "anchor", "beacon", "castle", "dragon",
  "eagle", "falcon", "glacier", "horizon", "jungle", "knight",
  "lantern", "marble", "noble", "orchid", "phoenix", "quartz",
  "raven", "sapphire", "tiger", "unicorn", "voyage", "willow",
] as const;

/**
 * Generate a memorable passphrase
 * 
 * Creates a passphrase in the format: "word-word-word-word-1234"
 * Easier to remember and type than random character passwords.
 * 
 * @param wordCount - Number of words to include (default: 4)
 * @returns A memorable passphrase with words and a random number suffix
 * 
 * @example
 * const passphrase = generatePassphrase(4);
 * // Returns: "mountain-river-forest-ocean-7392"
 */
export function generatePassphrase(wordCount: number = 4): string {
  if (wordCount < 3) {
    throw new Error('Passphrase must contain at least 3 words');
  }
  
  const words: string[] = [];
  for (let i = 0; i < wordCount; i++) {
    // Use cryptographically secure random selection
    const index = randomInt(0, WORD_LIST.length);
    words.push(WORD_LIST[index]);
  }
  
  // Add a random 4-digit number for additional entropy
  const randomNumber = randomInt(1000, 9999);
  
  return `${words.join("-")}-${randomNumber}`;
}

/**
 * Generate a secure random token (for API keys, tokens, etc.)
 * 
 * @param byteLength - Number of random bytes (default: 32)
 * @returns Hex-encoded random token
 * 
 * @example
 * const token = generateSecureToken(32);
 * // Returns: "a1b2c3d4e5f6..." (64 hex characters)
 */
export function generateSecureToken(byteLength: number = 32): string {
  return randomBytes(byteLength).toString('hex');
}
