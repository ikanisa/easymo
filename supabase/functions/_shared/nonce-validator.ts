/**
 * Nonce Validation for Replay Attack Protection
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js";

export interface NonceValidationResult {
  valid: boolean;
  error?: string;
}

const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function validateNonce(
  supabase: SupabaseClient,
  nonce: string,
  deviceId: string
): Promise<NonceValidationResult> {
  // Check if nonce already exists (replay attack)
  const { data: existing } = await supabase
    .from("webhook_nonces")
    .select("nonce")
    .eq("nonce", nonce)
    .single();

  if (existing) {
    return { valid: false, error: "Nonce already used - possible replay attack" };
  }

  // Store nonce with expiry
  const { error } = await supabase.from("webhook_nonces").insert({
    nonce,
    device_id: deviceId,
    expires_at: new Date(Date.now() + NONCE_TTL_MS).toISOString(),
  });

  if (error) {
    console.error("Failed to store nonce:", error);
    return { valid: false, error: "Failed to validate nonce" };
  }

  return { valid: true };
}

export async function logSecurityEvent(
  supabase: SupabaseClient,
  eventType: string,
  deviceId: string | null,
  ipAddress: string | null,
  details: Record<string, unknown>
): Promise<void> {
  await supabase.from("security_audit_log").insert({
    event_type: eventType,
    device_id: deviceId,
    ip_address: ipAddress,
    details,
  });
}
