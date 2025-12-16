/**
 * Unit tests for profile-cache.ts
 * 
 * P2-010: Missing Unit Tests - Add unit tests for handlers and utilities
 * 
 * Run with: deno test --allow-env --allow-net profile-cache.test.ts
 */

import {
  assertEquals,
  assertExists,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  getCachedProfile,
  invalidateProfileCache,
  getProfileCacheStats,
  clearProfileCache,
} from "./profile-cache.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js";

// Mock Supabase client
function createMockSupabaseClient(
  mockRpcResult: { data: any; error: any } = { data: null, error: null },
): SupabaseClient {
  return {
    rpc: async (fn: string, params?: any) => {
      return Promise.resolve(mockRpcResult);
    },
  } as unknown as SupabaseClient;
}

Deno.test("Profile Cache - getCachedProfile returns cached profile on second call", async () => {
  clearProfileCache();
  const mockProfile = {
    profile_id: "test-profile-id",
    user_id: "test-user-id",
    locale: "en",
  };

  const supabase = createMockSupabaseClient({
    data: mockProfile,
    error: null,
  });

  // First call - should fetch from database
  const profile1 = await getCachedProfile(supabase, "+250788123456", "Test User");
  assertExists(profile1);
  assertEquals(profile1?.phone, "+250788123456");
  assertEquals(profile1?.locale, "en");

  // Second call - should return from cache (no database call)
  const profile2 = await getCachedProfile(supabase, "+250788123456", "Test User");
  assertExists(profile2);
  assertEquals(profile2?.phone, "+250788123456");
  assertEquals(profile2?.locale, "en");
});

Deno.test("Profile Cache - getCachedProfile handles database errors gracefully", async () => {
  clearProfileCache();
  const supabase = createMockSupabaseClient({
    data: null,
    error: { message: "Database error" },
  });

  const profile = await getCachedProfile(supabase, "+250788123456", "Test User");
  assertEquals(profile, null);
});

Deno.test("Profile Cache - getCachedProfile handles missing profile", async () => {
  clearProfileCache();
  const supabase = createMockSupabaseClient({
    data: null,
    error: null,
  });

  const profile = await getCachedProfile(supabase, "+250788123456", "Test User");
  assertEquals(profile, null);
});

Deno.test("Profile Cache - invalidateProfileCache removes entry from cache", async () => {
  clearProfileCache();
  const mockProfile = {
    profile_id: "test-profile-id",
    user_id: "test-user-id",
    locale: "en",
  };

  const supabase = createMockSupabaseClient({
    data: mockProfile,
    error: null,
  });

  // Cache a profile
  await getCachedProfile(supabase, "+250788123456", "Test User");

  // Invalidate cache
  invalidateProfileCache("+250788123456");

  // Next call should fetch from database again
  const profile = await getCachedProfile(supabase, "+250788123456", "Test User");
  assertExists(profile);
});

Deno.test("Profile Cache - getProfileCacheStats returns cache statistics", () => {
  const stats = getProfileCacheStats();
  assertExists(stats);
  assertEquals(typeof stats.size, "number");
  assertEquals(typeof stats.maxSize, "number");
  assertEquals(typeof stats.hits, "number");
  assertEquals(typeof stats.misses, "number");
});

Deno.test("Profile Cache - different phone numbers are cached separately", async () => {
  clearProfileCache();
  const supabase1 = createMockSupabaseClient({
    data: {
      profile_id: "profile-1",
      user_id: "user-1",
      locale: "en",
    },
    error: null,
  });

  const supabase2 = createMockSupabaseClient({
    data: {
      profile_id: "profile-2",
      user_id: "user-2",
      locale: "fr",
    },
    error: null,
  });

  const profile1 = await getCachedProfile(supabase1, "+250788111111", "User 1");
  const profile2 = await getCachedProfile(supabase2, "+250788222222", "User 2");

  assertExists(profile1);
  assertExists(profile2);
  assertEquals(profile1?.phone, "+250788111111");
  assertEquals(profile2?.phone, "+250788222222");
  assertEquals(profile1?.locale, "en");
  assertEquals(profile2?.locale, "fr");
});

Deno.test("Profile Cache - handles locale fallback", async () => {
  const supabase = createMockSupabaseClient({
    data: {
      profile_id: "test-profile-id",
      user_id: "test-user-id",
      // No locale in response
    },
    error: null,
  });

  const profile = await getCachedProfile(supabase, "+250788123456", "Test User");
  assertExists(profile);
  assertEquals(profile?.locale, "en"); // Should default to "en"
});

console.log("✅ Profile cache tests loaded");

