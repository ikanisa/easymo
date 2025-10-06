import { z } from "zod";
import {
  adminVoucherDetailSchema,
  adminVoucherListSchema,
  adminVoucherListItemSchema,
  type AdminVoucherDetail,
  type AdminVoucherList,
} from "@/lib/schemas";

const flowExchangeMessageSchema = z.object({
  type: z.enum(["info", "warning", "error"]),
  text: z.string(),
});

const flowExchangeResponseSchema = z.object({
  next_screen_id: z.string(),
  data: z.unknown().optional(),
  page_token_next: z.string().nullable().optional(),
  messages: z.array(flowExchangeMessageSchema).optional(),
  field_errors: z.record(z.string()).optional(),
});

const voucherListDataSchema = z.object({
  vouchers: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string().optional().nullable(),
    }),
  ),
});

const flowExchangeVoucherListSchema = flowExchangeResponseSchema.extend({
  data: voucherListDataSchema.optional(),
});

const voucherDetailDataSchema = z.object({
  voucher: z.object({
    id: z.string(),
    code_5: z.string(),
    amount_text: z.string(),
    policy_number: z.string().nullable().optional(),
    whatsapp_e164: z.string().nullable().optional(),
    status: z.string(),
    issued_at: z.string(),
    redeemed_at: z.string().nullable().optional(),
  }),
});

const flowExchangeVoucherDetailSchema = flowExchangeResponseSchema.extend({
  data: voucherDetailDataSchema.optional(),
});

function mapMessages(messages?: Array<{ text: string }>): string[] {
  if (!messages) return [];
  return messages.map((msg) => msg.text);
}

export function parseAdminVoucherListFromFlowExchange(
  payload: unknown,
): AdminVoucherList {
  const parsed = flowExchangeVoucherListSchema.parse(payload);
  const vouchers = (parsed.data?.vouchers ?? []).map((item) =>
    adminVoucherListItemSchema.parse(item)
  );
  return adminVoucherListSchema.parse({
    vouchers,
    messages: mapMessages(parsed.messages),
  });
}

export function parseAdminVoucherDetailFromFlowExchange(
  payload: unknown,
): AdminVoucherDetail {
  const parsed = flowExchangeVoucherDetailSchema.parse(payload);
  const voucher = parsed.data?.voucher;
  if (!voucher) {
    throw new Error("Voucher detail missing in flow-exchange response");
  }
  return adminVoucherDetailSchema.parse({
    id: voucher.id,
    code5: voucher.code_5,
    amountText: voucher.amount_text,
    policyNumber: voucher.policy_number ?? null,
    whatsappE164: voucher.whatsapp_e164 ?? null,
    status: voucher.status,
    issuedAt: voucher.issued_at,
    redeemedAt: voucher.redeemed_at ?? null,
    messages: mapMessages(parsed.messages),
  });
}
