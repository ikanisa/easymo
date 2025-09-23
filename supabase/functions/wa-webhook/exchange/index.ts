import { serve } from "../deps.ts";
import type { FlowExchangeRequest } from "../types.ts";
import { handleFlowAction } from "./router.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  let body: FlowExchangeRequest;
  try {
    body = await req.json();
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 400,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
  const res = await handleFlowAction(body);
  return new Response(JSON.stringify(res), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
});
