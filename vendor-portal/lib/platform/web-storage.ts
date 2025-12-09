import type { StorageAdapter } from '@ibimina/admin-core/adapters';
import { openDB, type IDBPDatabase } from 'idb';

export class WebStorage implements StorageAdapter {
  private dbPromise: Promise<IDBPDatabase>;

  constructor() {
    this.dbPromise = openDB('ibimina-storage', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('kv-store')) {
          db.createObjectStore('kv-store');
        }
      },
    });
  }

  async get<T>(key: string): Promise<T | null> {
    const db = await this.dbPromise;
    const value = await db.get('kv-store', key);
    return value ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    const db = await this.dbPromise;
    await db.put('kv-store', value, key);
  }

  async remove(key: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete('kv-store', key);
  }

  async clear(): Promise<void> {
    const db = await this.dbPromise;
    await db.clear('kv-store');
  }

  async keys(): Promise<string[]> {
    const db = await this.dbPromise;
    return (await db.getAllKeys('kv-store')) as string[];
  }

  secure = {
    get: async (key: string): Promise<string | null> => {
      // For web, we use IndexedDB which is encrypted at rest by the browser
      // For truly secure storage, consider using Web Crypto API or a server-side solution
      return await this.get<string>(key);
    },

    set: async (key: string, value: string): Promise<void> => {
      await this.set(key, value);
    },

    remove: async (key: string): Promise<void> => {
      await this.remove(key);
    },
  };
}
