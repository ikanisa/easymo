import type { FlowExchangeRequest, FlowExchangeResponse } from "../../types.ts";
import { supabase } from "../../config.ts";
import { generateVoucher, redeemVoucher } from "../../vouchers/service.ts";
import { logStructuredEvent } from "../../observe/log.ts";
import { normalizeWaId } from "./auth.ts";

const DEFAULT_LIST_LIMIT = 9;

export async function handleAdminVouchers(
  req: FlowExchangeRequest,
  ctx: { waId: string },
): Promise<FlowExchangeResponse> {
  switch (req.action_id) {
    case "a_admin_voucher_issue":
      return await issueVoucher(req, ctx.waId);
    case "a_admin_voucher_check":
      return await checkVoucher(req);
    case "a_admin_voucher_redeem_confirm":
      return await confirmRedeem(req, ctx.waId);
    case "a_admin_voucher_recent":
      return await loadRecent(req);
    case "a_admin_voucher_search":
      return await searchVoucher(req);
    case "a_admin_voucher_detail":
      return await loadDetail(req);
    default:
      return {
        next_screen_id: req.screen_id,
        messages: [{
          level: "warning",
          text: `Unknown voucher action ${req.action_id}`,
        }],
      };
  }
}

async function issueVoucher(
  req: FlowExchangeRequest,
  adminWa: string,
): Promise<FlowExchangeResponse> {
  const whatsapp = toStringField(req.fields?.whatsapp_e164);
  const policyNumber = toStringField(req.fields?.policy_number);
  const plate = toOptionalString(req.fields?.plate);
  if (!whatsapp || !policyNumber) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Enter WhatsApp number and policy." }],
    };
  }
  try {
    const adminProfileId = await findProfileId(normalizeWaId(adminWa));
    const result = await generateVoucher({
      supabase,
      adminWaId: adminWa,
      adminProfileId,
      whatsappE164: whatsapp,
      policyNumber,
      plate,
    });
    return {
      next_screen_id: "s_voucher_issue",
      messages: [{
        level: "info",
        text: `Voucher sent ✓ Code ${result.code5}`,
      }],
      data: {
        voucher_preview: {
          code: result.code5,
          amount_minor: result.amountMinor,
          policy_number: result.policyNumber,
        },
      },
    };
  } catch (error) {
    await logStructuredEvent("VOUCHER_ISSUE_FAIL", {
      error: String(error),
      policy_number: policyNumber,
    });
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Issue failed." }],
    };
  }
}

async function checkVoucher(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const code5 = toStringField(req.fields?.code_5);
  if (!code5) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Enter code." }],
    };
  }
  const normalized = code5.padStart(5, "0");
  const { data, error } = await supabase
    .from("vouchers")
    .select(
      "id, code_5, amount_minor, currency, status, policy_number, whatsapp_e164, issued_at, redeemed_at, redeemed_by_station_id",
    )
    .eq("code_5", normalized)
    .maybeSingle();
  if (error) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Lookup failed." }],
    };
  }
  if (!data) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Voucher not found." }],
    };
  }
  if (data.status !== "issued") {
    return {
      next_screen_id: req.screen_id,
      messages: [{
        level: "warning",
        text: `Voucher ${normalized} already ${data.status}.`,
      }],
    };
  }
  return {
    next_screen_id: "s_voucher_confirm",
    data: {
      voucher: summarizeVoucher(data),
    },
  };
}

async function confirmRedeem(
  req: FlowExchangeRequest,
  adminWa: string,
): Promise<FlowExchangeResponse> {
  const code5 = toStringField(req.fields?.code_5);
  if (!code5) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Missing code." }],
    };
  }
  try {
    const result = await redeemVoucher({
      supabase,
      code5,
      redeemerWaId: adminWa,
      stationId: toOptionalString(req.fields?.station_id),
      reason: toOptionalString(req.fields?.reason),
    });
    if (result.status === "redeemed") {
      return {
        next_screen_id: "s_voucher_menu",
        messages: [{ level: "info", text: "Voucher redeemed." }],
      };
    }
    if (result.status === "already_redeemed") {
      return {
        next_screen_id: req.screen_id,
        messages: [{
          level: "warning",
          text: `Already redeemed on ${formatDate(result.voucher.redeemed_at)}`,
        }],
      };
    }
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Voucher not found." }],
    };
  } catch (error) {
    await logStructuredEvent("VOUCHER_REDEEM_FAIL", {
      error: String(error),
      code_5: code5,
    });
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Redeem failed." }],
    };
  }
}

async function loadRecent(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const { data, error } = await supabase
    .from("vouchers")
    .select(
      "id, code_5, amount_minor, currency, status, policy_number, issued_at, redeemed_at",
    )
    .order("issued_at", { ascending: false })
    .limit(DEFAULT_LIST_LIMIT);
  if (error) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Failed to load." }],
    };
  }
  return {
    next_screen_id: "s_voucher_recent",
    data: {
      vouchers: (data ?? []).map(toListRow),
    },
  };
}

async function searchVoucher(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const code5 = toOptionalString(req.fields?.code_5);
  const policy = toOptionalString(req.fields?.policy_number);
  if (!code5 && !policy) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Enter code or policy." }],
    };
  }
  let query = supabase
    .from("vouchers")
    .select(
      "id, code_5, amount_minor, currency, status, policy_number, issued_at, redeemed_at",
    )
    .order("issued_at", { ascending: false })
    .limit(DEFAULT_LIST_LIMIT);
  if (code5) {
    query = query.eq("code_5", code5.padStart(5, "0"));
  }
  if (policy) {
    query = query.eq("policy_number", policy);
  }
  const { data, error } = await query;
  if (error) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Search failed." }],
    };
  }
  if (!data?.length) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "warning", text: "No vouchers found." }],
    };
  }
  return {
    next_screen_id: "s_voucher_search_results",
    data: {
      vouchers: data.map(toListRow),
    },
  };
}

async function loadDetail(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const voucherId = toOptionalString(req.fields?.voucher_id);
  if (!voucherId) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Missing voucher id." }],
    };
  }
  const { data, error } = await supabase
    .from("vouchers")
    .select(
      "id, code_5, amount_minor, currency, status, policy_number, whatsapp_e164, issued_at, redeemed_at, redeemed_by_station_id, notes",
    )
    .eq("id", voucherId)
    .maybeSingle();
  if (error || !data) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Voucher not found." }],
    };
  }
  return {
    next_screen_id: "s_voucher_detail",
    data: {
      voucher: summarizeVoucher(data),
    },
  };
}

async function findProfileId(wa: string): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("whatsapp_e164", wa)
    .maybeSingle();
  return data?.user_id ?? null;
}

function toStringField(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

function toOptionalString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

function toListRow(row: any) {
  const status = row.status ?? "issued";
  const subtitle = status === "redeemed" && row.redeemed_at
    ? `Redeemed ${formatDate(row.redeemed_at)}`
    : `Issued ${formatDate(row.issued_at)}`;
  return {
    id: row.id,
    title: `${row.code_5} · ${formatAmount(row.amount_minor, row.currency)}`,
    description: subtitle,
  };
}

function summarizeVoucher(row: any) {
  return {
    id: row.id,
    code_5: row.code_5,
    amount_text: formatAmount(row.amount_minor, row.currency),
    policy_number: row.policy_number,
    whatsapp_e164: row.whatsapp_e164,
    status: row.status,
    issued_at: formatDate(row.issued_at),
    redeemed_at: row.redeemed_at ? formatDate(row.redeemed_at) : null,
  };
}

function formatAmount(amountMinor: number, currency: string): string {
  return `${currency} ${Number(amountMinor ?? 0).toLocaleString("en-US")}`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
