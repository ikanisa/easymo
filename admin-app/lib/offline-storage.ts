/**
 * Offline Storage Utilities for Desktop App
 * 
 * Provides IndexedDB wrapper for offline data persistence and sync queue management.
 * Used by the desktop app to enable offline-first functionality.
 */

const DB_NAME = 'easymo-offline';
const DB_VERSION = 1;

// Store names
const STORES = {
  CACHE: 'cache',
  SYNC_QUEUE: 'sync-queue',
  SETTINGS: 'settings',
} as const;

/**
 * Sync queue item representing a pending operation
 */
export interface SyncQueueItem {
  id: string;
  type: 'create' | 'update' | 'delete';
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  createdAt: number;
  retryCount: number;
  lastError?: string;
}

/**
 * Cached data item
 */
export interface CacheItem<T = unknown> {
  key: string;
  data: T;
  timestamp: number;
  expiresAt?: number;
}

/**
 * Open the IndexedDB database
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create cache store
      if (!db.objectStoreNames.contains(STORES.CACHE)) {
        const cacheStore = db.createObjectStore(STORES.CACHE, { keyPath: 'key' });
        cacheStore.createIndex('timestamp', 'timestamp', { unique: false });
        cacheStore.createIndex('expiresAt', 'expiresAt', { unique: false });
      }

      // Create sync queue store
      if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const syncStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id' });
        syncStore.createIndex('createdAt', 'createdAt', { unique: false });
        syncStore.createIndex('retryCount', 'retryCount', { unique: false });
      }

      // Create settings store
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      }
    };
  });
}

// =============================================================================
// CACHE OPERATIONS
// =============================================================================

/**
 * Store data in the cache
 */
export async function setCache<T>(
  key: string,
  data: T,
  ttlMs?: number
): Promise<void> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.CACHE, 'readwrite');
    const store = transaction.objectStore(STORES.CACHE);
    
    const item: CacheItem<T> = {
      key,
      data,
      timestamp: Date.now(),
      expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
    };
    
    const request = store.put(item);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
    
    transaction.oncomplete = () => db.close();
  });
}

/**
 * Get data from the cache
 */
export async function getCache<T>(key: string): Promise<T | null> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.CACHE, 'readonly');
    const store = transaction.objectStore(STORES.CACHE);
    const request = store.get(key);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const item = request.result as CacheItem<T> | undefined;
      
      if (!item) {
        resolve(null);
        return;
      }
      
      // Check if expired
      if (item.expiresAt && item.expiresAt < Date.now()) {
        // Delete expired item
        deleteCache(key).catch(console.error);
        resolve(null);
        return;
      }
      
      resolve(item.data);
    };
    
    transaction.oncomplete = () => db.close();
  });
}

/**
 * Delete data from the cache
 */
export async function deleteCache(key: string): Promise<void> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.CACHE, 'readwrite');
    const store = transaction.objectStore(STORES.CACHE);
    const request = store.delete(key);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
    
    transaction.oncomplete = () => db.close();
  });
}

/**
 * Clear all expired cache entries
 */
export async function clearExpiredCache(): Promise<number> {
  const db = await openDatabase();
  const now = Date.now();
  let deletedCount = 0;
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.CACHE, 'readwrite');
    const store = transaction.objectStore(STORES.CACHE);
    const index = store.index('expiresAt');
    const range = IDBKeyRange.upperBound(now);
    const request = index.openCursor(range);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        cursor.delete();
        deletedCount++;
        cursor.continue();
      }
    };
    
    transaction.oncomplete = () => {
      db.close();
      resolve(deletedCount);
    };
  });
}

/**
 * Clear all cache
 */
export async function clearAllCache(): Promise<void> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.CACHE, 'readwrite');
    const store = transaction.objectStore(STORES.CACHE);
    const request = store.clear();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
    
    transaction.oncomplete = () => db.close();
  });
}

// =============================================================================
// SYNC QUEUE OPERATIONS
// =============================================================================

/**
 * Add an item to the sync queue
 */
export async function addToSyncQueue(
  item: Omit<SyncQueueItem, 'id' | 'createdAt' | 'retryCount'>
): Promise<string> {
  const db = await openDatabase();
  const id = `sync-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
    const store = transaction.objectStore(STORES.SYNC_QUEUE);
    
    const queueItem: SyncQueueItem = {
      ...item,
      id,
      createdAt: Date.now(),
      retryCount: 0,
    };
    
    const request = store.add(queueItem);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(id);
    
    transaction.oncomplete = () => db.close();
  });
}

/**
 * Get all items in the sync queue
 */
export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.SYNC_QUEUE, 'readonly');
    const store = transaction.objectStore(STORES.SYNC_QUEUE);
    const index = store.index('createdAt');
    const request = index.getAll();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result as SyncQueueItem[]);
    
    transaction.oncomplete = () => db.close();
  });
}

/**
 * Get the count of items in the sync queue
 */
export async function getSyncQueueCount(): Promise<number> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.SYNC_QUEUE, 'readonly');
    const store = transaction.objectStore(STORES.SYNC_QUEUE);
    const request = store.count();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    transaction.oncomplete = () => db.close();
  });
}

/**
 * Update a sync queue item (e.g., after a failed retry)
 */
export async function updateSyncQueueItem(
  id: string,
  updates: Partial<Pick<SyncQueueItem, 'retryCount' | 'lastError'>>
): Promise<void> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
    const store = transaction.objectStore(STORES.SYNC_QUEUE);
    const getRequest = store.get(id);
    
    getRequest.onerror = () => reject(getRequest.error);
    getRequest.onsuccess = () => {
      const item = getRequest.result as SyncQueueItem | undefined;
      if (!item) {
        reject(new Error(`Sync queue item not found: ${id}`));
        return;
      }
      
      const updatedItem: SyncQueueItem = {
        ...item,
        ...updates,
      };
      
      const putRequest = store.put(updatedItem);
      putRequest.onerror = () => reject(putRequest.error);
      putRequest.onsuccess = () => resolve();
    };
    
    transaction.oncomplete = () => db.close();
  });
}

/**
 * Remove an item from the sync queue
 */
export async function removeFromSyncQueue(id: string): Promise<void> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
    const store = transaction.objectStore(STORES.SYNC_QUEUE);
    const request = store.delete(id);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
    
    transaction.oncomplete = () => db.close();
  });
}

/**
 * Clear all items from the sync queue
 */
export async function clearSyncQueue(): Promise<void> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
    const store = transaction.objectStore(STORES.SYNC_QUEUE);
    const request = store.clear();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
    
    transaction.oncomplete = () => db.close();
  });
}

// =============================================================================
// SETTINGS OPERATIONS
// =============================================================================

/**
 * Save a setting
 */
export async function setSetting<T>(key: string, value: T): Promise<void> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.SETTINGS, 'readwrite');
    const store = transaction.objectStore(STORES.SETTINGS);
    const request = store.put({ key, value });
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
    
    transaction.oncomplete = () => db.close();
  });
}

/**
 * Get a setting
 */
export async function getSetting<T>(key: string, defaultValue?: T): Promise<T | undefined> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.SETTINGS, 'readonly');
    const store = transaction.objectStore(STORES.SETTINGS);
    const request = store.get(key);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const result = request.result as { key: string; value: T } | undefined;
      resolve(result?.value ?? defaultValue);
    };
    
    transaction.oncomplete = () => db.close();
  });
}

/**
 * Delete a setting
 */
export async function deleteSetting(key: string): Promise<void> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.SETTINGS, 'readwrite');
    const store = transaction.objectStore(STORES.SETTINGS);
    const request = store.delete(key);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
    
    transaction.oncomplete = () => db.close();
  });
}

// =============================================================================
// SYNC QUEUE PROCESSOR
// =============================================================================

const MAX_RETRY_COUNT = 5;
const RETRY_DELAYS = [1000, 5000, 15000, 60000, 300000]; // Exponential backoff

/**
 * Process the sync queue (call when online)
 */
export async function processSyncQueue(
  fetchFn: (item: SyncQueueItem) => Promise<Response>
): Promise<{ processed: number; failed: number }> {
  const queue = await getSyncQueue();
  let processed = 0;
  let failed = 0;
  
  for (const item of queue) {
    try {
      const response = await fetchFn(item);
      
      if (response.ok) {
        await removeFromSyncQueue(item.id);
        processed++;
      } else {
        // Non-retryable error (4xx)
        if (response.status >= 400 && response.status < 500) {
          await removeFromSyncQueue(item.id);
          failed++;
        } else {
          // Retryable error (5xx)
          if (item.retryCount >= MAX_RETRY_COUNT) {
            await removeFromSyncQueue(item.id);
            failed++;
          } else {
            await updateSyncQueueItem(item.id, {
              retryCount: item.retryCount + 1,
              lastError: `HTTP ${response.status}: ${response.statusText}`,
            });
          }
        }
      }
    } catch (error) {
      // Network error - retry later
      if (item.retryCount >= MAX_RETRY_COUNT) {
        await removeFromSyncQueue(item.id);
        failed++;
      } else {
        await updateSyncQueueItem(item.id, {
          retryCount: item.retryCount + 1,
          lastError: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }
  
  return { processed, failed };
}

/**
 * Get the next retry delay based on retry count
 */
export function getRetryDelay(retryCount: number): number {
  return RETRY_DELAYS[Math.min(retryCount, RETRY_DELAYS.length - 1)];
}
