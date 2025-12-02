/**
 * Platform utilities for Tauri desktop app
 * Detects if running in desktop mode and provides platform-specific APIs
 */

import { invoke } from '@tauri-apps/api/core';
import { sendNotification as tauriNotify } from '@tauri-apps/plugin-notification';

declare global {
  interface Window {
    __TAURI__?: unknown;
  }
}

/**
 * Check if running in Tauri desktop environment
 */
export const isDesktop = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI__' in window;
};

/**
 * Check if running in web PWA mode
 */
export const isPWA = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches;
};

/**
 * Get platform information
 */
export interface PlatformInfo {
  platform: 'macos' | 'windows' | 'linux' | 'web';
  arch: string;
  version: string;
}

export async function getPlatformInfo(): Promise<PlatformInfo> {
  if (!isDesktop()) {
    return {
      platform: 'web',
      arch: 'unknown',
      version: 'web',
    };
  }

  try {
    return await invoke<PlatformInfo>('get_platform_info');
  } catch (error) {
    console.error('Failed to get platform info:', error);
    return {
      platform: 'web',
      arch: 'unknown',
      version: 'web',
    };
  }
}

// =============================================================================
// NETWORK STATUS DETECTION
// =============================================================================

/**
 * Network status information
 */
export interface NetworkStatus {
  online: boolean;
  type?: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
  downlink?: number; // Mbps
  rtt?: number; // Round-trip time in ms
}

/**
 * Get current network status
 */
export function getNetworkStatus(): NetworkStatus {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { online: true };
  }

  const online = navigator.onLine;

  // Use Network Information API if available
  const connection = (navigator as Navigator & { 
    connection?: {
      type?: string;
      effectiveType?: string;
      downlink?: number;
      rtt?: number;
    };
  }).connection;

  if (connection) {
    return {
      online,
      type: connection.type as NetworkStatus['type'],
      effectiveType: connection.effectiveType as NetworkStatus['effectiveType'],
      downlink: connection.downlink,
      rtt: connection.rtt,
    };
  }

  return { online };
}

/**
 * Check if currently online
 */
export function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

/**
 * Subscribe to network status changes
 * @param callback Function to call when network status changes
 * @returns Cleanup function to unsubscribe
 */
export function onNetworkStatusChange(
  callback: (status: NetworkStatus) => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleOnline = () => callback(getNetworkStatus());
  const handleOffline = () => callback(getNetworkStatus());

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Also listen for connection changes if available
  const connection = (navigator as Navigator & { 
    connection?: EventTarget;
  }).connection;
  
  if (connection) {
    connection.addEventListener('change', handleOnline);
  }

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    if (connection) {
      connection.removeEventListener('change', handleOnline);
    }
  };
}

// =============================================================================
// DISPLAY / WINDOW INFORMATION
// =============================================================================

/**
 * Display information for multi-monitor support
 */
export interface DisplayInfo {
  width: number;
  height: number;
  availWidth: number;
  availHeight: number;
  colorDepth: number;
  pixelRatio: number;
  orientation?: 'landscape' | 'portrait';
}

/**
 * Get current display information
 */
export function getDisplayInfo(): DisplayInfo {
  if (typeof window === 'undefined' || typeof screen === 'undefined') {
    return {
      width: 1920,
      height: 1080,
      availWidth: 1920,
      availHeight: 1080,
      colorDepth: 24,
      pixelRatio: 1,
    };
  }

  return {
    width: screen.width,
    height: screen.height,
    availWidth: screen.availWidth,
    availHeight: screen.availHeight,
    colorDepth: screen.colorDepth,
    pixelRatio: window.devicePixelRatio || 1,
    orientation: screen.width > screen.height ? 'landscape' : 'portrait',
  };
}

// =============================================================================
// CLIPBOARD INTEGRATION
// =============================================================================

/**
 * Copy text to clipboard (works in both desktop and web)
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Read text from clipboard (works in both desktop and web)
 */
export async function readFromClipboard(): Promise<string | null> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      return await navigator.clipboard.readText();
    }
    return null;
  } catch (error) {
    console.error('Failed to read from clipboard:', error);
    return null;
  }
}

// =============================================================================
// NOTIFICATIONS
// =============================================================================

/**
 * Send native notification (works in both desktop and web)
 */
export async function showNotification(
  title: string,
  body: string,
  options?: {
    icon?: string;
    tag?: string;
    silent?: boolean;
  }
): Promise<void> {
  if (isDesktop()) {
    // Use Tauri native notifications
    try {
      await tauriNotify({
        title,
        body,
        icon: options?.icon,
      });
    } catch (error) {
      console.error('Failed to send desktop notification:', error);
    }
  } else {
    // Fallback to Web Notification API
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: options?.icon,
          tag: options?.tag,
          silent: options?.silent,
        });
      } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          new Notification(title, {
            body,
            icon: options?.icon,
            tag: options?.tag,
            silent: options?.silent,
          });
        }
      }
    }
  }
}

// =============================================================================
// WINDOW MANAGEMENT
// =============================================================================

/**
 * Minimize window to system tray (desktop only)
 */
export async function minimizeToTray(): Promise<void> {
  if (!isDesktop()) return;

  try {
    await invoke('minimize_to_tray');
  } catch (error) {
    console.error('Failed to minimize to tray:', error);
  }
}

/**
 * Show window from tray (desktop only)
 */
export async function showWindow(): Promise<void> {
  if (!isDesktop()) return;

  try {
    await invoke('show_window');
  } catch (error) {
    console.error('Failed to show window:', error);
  }
}

/**
 * Open external URL
 */
export async function openExternal(url: string): Promise<void> {
  if (isDesktop()) {
    const { open } = await import('@tauri-apps/plugin-shell');
    await open(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

// =============================================================================
// FILE DIALOGS
// =============================================================================

/**
 * Save file dialog (desktop only)
 */
export async function saveFile(
  defaultPath?: string,
  filters?: Array<{ name: string; extensions: string[] }>
): Promise<string | null> {
  if (!isDesktop()) {
    console.warn('Save file dialog only available in desktop mode');
    return null;
  }

  try {
    const { save } = await import('@tauri-apps/plugin-dialog');
    return await save({
      defaultPath,
      filters,
    });
  } catch (error) {
    console.error('Failed to show save dialog:', error);
    return null;
  }
}

/**
 * Open file dialog (desktop only)
 */
export async function openFile(
  options?: {
    multiple?: boolean;
    directory?: boolean;
    filters?: Array<{ name: string; extensions: string[] }>;
  }
): Promise<string | string[] | null> {
  if (!isDesktop()) {
    console.warn('Open file dialog only available in desktop mode');
    return null;
  }

  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    return await open(options);
  } catch (error) {
    console.error('Failed to show open dialog:', error);
    return null;
  }
}

// =============================================================================
// AUTO-START
// =============================================================================

/**
 * Check if auto-start is enabled (desktop only)
 */
export async function isAutostartEnabled(): Promise<boolean> {
  if (!isDesktop()) return false;

  try {
    const { isEnabled } = await import('@tauri-apps/plugin-autostart');
    return await isEnabled();
  } catch (error) {
    console.error('Failed to check autostart status:', error);
    return false;
  }
}

/**
 * Enable/disable auto-start (desktop only)
 */
export async function setAutostart(enabled: boolean): Promise<void> {
  if (!isDesktop()) return;

  try {
    const { enable, disable } = await import('@tauri-apps/plugin-autostart');
    if (enabled) {
      await enable();
    } else {
      await disable();
    }
  } catch (error) {
    console.error('Failed to set autostart:', error);
  }
}

// =============================================================================
// SYSTEM TRAY
// =============================================================================

/**
 * Update system tray status
 */
export async function updateTrayStatus(status: 'online' | 'offline' | 'busy'): Promise<void> {
  if (!isDesktop()) return;

  try {
    await invoke('update_tray_status', { status });
  } catch (error) {
    console.error('Failed to update tray status:', error);
  }
}

/**
 * Show tray message
 */
export async function showTrayMessage(title: string, message: string): Promise<void> {
  if (!isDesktop()) return;

  try {
    await invoke('show_tray_message', { title, message });
  } catch (error) {
    console.error('Failed to show tray message:', error);
  }
}

/**
 * Flash tray icon for user attention
 */
export async function flashTrayIcon(): Promise<void> {
  if (!isDesktop()) return;

  try {
    await invoke('flash_tray_icon');
  } catch (error) {
    console.error('Failed to flash tray icon:', error);
  }
}

// =============================================================================
// GLOBAL SHORTCUTS
// =============================================================================

/**
 * Register global shortcut
 */
export async function registerGlobalShortcut(
  id: string,
  modifiers: string[],
  key: string
): Promise<void> {
  if (!isDesktop()) return;

  try {
    await invoke('register_global_shortcut', {
      shortcutId: id,
      modifiers,
      key,
    });
  } catch (error) {
    console.error('Failed to register global shortcut:', error);
  }
}

/**
 * Unregister global shortcut
 */
export async function unregisterGlobalShortcut(
  modifiers: string[],
  key: string
): Promise<void> {
  if (!isDesktop()) return;

  try {
    await invoke('unregister_global_shortcut', { modifiers, key });
  } catch (error) {
    console.error('Failed to unregister global shortcut:', error);
  }
}

// =============================================================================
// APP UPDATES
// =============================================================================

/**
 * Check for app updates
 */
export interface UpdateInfo {
  version: string;
  currentVersion: string;
  available: boolean;
  downloadUrl?: string;
  releaseNotes?: string;
}

export async function checkForUpdates(): Promise<UpdateInfo | null> {
  if (!isDesktop()) return null;

  try {
    return await invoke<UpdateInfo>('check_for_updates');
  } catch (error) {
    console.error('Failed to check for updates:', error);
    return null;
  }
}

/**
 * Download and install update
 */
export async function downloadAndInstallUpdate(): Promise<void> {
  if (!isDesktop()) return;

  try {
    await invoke('download_and_install_update');
  } catch (error) {
    console.error('Failed to download and install update:', error);
    throw error;
  }
}

/**
 * Get app version
 */
export async function getAppVersion(): Promise<string> {
  if (!isDesktop()) {
    return process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0';
  }

  try {
    return await invoke<string>('get_app_version');
  } catch (error) {
    console.error('Failed to get app version:', error);
    return '1.0.0';
  }
}

// =============================================================================
// VISIBILITY CHANGE (for session refresh)
// =============================================================================

/**
 * Subscribe to visibility changes (for triggering session refresh on window focus)
 * @param callback Function to call when visibility changes
 * @returns Cleanup function to unsubscribe
 */
export function onVisibilityChange(
  callback: (visible: boolean) => void
): () => void {
  if (typeof document === 'undefined') {
    return () => {};
  }

  const handleVisibilityChange = () => {
    callback(!document.hidden);
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}

/**
 * Check if the document is currently visible
 */
export function isDocumentVisible(): boolean {
  if (typeof document === 'undefined') return true;
  return !document.hidden;
}
