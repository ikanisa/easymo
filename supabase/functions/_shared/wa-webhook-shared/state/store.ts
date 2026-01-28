import { logStructuredEvent } from "../../observability/index.ts";
import { supabase } from "../config.ts";
import type { SupportedLanguage } from "../i18n/language.ts";

export type ChatState = { key: string; data?: Record<string, unknown> };

type ProfileRecord = {
  user_id: string;
  wa_id?: string | null;
  phone_number?: string | null;
  locale: string | null;
};

const WA_NUMBER_REGEX = /^\+\d{8,15}$/;
const ALLOWED_PREFIXES = (Deno.env.get("WA_ALLOWED_MSISDN_PREFIXES") ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter((value) => value.length > 0);
const ENFORCE_PREFIXES = (Deno.env.get("WA_ENFORCE_PREFIXES") ?? "false")
  .toLowerCase() === "true";

export class InvalidWhatsAppNumberError extends Error {
  constructor(readonly msisdn: string) {
    super("invalid_whatsapp_number");
  }
}

function normalizeWhatsAppNumber(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/[^0-9]/g, "");
  if (!digits || digits.length === 0) {
    throw new InvalidWhatsAppNumberError(raw);
  }
  // Accept any phone number format - just normalize to E.164-like format with +
  // No regex validation or prefix restrictions - allow all country codes
  const normalized = `+${digits}`;
  return normalized;
}

function maskMsisdn(msisdn: string): string {
  const digits = msisdn.replace(/[^0-9]/g, "");
  if (digits.length <= 4) return `***${digits}`;
  return `***${digits.slice(-4)}`;
}

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

async function findAuthUserIdByPhone(
  client = supabase,
  phone: string,
): Promise<string | null> {
  try {
    const { data, error } = await client
      .schema("auth")
      .from("users")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();
    if (error) return null;
    return data?.id ?? null;
  } catch {
    return null;
  }
}

async function findAuthUserIdByPhoneViaAdminList(
  client = supabase,
  phone: string,
): Promise<string | null> {
  try {
    const perPage = 200;
    for (let page = 1; page <= 10; page++) {
      const { data, error } = await client.auth.admin.listUsers({
        page,
        perPage,
      } as any);
      if (error) return null;

      const users = (data as any)?.users as
        | Array<{ id: string; phone?: string | null }>
        | undefined;
      if (!users?.length) return null;

      const match = users.find((user) => user.phone === phone);
      if (match?.id) return match.id;

      if (users.length < perPage) return null;
    }
    return null;
  } catch {
    return null;
  }
}

async function getOrCreateAuthUserId(
  client = supabase,
  phoneE164: string,
): Promise<string> {
  const existing = await findAuthUserIdByPhone(client, phoneE164);
  if (existing) return existing;

  // Create anonymous user (no password, phone as identifier)
  // This creates an anonymous user that can be identified by phone number
  const { data: created, error: createError } = await client.auth.admin
    .createUser({
      phone: phoneE164,
      phone_confirm: true,
      // No password = anonymous user
      // No email = anonymous user
      user_metadata: { 
        source: "whatsapp",
        auth_type: "anonymous",
        phone: phoneE164,
      },
      app_metadata: {
        provider: "whatsapp",
        providers: ["whatsapp"],
      },
    });

  if (!createError && created?.user?.id) {
    await logStructuredEvent("ANONYMOUS_USER_CREATED", {
      phone: maskMsisdn(phoneE164),
      user_id: created.user.id,
    });
    return created.user.id;
  }

  // If creation failed, check if it's a duplicate error (phone already exists)
  if (createError) {
    const errorMsg = createError.message?.toLowerCase() ?? "";
    const isDuplicateError =
      errorMsg.includes("already registered") ||
      errorMsg.includes("duplicate") ||
      errorMsg.includes("unique constraint") ||
      createError.code === "23505";

    if (isDuplicateError) {
      // Treat as recoverable - phone exists, just find the user
      const retry = await findAuthUserIdByPhone(client, phoneE164);
      if (retry) return retry;

      const viaList = await findAuthUserIdByPhoneViaAdminList(client, phoneE164);
      if (viaList) return viaList;

      // Log for debugging but don't throw - fall through to last resort lookup
      await logStructuredEvent(
        "AUTH_USER_LOOKUP_RETRY",
        {
          phone: maskMsisdn(phoneE164),
          error: "Phone exists, attempting extensive lookup",
        },
        "warn",
      );
      
      // Fall through to last resort lookup below
    } else {
      // Non-duplicate error - this is a real problem, throw it
      throw createError;
    }
  }

  // 5. Last resort: extensive lookup (for duplicate errors that couldn't be resolved above)
  const retry = await findAuthUserIdByPhone(client, phoneE164);
  if (retry) return retry;

  const viaList = await findAuthUserIdByPhoneViaAdminList(client, phoneE164);
  if (viaList) return viaList;

  // At this point, we've exhausted all options
  throw new Error(`Failed to resolve auth user id for ${maskMsisdn(phoneE164)}`);
}

async function findProfileUserIdByColumn(
  client = supabase,
  column: string,
  value: string,
): Promise<string | null> {
  const { data, error } = await client
    .from("profiles")
    .select("user_id")
    .eq(column, value)
    .maybeSingle();

  if (error?.code === "42703") return null; // missing column
  if (error && error.code !== "PGRST116") throw error;
  return (data as any)?.user_id ?? null;
}

async function loadProfileLocale(
  client = supabase,
  userId: string,
): Promise<string | null> {
  const selectors = ["language", "locale"];
  for (const selector of selectors) {
    const { data, error } = await client
      .from("profiles")
      .select(selector)
      .eq("user_id", userId)
      .maybeSingle();
    if (error?.code === "42703") continue;
    if (error && error.code !== "PGRST116") throw error;
    const value = (data as any)?.[selector];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

async function ensureProfileRowExists(
  client = supabase,
  userId: string,
): Promise<void> {
  const { error } = await client
    .from("profiles")
    .upsert({ user_id: userId }, { onConflict: "user_id" });
  if (!error) return;

  if (error.code === "42P10") {
    const { data: existing, error: selectError } = await client
      .from("profiles")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (selectError && selectError.code !== "PGRST116") throw selectError;

    if (existing) return;

    const { error: insertError } = await client
      .from("profiles")
      .insert({ user_id: userId });
    if (insertError) throw insertError;
    return;
  }

  throw error;
}

async function tryUpdateProfile(
  client = supabase,
  userId: string,
  patch: Record<string, unknown>,
): Promise<boolean> {
  const { error } = await client
    .from("profiles")
    .update(patch)
    .eq("user_id", userId);
  if (!error) return true;
  if (error.code === "42703") return false;
  throw error;
}

async function loadChatStateRow(
  client = supabase,
  userId: string,
): Promise<unknown> {
  // Get user's phone number from profile
  const { data: profile } = await client
    .from("profiles")
    .select("wa_id, phone_number")
    .eq("user_id", userId)
    .maybeSingle();
  
  // Use phone_number if available, otherwise wa_id
  const phoneForSession = profile?.phone_number || profile?.wa_id;
  if (!phoneForSession) {
    return null;
  }

  // Use user_sessions table instead of non-existent chat_state
  const { data, error } = await client
    .from("user_sessions")
    .select("context")
    .eq("phone_number", phoneForSession)
    .maybeSingle();
  
  if (error && error.code !== "PGRST116") {
    // If table doesn't exist or error, return null (will use default state)
    return null;
  }
  
  return (data as any)?.context || null;
}

export async function ensureProfile(
  client = supabase,
  whatsapp: string,
  locale?: SupportedLanguage,
): Promise<ProfileRecord> {
  let normalizedE164: string;
  let digits: string;
  try {
    normalizedE164 = normalizeWhatsAppNumber(whatsapp);
    digits = normalizedE164.replace(/^\+/, "");
  } catch (error) {
    if (error instanceof InvalidWhatsAppNumberError) {
      await logStructuredEvent("INVALID_WHATSAPP_NUMBER", {
        masked_input: maskMsisdn(whatsapp),
        masked_normalized: maskMsisdn(error.msisdn ?? ""),
        input_length: whatsapp.length,
        digits_only: whatsapp.replace(/[^0-9]/g, "").length,
      }, "warn");
      // For very short numbers (like test numbers), use a fallback normalization
      // This allows the system to continue processing even with incomplete numbers
      const inputDigits = whatsapp.replace(/[^0-9]/g, "");
      if (inputDigits.length >= 4 && inputDigits.length < 8) {
        await logStructuredEvent("USING_FALLBACK_NORMALIZATION_FOR_SHORT_NUMBER", {
          masked_input: maskMsisdn(whatsapp),
          digits_length: inputDigits.length,
        }, "warn");
        // Use a default country code (250 for Rwanda) and pad the number
        normalizedE164 = `+250${inputDigits.padStart(9, "0")}`;
        digits = normalizedE164.replace(/^\+/, "");
      } else {
        // Too short or invalid - throw the error
        throw error;
      }
    } else {
      throw error;
    }
  }
  
  // Ensure digits is set
  if (!normalizedE164) {
    throw new InvalidWhatsAppNumberError(whatsapp);
  }
  digits = normalizedE164.replace(/^\+/, "");

  try {
    const desiredLocale = locale ?? null;

    // Try RPC function first (if it exists)
    try {
      const { data: rpcData, error: rpcError } = await client.rpc(
        "ensure_whatsapp_user",
        {
          _wa_id: whatsapp,
          _profile_name: "User",
        },
      );

      // If RPC function exists and returns data, use it
      if (!rpcError && rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
        const profile = rpcData[0];
        // Check if profile has valid user_id (not NULL)
        if (profile && profile.user_id) {
          const effectiveLocale = desiredLocale ?? profile.locale ?? "en";

          // Update locale if needed
          if (desiredLocale && profile.locale !== desiredLocale) {
            await tryUpdateProfile(client, profile.user_id, {
              language: desiredLocale,
            });
          }

          await logStructuredEvent("PROFILE_ENSURED_VIA_RPC", {
            masked_phone: maskMsisdn(normalizedE164),
            user_id: profile.user_id,
            locale: effectiveLocale,
          });

          return {
            user_id: profile.user_id,
            wa_id: digits,
            phone_number: normalizedE164,
            locale: effectiveLocale,
          };
        }
        // If RPC returned empty array or NULL user_id, fall through to fallback
      }

      // If RPC returns error or NULL, fall through to fallback logic
      if (rpcError) {
        // Properly serialize error for logging
        const errorMessage = rpcError instanceof Error 
          ? rpcError.message 
          : (rpcError && typeof rpcError === "object" && "message" in rpcError)
          ? String((rpcError as Record<string, unknown>).message)
          : String(rpcError);
        
        const errorCode = (rpcError && typeof rpcError === "object" && "code" in rpcError)
          ? String((rpcError as Record<string, unknown>).code)
          : undefined;
        
        // Only log as warning if it's not a "function doesn't exist" error
        // Ambiguity errors should be logged but we'll use fallback
        if (!errorMessage.includes("does not exist")) {
          await logStructuredEvent("PROFILE_RPC_ERROR", {
            error: errorMessage,
            errorCode,
            masked_phone: maskMsisdn(normalizedE164),
          }, "warn");
        }
      }
    } catch (rpcErr) {
      // RPC function might not exist - fall through to fallback logic
      // This is expected during migration period
    }

    // Fallback: Use existing logic if RPC function doesn't exist or returned NULL
    // 1) Prefer existing profile (avoid auth calls)
    const lookupCandidates: Array<{ column: string; value: string }> = [
      { column: "wa_id", value: digits },
      { column: "phone_number", value: normalizedE164 },
      { column: "wa_id", value: normalizedE164 },
      { column: "phone_number", value: digits },
    ];

    let existingUserId: string | null = null;
    for (const candidate of lookupCandidates) {
      const found = await findProfileUserIdByColumn(
        client,
        candidate.column,
        candidate.value,
      );
      if (found) {
        existingUserId = found;
        break;
      }
    }

    if (existingUserId) {
      const storedLocale = await loadProfileLocale(client, existingUserId);
      const effectiveLocale = desiredLocale ?? storedLocale ?? "en";

      if (desiredLocale && storedLocale !== desiredLocale) {
        const updated = await tryUpdateProfile(client, existingUserId, {
          language: desiredLocale,
        });
        if (!updated) {
          await tryUpdateProfile(client, existingUserId, {
            locale: desiredLocale,
          });
        }
      }

      await logStructuredEvent("PROFILE_ENSURED", {
        masked_phone: maskMsisdn(normalizedE164),
        user_id: existingUserId,
        locale: effectiveLocale,
      });

      return {
        user_id: existingUserId,
        wa_id: digits,
        phone_number: normalizedE164,
        locale: effectiveLocale,
      };
    }

    // 2) Create or reuse auth user for this phone (anonymous authentication)
    // The trigger will automatically create the profile, but we ensure it exists
    const userId = await getOrCreateAuthUserId(client, normalizedE164);
    await ensureProfileRowExists(client, userId);

    // 3) Best-effort: persist phone mapping in actual columns
    // Store in both wa_id (digits) and phone_number (E.164 format)
    await tryUpdateProfile(client, userId, { wa_id: digits });
    await tryUpdateProfile(client, userId, { phone_number: normalizedE164 });

    // 4) Best-effort: persist preferred language across known column variants
    const effectiveLocale = desiredLocale ??
      (await loadProfileLocale(client, userId)) ?? "en";
    if (desiredLocale) {
      const updated = await tryUpdateProfile(client, userId, {
        language: desiredLocale,
      });
      if (!updated) {
        await tryUpdateProfile(client, userId, { locale: desiredLocale });
      }
    }

    await logStructuredEvent("PROFILE_CREATED", {
      masked_phone: maskMsisdn(normalizedE164),
      user_id: userId,
      locale: effectiveLocale,
    });

    return {
      user_id: userId,
      wa_id: digits,
      phone_number: normalizedE164,
      locale: effectiveLocale,
    };
  } catch (error) {
    const errorMessage = formatUnknownError(error);
    const isDuplicateError = errorMessage.toLowerCase().includes(
      "already registered",
    );

    // Only log as error if it's NOT a duplicate (duplicate is handled in getOrCreateAuthUserId)
    if (!isDuplicateError) {
      await logStructuredEvent(
        "USER_ENSURE_ERROR",
        {
          masked_phone: maskMsisdn(normalizedE164),
          error: errorMessage,
        },
        "error",
      );
    }

    throw error;
  }
}

export async function getState(
  client = supabase,
  userId: string,
): Promise<ChatState> {
  const raw = await loadChatStateRow(client, userId);
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
  // Get user's phone number from profile
  const { data: profile } = await client
    .from("profiles")
    .select("wa_id, phone_number")
    .eq("user_id", userId)
    .maybeSingle();
  
  // Use phone_number if available, otherwise wa_id
  const phoneForSession = profile?.phone_number || profile?.wa_id;
  if (!phoneForSession) {
    logStructuredEvent("SET_STATE_NO_PHONE", { userId }, "error");
    return; // Can't set state without phone number
  }

  // Use user_sessions table instead of non-existent chat_state
  const { error } = await client
    .from("user_sessions")
    .upsert({
      phone_number: phoneForSession,
      context: { key: state.key, data: state.data || {} },
      last_interaction: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "phone_number",
    });
  
  if (error) {
    logStructuredEvent("SET_STATE_ERROR", {
      userId,
      error: error.message,
    }, "error");
    // Don't throw - state management should be resilient
  }
}

export async function clearState(
  client = supabase,
  userId: string,
): Promise<void> {
  // Get user's phone number from profile
  const { data: profile } = await client
    .from("profiles")
    .select("wa_id, phone_number")
    .eq("user_id", userId)
    .maybeSingle();
  
  // Use phone_number if available, otherwise wa_id
  const phoneForSession = profile?.phone_number || profile?.wa_id;
  if (!phoneForSession) {
    return; // Nothing to clear
  }

  // Use user_sessions table instead of non-existent chat_state
  const { error } = await client
    .from("user_sessions")
    .update({
      context: {},
      active_service: null,
      updated_at: new Date().toISOString(),
    })
    .eq("phone_number", phoneForSession);
  
  if (error && error.code !== "PGRST116") {
    logStructuredEvent("CLEAR_STATE_ERROR", {
      userId,
      error: error.message,
    }, "error");
    // Don't throw - state management should be resilient
  }
}
