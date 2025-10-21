import { serve } from "./deps.ts";
import { supabase } from "./config.ts";
import { processWebhookRequest } from "./router/pipeline.ts";
import { handlePreparedWebhook } from "./router/processor.ts";

serve(async (req: Request): Promise<Response> => {
  const result = await processWebhookRequest(req);

  if (result.type === "response") {
    return result.response;
  }

  return await handlePreparedWebhook(supabase, result);
});
