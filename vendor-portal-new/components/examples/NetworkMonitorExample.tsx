"use client";

import { useEffect, useState } from "react";
import NetworkMonitor, { type NetworkStatus } from "@/lib/plugins/network-monitor";
import { Wifi, WifiOff, Signal, Smartphone } from "lucide-react";
import { logError, logInfo } from "@/lib/observability/logger";

/**
 * Example component demonstrating NetworkMonitor plugin usage
 *
 * Features:
 * - Display current network status
 * - Monitor network changes in real-time
 * - Show connection quality metrics
 * - Detect metered connections
 */
export function NetworkMonitorExample() {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusHistory, setStatusHistory] = useState<NetworkStatus[]>([]);

  useEffect(() => {
    getInitialStatus();
    return () => {
      if (isMonitoring) {
        NetworkMonitor.stopMonitoring();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getInitialStatus = async () => {
    try {
      const status = await NetworkMonitor.getStatus();
      setNetworkStatus(status);
    } catch (error) {
      logError("network_monitor_get_status_failed", { error });
    }
  };

  const startMonitoring = async () => {
    setLoading(true);
    try {
      await NetworkMonitor.startMonitoring();

      // Add listener for network changes
      await NetworkMonitor.addListener("networkStatusChange", (status) => {
        logInfo("network_status_changed", { status });
        setNetworkStatus(status);
        setStatusHistory((prev) => [status, ...prev].slice(0, 5)); // Keep last 5
      });

      setIsMonitoring(true);
      alert("Network monitoring started");
    } catch (error) {
      console.error("Failed to start monitoring:", error);
      alert("Error starting monitoring");
    } finally {
      setLoading(false);
    }
  };

  const stopMonitoring = async () => {
    setLoading(true);
    try {
      await NetworkMonitor.stopMonitoring();
      setIsMonitoring(false);
      alert("Network monitoring stopped");
    } catch (error) {
      console.error("Failed to stop monitoring:", error);
      alert("Error stopping monitoring");
    } finally {
      setLoading(false);
    }
  };

  const refreshStatus = async () => {
    setLoading(true);
    try {
      const status = await NetworkMonitor.getStatus();
      setNetworkStatus(status);
    } catch (error) {
      console.error("Failed to refresh status:", error);
      alert("Error refreshing status");
    } finally {
      setLoading(false);
    }
  };

  const getConnectionIcon = () => {
    if (!networkStatus?.connected) {
      return <WifiOff className="w-8 h-8 text-red-600" />;
    }

    switch (networkStatus.connectionType) {
      case "wifi":
        return <Wifi className="w-8 h-8 text-green-600" />;
      case "cellular":
        return <Signal className="w-8 h-8 text-blue-600" />;
      case "ethernet":
        return <Smartphone className="w-8 h-8 text-purple-600" />;
      default:
        return <Wifi className="w-8 h-8 text-gray-600" />;
    }
  };

  const getConnectionColor = () => {
    if (!networkStatus?.connected) return "text-red-600";
    switch (networkStatus.connectionType) {
      case "wifi":
        return "text-green-600";
      case "cellular":
        return "text-blue-600";
      case "ethernet":
        return "text-purple-600";
      default:
        return "text-gray-600";
    }
  };

  const formatBandwidth = (kbps: number | undefined) => {
    if (!kbps) return "N/A";
    if (kbps >= 1000) {
      return `${(kbps / 1000).toFixed(1)} Mbps`;
    }
    return `${kbps} Kbps`;
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center gap-3 mb-6">
          {getConnectionIcon()}
          <h2 className="text-2xl font-bold">Network Monitor Demo</h2>
        </div>

        {/* Current Status */}
        {networkStatus && (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded">
            <h3 className="font-semibold mb-3">Current Status</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Connection:</span>
                <span className={`font-medium ${getConnectionColor()}`}>
                  {networkStatus.connected ? "Connected" : "Disconnected"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Type:</span>
                <span className="font-medium capitalize">{networkStatus.connectionType}</span>
              </div>
              {networkStatus.isMetered !== undefined && (
                <div className="flex justify-between">
                  <span>Metered:</span>
                  <span
                    className={`font-medium ${networkStatus.isMetered ? "text-orange-600" : "text-green-600"}`}
                  >
                    {networkStatus.isMetered ? "Yes (Limited Data)" : "No (Unlimited)"}
                  </span>
                </div>
              )}
              {networkStatus.linkDownstreamBandwidthKbps !== undefined && (
                <div className="flex justify-between">
                  <span>Download Speed:</span>
                  <span className="font-medium">
                    {formatBandwidth(networkStatus.linkDownstreamBandwidthKbps)}
                  </span>
                </div>
              )}
              {networkStatus.linkUpstreamBandwidthKbps !== undefined && (
                <div className="flex justify-between">
                  <span>Upload Speed:</span>
                  <span className="font-medium">
                    {formatBandwidth(networkStatus.linkUpstreamBandwidthKbps)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3 mb-6">
          <button
            onClick={refreshStatus}
            disabled={loading}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {loading ? "Refreshing..." : "Refresh Status"}
          </button>

          {!isMonitoring ? (
            <button
              onClick={startMonitoring}
              disabled={loading}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
            >
              Start Monitoring
            </button>
          ) : (
            <button
              onClick={stopMonitoring}
              disabled={loading}
              className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium"
            >
              Stop Monitoring
            </button>
          )}
        </div>

        {/* Status History */}
        {statusHistory.length > 0 && (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded">
            <h3 className="font-semibold mb-3">Recent Changes</h3>
            <div className="space-y-2">
              {statusHistory.map((status, index) => (
                <div key={index} className="text-sm p-2 bg-white dark:bg-gray-800 rounded">
                  <span className="font-medium">{status.connectionType}</span>
                  {" - "}
                  <span className={status.connected ? "text-green-600" : "text-red-600"}>
                    {status.connected ? "Connected" : "Disconnected"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info */}
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded text-sm">
          <p className="font-medium mb-2">💡 Features Demonstrated:</p>
          <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-300">
            <li>Real-time network connectivity monitoring</li>
            <li>Connection type detection (WiFi/Cellular/Ethernet)</li>
            <li>Bandwidth quality metrics</li>
            <li>Metered connection detection</li>
            <li>Network change event listeners</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
