/**
 * Environment variable checking utilities for Supabase Edge Functions
 * 
 * Provides helpers for validating required environment variables
 * and generating helpful error messages.
 */

export interface EnvCheckResult {
  configured: boolean;
  missing: string[];
  warnings: string[];
}

/**
 * Check if required environment variables are configured.
 * Supports multiple alternative names for each variable (e.g., WA_TOKEN or WHATSAPP_ACCESS_TOKEN).
 * 
 * @param requiredVars - Array of arrays, where each inner array contains alternative names for a required variable
 * @returns EnvCheckResult with configuration status, missing variables, and warnings
 * 
 * @example
 * const result = checkRequiredEnv([
 *   ["SUPABASE_URL", "SERVICE_URL"],
 *   ["WA_TOKEN", "WHATSAPP_ACCESS_TOKEN"],
 * ]);
 * if (!result.configured) {
 *   console.error("Missing:", result.missing);
 * }
 */
export function checkRequiredEnv(requiredVars: string[][]): EnvCheckResult {
  const missing: string[] = [];
  const warnings: string[] = [];
  
  for (const alternatives of requiredVars) {
    const found = alternatives.some(name => !!Deno.env.get(name));
    if (!found) {
      missing.push(alternatives.join(" or "));
    }
  }
  
  // Check AI providers
  const hasOpenAI = !!Deno.env.get("OPENAI_API_KEY");
  const hasGemini = !!Deno.env.get("GEMINI_API_KEY");
  if (!hasOpenAI && !hasGemini) {
    warnings.push("No AI provider configured (OPENAI_API_KEY or GEMINI_API_KEY). AI features will be unavailable.");
  }
  
  return {
    configured: missing.length === 0,
    missing,
    warnings,
  };
}

/**
 * Core environment variables required for WhatsApp webhook functions
 */
export const REQUIRED_CORE_VARS = [
  ["SUPABASE_URL", "SERVICE_URL"],
  ["SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY", "WA_SUPABASE_SERVICE_ROLE_KEY"],
  ["WA_PHONE_ID", "WHATSAPP_PHONE_NUMBER_ID"],
  ["WA_TOKEN", "WHATSAPP_ACCESS_TOKEN"],
  ["WA_APP_SECRET", "WHATSAPP_APP_SECRET"],
  ["WA_VERIFY_TOKEN", "WHATSAPP_VERIFY_TOKEN"],
];
