/**
 * Password hashing utilities for admin credentials.
 * 
 * IMPORTANT: This module uses bcrypt which is a Node.js-only package.
 * It MUST only be used in server-side code (API routes, server components).
 * Never import this file in client-side code.
 * 
 * USAGE:
 * To generate a password hash for ADMIN_ACCESS_CREDENTIALS:
 * 
 * 1. Run this script with Node.js:
 *    npx ts-node -e "import('./lib/server/password-utils').then(m => m.hashPassword('your-password').then(console.log))"
 * 
 * 2. Or use bcrypt CLI:
 *    npx bcrypt-cli hash "your-password"
 * 
 * 3. Update ADMIN_ACCESS_CREDENTIALS with the hash:
 *    [{"actorId":"...", "email":"...", "passwordHash":"$2b$10$..."}]
 */

// This import enforces that this module can only be used on the server
import "server-only";

import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

/**
 * Hash a password using bcrypt with a default of 10 salt rounds.
 * 
 * @param password - The plaintext password to hash
 * @returns A promise that resolves to the bcrypt hash
 * 
 * @example
 * const hash = await hashPassword("mySecurePassword123");
 * // Returns something like: "$2b$10$..."
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a bcrypt hash.
 * 
 * @param password - The plaintext password to verify
 * @param hash - The bcrypt hash to compare against
 * @returns A promise that resolves to true if the password matches
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
