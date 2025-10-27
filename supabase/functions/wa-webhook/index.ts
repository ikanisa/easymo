import { serve } from "./deps.ts";
import { supabase } from "./config.ts";
import { processWebhookRequest } from "./router/pipeline.ts";
import { handlePreparedWebhook } from "./router/processor.ts";

serve(async (req: Request): Promise<Response> => {
  const cid = crypto.randomUUID();
  try {
    const result = await processWebhookRequest(req);

    if (result.type === "response") {
      return result.response;
    }

    return await handlePreparedWebhook(supabase, result);
  } catch (err) {
    // Prevent webhook retry storms; log correlation id for traceability
    console.error("wa_webhook.unhandled", { cid, error: String(err) });
    return new Response("ok", { status: 200 });
  }
});
