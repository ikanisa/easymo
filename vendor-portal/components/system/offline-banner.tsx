"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { useMemo } from "react";
import { useOfflineQueue } from "@/providers/offline-queue-provider";

export function OfflineBanner() {
  const { isOnline, actions, pendingCount } = useOfflineQueue();

  const failedCount = useMemo(
    () => actions.filter((action) => action.status === "failed").length,
    [actions]
  );
  const syncingCount = useMemo(
    () => actions.filter((action) => action.status === "syncing").length,
    [actions]
  );

  if (isOnline && pendingCount === 0 && failedCount === 0) {
    return null;
  }

  const tone = failedCount > 0 ? "bg-red-500/20 text-red-100" : "bg-amber-400/20 text-amber-100";
  const Icon = failedCount > 0 ? AlertTriangle : Loader2;
  const message =
    failedCount > 0
      ? `${failedCount} action${failedCount === 1 ? "" : "s"} need attention`
      : isOnline
        ? `Syncing ${pendingCount + syncingCount} queued action${pendingCount + syncingCount === 1 ? "" : "s"}`
        : `Offline · ${pendingCount} queued action${pendingCount === 1 ? "" : "s"}`;

  const description =
    failedCount > 0
      ? "Resolve conflicts to finish syncing."
      : isOnline
        ? "Hang tight while we reconcile your changes."
        : "You're working offline. We'll sync once you're back online.";

  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-2xl border border-white/10 px-4 py-3 text-sm ${tone}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <Icon className={`h-4 w-4 ${Icon === Loader2 ? "animate-spin" : ""}`} aria-hidden />
        <div>
          <p className="font-semibold tracking-wide">{message}</p>
          <p className="text-[12px] text-white/80">{description}</p>
        </div>
      </div>
    </div>
  );
}

export default OfflineBanner;
