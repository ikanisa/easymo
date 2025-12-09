import { logWarn } from "@/lib/observability/logger";

const BG_SYNC_TAG = "ibimina-offline-sync";

type SyncManager = {
  register: (tag: string) => Promise<void>;
};

const textEncoder = new TextEncoder();

async function hashString(value: string): Promise<string | null> {
  if (!globalThis.crypto?.subtle) {
    logWarn("offline.sync.hash_unavailable");
    return null;
  }

  try {
    const buffer = await globalThis.crypto.subtle.digest("SHA-256", textEncoder.encode(value));
    return Array.from(new Uint8Array(buffer))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  } catch (error) {
    logWarn("offline.sync.hash_failed", { error });
    return null;
  }
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  try {
    return await navigator.serviceWorker.ready;
  } catch (error) {
    logWarn("offline.sync.ready_failed", { error });
    return null;
  }
}

export async function requestBackgroundSync() {
  const registration = await getRegistration();
  if (!registration) {
    return false;
  }

  const syncManager = (registration as ServiceWorkerRegistration & { sync?: SyncManager }).sync;
  if (syncManager) {
    try {
      await syncManager.register(BG_SYNC_TAG);
      return true;
    } catch (error) {
      logWarn("offline.sync.register_failed", { error });
    }
  }

  registration.active?.postMessage({ type: "OFFLINE_QUEUE_REGISTER" });
  return false;
}

export async function notifyOfflineQueueUpdated(count: number) {
  const registration = await getRegistration();
  registration?.active?.postMessage({ type: "OFFLINE_QUEUE_UPDATED", count });
}

export async function requestImmediateOfflineSync(reason: string) {
  const registration = await getRegistration();
  registration?.active?.postMessage({ type: "OFFLINE_QUEUE_PROCESS", reason });
}

export async function updateAuthCacheScope(credential: string | null | undefined) {
  const registration = await getRegistration();
  if (!registration) {
    return;
  }

  if (!credential) {
    registration.active?.postMessage({ type: "AUTH_SCOPE_UPDATE", hash: "guest" });
    return;
  }

  const hash = await hashString(credential);
  if (!hash) {
    registration.active?.postMessage({ type: "AUTH_CACHE_RESET" });
    return;
  }

  registration.active?.postMessage({ type: "AUTH_SCOPE_UPDATE", hash });
}

export async function resetAuthCache() {
  const registration = await getRegistration();
  registration?.active?.postMessage({ type: "AUTH_CACHE_RESET" });
}
