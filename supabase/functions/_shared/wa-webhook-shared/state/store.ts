import { supabase } from "../config.ts";
import { logStructuredEvent } from "../observe/log.ts";
import type { SupportedLanguage } from "../i18n/language.ts";

export type ChatState = { key: string; data?: Record<string, unknown> };

type ProfileRecord = {
  user_id: string;
  whatsapp_e164: string | null;
  locale: string | null;
};

type UserRecord = {
  id: string;
  phone: string;
  name: string | null;
  language: string;
  country: string;
  tokens: number;
  ref_code: string | null;
  referred_by: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_seen_at: string | null;
};

const WA_NUMBER_REGEX = /^\+\d{8,15}$/;
const ALLOWED_PREFIXES = (Deno.env.get("WA_ALLOWED_MSISDN_PREFIXES") ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter((value) => value.length > 0);

export class InvalidWhatsAppNumberError extends Error {
  constructor(readonly msisdn: string) {
    super("invalid_whatsapp_number");
  }
}

function normalizeWhatsAppNumber(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/[^0-9]/g, "");
  if (!digits) {
    throw new InvalidWhatsAppNumberError(raw);
  }
  const normalized = `+${digits}`;
  if (!WA_NUMBER_REGEX.test(normalized)) {
    throw new InvalidWhatsAppNumberError(normalized);
  }
  if (
    ALLOWED_PREFIXES.length &&
    !ALLOWED_PREFIXES.some((prefix) => normalized.startsWith(prefix))
  ) {
    throw new InvalidWhatsAppNumberError(normalized);
  }
  return normalized;
}

function maskMsisdn(msisdn: string): string {
  const digits = msisdn.replace(/[^0-9]/g, "");
  if (digits.length <= 4) return `***${digits}`;
  return `***${digits.slice(-4)}`;
}

export async function ensureProfile(
  client = supabase,
  whatsapp: string,
  locale?: SupportedLanguage,
): Promise<ProfileRecord> {
  let normalized: string;
  try {
    normalized = normalizeWhatsAppNumber(whatsapp);
  } catch (error) {
    if (error instanceof InvalidWhatsAppNumberError) {
      await logStructuredEvent("INVALID_WHATSAPP_NUMBER", {
        masked_input: maskMsisdn(whatsapp),
        masked_normalized: maskMsisdn(error.msisdn ?? ""),
      });
    }
    throw error;
  }

  // NEW SIMPLIFIED SCHEMA: Use users table with get_or_create_user function
  try {
    const defaultCountry = Deno.env.get("DEFAULT_COUNTRY") || "RW";
    const { data: user, error: userError } = await client
      .rpc("get_or_create_user", {
        p_phone: normalized,
        p_name: null,
        p_language: locale || "en",
        p_country: defaultCountry,
      });

    if (userError) {
      await logStructuredEvent("USER_GET_OR_CREATE_ERROR", {
        masked_phone: maskMsisdn(normalized),
        error: userError.message,
        error_code: userError.code,
      });
      throw userError;
    }

    if (!user) {
      throw new Error("get_or_create_user returned null");
    }

    await logStructuredEvent("USER_ENSURED", {
      masked_phone: maskMsisdn(normalized),
      user_id: user.id,
      language: user.language,
    });

    // Return in ProfileRecord format for backward compatibility
    return {
      user_id: user.id,
      whatsapp_e164: user.phone,
      locale: user.language,
    } as ProfileRecord;
  } catch (error) {
    await logStructuredEvent("USER_ENSURE_ERROR", {
      masked_phone: maskMsisdn(normalized),
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function getState(
  client = supabase,
  userId: string,
): Promise<ChatState> {
  // Be resilient to accidental duplicates by taking the latest row
  const { data, error } = await client
    .from("chat_state")
    .select("state")
    .eq("user_id", userId)
    .order("last_updated", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw error;
  const raw = (data as any)?.state;
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
  // Prefer upsert with conflict on user_id when the constraint exists
  try {
    const { error } = await client
      .from("chat_state")
      .upsert({ user_id: userId, state, last_updated: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) throw error;
    return;
  } catch (err: any) {
    // If it's a duplicate key error, the upsert should have worked but didn't
    // This means the constraint might not exist or there's a different issue
    // Try update-or-insert pattern instead
    const nowIso = new Date().toISOString();
    const { data, error } = await client
      .from("chat_state")
      .select("id")
      .eq("user_id", userId)
      .order("last_updated", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error && error.code !== "PGRST116") throw error;
    if (data?.id) {
      // Update existing record
      const { error: updErr } = await client
        .from("chat_state")
        .update({ state, last_updated: nowIso })
        .eq("id", data.id);
      if (updErr) throw updErr;
    } else {
      // Insert new record, but handle duplicate key gracefully
      const { error: insErr } = await client
        .from("chat_state")
        .insert({ user_id: userId, state, last_updated: nowIso });
      
      // If we get a duplicate key error here, it means a race condition occurred
      // Try one more time with update
      if (insErr && insErr.code === "23505") {
        const { data: retryData } = await client
          .from("chat_state")
          .select("id")
          .eq("user_id", userId)
          .order("last_updated", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (retryData?.id) {
          const { error: retryUpdErr } = await client
            .from("chat_state")
            .update({ state, last_updated: nowIso })
            .eq("id", retryData.id);
          if (retryUpdErr) throw retryUpdErr;
        } else {
          // Still can't find it, throw the original error
          throw insErr;
        }
      } else if (insErr) {
        throw insErr;
      }
    }
  }
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
