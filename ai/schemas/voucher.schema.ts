import { z } from "zod";

/**
 * Input schema for creating a voucher
 */
export const VoucherCreateInput = z.object({
  customer_msisdn: z.string().min(10).describe("Customer mobile number (MSISDN)"),
  amount: z.number().positive().describe("Voucher amount in currency units"),
  currency: z.string().default("RWF").describe("Currency code (default: RWF)"),
});
export type TVoucherCreateInput = z.infer<typeof VoucherCreateInput>;

/**
 * Output schema for voucher creation
 */
export const VoucherCreateOutput = z.object({
  voucher_id: z.string().uuid().describe("Unique voucher identifier"),
  status: z.enum(["issued", "redeemed", "void"]).default("issued").describe("Voucher status"),
  amount: z.number().describe("Voucher amount"),
  currency: z.string().describe("Currency code"),
});
export type TVoucherCreateOutput = z.infer<typeof VoucherCreateOutput>;

/**
 * Input schema for voucher redemption
 */
export const VoucherRedeemInput = z.object({
  voucher_id: z.string().uuid().describe("Voucher ID to redeem"),
  customer_msisdn: z.string().min(10).describe("Customer mobile number"),
});
export type TVoucherRedeemInput = z.infer<typeof VoucherRedeemInput>;

/**
 * Output schema for voucher redemption
 */
export const VoucherRedeemOutput = z.object({
  voucher_id: z.string().uuid(),
  status: z.enum(["redeemed"]),
  redeemed_at: z.string().datetime(),
});
export type TVoucherRedeemOutput = z.infer<typeof VoucherRedeemOutput>;

/**
 * Input schema for voiding a voucher
 */
export const VoucherVoidInput = z.object({
  voucher_id: z.string().uuid().describe("Voucher ID to void"),
  reason: z.string().optional().describe("Reason for voiding"),
});
export type TVoucherVoidInput = z.infer<typeof VoucherVoidInput>;

/**
 * Output schema for voiding a voucher
 */
export const VoucherVoidOutput = z.object({
  voucher_id: z.string().uuid(),
  status: z.enum(["void"]),
  voided_at: z.string().datetime(),
});
export type TVoucherVoidOutput = z.infer<typeof VoucherVoidOutput>;
