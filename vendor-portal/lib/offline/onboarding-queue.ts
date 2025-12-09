import { openDB, type DBSchema } from "idb";

import type { OnboardingPayload } from "@/lib/member/onboarding";
import { notifyOfflineQueueUpdated } from "@/lib/offline/sync";

export type OnboardingQueueStatus = "pending" | "syncing" | "failed";

export interface OnboardingQueueItem {
  id: string;
  payload: OnboardingPayload;
  createdAt: string;
  attempts: number;
  status: OnboardingQueueStatus;
  lastError?: string | null;
}

interface OnboardingQueueDb extends DBSchema {
  submissions: {
    key: string;
    value: OnboardingQueueItem;
    indexes: {
      by_status: OnboardingQueueStatus;
      by_created_at: string;
    };
  };
}

const DB_NAME = "ibimina-onboarding";
const DB_VERSION = 1;
const STORE_NAME = "submissions";

async function getDb() {
  return openDB<OnboardingQueueDb>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("by_status", "status");
        store.createIndex("by_created_at", "createdAt");
      }
    },
  });
}

function generateId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function listInternal() {
  const db = await getDb();
  const tx = db.transaction(STORE_NAME, "readonly");
  const items = await tx.store.getAll();
  await tx.done;
  return items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

async function updateQueueMetrics() {
  try {
    const stats = await getOnboardingQueueStats();
    await notifyOfflineQueueUpdated(stats.pending + stats.failed);
  } catch {
    // ignore metrics update errors
  }
}

export async function enqueueOnboardingSubmission(
  payload: OnboardingPayload
): Promise<OnboardingQueueItem> {
  const db = await getDb();
  const now = new Date().toISOString();
  const record: OnboardingQueueItem = {
    id: generateId(),
    payload,
    createdAt: now,
    attempts: 0,
    status: "pending",
    lastError: null,
  };

  const tx = db.transaction(STORE_NAME, "readwrite");
  await tx.store.put(record);
  await tx.done;

  await updateQueueMetrics();
  return record;
}

export async function listOnboardingQueue() {
  return listInternal();
}

export interface OnboardingQueueStats {
  total: number;
  pending: number;
  syncing: number;
  failed: number;
}

export async function getOnboardingQueueStats(): Promise<OnboardingQueueStats> {
  const items = await listInternal();
  return items.reduce<OnboardingQueueStats>(
    (acc, item) => {
      acc.total += 1;
      acc[item.status] += 1;
      return acc;
    },
    { total: 0, pending: 0, syncing: 0, failed: 0 }
  );
}

async function updateOnboardingQueueItem(id: string, patch: Partial<OnboardingQueueItem>) {
  const db = await getDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const existing = await tx.store.get(id);
  if (!existing) {
    await tx.done;
    return null;
  }

  const updated: OnboardingQueueItem = {
    ...existing,
    ...patch,
    id: existing.id,
  };

  await tx.store.put(updated);
  await tx.done;
  return updated;
}

async function removeOnboardingQueueItem(id: string) {
  const db = await getDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  await tx.store.delete(id);
  await tx.done;
}

export interface OnboardingSyncResult {
  id: string;
  status: "success" | "error";
  error?: string;
}

export interface OnboardingSyncSummary {
  results: OnboardingSyncResult[];
  error?: string;
}

export async function syncQueuedOnboarding(): Promise<OnboardingSyncSummary> {
  const pending = await listInternal();
  if (pending.length === 0) {
    return { results: [] };
  }

  const prepared: OnboardingQueueItem[] = [];
  for (const item of pending) {
    const updated = await updateOnboardingQueueItem(item.id, {
      status: "syncing",
      attempts: item.attempts + 1,
      lastError: null,
    });
    prepared.push(updated ?? { ...item, status: "syncing", attempts: item.attempts + 1 });
  }

  try {
    const response = await fetch("/api/member/onboard/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        items: prepared.map(({ id, payload }) => ({ id, payload })),
      }),
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message =
        typeof body?.error === "string" ? body.error : "Unable to sync queued submissions";

      await Promise.all(
        prepared.map((item) =>
          updateOnboardingQueueItem(item.id, { status: "failed", lastError: message })
        )
      );
      await updateQueueMetrics();
      return {
        results: prepared.map((item) => ({ id: item.id, status: "error", error: message })),
        error: message,
      };
    }

    const results: OnboardingSyncResult[] = Array.isArray(body?.results) ? body.results : [];

    const handledIds = new Set(results.map((result) => result.id));

    const missing = prepared.filter((item) => !handledIds.has(item.id));
    for (const item of missing) {
      results.push({ id: item.id, status: "error", error: "No response from server" });
    }

    await Promise.all(
      results.map((result) => {
        if (result.status === "success") {
          return removeOnboardingQueueItem(result.id);
        }

        return updateOnboardingQueueItem(result.id, {
          status: "failed",
          lastError: result.error ?? "Sync failed",
        });
      })
    );

    await updateQueueMetrics();

    return { results };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network error";
    await Promise.all(
      prepared.map((item) =>
        updateOnboardingQueueItem(item.id, {
          status: "failed",
          lastError: message,
        })
      )
    );
    await updateQueueMetrics();
    return {
      results: prepared.map((item) => ({ id: item.id, status: "error", error: message })),
      error: message,
    };
  }
}

export async function clearOnboardingQueue() {
  const db = await getDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  await tx.store.clear();
  await tx.done;
  await updateQueueMetrics();
}
