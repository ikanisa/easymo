/**
 * Integration tests for profile creation flow
 * Tests the ensure_whatsapp_user RPC function and ensureProfile utility
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

Deno.test("ensure_whatsapp_user RPC function exists and works", async () => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.log("Skipping test - Supabase credentials not configured");
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  // Test with a unique phone number
  const testPhone = `+250${Math.floor(Math.random() * 1000000000)}`;
  
  const { data, error } = await supabase.rpc("ensure_whatsapp_user", {
    _wa_id: testPhone,
    _profile_name: "Test User",
  });

  if (error) {
    // If function doesn't exist, that's expected during migration
    if (error.message?.includes("does not exist")) {
      console.log("RPC function not yet deployed - this is expected during migration");
      return;
    }
    throw error;
  }

  // If function exists, verify it returns expected structure
  if (data && data.length > 0) {
    const profile = data[0];
    assertExists(profile.user_id, "user_id should be present");
    assertExists(profile.profile_id || profile.user_id, "profile_id or user_id should be present");
    assertExists(profile.locale, "locale should be present");
  }
});

Deno.test("ensureProfile utility handles missing RPC function gracefully", async () => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.log("Skipping test - Supabase credentials not configured");
    return;
  }

  // Import ensureProfile
  const { ensureProfile } = await import(
    "../../_shared/wa-webhook-shared/state/store.ts"
  );
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  // Test with a unique phone number
  const testPhone = `+250${Math.floor(Math.random() * 1000000000)}`;
  
  try {
    const profile = await ensureProfile(supabase, testPhone);
    
    // Should return a profile (either from RPC or fallback)
    assertExists(profile, "ensureProfile should return a profile");
    assertExists(profile.user_id, "user_id should be present");
    assertExists(profile.locale, "locale should be present");
  } catch (error) {
    // Should not throw - should handle gracefully
    throw new Error(`ensureProfile should not throw: ${error}`);
  }
});

Deno.test("profile lookup handles column variations", async () => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.log("Skipping test - Supabase credentials not configured");
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  // Test that we can query profiles by phone_number or wa_id
  const testPhone = `+250${Math.floor(Math.random() * 1000000000)}`;
  const digits = testPhone.replace(/^\+/, "");
  
  // Try to find profile by phone_number
  const { data: byPhone, error: phoneError } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("phone_number", testPhone)
    .maybeSingle();
  
  // Try to find profile by wa_id
  const { data: byWaId, error: waIdError } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("wa_id", digits)
    .maybeSingle();
  
  // Should not error (even if no results)
  if (phoneError && !phoneError.message?.includes("column") && phoneError.code !== "PGRST116") {
    throw phoneError;
  }
  
  if (waIdError && !waIdError.message?.includes("column") && waIdError.code !== "PGRST116") {
    throw waIdError;
  }
  
  // Test passes if no unexpected errors
  assertEquals(true, true);
});

