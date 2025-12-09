"use client";

import { useEffect, useState } from "react";
import { SmsIngest } from "@/lib/native/sms-ingest";

type PermissionState = "prompt" | "granted" | "denied";

export default function SmsConsentPage() {
  const [isNative, setIsNative] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<PermissionState>("prompt");
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAvailability = async () => {
      const available = SmsIngest.isAvailable();
      setIsNative(available);

      if (available) {
        const perms = await SmsIngest.checkPermissions();
        setPermissionStatus(perms.state);

        const enabled = await SmsIngest.isEnabled();
        setIsEnabled(enabled);
      }
    };

    void checkAvailability();
  }, []);

  const handleRequestPermissions = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await SmsIngest.requestPermissions();
      setPermissionStatus(result.state);

      if (result.state === "granted") {
        await SmsIngest.enable();
        await SmsIngest.scheduleBackgroundSync(15);
        setIsEnabled(true);
      } else {
        setError("SMS permissions were denied. This feature requires SMS access to function.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to request permissions");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async (enabled: boolean) => {
    setIsLoading(true);
    setError(null);

    try {
      if (enabled) {
        if (permissionStatus !== "granted") {
          await handleRequestPermissions();
        } else {
          await SmsIngest.enable();
          await SmsIngest.scheduleBackgroundSync(15);
          setIsEnabled(true);
        }
      } else {
        await SmsIngest.disable();
        setIsEnabled(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle SMS ingestion");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isNative) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg dark:bg-gray-800">
          <h1 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">
            SMS Ingestion Not Available
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            This feature is only available on the native Android app. Please use the mobile app to
            enable SMS-based payment ingestion.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8 dark:bg-gray-900">
      <div className="w-full max-w-2xl rounded-lg bg-white p-8 shadow-lg dark:bg-gray-800">
        <div className="mb-6">
          <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
            SMS Payment Ingestion
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Enable automatic payment processing from mobile money SMS notifications
          </p>
        </div>
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
          <h2 className="mb-3 text-lg font-semibold text-blue-900 dark:text-blue-100">
            📱 What we access
          </h2>
          <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>
                <strong>Mobile money SMS only:</strong> We only read messages from MTN MoMo and
                Airtel Money (identified by sender number)
              </span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>
                <strong>Payment information:</strong> Amount, transaction ID, sender phone number,
                and reference code
              </span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>
                <strong>No personal SMS:</strong> Your personal messages, contacts, and other SMS
                are never accessed
              </span>
            </li>
          </ul>
        </div>

        <div className="mb-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">How it works</h2>
          <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
            {[
              "Background monitoring every 15 minutes for new confirmations",
              "Secure parsing and encrypted upload to Supabase",
              "Automatic member allocation via reference codes",
              "No local storage — SMS data is forwarded instantly",
            ].map((item, index) => (
              <div key={item} className="flex items-start">
                <span className="mr-3 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                  {index + 1}
                </span>
                <p>{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/30">
          <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Status</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Permissions:{" "}
            <span className="font-semibold">
              {permissionStatus === "prompt" ? "Not requested" : permissionStatus}
            </span>
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            SMS ingestion:{" "}
            <span className="font-semibold">{isEnabled ? "Enabled" : "Disabled"}</span>
          </p>
          {error && (
            <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleRequestPermissions}
              disabled={isLoading}
              className="inline-flex flex-1 items-center justify-center rounded-full bg-kigali px-4 py-2 text-sm font-semibold text-ink transition hover:bg-kigali/90 disabled:opacity-60"
            >
              {isLoading ? "Requesting…" : "Request permissions"}
            </button>
            <button
              type="button"
              onClick={() => void handleToggle(!isEnabled)}
              disabled={isLoading}
              className="inline-flex flex-1 items-center justify-center rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-gray-400 dark:border-gray-700 dark:text-gray-200 disabled:opacity-60"
            >
              {isEnabled ? "Disable ingestion" : "Enable ingestion"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
