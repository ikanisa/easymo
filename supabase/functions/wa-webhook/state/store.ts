import { supabase } from "../config.ts";
import { logStructuredEvent } from "../observe/log.ts";
import type { SupportedLanguage } from "../i18n/language.ts";

export type ChatState = { key: string; data?: Record<string, unknown> };

type ProfileRecord = {
  user_id: string;
  whatsapp_e164: string | null;
  locale: string | null;
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
  const payload: Record<string, unknown> = { whatsapp_e164: normalized };
  if (locale) payload.locale = locale;

  // 1. Try to find existing profile first to avoid unnecessary auth calls
  const { data: existing } = await client
    .from("profiles")
    .select("user_id, whatsapp_e164, locale")
    .eq("whatsapp_e164", normalized)
    .maybeSingle();

  if (existing) return existing as ProfileRecord;

  // 2. Try to create Auth User to get a valid user_id
  // This requires the client to have service_role privileges (which it does in the webhook)
  const { data: authUser, error: authError } = await client.auth.admin.createUser({
    phone: normalized,
    phone_confirm: true,
    user_metadata: { role: "buyer" },
  });

  let userId: string;

  if (authError) {
    // If the error is "phone_exists", the user already exists in auth.
    // We need to look them up by phone number to get their user_id
    if (authError.message?.includes("already registered") || authError.message?.includes("phone_exists")) {
      await logStructuredEvent("AUTH_USER_EXISTS_LOOKING_UP", {
        masked_phone: maskMsisdn(normalized),
        error_code: (authError as any).code,
      });

      // Query auth.users table directly (indexed, fast, reliable)
      const { data: authUsers, error: lookupError } = await client
        .from("auth.users")
        .select("id, phone")
        .eq("phone", normalized)
        .maybeSingle();
      
      if (lookupError) {
        await logStructuredEvent("AUTH_USER_LOOKUP_ERROR", {
          masked_phone: maskMsisdn(normalized),
          error: lookupError.message,
          error_code: (lookupError as any).code,
        });
        throw lookupError;
      }
      
      if (!authUsers) {
        await logStructuredEvent("AUTH_USER_NOT_FOUND_AFTER_EXISTS_ERROR", {
          masked_phone: maskMsisdn(normalized),
          note: "Phone exists error but user not found in auth.users table",
        });
        throw new Error(`Phone exists in auth but user not found: ${maskMsisdn(normalized)}`);
      }
      
      userId = authUsers.id;
      
      await logStructuredEvent("AUTH_USER_FOUND_EXISTING", {
        masked_phone: maskMsisdn(normalized),
        user_id: userId,
      });
    } else {
      // Some other auth error - log and propagate it
      await logStructuredEvent("AUTH_USER_CREATE_FAILED", {
        masked_phone: maskMsisdn(normalized),
        error: authError.message,
        error_code: (authError as any).code,
        error_status: (authError as any).status,
      });
      throw authError;
    }
  } else {
    if (!authUser.user) {
      await logStructuredEvent("AUTH_USER_CREATE_NO_USER", {
        masked_phone: maskMsisdn(normalized),
      });
      throw new Error("Failed to create auth user");
    }
    userId = authUser.user.id;
    
    await logStructuredEvent("AUTH_USER_CREATED_NEW", {
      masked_phone: maskMsisdn(normalized),
      user_id: userId,
    });
  }

  // 3. Create Profile with the user_id
  payload.user_id = userId;
  payload.role = "buyer";

  const { data, error } = await client
    .from("profiles")
    .upsert(payload, { onConflict: "whatsapp_e164" })
    .select("user_id, whatsapp_e164, locale")
    .single();
    
  if (error) {
    await logStructuredEvent("PROFILE_UPSERT_FAILED", {
      masked_phone: maskMsisdn(normalized),
      user_id: userId,
      error: error.message,
      error_code: error.code,
    });
    throw error;
  }
  
  await logStructuredEvent("PROFILE_ENSURED", {
    masked_phone: maskMsisdn(normalized),
    user_id: userId,
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
