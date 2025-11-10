import type { FlowExchangeRequest, FlowExchangeResponse } from "../types.ts";
import { handleAdminFlow } from "./admin/router.ts";

export async function handleFlowAction(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  if (req.flow_id?.startsWith("flow.admin.")) {
    return await handleAdminFlow(req);
  }

  if (
    req.flow_id?.startsWith("flow.cust.") ||
    req.flow_id?.startsWith("flow.vend.")
  ) {
    return legacyFlowNotice(req);
  }

  return {
    next_screen_id: req.screen_id,
    messages: [{
      level: "warning",
      text: req.flow_id
        ? `Flow ${req.flow_id} is no longer available in EasyMO.`
        : "Flow handling requires a valid flow_id.",
    }],
  };
}

function legacyFlowNotice(
  req: FlowExchangeRequest,
): FlowExchangeResponse {
  return {
    next_screen_id: req.screen_id,
    messages: [{
      level: "info",
      text:
        "Legacy dine-in and vendor flows are handled offline by the success team. Reach out to your account manager for assistance.",
    }],
  };
}
