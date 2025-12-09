"use client";

import { useEffect, useState } from "react";

interface SnapshotEntry {
  url: string;
  cachedAt?: string;
  cacheName: string;
}

export function CachedSnapshots() {
  const [entries, setEntries] = useState<SnapshotEntry[]>([]);
  const [status, setStatus] = useState<string>("Looking for saved responses...");

  useEffect(() => {
    let mounted = true;

    const hydrate = async () => {
      if (typeof window === "undefined" || !("caches" in window)) {
        setStatus("Caching API not available in this browser.");
        return;
      }

      try {
        const cacheNames = await caches.keys();
        const relevantCaches = cacheNames.filter(
          (name) => name.startsWith("app-shell") || name.startsWith("api-routes")
        );

        const snapshots: SnapshotEntry[] = [];
        for (const cacheName of relevantCaches) {
          const cache = await caches.open(cacheName);
          const requests = await cache.keys();
          for (const request of requests) {
            const response = await cache.match(request);
            const cachedAt = response?.headers.get("date") ?? undefined;
            snapshots.push({ url: new URL(request.url).pathname, cachedAt, cacheName });
          }
        }

        if (!mounted) return;

        if (snapshots.length === 0) {
          setStatus(
            "No cached responses yet. Load dashboards or reconciliation once online to capture snapshots."
          );
          setEntries([]);
          return;
        }

        const deduped = Object.values(
          snapshots.reduce<Record<string, SnapshotEntry>>((acc, snapshot) => {
            if (!acc[snapshot.url]) {
              acc[snapshot.url] = snapshot;
            }
            return acc;
          }, {})
        );

        setEntries(deduped);
        setStatus(`Found ${deduped.length} cached item${deduped.length === 1 ? "" : "s"}.`);
      } catch (error) {
        if (mounted) {
          setStatus("Unable to read cached data.");
          console.error("offline.snapshots.error", error);
        }
      }
    };

    void hydrate();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-100" aria-live="polite">
        {status}
      </p>
      {entries.length > 0 && (
        <ul className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/5">
          {entries.map((entry) => (
            <li
              key={`${entry.cacheName}-${entry.url}`}
              className="flex items-center justify-between px-4 py-3"
            >
              <div className="flex flex-col text-left">
                <span className="text-sm font-semibold text-neutral-0">{entry.url}</span>
                <span className="text-xs text-neutral-200">
                  {entry.cachedAt ? `Cached at ${entry.cachedAt}` : "Timestamp unavailable"}
                </span>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-neutral-1">
                {entry.cacheName}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
