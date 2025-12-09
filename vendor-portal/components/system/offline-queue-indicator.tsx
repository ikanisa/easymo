"use client";

import { useState } from "react";
import { Loader2, RefreshCcw, Wifi, WifiOff, X } from "lucide-react";
import { useOfflineQueue } from "@/providers/offline-queue-provider";
import { useTranslation } from "@/providers/i18n-provider";
import { cn } from "@/lib/utils";

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

export function OfflineQueueIndicator() {
  const { isOnline, actions, pendingCount, retryFailed, clearAction, processing } =
    useOfflineQueue();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  if (isOnline && actions.length === 0) {
    return null;
  }

  const failed = actions.filter((action) => action.status === "failed").length;
  const indicatorTone = !isOnline
    ? "bg-red-500/80"
    : failed > 0
      ? "bg-amber-400/80"
      : "bg-emerald-400/80";
  const helperText = !isOnline
    ? t("system.offlineQueue.banner.offline", "Offline")
    : failed > 0
      ? t("system.offlineQueue.banner.needsRetry", "Needs retry")
      : t("system.offlineQueue.banner.queued", "Queued");

  return (
    <div className="fixed bottom-6 left-6 z-40 flex flex-col items-start gap-3 text-sm">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-left text-sm font-semibold tracking-[0.1em] text-neutral-0 shadow-lg backdrop-blur transition hover:bg-white/20",
          !isOnline && "border-red-400/90 text-red-100",
          failed > 0 && isOnline && "border-amber-400/90 text-amber-100"
        )}
        aria-expanded={open}
        aria-controls="offline-queue-panel"
      >
        <span
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-ink",
            indicatorTone
          )}
        >
          {pendingCount}
        </span>
        <span>{helperText}</span>
      </button>

      {open && (
        <div
          id="offline-queue-panel"
          className="w-80 rounded-3xl border border-white/10 bg-ink/80 p-4 text-neutral-0 shadow-2xl backdrop-blur-xl"
        >
          <header className="mb-3 flex items-center justify-between">
            <div>
              <p className="font-semibold text-neutral-0">
                {t("system.offlineQueue.title", "Offline queue")}
              </p>
              <p className="text-xs text-neutral-2">
                {isOnline ? (
                  <span className="inline-flex items-center gap-1">
                    <Wifi className="h-3 w-3" aria-hidden />
                    <span>{t("common.online", "Online")}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-red-300">
                    <WifiOff className="h-3 w-3" aria-hidden />
                    <span>{t("common.offline", "Offline")}</span>
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-neutral-1 transition hover:border-white/40 hover:text-neutral-0"
                onClick={() => void retryFailed()}
                aria-label={t("system.offlineQueue.retryAria", "Retry queued actions")}
                disabled={processing || actions.length === 0}
              >
                {processing ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <RefreshCcw className="h-4 w-4" aria-hidden />
                )}
              </button>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-neutral-1 transition hover:border-white/40 hover:text-neutral-0"
                onClick={() => setOpen(false)}
                aria-label={t("system.offlineQueue.closeAria", "Close offline queue")}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </header>

          <div className="space-y-3">
            {actions.length === 0 ? (
              <p className="text-xs text-neutral-2">
                {t("system.offlineQueue.empty", "No queued actions.")}
              </p>
            ) : (
              actions.map((action) => {
                const tone: "neutral" | "warning" =
                  action.status === "failed" ? "warning" : "neutral";
                const statusLabel =
                  action.status === "pending"
                    ? t("system.offlineQueue.status.pending", "Queued")
                    : action.status === "syncing"
                      ? t("system.offlineQueue.status.syncing", "Syncing")
                      : t("common.retry", "Retry");
                return (
                  <article
                    key={action.id}
                    className={cn(
                      "rounded-2xl border border-white/10 bg-white/5 p-3 text-xs shadow-inner backdrop-blur",
                      action.status === "failed" &&
                        "border-amber-400/40 bg-amber-400/10 text-amber-50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-neutral-0">{action.summary.primary}</p>
                        <p className="text-[11px] text-neutral-2">{action.summary.secondary}</p>
                      </div>
                      <button
                        type="button"
                        className="text-neutral-3 transition hover:text-neutral-0"
                        onClick={() => void clearAction(action.id)}
                        aria-label={t("system.offlineQueue.removeAction", "Remove action")}
                      >
                        <X className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-neutral-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold tracking-[0.1em]",
                          tone === "warning"
                            ? "bg-amber-400/10 text-amber-200"
                            : "bg-white/10 text-neutral-1"
                        )}
                      >
                        {statusLabel}
                      </span>
                      <span>{formatTimestamp(action.createdAt)}</span>
                    </div>
                    {action.lastError && action.status === "failed" && (
                      <p className="mt-2 rounded-lg bg-black/30 p-2 text-[11px] text-amber-100">
                        {action.lastError}
                      </p>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
