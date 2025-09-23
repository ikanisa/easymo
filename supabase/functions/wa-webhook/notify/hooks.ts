import { queueNotification } from "./sender.ts";
import { fmtCurrency } from "../utils/text.ts";
import { listVendorNumbers, getOrderCustomer } from "../exchange/helpers.ts";

export async function notifyOrderCreated(params: { orderId: string; barId: string; orderCode: string; totalMinor: number; currency: string; table?: string | null }) {
  const vendors = await listVendorNumbers(params.barId);
  const message = `New order #${params.orderCode}${params.table ? ` — Table ${params.table}` : ""}. Total ${fmtCurrency(params.totalMinor, params.currency)}.`;
  await Promise.all(vendors.map((to) => queueNotification({ to, text: message }, { type: "vendor_order_created", orderId: params.orderId })));
}

export async function notifyCustomerStatus(params: { orderId: string; status: "paid" | "served" | "cancelled"; reason?: string }) {
  const info = await getOrderCustomer(params.orderId);
  if (!info.wa_id) return;
  let text = "";
  switch (params.status) {
    case "paid":
      text = `✅ Order #${info.order_code} marked Paid.`;
      break;
    case "served":
      text = `🍽️ Order #${info.order_code} served. Enjoy!`;
      break;
    case "cancelled":
      text = `❌ Order #${info.order_code} cancelled${params.reason ? `: ${params.reason}` : ""}.`;
      break;
  }
  await queueNotification({ to: info.wa_id, text }, { type: `customer_order_${params.status}`, orderId: params.orderId });
}
