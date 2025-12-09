/**
 * Platform detection utilities
 *
 * Helps detect if user is on mobile, web, or specific platform
 */

/**
 * Detect if user is on a mobile device
 * Uses user agent string to determine platform
 */
export function isMobileDevice(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;

  // Check for mobile patterns
  const mobilePatterns = [
    /Android/i,
    /webOS/i,
    /iPhone/i,
    /iPad/i,
    /iPod/i,
    /BlackBerry/i,
    /Windows Phone/i,
  ];

  return mobilePatterns.some((pattern) => pattern.test(userAgent));
}

/**
 * Detect if user is on Android
 */
export function isAndroid(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const userAgent = navigator.userAgent || navigator.vendor;
  return /Android/i.test(userAgent);
}

/**
 * Detect if user is on iOS
 */
export function isIOS(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const userAgent = navigator.userAgent || navigator.vendor;
  return /iPad|iPhone|iPod/.test(userAgent);
}

/**
 * Detect if user is on a Capacitor app (native mobile wrapper)
 */
export function isCapacitorApp(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  // Check for Capacitor global
  return !!(window as any).Capacitor;
}

/**
 * Detect if user is on web (not mobile app)
 */
export function isWebPlatform(): boolean {
  return !isCapacitorApp() && !isMobileDevice();
}

/**
 * Get platform type
 */
export type PlatformType = "web" | "mobile-web" | "android-app" | "ios-app" | "unknown";

export function getPlatformType(): PlatformType {
  if (typeof window === "undefined") {
    return "unknown";
  }

  if (isCapacitorApp()) {
    if (isAndroid()) return "android-app";
    if (isIOS()) return "ios-app";
    return "unknown";
  }

  if (isMobileDevice()) {
    return "mobile-web";
  }

  return "web";
}
