"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Wifi, WifiOff, X } from "lucide-react";
import { useOfflineQueue } from "@/providers/offline-queue-provider";
import { useToast } from "@/providers/toast-provider";

interface NetworkStatusContextValue {
  isOnline: boolean;
  lastChangedAt: number | null;
  showBanner: () => void;
  hideBanner: () => void;
}

const NetworkStatusContext = createContext<NetworkStatusContextValue | null>(null);

const timeFormatter = new Intl.DateTimeFormat("en-RW", {
  hour: "2-digit",
  minute: "2-digit",
});

export function NetworkStatusProvider({ children }: { children: React.ReactNode }) {
  const { isOnline, pendingCount, lastSyncedAt } = useOfflineQueue();
  const { info, success } = useToast();
  const [visible, setVisible] = useState(false);
  const [lastChangedAt, setLastChangedAt] = useState<number | null>(null);
  const [status, setStatus] = useState<"online" | "offline">("online");
  const initialized = useRef(false);
  const dismissalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showBanner = () => setVisible(true);
  const hideBanner = () => {
    if (dismissalTimer.current) {
      clearTimeout(dismissalTimer.current);
      dismissalTimer.current = null;
    }
    setVisible(false);
  };

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      if (!isOnline) {
        setStatus("offline");
        setVisible(true);
      }
      return;
    }

    setLastChangedAt(Date.now());
    setStatus(isOnline ? "online" : "offline");

    if (isOnline) {
      success(
        pendingCount > 0
          ? `Back online. Resuming sync for ${pendingCount} change${pendingCount === 1 ? "" : "s"}.`
          : "Back online. You now have the latest data."
      );
      setVisible(true);
      if (dismissalTimer.current) {
        clearTimeout(dismissalTimer.current);
      }
      dismissalTimer.current = setTimeout(() => setVisible(false), 5500);
    } else {
      info(
        pendingCount > 0
          ? `You're offline. ${pendingCount} change${pendingCount === 1 ? "" : "s"} queued for sync.`
          : "You're offline. We'll queue your changes until you're back online."
      );
      setVisible(true);
      if (dismissalTimer.current) {
        clearTimeout(dismissalTimer.current);
        dismissalTimer.current = null;
      }
    }
  }, [info, isOnline, pendingCount, success]);

  useEffect(() => () => dismissalTimer.current && clearTimeout(dismissalTimer.current), []);

  const value = useMemo(
    () => ({
      isOnline,
      lastChangedAt,
      showBanner,
      hideBanner,
    }),
    [isOnline, lastChangedAt]
  );

  const tone =
    status === "online"
      ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-50"
      : "border-amber-400/60 bg-amber-500/10 text-amber-50";

  const Icon = status === "online" ? Wifi : WifiOff;

  const description =
    status === "online"
      ? lastSyncedAt
        ? `Last sync completed at ${timeFormatter.format(lastSyncedAt)}.`
        : "Sync is back on."
      : pendingCount > 0
        ? `${pendingCount} queued change${pendingCount === 1 ? "" : "s"} will sync automatically.`
        : "Working offline. Navigation is limited to cached pages.";

  return (
    <NetworkStatusContext.Provider value={value}>
      {visible && (
        <div
          className="fixed inset-x-4 top-4 z-50 flex justify-center md:inset-x-auto md:right-6"
          aria-live="polite"
        >
          <div
            className={`flex w-full max-w-xl items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur ${tone}`}
            data-testid="network-status-banner"
            data-state={status}
          >
            <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-black/20">
              <Icon className="h-4 w-4" aria-hidden />
            </div>
            <div className="flex-1 text-sm">
              <p className="font-semibold tracking-wide">
                {status === "online" ? "Back online" : "Offline mode"}
              </p>
              <p className="text-xs text-white/80">{description}</p>
            </div>
            <button
              type="button"
              onClick={hideBanner}
              className="rounded-full p-1 text-white/70 transition hover:bg-white/10 hover:text-white"
              aria-label="Dismiss network status"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      )}
      {children}
    </NetworkStatusContext.Provider>
  );
}

export function useNetworkStatus() {
  const context = useContext(NetworkStatusContext);
  if (!context) {
    throw new Error("useNetworkStatus must be used within NetworkStatusProvider");
  }
  return context;
}
