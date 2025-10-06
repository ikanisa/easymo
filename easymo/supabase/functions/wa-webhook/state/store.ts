import { supabase } from "../config.ts";
import type { SupportedLanguage } from "../i18n/language.ts";

export type ChatState = { key: string; data?: Record<string, unknown> };

type ProfileRecord = {
  user_id: string;
  whatsapp_e164: string | null;
  locale: string | null;
};

export async function ensureProfile(
  client = supabase,
  whatsapp: string,
  locale?: SupportedLanguage,
): Promise<ProfileRecord> {
  const normalized = whatsapp.startsWith("+") ? whatsapp : `+${whatsapp}`;
  const payload: Record<string, unknown> = { whatsapp_e164: normalized };
  if (locale) payload.locale = locale;
  const { data, error } = await client
    .from("profiles")
    .upsert(payload, { onConflict: "whatsapp_e164" })
    .select("user_id, whatsapp_e164, locale")
    .single();
  if (error) throw error;
  return data as ProfileRecord;
}

export async function getState(
  client = supabase,
  userId: string,
): Promise<ChatState> {
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
    return {
      key: (raw as { key?: string }).key ?? "home",
      data: (raw as { data?: Record<string, unknown> }).data ?? {},
    };
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

export async function clearState(
  client = supabase,
  userId: string,
): Promise<void> {
  const { error } = await client
    .from("chat_state")
    .delete()
    .eq("user_id", userId);
  if (error && error.code !== "PGRST116") throw error;
}
