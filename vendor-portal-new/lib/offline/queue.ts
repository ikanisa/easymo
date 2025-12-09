import { openDB, type DBSchema } from "idb";

export type OfflineActionStatus = "pending" | "syncing" | "failed";

export interface OfflineAction {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  summary: {
    primary: string;
    secondary: string;
  };
  createdAt: string;
  attempts: number;
  status: OfflineActionStatus;
  lastError?: string | null;
}

interface OfflineQueueDb extends DBSchema {
  queue: {
    key: string;
    value: OfflineAction;
    indexes: {
      by_status: OfflineActionStatus;
      by_created_at: string;
    };
  };
}

const DB_NAME = "ibimina-offline";
const DB_VERSION = 1;
const STORE_NAME = "queue";

async function getDb() {
  return openDB<OfflineQueueDb>(DB_NAME, DB_VERSION, {
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
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export async function enqueueAction(input: {
  type: string;
  payload: Record<string, unknown>;
  summary: { primary: string; secondary: string };
}): Promise<OfflineAction> {
  const db = await getDb();
  const now = new Date().toISOString();
  const record: OfflineAction = {
    id: generateId(),
    type: input.type,
    payload: input.payload,
    summary: input.summary,
    createdAt: now,
    attempts: 0,
    status: "pending",
    lastError: null,
  };

  const tx = db.transaction(STORE_NAME, "readwrite");
  await tx.store.put(record);
  await tx.done;
  return record;
}

export async function listActions(): Promise<OfflineAction[]> {
  const db = await getDb();
  const tx = db.transaction(STORE_NAME, "readonly");
  const values = await tx.store.getAll();
  await tx.done;
  return values.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export async function updateAction(id: string, patch: Partial<OfflineAction>) {
  const db = await getDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const existing = await tx.store.get(id);
  if (!existing) {
    await tx.done;
    return null;
  }
  const updated: OfflineAction = { ...existing, ...patch, id: existing.id };
  await tx.store.put(updated);
  await tx.done;
  return updated;
}

export async function removeAction(id: string) {
  const db = await getDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  await tx.store.delete(id);
  await tx.done;
}

export async function clearActions() {
  const db = await getDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  await tx.store.clear();
  await tx.done;
}
