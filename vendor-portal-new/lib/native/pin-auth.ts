/**
 * TypeScript bridge for PIN Authentication plugin.
 *
 * Provides secure 6-digit PIN authentication for quick login on mobile devices.
 *
 * Security Features:
 * - PIN hashed with PBKDF2-SHA256 (10,000 iterations)
 * - Salted hashes (16-byte random salt)
 * - Encrypted storage using Android Keystore
 * - Rate limiting (max 5 attempts)
 * - Auto-lockout (15 minutes after failed attempts)
 *
 * Usage:
 * ```typescript
 * import { PinAuth } from '@/lib/native/pin-auth';
 *
 * // Check if PIN is set
 * const { hasPin } = await PinAuth.hasPin();
 *
 * // Set PIN
 * await PinAuth.setPin('123456');
 *
 * // Verify PIN
 * const result = await PinAuth.verifyPin('123456');
 * if (result.valid) {
 *   // Login successful
 * }
 * ```
 */

import { Capacitor, registerPlugin } from "@capacitor/core";

export interface PinAuthPlugin {
  /**
   * Check if PIN is currently set
   */
  hasPin(): Promise<{ hasPin: boolean }>;

  /**
   * Set a new PIN (must be 6 digits)
   */
  setPin(options: { pin: string }): Promise<{ success: boolean }>;

  /**
   * Verify the provided PIN
   */
  verifyPin(options: { pin: string }): Promise<PinVerifyResult>;

  /**
   * Delete the stored PIN
   */
  deletePin(): Promise<{ success: boolean }>;

  /**
   * Change PIN (requires old PIN)
   */
  changePin(options: { oldPin: string; newPin: string }): Promise<{ success: boolean }>;

  /**
   * Get current lockout status
   */
  getLockStatus(): Promise<LockStatus>;
}

export interface PinVerifyResult {
  success: boolean;
  valid: boolean;
  attemptsRemaining?: number;
}

export interface LockStatus {
  isLocked: boolean;
  remainingSeconds: number;
  failCount: number;
  attemptsRemaining: number;
}

const PinAuthNative = registerPlugin<PinAuthPlugin>("PinAuth");

/**
 * Check if running on Android with PIN authentication support
 */
export function isPinAuthAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

/**
 * Validate PIN format (6 digits)
 */
export function validatePinFormat(pin: string): { valid: boolean; error?: string } {
  if (!pin) {
    return { valid: false, error: "PIN is required" };
  }

  if (pin.length !== 6) {
    return { valid: false, error: "PIN must be exactly 6 digits" };
  }

  if (!/^\d{6}$/.test(pin)) {
    return { valid: false, error: "PIN must contain only digits" };
  }

  return { valid: true };
}

/**
 * PIN Authentication API
 */
export const PinAuth = {
  /**
   * Check if PIN authentication is available on this platform
   */
  isAvailable(): boolean {
    return isPinAuthAvailable();
  },

  /**
   * Check if PIN is currently set
   */
  async hasPin(): Promise<{ hasPin: boolean }> {
    if (!isPinAuthAvailable()) {
      return { hasPin: false };
    }

    try {
      return await PinAuthNative.hasPin();
    } catch (error) {
      console.error("Failed to check PIN status:", error);
      throw error;
    }
  },

  /**
   * Set a new 6-digit PIN
   */
  async setPin(pin: string): Promise<{ success: boolean }> {
    if (!isPinAuthAvailable()) {
      throw new Error("PIN authentication is not available on this platform");
    }

    // Validate PIN format
    const validation = validatePinFormat(pin);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    try {
      return await PinAuthNative.setPin({ pin });
    } catch (error) {
      console.error("Failed to set PIN:", error);
      throw error;
    }
  },

  /**
   * Verify the provided PIN
   */
  async verifyPin(pin: string): Promise<PinVerifyResult> {
    if (!isPinAuthAvailable()) {
      throw new Error("PIN authentication is not available on this platform");
    }

    // Validate PIN format
    const validation = validatePinFormat(pin);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    try {
      return await PinAuthNative.verifyPin({ pin });
    } catch (error) {
      // Error might be due to lockout
      const lockStatus = await this.getLockStatus();
      if (lockStatus.isLocked) {
        throw new Error(
          `Too many failed attempts. Try again in ${lockStatus.remainingSeconds} seconds`
        );
      }
      console.error("Failed to verify PIN:", error);
      throw error;
    }
  },

  /**
   * Delete the stored PIN
   */
  async deletePin(): Promise<{ success: boolean }> {
    if (!isPinAuthAvailable()) {
      throw new Error("PIN authentication is not available on this platform");
    }

    try {
      return await PinAuthNative.deletePin();
    } catch (error) {
      console.error("Failed to delete PIN:", error);
      throw error;
    }
  },

  /**
   * Change PIN (requires old PIN for verification)
   */
  async changePin(oldPin: string, newPin: string): Promise<{ success: boolean }> {
    if (!isPinAuthAvailable()) {
      throw new Error("PIN authentication is not available on this platform");
    }

    // Validate both PINs
    const oldValidation = validatePinFormat(oldPin);
    if (!oldValidation.valid) {
      throw new Error(`Old PIN: ${oldValidation.error}`);
    }

    const newValidation = validatePinFormat(newPin);
    if (!newValidation.valid) {
      throw new Error(`New PIN: ${newValidation.error}`);
    }

    if (oldPin === newPin) {
      throw new Error("New PIN must be different from old PIN");
    }

    try {
      return await PinAuthNative.changePin({ oldPin, newPin });
    } catch (error) {
      console.error("Failed to change PIN:", error);
      throw error;
    }
  },

  /**
   * Get current lockout status
   */
  async getLockStatus(): Promise<LockStatus> {
    if (!isPinAuthAvailable()) {
      return {
        isLocked: false,
        remainingSeconds: 0,
        failCount: 0,
        attemptsRemaining: 5,
      };
    }

    try {
      return await PinAuthNative.getLockStatus();
    } catch (error) {
      console.error("Failed to get lock status:", error);
      throw error;
    }
  },
};

export default PinAuth;
