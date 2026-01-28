import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { createJsonErrorResponse,serveWithObservability } from "../_shared/observability.ts";
import { BusinessClassificationService } from "./service.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

serveWithObservability("unified-business-classification", async (req, ctx) => {
  if (req.method !== "POST") {
    return createJsonErrorResponse("Method not allowed", 405);
  }

  try {
    const { 
      businessId, 
      batchSize = 50,
      dryRun = false,
      minConfidence = 0.5,
      categoryFilter
    } = await req.json().catch(() => ({}));

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const service = new BusinessClassificationService(supabase);

    // Single business classification
    if (businessId) {
      ctx.logger.info("CLASSIFY_SINGLE", { businessId });
      const result = await service.classifySingle(businessId);
      
      return new Response(JSON.stringify({
        success: true,
        result,
      }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Batch classification
    ctx.logger.info("CLASSIFY_BATCH", { batchSize, dryRun, categoryFilter });
    const results = await service.classifyBatch({
      batchSize,
      dryRun,
      minConfidence,
      categoryFilter,
    });

    return new Response(JSON.stringify({
      success: true,
      ...results,
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    ctx.logger.error("CLASSIFICATION_ERROR", { 
      error: error instanceof Error ? error.message : String(error) 
    });
    ctx.captureException(error);
    
    return createJsonErrorResponse(
      error instanceof Error ? error.message : "Classification failed",
      500
    );
  }
});
