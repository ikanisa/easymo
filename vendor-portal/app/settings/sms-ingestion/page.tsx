"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SmsIngest, type SmsMessage } from "@/lib/native/sms-ingest";
import { logError } from "@/lib/observability/logger";

/**
 * SMS Ingestion Settings Page
 *
 * Allows staff to:
 * - View current status
 * - Enable/disable SMS ingestion
 * - Test SMS reading functionality
 * - View recent ingested messages
 * - Configure sync settings
 */
export default function SmsIngestionSettingsPage() {
  const router = useRouter();
  const [isNative, setIsNative] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<"prompt" | "granted" | "denied">(
    "prompt"
  );
  const [isLoading, setIsLoading] = useState(false);
  const [testMessages, setTestMessages] = useState<SmsMessage[]>([]);
  const [syncInterval, setSyncInterval] = useState(15);
  const [showTest, setShowTest] = useState(false);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    const available = SmsIngest.isAvailable();
    setIsNative(available);

    if (available) {
      const perms = await SmsIngest.checkPermissions();
      setPermissionStatus(perms.state);

      const enabled = await SmsIngest.isEnabled();
      setIsEnabled(enabled);
    }
  };

  const handleToggle = async () => {
    if (permissionStatus !== "granted") {
      // Redirect to consent page
      router.push("/settings/sms-consent");
      return;
    }

    setIsLoading(true);
    try {
      if (isEnabled) {
        await SmsIngest.disable();
        setIsEnabled(false);
      } else {
        await SmsIngest.enable();
        await SmsIngest.scheduleBackgroundSync(syncInterval);
        setIsEnabled(true);
      }
    } catch (error) {
      logError("sms_ingestion.toggle_failed", { error });
      alert("Failed to toggle SMS ingestion. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestRead = async () => {
    setIsLoading(true);
    setShowTest(true);
    try {
      const messages = await SmsIngest.querySmsInbox({ limit: 10 });
      setTestMessages(messages);
    } catch (error) {
      logError("sms_ingestion.read_failed", { error });
      alert("Failed to read SMS. Make sure permissions are granted.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateInterval = async () => {
    setIsLoading(true);
    try {
      await SmsIngest.scheduleBackgroundSync(syncInterval);
      alert(`Sync interval updated to ${syncInterval} minutes`);
    } catch (error) {
      logError("sms_ingestion.update_interval_failed", { error });
      alert("Failed to update sync interval. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isNative) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h1 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">
            SMS Ingestion Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            SMS ingestion is only available on the native Android app. This feature allows automatic
            processing of mobile money payment notifications.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
          SMS Ingestion Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Manage automatic payment processing from mobile money SMS
        </p>
      </div>

      {/* Status Card */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Feature Status</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {isEnabled
                ? "SMS ingestion is active and monitoring for payments"
                : "SMS ingestion is currently disabled"}
            </p>
          </div>
          <div
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              isEnabled
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
            }`}
          >
            {isEnabled ? "Active" : "Inactive"}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
          <div>
            <p className="font-medium text-gray-900 dark:text-white">Enable SMS Ingestion</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {permissionStatus === "granted"
                ? "Toggle to enable or disable automatic SMS processing"
                : "Permissions required - click to set up"}
            </p>
          </div>
          <button
            onClick={handleToggle}
            disabled={isLoading}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              isEnabled ? "bg-green-600" : "bg-gray-300 dark:bg-gray-600"
            } ${isLoading ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600 dark:text-gray-400">Permission Status</p>
            <p className="font-medium text-gray-900 dark:text-white capitalize">
              {permissionStatus}
            </p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-gray-400">Platform</p>
            <p className="font-medium text-gray-900 dark:text-white">Android Native</p>
          </div>
        </div>
      </div>

      {/* Sync Configuration */}
      {permissionStatus === "granted" && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Sync Configuration
          </h2>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="syncInterval"
                className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Background Sync Interval: {syncInterval} minutes
              </label>
              <input
                type="range"
                id="syncInterval"
                min="5"
                max="60"
                step="5"
                value={syncInterval}
                onChange={(e) => setSyncInterval(Number(e.target.value))}
                className="w-full"
              />
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                How often to check for new mobile money SMS (5-60 minutes)
              </p>
            </div>
            <button
              onClick={handleUpdateInterval}
              disabled={isLoading || !isEnabled}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              Update Interval
            </button>
          </div>
        </div>
      )}

      {/* Test Section */}
      {permissionStatus === "granted" && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Test SMS Reading
          </h2>
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            Test the SMS reading functionality to see recent mobile money messages
          </p>
          <button
            onClick={handleTestRead}
            disabled={isLoading}
            className="rounded-lg bg-gray-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-500 dark:hover:bg-gray-600"
          >
            {isLoading ? "Reading..." : "Test Read SMS"}
          </button>

          {showTest && (
            <div className="mt-4">
              <h3 className="mb-2 font-medium text-gray-900 dark:text-white">
                Recent Messages ({testMessages.length})
              </h3>
              {testMessages.length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  No mobile money SMS found in recent messages
                </p>
              ) : (
                <div className="space-y-2">
                  {testMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-700 dark:bg-gray-900"
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {msg.address}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(msg.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-gray-700 dark:text-gray-300">{msg.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Privacy & Support */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Privacy & Support
        </h2>
        <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
          <p>• SMS data is only read from mobile money providers (MTN, Airtel)</p>
          <p>• Messages are immediately sent to secure servers and not stored locally</p>
          <p>• Phone numbers are encrypted before storage</p>
          <p>• You can disable this feature at any time</p>
          <div className="mt-4 flex gap-4">
            <a href="/privacy" className="text-blue-600 underline dark:text-blue-400">
              Privacy Policy
            </a>
            <a href="/settings/sms-consent" className="text-blue-600 underline dark:text-blue-400">
              View Full Consent Details
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
