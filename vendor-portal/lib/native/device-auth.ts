/**
 * TypeScript bridge for Device-Bound Authentication plugin.
 *
 * Implements WebAuthn/FIDO-style authentication where the Staff Android app
 * acts as a biometric-gated authenticator for web login.
 *
 * Security Features:
 * - EC P-256 keys in Android Keystore (StrongBox preferred)
 * - Biometric-bound private keys (never exported)
 * - Challenge-response protocol with origin binding
 * - Phishing resistance and replay prevention
 *
 * Usage:
 * ```typescript
 * import { DeviceAuth } from '@/lib/native/device-auth';
 *
 * // Check if biometric is available
 * const bioStatus = await DeviceAuth.checkBiometricAvailable();
 *
 * // Generate device key (triggers biometric)
 * const keyInfo = await DeviceAuth.generateDeviceKey(userId);
 *
 * // Sign challenge (triggers biometric)
 * const result = await DeviceAuth.signChallenge(challenge, origin);
 * ```
 */

import { Capacitor, registerPlugin } from "@capacitor/core";

export interface DeviceAuthPlugin {
  /**
   * Check if biometric authentication is available
   */
  checkBiometricAvailable(): Promise<BiometricStatus>;

  /**
   * Check if device already has a key pair
   */
  hasDeviceKey(): Promise<DeviceKeyStatus>;

  /**
   * Get device information
   */
  getDeviceInfo(): Promise<DeviceInfo>;

  /**
   * Generate new device key pair (triggers biometric)
   */
  generateDeviceKey(options: {
    userId: string;
    requireBiometric?: boolean;
  }): Promise<KeyGenerationResult>;

  /**
   * Sign challenge (triggers biometric)
   */
  signChallenge(options: {
    challenge: string;
    userId: string;
    origin: string;
  }): Promise<SigningResult>;

  /**
   * Validate challenge format
   */
  validateChallenge(options: { challenge: string }): Promise<ValidationResult>;

  /**
   * Delete device key
   */
  deleteDeviceKey(): Promise<{ success: boolean }>;
}

export interface BiometricStatus {
  available: boolean;
  message: string;
}

export interface DeviceKeyStatus {
  hasKey: boolean;
  deviceId: string;
  publicKey?: string;
}

export interface DeviceInfo {
  deviceId: string;
  model: string;
  manufacturer: string;
  osVersion: string;
  sdkVersion: number;
  brand: string;
  device: string;
}

export interface KeyGenerationResult {
  success: boolean;
  deviceId: string;
  publicKey: string;
  keyAlgorithm: string;
  isStrongBoxBacked: boolean;
}

export interface SigningResult {
  success: boolean;
  signature: string;
  signedMessage: string;
  deviceId: string;
  challengeInfo: {
    sessionId: string;
    nonce: string;
    origin: string;
  };
}

export interface ValidationResult {
  valid: boolean;
  sessionId?: string;
  nonce?: string;
  origin?: string;
  expiresAt?: number;
  reason?: string;
  expired?: boolean;
}

// Register the plugin
const DeviceAuthNative = registerPlugin<DeviceAuthPlugin>("DeviceAuth", {
  web: {
    checkBiometricAvailable: async () => ({
      available: false,
      message: "Device-bound authentication only available on Android",
    }),
    hasDeviceKey: async () => ({
      hasKey: false,
      deviceId: "web-device",
    }),
    getDeviceInfo: async () => ({
      deviceId: "web-device",
      model: "Browser",
      manufacturer: "Web",
      osVersion: "N/A",
      sdkVersion: 0,
      brand: "Web",
      device: "Browser",
    }),
    generateDeviceKey: async () => {
      throw new Error("Device-bound authentication only available on Android");
    },
    signChallenge: async () => {
      throw new Error("Device-bound authentication only available on Android");
    },
    validateChallenge: async () => ({
      valid: false,
      reason: "Device-bound authentication only available on Android",
    }),
    deleteDeviceKey: async () => ({ success: false }),
  },
});

/**
 * High-level Device Authentication API
 */
export const DeviceAuth = {
  /**
   * Check if running on Android with biometric support
   */
  isAvailable(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  },

  /**
   * Check if biometric authentication is available
   */
  async checkBiometricAvailable(): Promise<BiometricStatus> {
    if (!this.isAvailable()) {
      return {
        available: false,
        message: "Device-bound authentication only available on Android",
      };
    }
    return DeviceAuthNative.checkBiometricAvailable();
  },

  /**
   * Check if device has a key pair
   */
  async hasDeviceKey(): Promise<DeviceKeyStatus> {
    if (!this.isAvailable()) {
      return { hasKey: false, deviceId: "web-device" };
    }
    return DeviceAuthNative.hasDeviceKey();
  },

  /**
   * Get device information
   */
  async getDeviceInfo(): Promise<DeviceInfo> {
    if (!this.isAvailable()) {
      return {
        deviceId: "web-device",
        model: "Browser",
        manufacturer: "Web",
        osVersion: "N/A",
        sdkVersion: 0,
        brand: "Web",
        device: "Browser",
      };
    }
    return DeviceAuthNative.getDeviceInfo();
  },

  /**
   * Generate device key pair (triggers biometric)
   */
  async generateDeviceKey(
    userId: string,
    requireBiometric: boolean = true
  ): Promise<KeyGenerationResult> {
    if (!this.isAvailable()) {
      throw new Error("Device-bound authentication only available on Android");
    }

    return DeviceAuthNative.generateDeviceKey({
      userId,
      requireBiometric,
    });
  },

  /**
   * Sign challenge (triggers biometric)
   */
  async signChallenge(
    challengeJson: string,
    userId: string,
    origin: string
  ): Promise<SigningResult> {
    if (!this.isAvailable()) {
      throw new Error("Device-bound authentication only available on Android");
    }

    return DeviceAuthNative.signChallenge({
      challenge: challengeJson,
      userId,
      origin,
    });
  },

  /**
   * Validate challenge format
   */
  async validateChallenge(challengeJson: string): Promise<ValidationResult> {
    if (!this.isAvailable()) {
      return {
        valid: false,
        reason: "Device-bound authentication only available on Android",
      };
    }

    return DeviceAuthNative.validateChallenge({ challenge: challengeJson });
  },

  /**
   * Delete device key
   */
  async deleteDeviceKey(): Promise<void> {
    if (!this.isAvailable()) return;
    await DeviceAuthNative.deleteDeviceKey();
  },
};

/**
 * React hook for device authentication
 */
export function useDeviceAuth() {
  const isAvailable = DeviceAuth.isAvailable();

  return {
    isAvailable,
    checkBiometricAvailable: DeviceAuth.checkBiometricAvailable.bind(DeviceAuth),
    hasDeviceKey: DeviceAuth.hasDeviceKey.bind(DeviceAuth),
    getDeviceInfo: DeviceAuth.getDeviceInfo.bind(DeviceAuth),
    generateDeviceKey: DeviceAuth.generateDeviceKey.bind(DeviceAuth),
    signChallenge: DeviceAuth.signChallenge.bind(DeviceAuth),
    validateChallenge: DeviceAuth.validateChallenge.bind(DeviceAuth),
    deleteDeviceKey: DeviceAuth.deleteDeviceKey.bind(DeviceAuth),
  };
}
