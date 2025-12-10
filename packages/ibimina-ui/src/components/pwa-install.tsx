"use client";

import { useState, useEffect } from "react";
import { cn } from "../utils/cn";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export interface PWAInstallPromptProps {
  appName?: string;
  description?: string;
  onInstall?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function PWAInstallPrompt({
  appName = "SACCO+",
  description = "Install our app for quick access and offline support",
  onInstall,
  onDismiss,
  className,
}: PWAInstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    // Check if user has dismissed before
    const dismissed = localStorage.getItem("pwa-install-dismissed");
    if (dismissed) {
      const dismissedDate = new Date(dismissed);
      const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        return; // Don't show for 7 days after dismissal
      }
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Check for iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isInStandaloneMode =
      "standalone" in window.navigator && (window.navigator as any).standalone;

    if (isIOS && !isInStandaloneMode) {
      setIsVisible(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      console.log("PWA installed");
      onInstall?.();
      setIsVisible(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem("pwa-install-dismissed", new Date().toISOString());
    setIsVisible(false);
    onDismiss?.();
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  if (isInstalled || !isVisible) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-xl border border-atlas-blue/30 bg-white p-4 shadow-2xl dark:bg-neutral-900 md:left-auto md:right-4",
        className
      )}
      role="dialog"
      aria-labelledby="pwa-install-title"
      aria-describedby="pwa-install-description"
    >
      <div className="flex gap-4">
        <div className="flex-shrink-0">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-atlas-blue/10">
            <svg
              className="h-6 w-6 text-atlas-blue"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <h3
            id="pwa-install-title"
            className="font-semibold text-neutral-900 dark:text-neutral-100"
          >
            Install {appName}
          </h3>
          <p
            id="pwa-install-description"
            className="mt-1 text-sm text-neutral-600 dark:text-neutral-400"
          >
            {description}
          </p>

          {isIOS ? (
            <div className="mt-3 space-y-2 text-sm">
              <p className="font-medium text-neutral-900 dark:text-neutral-100">
                To install on iOS:
              </p>
              <ol className="list-decimal space-y-1 pl-4 text-neutral-600 dark:text-neutral-400">
                <li>
                  Tap the <strong>Share</strong> button{" "}
                  <svg className="inline h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16 5l-1.42 1.42-1.59-1.59V16h-1.98V4.83L9.42 6.42 8 5l4-4 4 4zm4 14H4c-1.1 0-2 .9-2 2v2h20v-2c0-1.1-.9-2-2-2z" />
                  </svg>
                </li>
                <li>Scroll down and tap "Add to Home Screen"</li>
                <li>Tap "Add" to confirm</li>
              </ol>
            </div>
          ) : (
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleInstall}
                className="flex-1 rounded-lg bg-atlas-blue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-atlas-blue-dark"
              >
                Install App
              </button>
              <button
                onClick={handleDismiss}
                className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                aria-label="Dismiss install prompt"
              >
                Not Now
              </button>
            </div>
          )}
        </div>

        {isIOS && (
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
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
        )}
      </div>
    </div>
  );
}

/**
 * Hook to check PWA install status
 */
export function usePWAInstall() {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setCanInstall(false);
      setDeferredPrompt(null);
      return true;
    }

    return false;
  };

  return {
    canInstall,
    isInstalled,
    install,
  };
}

/**
 * Banner for app update available
 */
export interface PWAUpdateBannerProps {
  onUpdate: () => void;
  className?: string;
}

export function PWAUpdateBanner({ onUpdate, className }: PWAUpdateBannerProps) {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        setShowBanner(true);
      });
    }
  }, []);

  if (!showBanner) return null;

  const handleUpdate = () => {
    setShowBanner(false);
    onUpdate();
  };

  return (
    <div
      className={cn(
        "fixed top-4 left-4 right-4 z-50 mx-auto max-w-md rounded-lg border border-green-200 bg-green-50 p-4 shadow-lg dark:border-green-800 dark:bg-green-900/20",
        className
      )}
      role="alert"
    >
      <div className="flex items-center gap-3">
        <svg
          className="h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        <div className="flex-1">
          <p className="text-sm font-medium text-green-900 dark:text-green-100">
            New version available
          </p>
          <p className="mt-0.5 text-xs text-green-700 dark:text-green-300">
            Refresh to get the latest features
          </p>
        </div>
        <button
          onClick={handleUpdate}
          className="flex-shrink-0 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
