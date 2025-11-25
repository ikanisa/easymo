import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  isLocationCacheValid,
  getLocationCacheAge,
  formatLocationCacheAge,
  checkLocationCache,
  LOCATION_CACHE_MINUTES,
} from "./location_cache.ts";

Deno.test("isLocationCacheValid - returns false for null", () => {
  assertEquals(isLocationCacheValid(null), false);
});

Deno.test("isLocationCacheValid - returns true for recent location", () => {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  assertEquals(isLocationCacheValid(fiveMinutesAgo), true);
});

Deno.test("isLocationCacheValid - returns false for expired location", () => {
  const fortyMinutesAgo = new Date(Date.now() - 40 * 60 * 1000).toISOString();
  assertEquals(isLocationCacheValid(fortyMinutesAgo), false);
});

Deno.test("isLocationCacheValid - respects custom cache duration", () => {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  assertEquals(isLocationCacheValid(tenMinutesAgo, 5), false); // 5 min cache
  assertEquals(isLocationCacheValid(tenMinutesAgo, 15), true); // 15 min cache
});

Deno.test("getLocationCacheAge - returns null for invalid input", () => {
  assertEquals(getLocationCacheAge(null), null);
  assertEquals(getLocationCacheAge("invalid"), null);
});

Deno.test("getLocationCacheAge - calculates correct age", () => {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const age = getLocationCacheAge(fiveMinutesAgo);
  assertEquals(age !== null && age >= 4 && age <= 6, true); // Allow for test execution time
});

Deno.test("formatLocationCacheAge - formats correctly", () => {
  assertEquals(formatLocationCacheAge(null), "never cached");
  
  const justNow = new Date(Date.now() - 30 * 1000).toISOString();
  assertEquals(formatLocationCacheAge(justNow), "just now");
  
  const fiveMins = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const formatted = formatLocationCacheAge(fiveMins);
  assertEquals(formatted.includes("mins ago"), true);
});

Deno.test("checkLocationCache - identifies need for refresh", () => {
  const result1 = checkLocationCache(null);
  assertEquals(result1.needsRefresh, true);
  assertEquals(result1.message?.includes("Please share"), true);
  
  const expired = new Date(Date.now() - 40 * 60 * 1000).toISOString();
  const result2 = checkLocationCache(expired);
  assertEquals(result2.needsRefresh, true);
  assertEquals(result2.message?.includes("too old"), true);
  
  const fresh = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const result3 = checkLocationCache(fresh);
  assertEquals(result3.needsRefresh, false);
  assertEquals(result3.message, undefined);
});
