"use client";

import { useMemo } from "react";
import { useOfflineQueue } from "@/providers/offline-queue-provider";

export function QueuedSyncSummary() {
  const { actions, pendingCount, processing } = useOfflineQueue();

  const { failed, syncing } = useMemo(() => {
    let failedCount = 0;
    let syncingCount = 0;
    for (const action of actions) {
      if (action.status === "failed") {
        failedCount += 1;
      } else if (action.status === "syncing") {
        syncingCount += 1;
      }
    }
    return { failed: failedCount, syncing: syncingCount };
  }, [actions]);

  if (pendingCount === 0 && failed === 0 && syncing === 0 && !processing) {
    return null;
  }

  return (
    <aside
      className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-neutral-1"
      aria-live="polite"
    >
      <header className="mb-2 text-[11px] uppercase tracking-[0.3em] text-neutral-3">
        Sync status
      </header>
      <dl className="grid gap-3 text-center sm:grid-cols-3">
        <div>
          <dt className="text-[10px] uppercase tracking-[0.3em] text-neutral-3">Queued</dt>
          <dd className="text-base font-semibold text-neutral-0">{pendingCount}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-[0.3em] text-neutral-3">Syncing</dt>
          <dd className="text-base font-semibold text-neutral-0">{syncing}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-[0.3em] text-neutral-3">Failed</dt>
          <dd className="text-base font-semibold text-neutral-0">{failed}</dd>
        </div>
      </dl>
      {processing && <p className="mt-3 text-[11px] text-neutral-2">Reconciling your changes…</p>}
    </aside>
  );
}

export default QueuedSyncSummary;
