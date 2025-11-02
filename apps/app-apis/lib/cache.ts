import { LRUCache } from 'lru-cache'
import type { QueryCache } from '@easymo/clients'

export function createRequestCache(max: number, ttlMs: number): QueryCache {
  const cache = new LRUCache<string, { value: unknown; expiresAt: number }>({
    max
  })

  return {
    get<T>(key: string) {
      const entry = cache.get(key)
      if (!entry) {
        return undefined
      }

      if (entry.expiresAt < Date.now()) {
        cache.delete(key)
        return undefined
      }

      return entry.value as T
    },
    set<T>(key: string, value: T, ttl?: number) {
      cache.set(key, { value, expiresAt: Date.now() + (ttl ?? ttlMs) })
    },
    delete(key: string) {
      cache.delete(key)
    }
  }
}
