/**
 * TypeScript bridge for REAL-TIME SMS Ingestion plugin.
 *
 * This module provides instant SMS processing for mobile money notifications.
 * SMS messages are processed in REAL-TIME as they arrive, giving members
 * instant payment approval experiences.
 *
 * Real-time Flow:
 * 1. SMS arrives from MTN/Airtel → BroadcastReceiver triggered instantly
 * 2. Sent to backend → OpenAI parses transaction details
 * 3. Member matched → Balance updated immediately
 * 4. Member sees payment approved in seconds (not 15 minutes!)
 *
 * Usage:
 * ```typescript
 * import { SmsIngest } from '@/lib/native/sms-ingest';
 *
 * // Configure backend endpoint (do this once on app start)
 * await SmsIngest.configure({
 *   edgeFunctionUrl: 'https://your-project.supabase.co/functions/v1/ingest-sms',
 *   hmacSecret: 'your-hmac-secret'
 * });
 *
 * // Request permissions
 * const result = await SmsIngest.requestPermissions();
 *
 * // Enable REAL-TIME SMS ingestion
 * await SmsIngest.enable();
 *
 * // Now SMS messages are processed instantly!
 * // BroadcastReceiver intercepts all MTN/Airtel SMS in real-time
 * ```
 */

import { Capacitor, registerPlugin } from "@capacitor/core";

export interface SmsIngestPlugin {
  /**
   * Check current permission status for SMS reading
   */
  checkPermissions(): Promise<PermissionStatus>;

  /**
   * Request SMS permissions from the user
   */
  requestPermissions(): Promise<PermissionStatus>;

  /**
   * Check if SMS ingestion is currently enabled
   */
  isEnabled(): Promise<{ enabled: boolean }>;

  /**
   * Enable REAL-TIME SMS ingestion
   * - BroadcastReceiver processes messages instantly on arrival
   * - Hourly fallback sync for missed messages
   */
  enable(): Promise<{ enabled: boolean; realtime: boolean }>;

  /**
   * Disable SMS ingestion and stop background sync
   */
  disable(): Promise<{ enabled: boolean }>;

  /**
   * Configure backend endpoint for SMS processing
   */
  configure(options: {
    edgeFunctionUrl: string;
    hmacSecret: string;
  }): Promise<{ configured: boolean }>;

  /**
   * Query SMS inbox for messages from mobile money providers
   */
  querySmsInbox(options?: QueryOptions): Promise<QueryResult>;

  /**
   * Update the last sync timestamp
   */
  updateLastSyncTime(options: {
    timestamp: number;
  }): Promise<{ success: boolean; timestamp: number }>;

  /**
   * Schedule background sync with custom interval (fallback only)
   */
  scheduleBackgroundSync(options?: { intervalMinutes?: number }): Promise<{ scheduled: boolean }>;
}

export interface PermissionStatus {
  readSms?: "granted" | "denied" | "prompt";
  receiveSms?: "granted" | "denied" | "prompt";
  state: "granted" | "denied" | "prompt";
}

export interface QueryOptions {
  /**
   * Maximum number of messages to return
   * @default 50
   */
  limit?: number;

  /**
   * Only return messages received after this timestamp (milliseconds)
   * @default Last sync time or 0
   */
  since?: number;
}

export interface SmsMessage {
  id: number;
  address: string;
  body: string;
  timestamp: number;
  received_at: string;
}

export interface QueryResult {
  messages: SmsMessage[];
  count: number;
}

const isServer = typeof window === "undefined";

const SmsIngestNative = !isServer
  ? registerPlugin<SmsIngestPlugin>("SmsIngest", {
      web: {
        checkPermissions: async () => ({ state: "denied" as const }),
        requestPermissions: async () => ({ state: "denied" as const }),
        isEnabled: async () => ({ enabled: false }),
        enable: async () => {
          throw new Error("Real-time SMS ingestion only available on Android");
        },
        disable: async () => ({ enabled: false }),
        configure: async () => {
          throw new Error("Real-time SMS ingestion only available on Android");
        },
        querySmsInbox: async () => ({ messages: [], count: 0 }),
        updateLastSyncTime: async () => ({ success: false, timestamp: 0 }),
        scheduleBackgroundSync: async () => ({ scheduled: false }),
      },
    })
  : ({
      checkPermissions: async () => ({ state: "denied" as const }),
      requestPermissions: async () => ({ state: "denied" as const }),
      isEnabled: async () => ({ enabled: false }),
      enable: async () => ({ enabled: false, realtime: false }),
      disable: async () => ({ enabled: false }),
      configure: async () => ({ configured: false }),
      querySmsInbox: async () => ({ messages: [], count: 0 }),
      updateLastSyncTime: async () => ({ success: false, timestamp: 0 }),
      scheduleBackgroundSync: async () => ({ scheduled: false }),
    } satisfies SmsIngestPlugin);

/**
 * High-level SMS Ingestion API
 */
export const SmsIngest = {
  /**
   * Check if running on a native platform with SMS support
   */
  isAvailable(): boolean {
    if (isServer) return false;
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  },

  /**
   * Check if SMS permissions are granted
   */
  async checkPermissions(): Promise<PermissionStatus> {
    if (!this.isAvailable()) {
      return { state: "denied" };
    }
    return SmsIngestNative.checkPermissions();
  },

  /**
   * Request SMS permissions from user
   * Shows native permission dialog
   */
  async requestPermissions(): Promise<PermissionStatus> {
    if (!this.isAvailable()) {
      throw new Error("SMS ingestion is only available on native Android");
    }
    return SmsIngestNative.requestPermissions();
  },

  /**
   * Check if SMS ingestion is currently enabled
   */
  async isEnabled(): Promise<boolean> {
    if (!this.isAvailable()) return false;
    const result = await SmsIngestNative.isEnabled();
    return result.enabled;
  },

  /**
   * Configure backend endpoint for real-time SMS processing
   */
  async configure(edgeFunctionUrl: string, hmacSecret: string): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error("SMS ingestion is only available on native Android");
    }

    await SmsIngestNative.configure({ edgeFunctionUrl, hmacSecret });
  },

  /**
   * Enable REAL-TIME SMS ingestion
   * - BroadcastReceiver processes SMS instantly on arrival
   * - Hourly fallback sync for missed messages
   * - Requires permissions to be granted first
   */
  async enable(): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error("SMS ingestion is only available on native Android");
    }

    // Check permissions first
    const perms = await this.checkPermissions();
    if (perms.state !== "granted") {
      throw new Error("SMS permissions not granted");
    }

    await SmsIngestNative.enable();
  },

  /**
   * Disable SMS ingestion
   */
  async disable(): Promise<void> {
    if (!this.isAvailable()) return;
    await SmsIngestNative.disable();
  },

  /**
   * Query SMS inbox for mobile money messages
   */
  async querySmsInbox(options?: QueryOptions): Promise<SmsMessage[]> {
    if (!this.isAvailable()) {
      return [];
    }

    const result = await SmsIngestNative.querySmsInbox(options);
    return result.messages;
  },

  /**
   * Mark sync as completed at current timestamp
   */
  async markSyncComplete(): Promise<void> {
    if (!this.isAvailable()) return;
    await SmsIngestNative.updateLastSyncTime({
      timestamp: Date.now(),
    });
  },

  /**
   * Schedule periodic background sync (fallback for missed messages)
   * Real-time processing happens via BroadcastReceiver, this is just a safety net
   */
  async scheduleBackgroundSync(intervalMinutes: number = 60): Promise<void> {
    if (!this.isAvailable()) return;
    await SmsIngestNative.scheduleBackgroundSync({ intervalMinutes });
  },
};

/**
 * Hook for checking SMS ingestion availability and status
 */
export function useSmsIngest() {
  const isAvailable = SmsIngest.isAvailable();

  return {
    isAvailable,
    configure: SmsIngest.configure.bind(SmsIngest),
    checkPermissions: SmsIngest.checkPermissions.bind(SmsIngest),
    requestPermissions: SmsIngest.requestPermissions.bind(SmsIngest),
    isEnabled: SmsIngest.isEnabled.bind(SmsIngest),
    enable: SmsIngest.enable.bind(SmsIngest),
    disable: SmsIngest.disable.bind(SmsIngest),
    querySmsInbox: SmsIngest.querySmsInbox.bind(SmsIngest),
    markSyncComplete: SmsIngest.markSyncComplete.bind(SmsIngest),
    scheduleBackgroundSync: SmsIngest.scheduleBackgroundSync.bind(SmsIngest),
  };
}
