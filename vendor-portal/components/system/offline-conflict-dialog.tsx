"use client";

import { useCallback, useEffect } from "react";
import { AlertCircle, RotateCcw, X } from "lucide-react";
import { useOfflineQueue } from "@/providers/offline-queue-provider";

export function OfflineConflictDialog() {
  const { lastConflict, retryFailed, clearConflict } = useOfflineQueue();

  useEffect(() => {
    if (!lastConflict) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        clearConflict();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearConflict, lastConflict]);

  const handleRetry = useCallback(() => {
    void retryFailed();
  }, [retryFailed]);

  if (!lastConflict) {
    return null;
  }

  const { action, message, occurredAt } = lastConflict;
  const occurred = new Date(occurredAt);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="conflict-dialog-title"
    >
      <div className="glass w-full max-w-md rounded-3xl p-6 text-neutral-0">
        <header className="flex items-start justify-between">
          <div>
            <p
              id="conflict-dialog-title"
              className="inline-flex items-center gap-2 text-lg font-semibold text-red-100"
            >
              <AlertCircle className="h-5 w-5" aria-hidden /> Sync conflict detected
            </p>
            <p className="mt-1 text-sm text-neutral-2">{message}</p>
          </div>
          <button
            type="button"
            onClick={clearConflict}
            className="rounded-full border border-white/15 p-2 text-neutral-2 transition hover:border-white/40 hover:text-neutral-0"
            aria-label="Dismiss conflict dialog"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        <section className="mt-4 space-y-2 text-sm text-neutral-1">
          <p>
            <span className="font-semibold">Action:</span> {action.summary.primary}
          </p>
          <p>
            <span className="font-semibold">Queued:</span> {occurred.toLocaleString()}
          </p>
          {lastConflict.status && (
            <p>
              <span className="font-semibold">Status:</span> HTTP {lastConflict.status}
            </p>
          )}
        </section>

        <footer className="mt-6 flex justify-end gap-3 text-xs uppercase tracking-[0.3em]">
          <button
            type="button"
            onClick={clearConflict}
            className="rounded-full border border-white/15 px-4 py-2 text-neutral-2 transition hover:border-white/40 hover:text-neutral-0"
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-2 rounded-full bg-rw-blue px-4 py-2 text-ink shadow-glass transition hover:bg-rw-blue/90"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Retry
          </button>
        </footer>
      </div>
    </div>
  );
}

export default OfflineConflictDialog;
