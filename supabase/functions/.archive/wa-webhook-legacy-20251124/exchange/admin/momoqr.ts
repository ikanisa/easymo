import type { FlowExchangeRequest, FlowExchangeResponse } from "../../types.ts";
import { supabase } from "../../config.ts";
import { recordAdminAudit } from "./audit.ts";
import { encodeTelUriForQr, formatUssdText } from "../../utils/ussd.ts";

const LIMIT = 10;

export async function handleAdminMomoQr(
  req: FlowExchangeRequest,
  ctx: { waId: string },
): Promise<FlowExchangeResponse> {
  switch (req.action_id) {
    case "a_admin_momoqr_recent":
    case "a_admin_open_momoqr":
      return await recent(req);
    case "a_admin_qr_generate":
      return await generate(req, ctx.waId);
    default:
      return {
        next_screen_id: req.screen_id,
        messages: [{
          level: "warning",
          text: `Unknown MoMo action ${req.action_id}`,
        }],
      };
  }
}

async function recent(req: FlowExchangeRequest): Promise<FlowExchangeResponse> {
  const { data, error } = await supabase
    .from("momo_qr_requests")
    .select(
      "id, user_id, msisdn_or_code, amount, qr_url, ussd, tel_uri, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (error) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Failed to load history." }],
    };
  }
  return {
    next_screen_id: "s_qr_recent",
    data: {
      requests: data ?? [],
    },
  };
}

async function generate(
  req: FlowExchangeRequest,
  adminWa: string,
): Promise<FlowExchangeResponse> {
  const target = typeof req.fields?.target === "string"
    ? req.fields.target
    : undefined;
  const amount = typeof req.fields?.amount === "number"
    ? req.fields.amount
    : Number(req.fields?.amount ?? 0);
  if (!target) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Enter target number or code." }],
    };
  }
  const humanUssd = `*182*8*1*${target}#`;
  // Use QR-optimized encoding for better Android compatibility
  const telUri = encodeTelUriForQr(humanUssd);
  const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(telUri)}`;
  await supabase
    .from("momo_qr_requests")
    .insert({
      user_id: null,
      msisdn_or_code: target,
      amount,
      qr_url: qrUrl,
      ussd: humanUssd,
      tel_uri: telUri,
    });
  await recordAdminAudit({
    adminWaId: adminWa,
    action: "admin_momoqr_generate",
    targetId: target,
    after: { amount },
  });
  return {
    next_screen_id: "s_qr_result",
    data: {
      qr_url: qrUrl,
      ussd: formatUssdText(humanUssd),
      tel_uri: telUri,
    },
  };
}
