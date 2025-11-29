import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import { Store } from '@tauri-apps/plugin-store';

// Create a store instance
let store: Store | null = null;

async function getStore() {
  if (!store) {
    store = await Store.load('query-cache.dat');
  }
  return store;
}

// Create a persister
const persister = createAsyncStoragePersister({
  storage: {
    getItem: async (key) => {
      const s = await getStore();
      const val = await s.get<string>(key);
      return val ?? null;
    },
    setItem: async (key, value) => {
      const s = await getStore();
      await s.set(key, value);
      await s.save();
    },
    removeItem: async (key) => {
      const s = await getStore();
      await s.delete(key);
      await s.save();
    },
  },
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

export { persister };
