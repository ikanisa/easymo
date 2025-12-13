import type { SupabaseClient } from "../deps.ts";

export async function logMomoQrRequest(
  client: SupabaseClient,
  payload: {
    requesterWaId: string;
    target: string;
    targetType: "msisdn" | "code";
    amountMinor: number | null;
    qrUrl: string;
    ussd: string;
    telUri: string;
  },
): Promise<void> {
  const insertPayload = {
    requester_wa_id: payload.requesterWaId,
    whatsapp_e164: payload.requesterWaId,
    target_value: payload.target,
    target_type: payload.targetType,
    amount_minor: payload.amountMinor,
    qr_url: payload.qrUrl,
    ussd_code: payload.ussd,
    tel_uri: payload.telUri,
  };
  const { error } = await client.from("momo_qr_requests").insert(insertPayload);
  if (error) {
    logStructuredEvent("ERROR", { error: "momo_qr.log_fail", error }, "error");
  }
}
