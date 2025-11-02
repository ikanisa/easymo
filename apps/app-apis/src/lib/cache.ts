import { LRUCache } from "lru-cache";
import { getEnvironment } from "@app-apis/config/environment";

let cache: LRUCache<string, unknown> | null = null;

const getCache = () => {
  if (!cache) {
    const env = getEnvironment();
    cache = new LRUCache({
      ttl: env.cache.ttlMs,
      max: env.cache.maxSize,
      updateAgeOnGet: true,
    });
  }

  return cache;
};

export const cached = async <T>(key: string, loader: () => Promise<T>): Promise<T> => {
  const store = getCache();
  if (store.has(key)) {
    return store.get(key) as T;
  }

  const value = await loader();
  store.set(key, value);
  return value;
};

export const clearCache = () => {
  cache?.clear();
};
