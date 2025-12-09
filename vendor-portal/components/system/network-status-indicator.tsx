"use client";

import { useMemo } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { useOfflineQueue } from "@/providers/offline-queue-provider";

const timeFormatter = new Intl.DateTimeFormat("en-RW", {
  hour: "2-digit",
  minute: "2-digit",
});

export function NetworkStatusIndicator() {
  const { isOnline, lastSyncedAt } = useOfflineQueue();

  const label = isOnline ? "Online" : "Offline";
  const Icon = isOnline ? Wifi : WifiOff;
  const statusTone = isOnline
    ? "border-emerald-400/60 text-emerald-100"
    : "border-red-400/60 text-red-100";

  const syncedLabel = useMemo(() => {
    if (!lastSyncedAt) {
      return isOnline ? "Awaiting sync" : "No sync yet";
    }
    return `Last sync ${timeFormatter.format(lastSyncedAt)}`;
  }, [isOnline, lastSyncedAt]);

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-neutral-1"
      role="status"
      aria-live="polite"
    >
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${statusTone}`}
      >
        <Icon className="h-3 w-3" aria-hidden />
        {label}
      </span>
      <span>{syncedLabel}</span>
    </div>
  );
}

export default NetworkStatusIndicator;
