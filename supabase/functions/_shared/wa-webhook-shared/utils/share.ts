import { WA_BOT_NUMBER_E164 } from "../config.ts";
import type { SupabaseClient } from "../deps.ts";

const SHORT_LINK_PREFIX = "https://easy.mo/r/";
const QR_BASE = "https://quickchart.io/qr?text=";
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const REFERRAL_NUMBER_E164 = "+22893002751"; // Fixed referral number

export function buildWaLink(prefill: string, overrideNumber?: string): string {
  const rawNumber = overrideNumber ?? WA_BOT_NUMBER_E164 ?? REFERRAL_NUMBER_E164;
  if (!rawNumber) return "";
  const digits = rawNumber.replace(/^\+/, "").replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(prefill)}`;
}

export function buildQrUrl(payload: string): string {
  return `${QR_BASE}${encodeURIComponent(payload)}&timestamp=${Date.now()}`;
}

export async function ensureReferralLink(
  client: SupabaseClient,
  profileId: string,
): Promise<{ code: string; shortLink: string; waLink: string; qrUrl: string }> {
  // 1) Try to read an existing code from profiles for backward compatibility
  let code = "";
  try {
    const { data: prof } = await client
      .from("profiles")
      .select("referral_code, whatsapp_e164")
      .eq("user_id", profileId)
      .maybeSingle();
    if (prof?.referral_code && typeof prof.referral_code === "string") {
      code = prof.referral_code.trim().toUpperCase();
    }
  } catch (_) {
    // non-fatal
  }

  // 2) Ensure a referral link exists (prefer existing active link)
  let shortLinkFromDb: string | undefined;
  try {
    const existing = await client
      .from("referral_links")
      .select("code, short_url")
      .eq("user_id", profileId)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing.error && (existing.error as any)?.code !== "PGRST116") {
      throw existing.error;
    }
    if (existing.data?.code) {
      code = code || existing.data.code;
      shortLinkFromDb = existing.data.short_url || undefined;
    }
  } catch (_) {
    // non-fatal
  }

  // 3) If no code yet, try RPC generator; else fallback to local generation
  if (!code) {
    try {
      const { data } = await client.rpc("generate_referral_code", {
        p_profile_id: profileId,
      });
      if (typeof data === "string" && data) {
        code = data.trim().toUpperCase();
      }
    } catch (_) {
      // fallback to local
      code = generateReferralCode(8);
    }
    // Persist on profiles (best-effort)
    try {
      await client
        .from("profiles")
        .update({ referral_code: code })
        .eq("user_id", profileId);
    } catch (_) {
      // non-fatal
    }
  }

  // 4) Upsert into referral_links to ensure referral_apply_code_v2 can map code→user
  const shortLink = shortLinkFromDb ?? buildShortLink(code);
  try {
    // Try to insert first (most schemas permit duplicates via conflict handling)
    const { error } = await client
      .from("referral_links")
      .upsert({ user_id: profileId, code, short_url: shortLink, active: true }, {
        onConflict: "code",
        ignoreDuplicates: false,
      } as any);
    if (error && (error as any).code !== "23505") {
      // fallback: attempt targeted update
      await client
        .from("referral_links")
        .update({ short_url: shortLink, active: true })
        .eq("user_id", profileId)
        .eq("code", code);
    }
  } catch (_) {
    // non-fatal: we can still return a valid wa.me link
  }

  const waLink = buildWaLink(`REF:${code}`, REFERRAL_NUMBER_E164) || shortLink;
  const qrPayload = waLink || shortLink;
  const qrUrl = buildQrUrl(qrPayload);
  return { code, shortLink, waLink, qrUrl };
}

async function insertReferralLink(
  client: SupabaseClient,
  profileId: string,
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode();
    const shortLink = buildShortLink(code);
    const { data, error } = await client
      .from("referral_links")
      .insert({ user_id: profileId, code, short_url: shortLink, active: true })
      .select("code")
      .single();
    if (!error && data?.code) return data.code;
    if (error && (error as any).code === "23505") continue;
    if (error) throw error;
  }
  throw new Error("Failed to create referral link");
}

export function generateReferralCode(length = 8): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let result = "";
  for (const byte of bytes) result += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return result;
}

function buildShortLink(code: string): string {
  return `${SHORT_LINK_PREFIX}${code}`;
}
