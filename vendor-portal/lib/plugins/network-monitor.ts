import { registerPlugin } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";

/**
 * Network Monitor Plugin
 *
 * Provides real-time network connectivity monitoring with:
 * - Connection type detection (WiFi, Cellular, Ethernet)
 * - Connection quality estimation
 * - Network change notifications
 * - Offline/online state management
 */

export type ConnectionType = "wifi" | "cellular" | "ethernet" | "bluetooth" | "none" | "unknown";

export interface NetworkStatus {
  connected: boolean;
  connectionType: ConnectionType;
  isMetered?: boolean;
  linkDownstreamBandwidthKbps?: number;
  linkUpstreamBandwidthKbps?: number;
}

export interface NetworkMonitorPlugin {
  /**
   * Get current network status
   */
  getStatus(): Promise<NetworkStatus>;

  /**
   * Start monitoring network changes
   * Emits 'networkStatusChange' events
   */
  startMonitoring(): Promise<{ success: boolean }>;

  /**
   * Stop monitoring network changes
   */
  stopMonitoring(): Promise<{ success: boolean }>;

  /**
   * Add listener for network status changes
   */
  addListener(
    eventName: "networkStatusChange",
    listenerFunc: (status: NetworkStatus) => void
  ): Promise<PluginListenerHandle>;
}

const NetworkMonitor = registerPlugin<NetworkMonitorPlugin>("NetworkMonitor");

export default NetworkMonitor;
