/**
 * Unified OCR Edge Function
 * 
 * Consolidates 3 separate OCR functions into one:
 * - insurance-ocr (insurance certificates)
 * - ocr-processor (restaurant menus)
 * - vehicle-ocr (vehicle certificates)
 * 
 * Routes by `domain` parameter: insurance | menu | vehicle
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { corsHeaders } from "../_shared/cors.ts";
import { logStructuredEvent } from "../_shared/observability.ts";
import { rateLimitMiddleware } from "../_shared/rate-limit/index.ts";
import { hasOpenAIKey } from "./core/openai.ts";
import { hasGeminiKey } from "./core/gemini.ts";
import {
  validateDomain,
  validateInsuranceInline,
  validateVehicleRequest,
} from "./validation.ts";

// Domain handlers
import { processInsuranceQueue, processInsuranceInline } from "./domains/insurance.ts";
import { processMenuQueue } from "./domains/menu.ts";
import { processVehicleRequest } from "./domains/vehicle.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SERVICE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SERVICE_ROLE_KEY");

type Domain = "insurance" | "menu" | "vehicle";

export async function handler(req: Request): Promise<Response> {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Validate OCR provider availability
  if (!hasOpenAIKey() && !hasGeminiKey()) {
    await logStructuredEvent("UNIFIED_OCR_NO_PROVIDER", {}, "error");
    return jsonResponse(
      {
        error: "no_ocr_provider",
        message: "Neither OPENAI_API_KEY nor GEMINI_API_KEY configured",
      },
      503,
    );
  }

  // Validate Supabase credentials
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    await logStructuredEvent("UNIFIED_OCR_NO_SUPABASE", {}, "error");
    return jsonResponse(
      { error: "missing_supabase_config" },
      500,
    );
  }

  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const url = new URL(req.url);
    const domain = url.searchParams.get("domain") as Domain | null;

    // POST requests: inline processing or vehicle validation
    if (req.method === "POST") {
      // Rate limiting: 10 OCR requests per minute per IP
      const rateLimitCheck = await rateLimitMiddleware(req, {
        limit: 10,
        windowSeconds: 60,
      });

      if (!rateLimitCheck.allowed) {
        await logStructuredEvent("UNIFIED_OCR_RATE_LIMITED", {
          ip: req.headers.get("x-forwarded-for") || "unknown",
        }, "warn");
        return rateLimitCheck.response!;
      }

      const body = await req.json();

      // Determine domain from body or query param
      const activeDomain = body.domain || domain;

      // Validate domain
      const domainValidation = validateDomain(activeDomain);
      if (typeof domainValidation === "object" && "error" in domainValidation) {
        return jsonResponse(domainValidation, 400);
      }

      await logStructuredEvent("UNIFIED_OCR_INLINE_START", {
        domain: domainValidation,
      }, "info");

      switch (domainValidation) {
        case "insurance": {
          const validation = validateInsuranceInline(body);
          if ("error" in validation) {
            return jsonResponse(validation, 400);
          }
          return await processInsuranceInline(client, validation.inline);
        }

        case "vehicle": {
          const validation = validateVehicleRequest(body);
          if ("error" in validation) {
            return jsonResponse(validation, 400);
          }
          return await processVehicleRequest(client, validation);
        }

        default:
          return jsonResponse({ error: "unsupported_domain_for_inline" }, 400);
      }
    }

    // GET requests: queue processing
    if (req.method === "GET") {
      // Validate domain
      const domainValidation = validateDomain(domain);
      if (typeof domainValidation === "object" && "error" in domainValidation) {
        return jsonResponse(domainValidation, 400);
      }

      const limit = parseInt(url.searchParams.get("limit") || "5", 10);
      
      // Validate limit parameter
      if (isNaN(limit) || limit < 1 || limit > 100) {
        return jsonResponse({ error: "invalid_limit: must be between 1 and 100" }, 400);
      }

      await logStructuredEvent("UNIFIED_OCR_QUEUE_START", {
        domain: domainValidation,
        limit,
      }, "info");

      switch (domainValidation) {
        case "insurance":
          return await processInsuranceQueue(client, limit);

        case "menu":
          return await processMenuQueue(client, limit);

        default:
          return jsonResponse({ error: "unsupported_domain_for_queue" }, 400);
      }
    }

    return jsonResponse({ error: "method_not_allowed" }, 405);
  } catch (error) {
    await logStructuredEvent("UNIFIED_OCR_ERROR", {
      error: error instanceof Error ? error.message : String(error),
    }, "error");

    return jsonResponse(
      {
        error: "internal_error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json",
    },
  });
}

if (import.meta.main) {
  Deno.serve(handler);
}
