import type { SupabaseClient } from "./wa-webhook-shared/deps.ts";

export type UserSession = {
  id: string;
  phone_number: string;
  active_service: string | null;
  context: Record<string, unknown>;
  last_interaction: string;
  created_at: string;
  updated_at: string;
};

const TABLE = "user_sessions";

export async function getSessionByPhone(
  supabase: SupabaseClient,
  phoneNumber: string,
): Promise<UserSession | null> {
  const { data, error } = await supabase
    .from<UserSession>(TABLE)
    .select("*")
    .eq("phone_number", phoneNumber)
    .maybeSingle();
  if (error) {
    console.error("session.get_failed", { error: error.message });
    return null;
  }
  return data ?? null;
}

export async function setActiveService(
  supabase: SupabaseClient,
  phoneNumber: string,
  service: string,
  context: Record<string, unknown> = {},
): Promise<void> {
  const payload = {
    phone_number: phoneNumber,
    active_service: service,
    context,
    last_interaction: new Date().toISOString(),
  };
  const { error } = await supabase
    .from(TABLE)
    .upsert(payload, { onConflict: "phone_number" });
  if (error) {
    console.error("session.set_active_failed", { error: error.message });
  }
}

export async function clearActiveService(
  supabase: SupabaseClient,
  phoneNumber: string,
): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({
      active_service: null,
      last_interaction: new Date().toISOString(),
    })
    .eq("phone_number", phoneNumber);
  if (error) {
    console.error("session.clear_failed", { error: error.message });
  }
}

export async function touchSession(
  supabase: SupabaseClient,
  phoneNumber: string,
): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .upsert({
      phone_number: phoneNumber,
      last_interaction: new Date().toISOString(),
    }, { onConflict: "phone_number", ignoreDuplicates: false });
  if (error) {
    console.error("session.touch_failed", { error: error.message });
  }
}
