"use client";

import { useEffect, useState } from "react";
import EnhancedNotifications from "@/lib/plugins/enhanced-notifications";
import { Bell, CheckCircle, XCircle } from "lucide-react";
import { logError, logInfo } from "@/lib/observability/logger";

/**
 * Example component demonstrating EnhancedNotifications plugin usage
 *
 * Features:
 * - Request notification permissions
 * - Show notifications with different channels
 * - Add action buttons to notifications
 * - Cancel notifications
 */
export function NotificationExample() {
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastNotificationId, setLastNotificationId] = useState<number | null>(null);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    try {
      const { granted } = await EnhancedNotifications.checkPermissions();
      setPermissionGranted(granted);
    } catch (error) {
      logError("notification_permissions_check_failed", { error });
    }
  };

  const requestPermissions = async () => {
    setLoading(true);
    try {
      const { granted } = await EnhancedNotifications.requestPermissions();
      setPermissionGranted(granted);
      if (granted) {
        alert("Notification permissions granted!");
      } else {
        alert("Notification permissions denied");
      }
    } catch (error) {
      console.error("Failed to request permissions:", error);
      alert("Error requesting permissions");
    } finally {
      setLoading(false);
    }
  };

  const showTransactionNotification = async () => {
    if (!permissionGranted) {
      alert("Please grant notification permissions first");
      return;
    }

    setLoading(true);
    try {
      const { id } = await EnhancedNotifications.showNotification({
        title: "Transaction Complete",
        body: "Jean Doe deposited 50,000 RWF",
        channelId: "transactions",
        groupKey: "transactions",
        actions: [
          { id: "view", title: "View Details" },
          { id: "share", title: "Share Receipt" },
        ],
        data: JSON.stringify({ transactionId: "tx_123", amount: 50000 }),
      });
      setLastNotificationId(id);
      logInfo("notification_shown", { id });
    } catch (error) {
      logError("notification_show_failed", { error });
      alert("Error showing notification");
    } finally {
      setLoading(false);
    }
  };

  const showAlertNotification = async () => {
    if (!permissionGranted) {
      alert("Please grant notification permissions first");
      return;
    }

    setLoading(true);
    try {
      const { id } = await EnhancedNotifications.showNotification({
        title: "Important Alert",
        body: "New member application requires approval",
        channelId: "alerts",
        priority: 1, // High priority
        actions: [
          { id: "approve", title: "Approve" },
          { id: "review", title: "Review" },
        ],
      });
      setLastNotificationId(id);
      logInfo("alert_notification_shown", { id });
    } catch (error) {
      logError("alert_notification_failed", { error });
      alert("Error showing alert");
    } finally {
      setLoading(false);
    }
  };

  const cancelLastNotification = async () => {
    if (!lastNotificationId) {
      alert("No notification to cancel");
      return;
    }

    setLoading(true);
    try {
      await EnhancedNotifications.cancelNotification({ id: lastNotificationId });
      alert("Notification cancelled");
      setLastNotificationId(null);
    } catch (error) {
      console.error("Failed to cancel notification:", error);
      alert("Error cancelling notification");
    } finally {
      setLoading(false);
    }
  };

  const cancelAllNotifications = async () => {
    setLoading(true);
    try {
      await EnhancedNotifications.cancelAllNotifications();
      alert("All notifications cancelled");
      setLastNotificationId(null);
    } catch (error) {
      console.error("Failed to cancel all notifications:", error);
      alert("Error cancelling notifications");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center gap-3 mb-6">
          <Bell className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold">Enhanced Notifications Demo</h2>
        </div>

        {/* Permission Status */}
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded">
          <div className="flex items-center justify-between">
            <span className="font-medium">Notification Permissions:</span>
            <div className="flex items-center gap-2">
              {permissionGranted ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-green-600">Granted</span>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-red-600" />
                  <span className="text-red-600">Not Granted</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {!permissionGranted && (
            <button
              onClick={requestPermissions}
              disabled={loading}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {loading ? "Requesting..." : "Request Permissions"}
            </button>
          )}

          <button
            onClick={showTransactionNotification}
            disabled={loading || !permissionGranted}
            className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
          >
            Show Transaction Notification
          </button>

          <button
            onClick={showAlertNotification}
            disabled={loading || !permissionGranted}
            className="w-full px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 font-medium"
          >
            Show Alert Notification
          </button>

          <button
            onClick={cancelLastNotification}
            disabled={loading || !lastNotificationId}
            className="w-full px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 font-medium"
          >
            Cancel Last Notification
          </button>

          <button
            onClick={cancelAllNotifications}
            disabled={loading}
            className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium"
          >
            Cancel All Notifications
          </button>
        </div>

        {/* Info */}
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded text-sm">
          <p className="font-medium mb-2">💡 Features Demonstrated:</p>
          <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-300">
            <li>Requesting notification permissions (Android 13+)</li>
            <li>Custom notification channels (transactions, alerts)</li>
            <li>Action buttons in notifications</li>
            <li>Notification grouping</li>
            <li>Canceling individual or all notifications</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
