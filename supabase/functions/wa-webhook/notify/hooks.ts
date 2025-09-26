import {
  queueCustomerStatusTemplate,
  queueStaffInvite,
  queueVendorOrderCreated,
} from "./sender.ts";
import { fmtCurrency } from "../utils/text.ts";
import { getOrderCustomer, listVendorNumbers } from "../exchange/helpers.ts";
import {
  type BarProfile,
  getManagerNumbers,
} from "../domains/dinein/service.ts";

export async function notifyOrderCreated(
  params: {
    orderId: string;
    barId: string;
    orderCode: string;
    totalMinor: number;
    currency: string;
    bar?: BarProfile;
    table?: string | null;
  },
) {
  const vendors = await listVendorNumbers(params.barId);
  const extras = params.bar ? getManagerNumbers(params.bar) : [];
  for (const extra of extras) {
    if (!vendors.includes(extra)) vendors.push(extra);
  }
  const totalText = fmtCurrency(params.totalMinor, params.currency);
  await Promise.all(
    vendors.map((to) =>
      queueVendorOrderCreated({
        to,
        orderCode: params.orderCode,
        table: params.table,
        totalText,
        orderId: params.orderId,
      })
    ),
  );
}

export async function notifyCustomerStatus(
  params: {
    orderId: string;
    status: "paid" | "served" | "cancelled";
    reason?: string;
  },
) {
  const info = await getOrderCustomer(params.orderId);
  if (!info.wa_id) return;
  await queueCustomerStatusTemplate({
    to: info.wa_id,
    status: params.status,
    orderCode: info.order_code ?? params.orderId,
    totalMinor: info.total_minor,
    currency: info.currency,
    reason: params.reason,
    orderId: params.orderId,
  });
}

export async function notifyStaffInvite(
  params: {
    to: string;
    barName: string;
    code: string;
    expiresInHours?: number;
  },
): Promise<void> {
  await queueStaffInvite(params);
}
