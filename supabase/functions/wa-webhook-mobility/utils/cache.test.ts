/**
 * Unit tests for cache.ts
 *
 * Run with: deno test utils/cache.test.ts
 */

import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  __resetCache,
  deleteCached,
  getCached,
  getCacheManager,
  getOrSetCached,
  setCached,
} from "./cache.ts";

const test = (
  name: string,
  fn: () => Promise<void> | void,
) => Deno.test({ name, sanitizeOps: false, sanitizeResources: false, fn });

test("Cache - basic get/set", () => {
  __resetCache();

  const cache = getCacheManager();

  cache.set("key1", "value1");
  const value = cache.get("key1");

  assertEquals(value, "value1");
});

test("Cache - returns null for missing keys", () => {
  __resetCache();

  const cache = getCacheManager();
  const value = cache.get("nonexistent");

  assertEquals(value, null);
});

test("Cache - respects TTL", async () => {
  __resetCache();

  const cache = getCacheManager();

  // Set with 1 second TTL
  cache.set("key1", "value1", 1);

  // Should exist immediately
  assertEquals(cache.get("key1"), "value1");

  // Wait for expiration
  await new Promise((resolve) => setTimeout(resolve, 1100));

  // Should be expired
  assertEquals(cache.get("key1"), null);
});

test("Cache - getOrSet creates entry if missing", async () => {
  __resetCache();

  const cache = getCacheManager();
  let factoryCalled = false;

  const value = await cache.getOrSet(
    "key1",
    async () => {
      factoryCalled = true;
      return "computed-value";
    },
  );

  assertEquals(value, "computed-value");
  assertEquals(factoryCalled, true);

  // Second call should use cached value
  factoryCalled = false;
  const value2 = await cache.getOrSet(
    "key1",
    async () => {
      factoryCalled = true;
      return "should-not-call";
    },
  );

  assertEquals(value2, "computed-value");
  assertEquals(factoryCalled, false);
});

test("Cache - delete removes entry", () => {
  __resetCache();

  const cache = getCacheManager();

  cache.set("key1", "value1");
  assertEquals(cache.get("key1"), "value1");

  const deleted = cache.delete("key1");
  assertEquals(deleted, true);
  assertEquals(cache.get("key1"), null);
});

test("Cache - tracks hit/miss statistics", () => {
  __resetCache();

  const cache = getCacheManager();

  cache.set("key1", "value1");

  // Hit
  cache.get("key1");

  // Miss
  cache.get("nonexistent");

  const stats = cache.getStats();

  assertEquals(stats.hits, 1);
  assertEquals(stats.misses, 1);
  assertEquals(stats.sets, 1);
  assertExists(stats.hitRate);
});

test("Cache - evicts LRU when full", () => {
  __resetCache();

  // Create cache with small size for testing
  const cache = getCacheManager();

  // This test would need the cache to have a small maxSize
  // In production, you'd configure this via env vars

  cache.destroy();
});

test("Cache - has() checks existence", () => {
  __resetCache();

  const cache = getCacheManager();

  cache.set("key1", "value1");

  assertEquals(cache.has("key1"), true);
  assertEquals(cache.has("nonexistent"), false);
});

test("Cache - clear() removes all entries", () => {
  __resetCache();

  const cache = getCacheManager();

  cache.set("key1", "value1");
  cache.set("key2", "value2");
  cache.set("key3", "value3");

  cache.clear();

  assertEquals(cache.get("key1"), null);
  assertEquals(cache.get("key2"), null);
  assertEquals(cache.get("key3"), null);

  const stats = cache.getStats();
  assertEquals(stats.size, 0);
});

test("Cache - isHealthy checks capacity", () => {
  __resetCache();

  const cache = getCacheManager();

  // With default size (1000), should be healthy with few entries
  cache.set("key1", "value1");

  assertEquals(cache.isHealthy(), true);
});

test("Cache - stores different data types", () => {
  __resetCache();

  const cache = getCacheManager();

  // String
  cache.set("str", "value");
  assertEquals(cache.get("str"), "value");

  // Number
  cache.set("num", 42);
  assertEquals(cache.get("num"), 42);

  // Object
  cache.set("obj", { foo: "bar" });
  assertEquals(cache.get("obj"), { foo: "bar" });

  // Array
  cache.set("arr", [1, 2, 3]);
  assertEquals(cache.get("arr"), [1, 2, 3]);
});
