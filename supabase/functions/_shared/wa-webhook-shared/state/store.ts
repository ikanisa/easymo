import { supabase } from "../config.ts";
import { logStructuredEvent } from "../observe/log.ts";
import type { SupportedLanguage } from "../i18n/language.ts";

export type ChatState = { key: string; data?: Record<string, unknown> };

type ProfileRecord = {
  user_id: string;
  whatsapp_e164: string | null;
  locale: string | null;
};

type WhatsAppUserRecord = {
  id: string;
  phone_number: string;
  display_name: string | null;
  preferred_language: string | null;
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

  // NEW AI AGENT FLOW: Use whatsapp_users table
  // 1. Check if WhatsApp user exists
  const { data: waUser, error: waUserError } = await client
    .from("whatsapp_users")
    .select("id, phone_number, preferred_language")
    .eq("phone_number", normalized)
    .maybeSingle();

  if (waUserError && waUserError.code !== "PGRST116") {
    await logStructuredEvent("WHATSAPP_USER_QUERY_ERROR", {
      masked_phone: maskMsisdn(normalized),
      error: waUserError.message,
      error_code: waUserError.code,
    });
    throw waUserError;
  }

  let waUserId: string;
  let userLanguage: string | null = null;

  if (waUser) {
    // User exists
    waUserId = waUser.id;
    userLanguage = waUser.preferred_language;
    
    await logStructuredEvent("WHATSAPP_USER_FOUND", {
      masked_phone: maskMsisdn(normalized),
      user_id: waUserId,
    });
  } else {
    // Create new WhatsApp user
    const { data: newWaUser, error: createError } = await client
      .from("whatsapp_users")
      .insert({
        phone_number: normalized,
        preferred_language: locale || "en",
        user_roles: ["guest"],
      })
      .select("id")
      .single();

    if (createError) {
      await logStructuredEvent("WHATSAPP_USER_CREATE_ERROR", {
        masked_phone: maskMsisdn(normalized),
        error: createError.message,
        error_code: createError.code,
      });
      throw createError;
    }

    waUserId = newWaUser.id;
    userLanguage = locale || "en";

    await logStructuredEvent("WHATSAPP_USER_CREATED", {
      masked_phone: maskMsisdn(normalized),
      user_id: waUserId,
    });
  }

  // LEGACY COMPATIBILITY: Maintain profiles table for backward compatibility
  // Use whatsapp_users.id as the user_id for profiles table
  
  // 1. Check if profile already exists
  const { data: existing } = await client
    .from("profiles")
    .select("user_id, whatsapp_e164, locale")
    .eq("whatsapp_e164", normalized)
    .maybeSingle();

  if (existing) {
    await logStructuredEvent("PROFILE_FOUND_EXISTING", {
      masked_phone: maskMsisdn(normalized),
      user_id: existing.user_id,
      wa_user_id: waUserId,
    });
    return existing as ProfileRecord;
  }

  // 2. Create new profile using whatsapp_users.id as user_id
  // This maintains backward compatibility without requiring auth.admin API
  let newProfile: any = null;
  try {
    const upsert = await client
      .from("profiles")
      .upsert(
        {
          user_id: waUserId, // Use WhatsApp user ID directly
          whatsapp_e164: normalized,
          locale: userLanguage || locale || "en",
          role: "buyer",
        },
        { onConflict: "whatsapp_e164" }
      )
      .select("user_id, whatsapp_e164, locale")
      .single();
    newProfile = upsert.data;
    if (upsert.error) throw upsert.error;
  } catch (profileError: any) {
    // Fallback path when unique index/constraint is missing on whatsapp_e164
    await logStructuredEvent("PROFILE_UPSERT_FAILED", {
      masked_phone: maskMsisdn(normalized),
      error: profileError?.message ?? String(profileError),
      error_code: profileError?.code ?? null,
    });
    // Try to update by whatsapp_e164; if no row updated, insert
    try {
      const upd = await client
        .from("profiles")
        .update({ user_id: waUserId, locale: userLanguage || locale || "en", role: "buyer" })
        .eq("whatsapp_e164", normalized)
        .select("user_id, whatsapp_e164, locale");
      if (upd.error) throw upd.error;
      const updCount = Array.isArray(upd.data) ? upd.data.length : 0;
      if (updCount === 0) {
        const ins = await client
          .from("profiles")
          .insert({ user_id: waUserId, whatsapp_e164: normalized, locale: userLanguage || locale || "en", role: "buyer" })
          .select("user_id, whatsapp_e164, locale")
          .single();
        newProfile = ins.data;
      } else {
        const sel = await client
          .from("profiles")
          .select("user_id, whatsapp_e164, locale")
          .eq("whatsapp_e164", normalized)
          .single();
        newProfile = sel.data;
      }
    } catch (_fallbackErr) {
      // Non-blocking: profile creation failed but whatsapp_user exists
      await logStructuredEvent("PROFILE_CREATION_SKIPPED", {
        masked_phone: maskMsisdn(normalized),
        wa_user_id: waUserId,
        reason: "Using whatsapp_users table as primary source",
      });
      return {
        user_id: waUserId,
        whatsapp_e164: normalized,
        locale: userLanguage || locale || "en",
      } as ProfileRecord;
    }
  }
  
  await logStructuredEvent("PROFILE_ENSURED", {
    masked_phone: maskMsisdn(normalized),
    user_id: newProfile.user_id,
    wa_user_id: waUserId,
  });
  
  return newProfile as ProfileRecord;
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
