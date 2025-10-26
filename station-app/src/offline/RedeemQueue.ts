import type { RedeemRequest, RedeemResponse } from "@station/api/types";
import { StationClient } from "@station/api/stationClient";

const STORAGE_PREFIX = "station.redeemQueue";

export type RedeemQueueEntryStatus = "pending" | "processing" | "succeeded" | "failed";

export type RedeemQueueEntry = {
  id: string;
  voucherCode: string;
  method: RedeemRequest["method"];
  context?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  status: RedeemQueueEntryStatus;
  attempts: number;
  lastError?: string;
};

type RedeemQueueOptions = {
  stationId: string;
  client: StationClient;
  onComplete?: (entry: RedeemQueueEntry, response: RedeemResponse) => void;
  onError?: (entry: RedeemQueueEntry, response: RedeemResponse) => void;
  storage?: Storage;
  retryDelaysMs?: number[];
};

const defaultRetryDelays = [1_000, 5_000, 15_000];

const getStorageKey = (stationId: string) => `${STORAGE_PREFIX}:${stationId}`;

const loadEntries = (stationId: string, storage: Storage): RedeemQueueEntry[] => {
  try {
    const raw = storage.getItem(getStorageKey(stationId));
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as RedeemQueueEntry[];
    return parsed ?? [];
  } catch (error) {
    console.warn("station.redeemQueue.load_failed", error);
    return [];
  }
};

const persistEntries = (stationId: string, storage: Storage, entries: RedeemQueueEntry[]) => {
  storage.setItem(getStorageKey(stationId), JSON.stringify(entries));
};

const createEntryId = (stationId: string, voucherCode: string) => `${stationId}:${voucherCode}`;

const scheduleFlush = (cb: () => void, delay: number) => {
  if (typeof window !== "undefined" && typeof window.setTimeout === "function") {
    window.setTimeout(cb, delay);
  } else {
    setTimeout(cb, delay);
  }
};

export class RedeemQueue {
  private entries: RedeemQueueEntry[] = [];
  private readonly storage: Storage;
  private readonly retryDelays: number[];
  private isFlushing = false;

  constructor(private readonly options: RedeemQueueOptions) {
    this.storage = options.storage ?? window.localStorage;
    this.retryDelays = options.retryDelaysMs ?? defaultRetryDelays;
    this.entries = loadEntries(options.stationId, this.storage);
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.flush());
    }
    if (typeof navigator !== "undefined" && navigator.onLine) {
      void this.flush();
    }
  }

  list() {
    return [...this.entries];
  }

  enqueue(request: RedeemRequest) {
    const existing = this.entries.find((entry) => entry.id === createEntryId(this.options.stationId, request.voucherCode));
    if (existing && existing.status === "pending") {
      return existing;
    }

    const now = new Date().toISOString();
    const entry: RedeemQueueEntry = {
      id: createEntryId(this.options.stationId, request.voucherCode),
      voucherCode: request.voucherCode,
      method: request.method,
      context: request.context,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      status: "pending",
      attempts: existing?.attempts ?? 0,
      lastError: existing?.lastError,
    };

    this.entries = [entry, ...this.entries.filter((item) => item.id !== entry.id)];
    persistEntries(this.options.stationId, this.storage, this.entries);
    void this.flush();
    return entry;
  }

  remove(id: string) {
    this.entries = this.entries.filter((entry) => entry.id !== id);
    persistEntries(this.options.stationId, this.storage, this.entries);
  }

  private updateEntry(id: string, updates: Partial<RedeemQueueEntry>) {
    this.entries = this.entries.map((entry) =>
      entry.id === id
        ? {
            ...entry,
            ...updates,
            updatedAt: new Date().toISOString(),
          }
        : entry,
    );
    persistEntries(this.options.stationId, this.storage, this.entries);
  }

  async flush() {
    if (this.isFlushing) {
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return;
    }

    this.isFlushing = true;
    try {
      for (const entry of this.entries) {
        if (entry.status === "succeeded") {
          continue;
        }

        if (entry.status === "processing") {
          continue;
        }

        const delay = this.retryDelays[Math.min(entry.attempts, this.retryDelays.length - 1)];
        if (entry.lastError && Date.now() - Date.parse(entry.updatedAt) < delay) {
          continue;
        }

        await this.processEntry(entry);
      }
    } finally {
      this.isFlushing = false;
    }
  }

  private async processEntry(entry: RedeemQueueEntry) {
    this.updateEntry(entry.id, { status: "processing", attempts: entry.attempts + 1, lastError: undefined });
    const idempotencyKey = this.createIdempotencyKey(entry);

    let response: RedeemResponse;
    try {
      response = await this.options.client.redeem(
        {
          voucherCode: entry.voucherCode,
          method: entry.method,
          context: entry.context,
        },
        idempotencyKey,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_error";
      this.updateEntry(entry.id, {
        status: "failed",
        lastError: message,
      });
      this.options.onError?.(this.find(entry.id)!, {
        status: "network_error",
        message,
        retryable: true,
      });
      this.scheduleRetry(entry);
      return;
    }

    if (response.status === "redeemed" || response.status === "already_redeemed") {
      this.updateEntry(entry.id, { status: "succeeded", lastError: undefined });
      this.options.onComplete?.(this.find(entry.id)!, response);
      this.remove(entry.id);
      return;
    }

    const retryable = response.retryable;
    this.updateEntry(entry.id, { status: retryable ? "failed" : "succeeded", lastError: response.message });
    if (!retryable) {
      this.options.onError?.(this.find(entry.id)!, response);
      this.remove(entry.id);
      return;
    }
    this.options.onError?.(this.find(entry.id)!, response);
    this.scheduleRetry(entry);
  }

  private find(id: string) {
    return this.entries.find((entry) => entry.id === id) ?? null;
  }

  private scheduleRetry(entry: RedeemQueueEntry) {
    const delay = this.retryDelays[Math.min(entry.attempts, this.retryDelays.length - 1)];
    scheduleFlush(() => {
      if (typeof navigator === "undefined" || navigator.onLine) {
        void this.flush();
      }
    }, delay);
  }

  private createIdempotencyKey(entry: RedeemQueueEntry) {
    const fingerprint = `${entry.id}:${entry.createdAt}`;
    const hasBuffer = typeof globalThis !== 'undefined' && typeof (globalThis as { Buffer?: typeof Buffer }).Buffer !== 'undefined';
    const encode = typeof btoa === 'function'
      ? btoa
      : hasBuffer
        ? (value: string) => (globalThis as { Buffer: typeof Buffer }).Buffer.from(value, 'utf-8').toString('base64')
        : () => fingerprint;
    return encode(fingerprint).replace(/[^a-z0-9]/gi, '').slice(0, 24) || fingerprint;
  }
}

