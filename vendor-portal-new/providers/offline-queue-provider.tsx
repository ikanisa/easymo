"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  clearActions,
  enqueueAction,
  listActions,
  removeAction,
  updateAction,
  type OfflineAction,
} from "@/lib/offline/queue";
import {
  notifyOfflineQueueUpdated,
  requestBackgroundSync,
  requestImmediateOfflineSync,
} from "@/lib/offline/sync";
import { useToast } from "@/providers/toast-provider";
import type { Database } from "@/lib/supabase/types";
import { trackConflictResolution, trackQueuedSyncSummary } from "@/src/instrumentation/ux";

type QueueInput = {
  type: string;
  payload: Record<string, unknown>;
  summary: { primary: string; secondary: string };
};

interface OfflineQueueContextValue {
  isOnline: boolean;
  processing: boolean;
  actions: OfflineAction[];
  pendingCount: number;
  lastSyncedAt: Date | null;
  lastConflict: OfflineConflictState | null;
  queueAction: (input: QueueInput) => Promise<OfflineAction>;
  retryFailed: () => Promise<void>;
  clearAction: (id: string) => Promise<void>;
  clearConflict: () => void;
}

interface OfflineConflictState {
  action: OfflineAction;
  status?: number;
  message: string;
  details?: unknown;
  occurredAt: string;
}

const OfflineQueueContext = createContext<OfflineQueueContextValue | null>(null);

async function safeListActions() {
  try {
    return await listActions();
  } catch {
    return [];
  }
}

export function OfflineQueueProvider({ children }: { children: React.ReactNode }) {
  const toast = useToast();
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [actions, setActions] = useState<OfflineAction[]>([]);
  const [processing, setProcessing] = useState(false);
  const lastBroadcastCount = useRef(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [lastConflict, setLastConflict] = useState<OfflineConflictState | null>(null);

  const refresh = useCallback(async () => {
    const all = await safeListActions();
    setActions(all);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  type PaymentStatus = Database["app"]["Tables"]["payments"]["Row"]["status"];

  type QueueHandler = (action: OfflineAction) => Promise<void>;

  class OfflineSyncError extends Error {
    constructor(
      message: string,
      public readonly status?: number,
      public readonly details?: unknown
    ) {
      super(message);
      this.name = "OfflineSyncError";
    }
  }

  const offlineSyncErrorCtor = OfflineSyncError;

  const callPaymentsEndpoint = useCallback(
    async (path: string, payload: Record<string, unknown>) => {
      const response = await fetch(path, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new OfflineSyncError(body.error ?? "Request failed", response.status, body);
      }
    },
    // OfflineSyncError is a stable class defined in this component
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const handlers = useMemo<Record<string, QueueHandler>>(
    () => ({
      "payments:update-status": async (action: OfflineAction) => {
        const { ids, status, saccoId } = action.payload as {
          ids?: string[];
          status?: PaymentStatus;
          saccoId?: string | null;
        };
        if (!ids?.length || !status) {
          throw new Error("Invalid payload for status update");
        }
        await callPaymentsEndpoint("/api/admin/payments/update-status", {
          ids,
          status,
          saccoId: saccoId ?? null,
        });
      },
      "payments:assign": async (action: OfflineAction) => {
        const { ids, ikiminaId, memberId, saccoId } = action.payload as {
          ids?: string[];
          ikiminaId?: string;
          memberId?: string | null;
          saccoId?: string | null;
        };
        if (!ids?.length || !ikiminaId) {
          throw new Error("Invalid payload for ikimina assignment");
        }

        const payload: Record<string, unknown> = {
          ids,
          ikiminaId,
          saccoId: saccoId ?? null,
        };
        if (memberId !== undefined) {
          payload.memberId = memberId;
        }
        await callPaymentsEndpoint("/api/admin/payments/assign", payload);
      },
    }),
    [callPaymentsEndpoint]
  );

  const processQueue = useCallback(async () => {
    if (!isOnline || processing) {
      return;
    }

    const pending = await safeListActions();
    if (pending.length === 0) {
      setActions(pending);
      return;
    }

    setProcessing(true);
    try {
      for (const action of pending) {
        const handler = handlers[action.type];
        if (!handler) {
          await removeAction(action.id);
          continue;
        }

        try {
          await updateAction(action.id, {
            status: "syncing",
            attempts: action.attempts + 1,
            lastError: null,
          });
          await handler(action);
          await removeAction(action.id);
          toast.success(action.summary.primary);
          setLastSyncedAt(new Date());
          trackConflictResolution("synced", {
            type: action.type,
            attempts: action.attempts + 1,
          });
          if (lastConflict?.action.id === action.id) {
            setLastConflict(null);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Sync failed";
          await updateAction(action.id, {
            status: "failed",
            attempts: action.attempts + 1,
            lastError: message,
          });
          toast.error(`${action.summary.primary}: ${message}`);
          if (error instanceof offlineSyncErrorCtor && error.status === 409) {
            const conflict: OfflineConflictState = {
              action,
              status: error.status,
              message,
              details: error.details,
              occurredAt: new Date().toISOString(),
            };
            setLastConflict(conflict);
            trackConflictResolution("detected", {
              type: action.type,
              attempts: action.attempts + 1,
            });
          }
        }
      }
    } finally {
      setProcessing(false);
      await refresh();
    }
  }, [handlers, isOnline, lastConflict, offlineSyncErrorCtor, processing, refresh, toast]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      const { data } = event;
      if (!data || typeof data !== "object") {
        return;
      }

      if (data.type === "OFFLINE_QUEUE_PROCESS") {
        void processQueue();
      }
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () => navigator.serviceWorker.removeEventListener("message", handleMessage);
  }, [processQueue]);

  useEffect(() => {
    if (isOnline) {
      void processQueue();
    }
  }, [isOnline, processQueue]);

  useEffect(() => {
    const pending = actions.filter((action) => action.status !== "syncing").length;
    if (pending !== lastBroadcastCount.current) {
      lastBroadcastCount.current = pending;
      void notifyOfflineQueueUpdated(pending);
    }
  }, [actions]);

  useEffect(() => {
    const pending = actions.filter((action) => action.status !== "syncing").length;
    const failed = actions.filter((action) => action.status === "failed").length;
    const syncing = actions.filter((action) => action.status === "syncing").length;
    trackQueuedSyncSummary({
      pending,
      failed,
      syncing,
      online: isOnline,
    });
  }, [actions, isOnline]);

  useEffect(() => {
    if (!lastConflict) {
      return;
    }
    const stillFailed = actions.some(
      (action) => action.id === lastConflict.action.id && action.status === "failed"
    );
    if (!stillFailed) {
      trackConflictResolution("cleared", { type: lastConflict.action.type });
      setLastConflict(null);
    }
  }, [actions, lastConflict]);

  const queueAction = useCallback(
    async (input: QueueInput) => {
      const record = await enqueueAction(input);
      await refresh();
      toast.info(`${input.summary.primary} · ${input.summary.secondary}`);
      void requestBackgroundSync();
      if (isOnline) {
        void processQueue();
      } else {
        void requestImmediateOfflineSync("queued-offline");
      }
      return record;
    },
    [isOnline, processQueue, refresh, toast]
  );

  const retryFailed = useCallback(async () => {
    await processQueue();
  }, [processQueue]);

  const clearAction = useCallback(
    async (id: string) => {
      await removeAction(id);
      await refresh();
    },
    [refresh]
  );

  const clearAll = useCallback(async () => {
    await clearActions();
    await refresh();
  }, [refresh]);

  const clearConflict = useCallback(() => {
    if (lastConflict) {
      trackConflictResolution("dismissed", { type: lastConflict.action.type });
    }
    setLastConflict(null);
  }, [lastConflict]);

  const setOnlineState = useCallback((value: boolean) => {
    setIsOnline(value);
  }, []);

  const value = useMemo<OfflineQueueContextValue>(
    () => ({
      isOnline,
      processing,
      actions,
      pendingCount: actions.filter((action) => action.status !== "syncing").length,
      lastSyncedAt,
      lastConflict,
      queueAction,
      retryFailed,
      clearAction,
      clearConflict,
    }),
    [
      actions,
      clearAction,
      clearConflict,
      isOnline,
      lastConflict,
      lastSyncedAt,
      processing,
      queueAction,
      retryFailed,
    ]
  );

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_E2E !== "1" || typeof window === "undefined") {
      return;
    }

    window.__offlineQueueTest = {
      queueAction,
      clearAll,
      setOnline: setOnlineState,
    };

    return () => {
      delete window.__offlineQueueTest;
    };
  }, [clearAll, queueAction, setOnlineState]);

  return <OfflineQueueContext.Provider value={value}>{children}</OfflineQueueContext.Provider>;
}

export function useOfflineQueue() {
  const context = useContext(OfflineQueueContext);
  if (!context) {
    throw new Error("useOfflineQueue must be used within OfflineQueueProvider");
  }
  return context;
}

export type { OfflineConflictState };

declare global {
  interface Window {
    __offlineQueueTest?: {
      queueAction: (input: QueueInput) => Promise<OfflineAction>;
      clearAll: () => Promise<void>;
      setOnline: (value: boolean) => void;
    };
  }
}
