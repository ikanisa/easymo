import type { FlowExchangeRequest, FlowExchangeResponse } from "../types.ts";
import { notImplemented } from "./util.ts";
import { handleCustomerBarBrowser } from "./actions/cust_bar_browser.ts";
import { handleCustomerBarMenu } from "./actions/cust_bar_menu.ts";
import { handleCustomerOrderTracker } from "./actions/cust_order_tracker.ts";
import { handleVendorOnboard } from "./actions/vend_onboard.ts";
import { handleVendorMenuReview } from "./actions/vend_menu_review.ts";
import { handleVendorOrders } from "./actions/vend_orders.ts";
import { handleVendorStaff } from "./actions/vend_staff.ts";
import { handleVendorSettings } from "./actions/vend_settings.ts";

export async function handleFlowAction(req: FlowExchangeRequest): Promise<FlowExchangeResponse> {
  console.log("flow_exchange", { flow_id: req.flow_id, action_id: req.action_id, wa_id: req.wa_id });
  switch (req.flow_id) {
    case "flow.cust.bar_browser.v1":
      return await handleCustomerBarBrowser(req);
    case "flow.cust.bar_menu.v1":
      return await handleCustomerBarMenu(req);
    case "flow.cust.order_tracker.v1":
      return await handleCustomerOrderTracker(req);
    case "flow.vend.onboard.v1":
      return await handleVendorOnboard(req);
    case "flow.vend.menu_review.v1":
      return await handleVendorMenuReview(req);
    case "flow.vend.orders.v1":
      return await handleVendorOrders(req);
    case "flow.vend.staff.v1":
      return await handleVendorStaff(req);
    case "flow.vend.settings.v1":
      return await handleVendorSettings(req);
    default:
      return {
        next_screen_id: req.screen_id,
        messages: [{ level: "error", text: `Unknown flow ${req.flow_id}` }],
      };
  }
}
