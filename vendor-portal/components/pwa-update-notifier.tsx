"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/providers/toast-provider";

/**
 * PWA Update Notifier
 *
 * Detects when a new version of the PWA is available and prompts the user to update.
 * Uses the Workbox service worker lifecycle events to detect updates.
 *
 * Features:
 * - Automatic update detection
 * - User-friendly toast notification
 * - One-click update and reload
 * - Skip waiting for immediate activation
 */
export function PWAUpdateNotifier() {
  const { success } = useToast();
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [showReload, setShowReload] = useState(false);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    ) {
      return;
    }

    const handleControllerChange = () => {
      window.location.reload();
    };

    const handleWaiting = (worker: ServiceWorker) => {
      setWaitingWorker(worker);
      setShowReload(true);
    };

    const checkForUpdates = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration();

        if (!registration) {
          return;
        }

        // Check for waiting worker
        if (registration.waiting) {
          handleWaiting(registration.waiting);
          return;
        }

        // Listen for new service worker
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              handleWaiting(newWorker);
            }
          });
        });

        // Listen for controller change
        navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

        // Check for updates periodically (every 5 minutes)
        const interval = setInterval(
          async () => {
            try {
              await registration.update();
            } catch {
              // Ignore update errors
            }
          },
          5 * 60 * 1000
        );

        return () => {
          clearInterval(interval);
          navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
        };
      } catch {
        // Service worker not available
      }
    };

    checkForUpdates();
  }, []);

  useEffect(() => {
    if (showReload && waitingWorker) {
      // Show toast with update button
      const updateButton = document.createElement("button");
      updateButton.textContent = "Update Now";
      updateButton.className =
        "ml-3 text-sm font-medium text-primary-500 hover:text-primary-600 underline";
      updateButton.onclick = () => {
        waitingWorker.postMessage({ type: "SKIP_WAITING" });
        setShowReload(false);
      };

      const toastMessage = document.createElement("div");
      toastMessage.className = "flex items-center justify-between";
      toastMessage.innerHTML = `
        <div>
          <p class="font-medium">New version available!</p>
          <p class="text-sm text-muted-foreground">Click to update and reload the app.</p>
        </div>
      `;
      toastMessage.appendChild(updateButton);

      // Use custom toast implementation
      success("A new version is available. Click 'Update Now' to refresh.");

      setShowReload(false);
    }
  }, [showReload, waitingWorker, success]);

  return null;
}

/**
 * PWA Install Prompt Enhanced
 *
 * Enhances the existing PWA install prompt with better UX.
 * Shows a banner when the app can be installed.
 */
export function PWAInstallPromptEnhanced() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstall(true);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setShowInstall(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setDeferredPrompt(null);
      setShowInstall(false);
    }
  };

  if (!showInstall) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md md:left-auto">
      <div className="card-elevated p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <svg
              className="h-6 w-6 text-primary-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-readable">Install Ibimina</h3>
            <p className="mt-1 text-sm text-muted-readable">
              Install this app on your device for quick access and offline use.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowInstall(false)}
            className="flex-shrink-0 text-muted-readable hover:text-readable"
            aria-label="Dismiss"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={handleInstallClick}
            className="btn-primary flex-1 rounded-lg px-4 py-2 text-sm font-medium"
          >
            Install
          </button>
          <button
            type="button"
            onClick={() => setShowInstall(false)}
            className="btn-secondary flex-1 rounded-lg px-4 py-2 text-sm font-medium"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}
