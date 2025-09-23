import { supabase } from "../config.ts";

export type ChatState = { key: string; data?: Record<string, unknown> };

export async function ensureProfile(client = supabase, whatsapp: string) {
  const normalized = whatsapp.startsWith("+") ? whatsapp : `+${whatsapp}`;
  const { data, error } = await client
    .from("profiles")
    .select("user_id, whatsapp_e164")
    .eq("whatsapp_e164", normalized)
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw error;
  if (data) return data;
  const { data: inserted, error: insertError } = await client
    .from("profiles")
    .insert({ whatsapp_e164: normalized })
    .select("user_id, whatsapp_e164")
    .single();
  if (insertError) throw insertError;
  return inserted;
}

export async function getState(client = supabase, userId: string): Promise<ChatState> {
  const { data, error } = await client
    .from("chat_state")
    .select("state")
    .eq("user_id", userId)
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw error;
  const raw = data?.state;
  if (!raw) return { key: "home", data: {} };
  if (typeof raw === "string") return { key: raw, data: {} };
  if (typeof raw === "object" && raw !== null) {
    return { key: (raw as { key?: string }).key ?? "home", data: (raw as { data?: Record<string, unknown> }).data ?? {} };
  }
  return { key: "home", data: {} };
}

export async function setState(
  client = supabase,
  userId: string,
  state: ChatState,
): Promise<void> {
  const { error } = await client
    .from("chat_state")
    .upsert({ user_id: userId, state })
    .eq("user_id", userId);
  if (error) throw error;
}

export async function clearState(client = supabase, userId: string): Promise<void> {
  const { error } = await client
    .from("chat_state")
    .delete()
    .eq("user_id", userId);
  if (error && error.code !== "PGRST116") throw error;
}
