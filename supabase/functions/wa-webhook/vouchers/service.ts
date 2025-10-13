import { crypto, TextEncoder } from "../deps.ts";
import type { SupabaseClient } from "../deps.ts";
import { VOUCHER_BUCKET, VOUCHER_SIGNING_SECRET } from "../config.ts";
import { logStructuredEvent } from "../observe/log.ts";
import { queueNotification } from "../notify/sender.ts";
import { recordAdminAudit } from "../exchange/admin/audit.ts";
import { getAppConfig } from "../utils/app_config.ts";
import { renderVoucherPng } from "./render.ts";

const DEFAULT_AMOUNT_MINOR = 2000;
const DEFAULT_CURRENCY = "RWF";
const SIGNATURE_LENGTH = 6;
const MAX_CODE_ATTEMPTS = 8;
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour
const SIGNATURE_SEPARATOR = ""; // adhere to raw concatenation rule

export type GenerateVoucherParams = {
  supabase: SupabaseClient;
  adminWaId: string;
  adminProfileId?: string | null;
  whatsappE164: string;
  policyNumber: string;
  plate?: string | null;
  amountMinor?: number;
  currency?: string;
};

export type RedeemVoucherParams = {
  supabase: SupabaseClient;
  code5: string;
  redeemerWaId: string;
  stationId?: string | null;
  reason?: string | null;
};

export type VoucherIssueResult = {
  voucherId: string;
  code5: string;
  signedUrl: string;
  amountMinor: number;
  policyNumber: string;
};

export type RedeemVoucherResult =
  | { status: "redeemed"; voucher: VoucherRow }
  | { status: "already_redeemed"; voucher: VoucherRow }
  | { status: "not_found" };

type VoucherRow = {
  id: string;
  code_5: string;
  amount_minor: number;
  currency: string;
  status: string;
  policy_number: string;
  whatsapp_e164: string;
  issued_at: string;
  redeemed_at: string | null;
  redeemed_by_station_id: string | null;
  image_url: string | null;
};

export async function generateVoucher(
  params: GenerateVoucherParams,
): Promise<VoucherIssueResult> {
  const amountMinor = params.amountMinor ?? DEFAULT_AMOUNT_MINOR;
  const currency = params.currency ?? DEFAULT_CURRENCY;
  const supabase = params.supabase;
  const adminWa = normalizeWa(params.adminWaId);
  const recipientWa = normalizeWa(params.whatsappE164);
  const issuedAt = new Date();
  const issuedAtIso = issuedAt.toISOString();

  await logStructuredEvent("VOUCHER_ISSUE_REQ", {
    policy_number: params.policyNumber,
    wa_id: maskWa(recipientWa),
    admin_wa: maskWa(adminWa),
  });

  const voucherId = crypto.randomUUID();
  const code5 = await generateUniqueCode(supabase);
  const signature = await computeSignature(
    `${code5}${SIGNATURE_SEPARATOR}${params.policyNumber}${SIGNATURE_SEPARATOR}${issuedAtIso}`,
  );
  const qrPayload = `VC:${code5}:${signature}`;
  const userId = await findProfileId(supabase, recipientWa);

  const pngBytes = await renderVoucherPng({
    code: code5,
    amountMinor,
    currency,
    policyNumber: params.policyNumber,
    issuedAt,
    qrPayload,
    plate: params.plate ?? undefined,
  });

  const storagePath = `${voucherId}.png`;
  const { error: uploadError } = await supabase.storage
    .from(VOUCHER_BUCKET)
    .upload(storagePath, pngBytes, {
      cacheControl: "3600",
      contentType: "image/png",
      upsert: false,
    });
  if (uploadError) {
    await logStructuredEvent("VOUCHER_RENDER_FAIL", {
      policy_number: params.policyNumber,
      error: uploadError.message,
    });
    throw uploadError;
  }
  await logStructuredEvent("VOUCHER_RENDER_OK", {
    voucher_id: voucherId,
    size_bytes: pngBytes.length,
  });

  const insertPayload = {
    id: voucherId,
    code_5: code5,
    amount_minor: amountMinor,
    currency,
    status: "issued",
    user_id: userId,
    whatsapp_e164: recipientWa,
    policy_number: params.policyNumber,
    plate: params.plate ?? null,
    qr_payload: qrPayload,
    image_url: storagePath,
    issued_by_admin: params.adminProfileId ?? null,
    issued_at: issuedAtIso,
    notes: null as string | null,
  };

  const { error: insertError } = await supabase
    .from("vouchers")
    .insert(insertPayload);
  if (insertError) {
    await logStructuredEvent("VOUCHER_ISSUE_FAIL", {
      voucher_id: voucherId,
      error: insertError.message,
    });
    throw insertError;
  }

  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from(VOUCHER_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (signedUrlError || !signedUrlData?.signedUrl) {
    await logStructuredEvent("VOUCHER_SEND_FAIL", {
      voucher_id: voucherId,
      error: signedUrlError?.message ?? "missing_signed_url",
    });
    throw signedUrlError ?? new Error("Failed to create signed URL");
  }

  const caption = `ENGEN Fuel Voucher — ${
    formatCurrency(amountMinor, currency)
  }\nCode: ${code5}\nPolicy: ${params.policyNumber}`;

  await queueNotification({
    to: recipientWa,
    media: {
      type: "image",
      link: signedUrlData.signedUrl,
      caption,
    },
  }, { type: "voucher_issue", voucherId });

  await logStructuredEvent("VOUCHER_SEND_OK", {
    voucher_id: voucherId,
    wa_id: maskWa(recipientWa),
  });

  await recordAdminAudit({
    adminWaId: adminWa,
    action: "VOUCHER_ISSUE",
    targetId: voucherId,
    after: {
      policy_number: params.policyNumber,
      whatsapp_e164: recipientWa,
      amount_minor: amountMinor,
      currency,
    },
  });

  return {
    voucherId,
    code5,
    signedUrl: signedUrlData.signedUrl,
    amountMinor,
    policyNumber: params.policyNumber,
  };
}

export async function redeemVoucher(
  params: RedeemVoucherParams,
): Promise<RedeemVoucherResult> {
  const supabase = params.supabase;
  const code = params.code5.trim();
  const code5 = code.padStart(5, "0");
  const redeemerWa = normalizeWa(params.redeemerWaId);

  await logStructuredEvent("VOUCHER_REDEEM_CHECK", {
    code_5: code5,
    redeemer: maskWa(redeemerWa),
  });

  const { data: voucher, error: selectError } = await supabase
    .from("vouchers")
    .select(
      "id, code_5, amount_minor, currency, status, policy_number, whatsapp_e164, issued_at, redeemed_at, redeemed_by_station_id, image_url",
    )
    .eq("code_5", code5)
    .maybeSingle();
  if (selectError) throw selectError;
  if (!voucher) {
    return { status: "not_found" };
  }

  if (voucher.status !== "issued") {
    return { status: "already_redeemed", voucher };
  }

  const nowIso = new Date().toISOString();
  const stationId = params.stationId ?? null;
  const reason = params.reason ?? null;

  const { data: updated, error: updateError } = await supabase
    .from("vouchers")
    .update({
      status: "redeemed",
      redeemed_at: nowIso,
      redeemed_by_station_id: stationId,
      notes: reason,
    })
    .eq("id", voucher.id)
    .eq("status", "issued")
    .select(
      "id, code_5, amount_minor, currency, status, policy_number, whatsapp_e164, issued_at, redeemed_at, redeemed_by_station_id, image_url",
    )
    .maybeSingle();
  if (updateError) throw updateError;
  if (!updated) {
    const { data: current } = await supabase
      .from("vouchers")
      .select(
        "id, code_5, amount_minor, currency, status, policy_number, whatsapp_e164, issued_at, redeemed_at, redeemed_by_station_id, image_url",
      )
      .eq("id", voucher.id)
      .maybeSingle();
    return {
      status: "already_redeemed",
      voucher: (current ?? voucher) as VoucherRow,
    };
  }

  await supabase
    .from("voucher_redemptions")
    .insert({
      voucher_id: voucher.id,
      station_id: stationId,
      redeemer_wa_e164: redeemerWa,
      reason,
      meta: {},
    });

  await logStructuredEvent("VOUCHER_REDEEM_OK", {
    voucher_id: voucher.id,
    redeemer: maskWa(redeemerWa),
  });

  await recordAdminAudit({
    adminWaId: redeemerWa,
    action: "VOUCHER_REDEEM",
    targetId: voucher.id,
    after: {
      voucher_id: voucher.id,
      reason,
      station_id: stationId,
    },
  });

  const config = await getAppConfig(supabase);
  const admins = config.insurance_admin_numbers ?? [];
  const message = `Voucher ${code5} (${
    formatCurrency(updated.amount_minor, updated.currency)
  }) redeemed at ${nowIso}`;
  if (admins.length) {
    await Promise.allSettled(
      admins.slice(0, 5).map((wa) =>
        queueNotification({
          to: normalizeWa(wa),
          text: message,
        }, { type: "voucher_redeemed", voucherId: voucher.id })
      ),
    );
  }

  return { status: "redeemed", voucher: updated as VoucherRow };
}

async function generateUniqueCode(supabase: SupabaseClient): Promise<string> {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const candidate = randomCode();
    const { count, error } = await supabase
      .from("vouchers")
      .select("id", { head: true, count: "exact" })
      .eq("code_5", candidate)
      .in("status", ["issued", "redeemed"]);
    if (error) throw error;
    if (!count) {
      return candidate;
    }
  }
  throw new Error("Failed to generate unique voucher code");
}

function randomCode(): string {
  const random = crypto.getRandomValues(new Uint16Array(1))[0] % 100000;
  return random.toString().padStart(5, "0");
}

async function findProfileId(
  supabase: SupabaseClient,
  wa: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("whatsapp_e164", wa)
    .maybeSingle();
  return data?.user_id ?? null;
}

async function computeSignature(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(VOUCHER_SIGNING_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const data = encoder.encode(message);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, data));
  return base32Encode(signature).slice(0, SIGNATURE_LENGTH);
}

function base32Encode(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  let output = "";

  for (let i = 0; i < bytes.length; i += 1) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }
  return output;
}

function normalizeWa(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("+")) return trimmed;
  return `+${trimmed.replace(/^\+/, "")}`;
}

function maskWa(wa: string): string {
  const normalized = normalizeWa(wa);
  if (normalized.length <= 4) return normalized;
  return `***${normalized.slice(-4)}`;
}

function formatCurrency(amountMinor: number, currency: string): string {
  return `${currency} ${amountMinor.toLocaleString("en-US")}`;
}
