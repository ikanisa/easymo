/**
 * Staff Password Change Component
 *
 * Allows staff to change their password with platform restrictions
 * Password changes are only allowed via web app, not mobile
 */

"use client";

import { useState, useEffect } from "react";
import { Lock, AlertTriangle } from "lucide-react";
import { getPlatformType, isWebPlatform } from "@/lib/platform";

interface PasswordChangeProps {
  onSuccess?: () => void;
}

export function PasswordChange({ onSuccess }: PasswordChangeProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [platformType, setPlatformType] = useState<string>("unknown");
  const [isWeb, setIsWeb] = useState(true);

  useEffect(() => {
    const platform = getPlatformType();
    setPlatformType(platform);
    setIsWeb(isWebPlatform());
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("All fields are required");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters long");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    if (currentPassword === newPassword) {
      setError("New password must be different from current password");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch("/api/staff/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.platform_restriction) {
          setError(
            "Password changes are not allowed on mobile devices. Please use the web application."
          );
        } else {
          setError(data.error || "Failed to change password");
        }
        return;
      }

      // Success
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      if (onSuccess) {
        onSuccess();
      }

      // Auto-dismiss success message after 5 seconds
      setTimeout(() => {
        setSuccess(false);
      }, 5000);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Show restriction message on mobile
  if (!isWeb) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 bg-amber-900/20 border border-amber-700 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2">
            <h3 className="font-medium text-amber-200">Mobile Platform Restriction</h3>
            <p className="text-sm text-amber-300/80">
              For security reasons, password changes are only allowed through the web application.
            </p>
            <p className="text-sm text-amber-300/80">
              Please log in to the web app at{" "}
              <a
                href="https://staff.ibimina.rw"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-amber-200"
              >
                staff.ibimina.rw
              </a>{" "}
              to change your password.
            </p>
            <p className="text-xs text-amber-400 mt-2">
              Current platform: <span className="font-mono">{platformType}</span>
            </p>
          </div>
        </div>

        <div className="p-4 bg-neutral-9/30 border border-neutral-2/30 rounded-lg">
          <h4 className="text-sm font-medium text-neutral-1 mb-2">Why this restriction?</h4>
          <ul className="text-sm text-neutral-2 space-y-1 list-disc list-inside">
            <li>Enhanced security for password management</li>
            <li>Verified web session required for sensitive changes</li>
            <li>Prevents unauthorized access from lost/stolen devices</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success message */}
      {success && (
        <div className="p-4 bg-green-900/20 border border-green-700 rounded-lg">
          <p className="text-sm text-green-200">
            Password changed successfully! Please use your new password for future logins.
          </p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg">
          <p className="text-sm text-red-200">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Current Password */}
        <div>
          <label
            htmlFor="current-password"
            className="block text-sm font-medium text-neutral-1 mb-2"
          >
            Current Password{" "}
            <span className="text-red-400" aria-label="required">
              *
            </span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-neutral-2" aria-hidden="true" />
            </div>
            <input
              id="current-password"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                setError(null);
              }}
              disabled={isLoading}
              className="w-full pl-10 pr-4 py-3 rounded-lg bg-neutral-9/50 border border-neutral-2/30 text-neutral-0 placeholder:text-neutral-2 focus:outline-none focus:ring-2 focus:ring-rw-blue focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* New Password */}
        <div>
          <label htmlFor="new-password" className="block text-sm font-medium text-neutral-1 mb-2">
            New Password{" "}
            <span className="text-red-400" aria-label="required">
              *
            </span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-neutral-2" aria-hidden="true" />
            </div>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              required
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setError(null);
              }}
              disabled={isLoading}
              className="w-full pl-10 pr-4 py-3 rounded-lg bg-neutral-9/50 border border-neutral-2/30 text-neutral-0 placeholder:text-neutral-2 focus:outline-none focus:ring-2 focus:ring-rw-blue focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <p className="mt-2 text-xs text-neutral-2">Must be at least 8 characters long</p>
        </div>

        {/* Confirm New Password */}
        <div>
          <label
            htmlFor="confirm-password"
            className="block text-sm font-medium text-neutral-1 mb-2"
          >
            Confirm New Password{" "}
            <span className="text-red-400" aria-label="required">
              *
            </span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-neutral-2" aria-hidden="true" />
            </div>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setError(null);
              }}
              disabled={isLoading}
              className="w-full pl-10 pr-4 py-3 rounded-lg bg-neutral-9/50 border border-neutral-2/30 text-neutral-0 placeholder:text-neutral-2 focus:outline-none focus:ring-2 focus:ring-rw-blue focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className={`w-full px-6 py-3 text-base font-semibold rounded-lg transition-all focus-visible:ring-4 focus-visible:ring-rw-blue focus-visible:ring-opacity-50 ${
            isLoading
              ? "bg-neutral-2/30 text-neutral-2 cursor-not-allowed"
              : "bg-rw-blue text-ink hover:bg-opacity-90"
          }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Changing Password...
            </span>
          ) : (
            "Change Password"
          )}
        </button>
      </form>

      {/* Security Notice */}
      <div className="p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
        <h4 className="text-sm font-medium text-blue-200 mb-2">Security Tips</h4>
        <ul className="text-sm text-blue-300/80 space-y-1 list-disc list-inside">
          <li>Use a strong, unique password</li>
          <li>Include letters, numbers, and special characters</li>
          <li>Don&apos;t reuse passwords from other accounts</li>
          <li>Consider using a password manager</li>
        </ul>
      </div>
    </div>
  );
}
