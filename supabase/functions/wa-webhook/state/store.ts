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

  // LEGACY COMPATIBILITY: Also maintain profiles table for backward compatibility
  // 1. Try to find existing profile
  const { data: existing } = await client
    .from("profiles")
    .select("user_id, whatsapp_e164, locale")
    .eq("whatsapp_e164", normalized)
    .maybeSingle();

  if (existing) {
    await logStructuredEvent("PROFILE_FOUND_EXISTING", {
      masked_phone: maskMsisdn(normalized),
      user_id: existing.user_id,
    });
    return existing as ProfileRecord;
  }

  // 2. Create auth user for backward compatibility
  const { data: authUser, error: authError } = await client.auth.admin.createUser({
    phone: normalized,
    phone_confirm: true,
    user_metadata: { role: "buyer", wa_user_id: waUserId },
  });

  let userId: string;

  if (authError) {
    if (authError.message?.includes("already registered") || authError.message?.includes("phone_exists")) {
      const { data: listResult, error: lookupError } = await client.auth.admin.listUsers();
      
      if (lookupError) {
        await logStructuredEvent("AUTH_USER_LOOKUP_ERROR", {
          masked_phone: maskMsisdn(normalized),
          error: lookupError.message,
        });
        throw lookupError;
      }
      
      const foundUser = listResult?.users?.find(u => u.phone === normalized);
      
      if (!foundUser) {
        throw new Error(`Phone exists in auth but user not found: ${maskMsisdn(normalized)}`);
      }
      
      userId = foundUser.id;
    } else {
      await logStructuredEvent("AUTH_USER_CREATE_FAILED", {
        masked_phone: maskMsisdn(normalized),
        error: authError.message,
      });
      throw authError;
    }
  } else {
    if (!authUser.user) {
      throw new Error("Failed to create auth user");
    }
    userId = authUser.user.id;
  }

  // 3. Create profile
  const { data, error } = await client
    .from("profiles")
    .upsert(
      {
        user_id: userId,
        whatsapp_e164: normalized,
        locale: userLanguage || locale || "en",
        role: "buyer",
      },
      { onConflict: "whatsapp_e164" }
    )
    .select("user_id, whatsapp_e164, locale")
    .single();
    
  if (error) {
    await logStructuredEvent("PROFILE_UPSERT_FAILED", {
      masked_phone: maskMsisdn(normalized),
      error: error.message,
    });
    throw error;
  }
  
  await logStructuredEvent("PROFILE_ENSURED", {
    masked_phone: maskMsisdn(normalized),
    user_id: userId,
    wa_user_id: waUserId,
  });
  
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
