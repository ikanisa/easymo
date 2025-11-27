import { Store } from '@tauri-apps/plugin-store';

let store: Store | null = null;

async function getStore() {
  if (!store) {
    store = await Store.load('secure-storage.dat');
  }
  return store;
}

export async function setSecureItem(key: string, value: unknown) {
  const s = await getStore();
  await s.set(key, value);
  await s.save();
}

export async function getSecureItem<T>(key: string): Promise<T | null> {
  const s = await getStore();
  const val = await s.get<T>(key);
  return val ?? null;
}
