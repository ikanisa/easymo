import { serve } from "../deps.ts";
import type { FlowExchangeRequest } from "../types.ts";
import { handleFlowAction } from "./router.ts";
import { logStructuredEvent } from "../observe/log.ts";

function maskWa(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const suffix = trimmed.slice(-4);
  return `***${suffix}`;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  let body: FlowExchangeRequest;
  try {
    body = await req.json();
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 400,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
  await logStructuredEvent("FLOW_EXCHANGE_REQUEST", {
    flow_id: body.flow_id,
    action_id: body.action_id,
    wa_id: maskWa(body.wa_id),
  });
  const res = await handleFlowAction(body);
  await logStructuredEvent("FLOW_EXCHANGE_RESPONSE", {
    flow_id: body.flow_id,
    action_id: body.action_id,
    next_screen_id: res.next_screen_id,
    wa_id: maskWa(body.wa_id),
  });
  return new Response(JSON.stringify(res), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
});
