import type { FlowExchangeRequest, FlowExchangeResponse } from "../types.ts";

export async function notImplemented(req: FlowExchangeRequest): Promise<FlowExchangeResponse> {
  console.warn("flow_exchange.not_implemented", req);
  return {
    next_screen_id: req.screen_id,
    messages: [{ level: "warning", text: "Flow handler under construction." }],
  };
}
