import { assertEquals } from "https://deno.land/std@0.203.0/testing/asserts.ts";
import { checkRequiredEnv, REQUIRED_CORE_VARS } from "./env-check.ts";

Deno.test("checkRequiredEnv - identifies missing variables", () => {
  // Test with known missing vars (assuming they're not set in test environment)
  const result = checkRequiredEnv([
    ["NON_EXISTENT_VAR_123"],
    ["ANOTHER_MISSING_VAR_456"],
  ]);
  
  assertEquals(result.configured, false);
  assertEquals(result.missing.length, 2);
  assertEquals(result.missing[0], "NON_EXISTENT_VAR_123");
  assertEquals(result.missing[1], "ANOTHER_MISSING_VAR_456");
});

Deno.test("checkRequiredEnv - handles alternative variable names", () => {
  // Set one of the alternatives
  const originalValue = Deno.env.get("TEST_VAR_ALT2");
  Deno.env.set("TEST_VAR_ALT2", "test-value");
  
  const result = checkRequiredEnv([
    ["TEST_VAR_ALT1", "TEST_VAR_ALT2", "TEST_VAR_ALT3"],
  ]);
  
  // Should find at least one alternative
  assertEquals(result.configured, true);
  assertEquals(result.missing.length, 0);
  
  // Cleanup
  if (originalValue === undefined) {
    Deno.env.delete("TEST_VAR_ALT2");
  } else {
    Deno.env.set("TEST_VAR_ALT2", originalValue);
  }
});

Deno.test("checkRequiredEnv - warns about missing AI providers", () => {
  // Ensure AI keys are not set
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  
  if (openaiKey) Deno.env.delete("OPENAI_API_KEY");
  if (geminiKey) Deno.env.delete("GEMINI_API_KEY");
  
  const result = checkRequiredEnv([]);
  
  assertEquals(result.warnings.length >= 1, true);
  assertEquals(
    result.warnings.some(w => w.includes("AI provider")),
    true,
    "Should warn about missing AI providers"
  );
  
  // Restore
  if (openaiKey) Deno.env.set("OPENAI_API_KEY", openaiKey);
  if (geminiKey) Deno.env.set("GEMINI_API_KEY", geminiKey);
});

Deno.test("checkRequiredEnv - no warnings when AI provider is set", () => {
  // Set one AI provider
  const originalValue = Deno.env.get("OPENAI_API_KEY");
  Deno.env.set("OPENAI_API_KEY", "sk-test-key");
  
  const result = checkRequiredEnv([]);
  
  assertEquals(
    result.warnings.some(w => w.includes("AI provider")),
    false,
    "Should not warn when AI provider is configured"
  );
  
  // Cleanup
  if (originalValue === undefined) {
    Deno.env.delete("OPENAI_API_KEY");
  } else {
    Deno.env.set("OPENAI_API_KEY", originalValue);
  }
});

Deno.test("REQUIRED_CORE_VARS - contains expected variables", () => {
  assertEquals(Array.isArray(REQUIRED_CORE_VARS), true);
  assertEquals(REQUIRED_CORE_VARS.length >= 6, true);
  
  // Check for some key variables
  const hasSupabaseUrl = REQUIRED_CORE_VARS.some(vars => 
    vars.includes("SUPABASE_URL") || vars.includes("SERVICE_URL")
  );
  assertEquals(hasSupabaseUrl, true, "Should include SUPABASE_URL");
  
  const hasServiceRole = REQUIRED_CORE_VARS.some(vars => 
    vars.includes("SUPABASE_SERVICE_ROLE_KEY")
  );
  assertEquals(hasServiceRole, true, "Should include SUPABASE_SERVICE_ROLE_KEY");
});
