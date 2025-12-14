import { supabase } from "../config.ts";
import { logStructuredEvent } from "../../observability/index.ts";
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

  const { data: created, error: createError } = await client.auth.admin
    .createUser({
      phone: phoneE164,
      phone_confirm: true,
      user_metadata: { source: "whatsapp" },
    });

  if (!createError && created?.user?.id) return created.user.id;

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
  const orderColumns = ["updated_at", "last_updated"];
  for (const column of orderColumns) {
    const { data, error } = await client
      .from("chat_state")
      .select("state")
      .eq("user_id", userId)
      .order(column, { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error?.code === "42703") continue;
    if (error && error.code !== "PGRST116") throw error;
    return (data as any)?.state;
  }

  const { data, error } = await client
    .from("chat_state")
    .select("state")
    .eq("user_id", userId)
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw error;
  return (data as any)?.state;
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
      });
    }
    throw error;
  }

  try {
    const desiredLocale = locale ?? null;

    // 1) Prefer existing profile (avoid auth calls)
    const lookupCandidates: Array<{ column: string; value: string }> = [
      { column: "whatsapp_number", value: digits },
      { column: "wa_id", value: digits },
      { column: "whatsapp_e164", value: normalizedE164 },
      { column: "phone_number", value: normalizedE164 },
      { column: "phone_e164", value: normalizedE164 },
      { column: "whatsapp_number", value: normalizedE164 },
      { column: "wa_id", value: normalizedE164 },
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
        whatsapp_e164: normalizedE164,
        locale: effectiveLocale,
      };
    }

    // 2) Create or reuse auth user for this phone, then ensure profile row exists
    const userId = await getOrCreateAuthUserId(client, normalizedE164);
    await ensureProfileRowExists(client, userId);

    // 3) Best-effort: persist phone mapping across known column variants
    await tryUpdateProfile(client, userId, { whatsapp_number: digits });
    await tryUpdateProfile(client, userId, { wa_id: digits });
    await tryUpdateProfile(client, userId, { whatsapp_e164: normalizedE164 });
    await tryUpdateProfile(client, userId, { phone_number: normalizedE164 });
    await tryUpdateProfile(client, userId, { phone_e164: normalizedE164 });

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
      whatsapp_e164: normalizedE164,
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
  const nowIso = new Date().toISOString();
  const base = { user_id: userId, state };

  const candidates: Array<Record<string, unknown>> = [
    { ...base, state_key: state.key, updated_at: nowIso },
    { ...base, state_key: state.key, last_updated: nowIso },
    { ...base, updated_at: nowIso },
    { ...base, last_updated: nowIso },
    base,
  ];

  for (const payload of candidates) {
    const { error } = await client
      .from("chat_state")
      .upsert(payload, { onConflict: "user_id" });
    if (!error) return;
    if (error.code === "42703") continue; // missing column
    if (error.code === "42P10") {
      // No unique constraint on user_id: update-or-insert fallback
      const { data: existing, error: selectError } = await client
        .from("chat_state")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (selectError && selectError.code !== "PGRST116") throw selectError;

      if (existing) {
        const { error: updateError } = await client
          .from("chat_state")
          .update(payload)
          .eq("user_id", userId);
        if (updateError) throw updateError;
        return;
      }

      const { error: insertError } = await client.from("chat_state").insert(
        payload,
      );
      if (insertError) throw insertError;
      return;
    }
    throw error;
  }

  throw new Error("Unable to persist chat state (schema mismatch)");
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
