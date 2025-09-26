import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

export const paginationSchema = z.object({
  page_token: z.string().nullable().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export const barSearchFiltersSchema = z.object({
  q: z.string().max(60).optional(),
  area: z.string().max(60).optional(),
});

export const itemAddSchema = z.object({
  bar_id: z.string().uuid(),
  item_id: z.string().uuid(),
  qty: z.coerce.number().int().min(1).max(50),
  modifiers: z.array(z.any()).optional(),
});

export const cartUpdateSchema = z.object({
  bar_id: z.string().uuid(),
  line_id: z.string().uuid(),
  new_qty: z.coerce.number().int().min(0).max(50),
});

export const placeOrderSchema = z.object({
  bar_id: z.string().uuid(),
  table_label: z.string().min(1).max(8),
  note: z.string().max(140).optional(),
});

export const customerPaidSignalSchema = z.object({
  order_id: z.string().uuid(),
});

export const orderDetailSchema = z.object({
  order_id: z.string().uuid(),
});

export const vendorQueueSchema = z.object({
  queue: z.enum(["pending", "paid", "served", "cancelled"]),
});

export const vendorOrderActionSchema = z.object({
  order_id: z.string().uuid(),
});

export const vendorCancelSchema = z.object({
  order_id: z.string().uuid(),
  reason: z.string().min(4).max(120),
});

export const vendorOnboardIdentitySchema = z.object({
  bar_name: z.string().min(2).max(80),
  location_text: z.string().min(5).max(120),
  country: z.string().min(2).max(40),
  city_area: z.string().min(2).max(60),
});

export const vendorOnboardContactsSchema = z.object({
  order_numbers_csv: z.string().min(5).max(160),
  momo_code: z.string().min(2).max(40),
});

export const vendorStaffSchema = z.object({
  phone: z.string().min(6).max(20),
  role: z.enum(["manager", "staff"]).optional(),
});

export const vendorSettingsSchema = z.object({
  momo_code: z.string().min(2).max(40),
  service_charge_pct: z.coerce.number().min(0).max(25),
  allow_direct_chat: z.enum(["true", "false"]),
  default_prep_minutes: z.coerce.number().int().min(0).max(240),
  payment_instructions: z.string().max(240).optional(),
});

export type Parsed<T extends z.ZodTypeAny> = z.infer<T>;

export function buildErrorResponse(
  next_screen_id: string,
  message: string,
  fieldErrors?: Record<string, string>,
) {
  return {
    next_screen_id,
    messages: [{ type: "error" as const, text: message }],
    field_errors: fieldErrors,
  };
}

export function buildInfoResponse(
  next_screen_id: string,
  data: Record<string, unknown>,
) {
  return {
    next_screen_id,
    data,
  };
}
