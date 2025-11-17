import { WA_BOT_NUMBER_E164 } from "../config.ts";
import type { SupabaseClient } from "../deps.ts";

const SHORT_LINK_PREFIX = "https://easy.mo/r/";
const QR_BASE = "https://quickchart.io/qr?text=";
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const REFERRAL_NUMBER_E164 =
  Deno.env.get("WA_REFERRAL_NUMBER_E164") ?? "+22893002751";

export function buildWaLink(prefill: string, overrideNumber?: string): string {
  const rawNumber = overrideNumber ?? WA_BOT_NUMBER_E164 ?? REFERRAL_NUMBER_E164;
  if (!rawNumber) return "";
  const digits = rawNumber.replace(/^\+/, "").replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(prefill)}`;
}

export async function ensureReferralLink(
  client: SupabaseClient,
  profileId: string,
): Promise<{ code: string; shortLink: string; waLink: string; qrUrl: string }> {
  const existing = await client
    .from("referral_links")
    .select("code, short_url")
    .eq("user_id", profileId)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing.error) throw existing.error;

  let code = existing.data?.code ?? "";
  if (!code) {
    code = await insertReferralLink(client, profileId);
  } else if (!existing.data?.short_url) {
    const shortLink = buildShortLink(code);
    await client
      .from("referral_links")
      .update({ short_url: shortLink })
      .eq("user_id", profileId)
      .eq("code", code);
  }

  const shortLink = existing.data?.short_url ?? buildShortLink(code);
  const waLink = buildWaLink(`REF:${code}`, REFERRAL_NUMBER_E164) || shortLink;
  const qrPayload = waLink || shortLink;
  const qrUrl = `${QR_BASE}${encodeURIComponent(qrPayload)}&timestamp=${Date.now()}`;
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

function generateReferralCode(length = 8): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let result = "";
  for (const byte of bytes) result += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return result;
}

function buildShortLink(code: string): string {
  return `${SHORT_LINK_PREFIX}${code}`;
}
