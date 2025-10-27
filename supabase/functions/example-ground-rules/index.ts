/**
 * Example Edge Function demonstrating Ground Rules compliance
 * 
 * This function serves as a reference implementation showing:
 * - Structured logging with correlation IDs
 * - Event counters and metrics
 * - Feature flag enforcement
 * - Security (signature verification, secret management)
 * - Proper error handling
 * 
 * @see docs/GROUND_RULES.md
 */

import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import {
  createServiceRoleClient,
  handleOptions,
  json,
  requireAdminAuth,
} from "../_shared/admin.ts";
import {
  logStructuredEvent,
  logError,
  logRequest,
  logResponse,
  recordMetric,
  recordDurationMetric,
  maskPII,
  getCorrelationId,
} from "../_shared/observability.ts";
import {
  isFeatureEnabled,
  requireFeatureFlag,
} from "../_shared/feature-flags.ts";
import {
  validateRequiredEnvVars,
  sanitizeErrorMessage,
} from "../_shared/security.ts";

// Validate required environment variables on startup
try {
  validateRequiredEnvVars([
    "SUPABASE_SERVICE_ROLE_KEY",
    "ADMIN_TOKEN",
  ]);
} catch (error) {
  console.error("Startup validation failed:", error);
}

const supabase = createServiceRoleClient();

// Request validation schema
const requestSchema = z.object({
  userId: z.string().uuid(),
  action: z.enum(["process", "validate", "update"]),
  phoneNumber: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
}).strict();

Deno.serve(async (req) => {
  const startTime = Date.now();
  
  // 1. OBSERVABILITY: Log incoming request with correlation ID
  const correlationId = logRequest("example-feature", req, {
    userAgent: req.headers.get("user-agent"),
  });
  
  try {
    // 2. CORS: Handle preflight requests
    if (req.method === "OPTIONS") {
      await recordMetric("request.options", 1);
      return handleOptions();
    }
    
    // 3. FEATURE FLAGS: Check if feature is enabled
    if (!isFeatureEnabled("marketplace.vendor")) {
      await logStructuredEvent("FEATURE_DISABLED", {
        feature: "marketplace.vendor",
        correlationId,
      });
      await recordMetric("feature.disabled", 1, {
        feature: "marketplace.vendor",
      });
      
      logResponse("example-feature", 403, { correlationId });
      return json({
        error: "feature_not_enabled",
        message: "This feature is not yet available",
      }, 403);
    }
    
    // 4. SECURITY: Verify authentication
    const authResponse = requireAdminAuth(req);
    if (authResponse) {
      await recordMetric("auth.failed", 1, {
        endpoint: "example-feature",
      });
      logResponse("example-feature", 401, { correlationId });
      return authResponse;
    }
    
    // 5. VALIDATION: Parse and validate input
    if (req.method !== "POST") {
      await recordMetric("request.method_not_allowed", 1);
      logResponse("example-feature", 405, { correlationId });
      return json({ error: "method_not_allowed" }, 405);
    }
    
    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      await recordMetric("validation.invalid_json", 1);
      logResponse("example-feature", 400, { correlationId });
      return json({ error: "invalid_json" }, 400);
    }
    
    const parseResult = requestSchema.safeParse(payload);
    if (!parseResult.success) {
      await logStructuredEvent("VALIDATION_FAILED", {
        errors: parseResult.error.errors,
        correlationId,
      });
      await recordMetric("validation.failed", 1);
      logResponse("example-feature", 400, { correlationId });
      return json({
        error: "invalid_payload",
        details: parseResult.error.errors,
      }, 400);
    }
    
    const { userId, action, phoneNumber, metadata } = parseResult.data;
    
    // 6. SECURITY: Mask PII in logs
    const maskedPhone = phoneNumber ? maskPII(phoneNumber, 7, 3) : null;
    
    await logStructuredEvent("REQUEST_VALIDATED", {
      userId,
      action,
      phoneNumber: maskedPhone,
      correlationId,
    });
    
    // 7. BUSINESS LOGIC: Perform the requested action
    let result;
    
    switch (action) {
      case "process":
        result = await processAction(userId, metadata);
        break;
      case "validate":
        result = await validateAction(userId, metadata);
        break;
      case "update":
        result = await updateAction(userId, metadata);
        break;
    }
    
    // 8. OBSERVABILITY: Log successful completion
    await logStructuredEvent("ACTION_COMPLETED", {
      userId,
      action,
      resultId: result.id,
      correlationId,
    });
    
    // 9. METRICS: Record success metrics
    await recordMetric("action.completed", 1, {
      action,
      status: "success",
    });
    
    await recordDurationMetric("action.duration", startTime, {
      action,
      status: "success",
    });
    
    // 10. RESPONSE: Return successful response
    logResponse("example-feature", 200, {
      correlationId,
      duration: Date.now() - startTime,
    });
    
    return json({
      ok: true,
      result,
      correlationId,
    });
    
  } catch (error) {
    // 11. ERROR HANDLING: Comprehensive error logging
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logError("example-feature.action_failed", error, {
      correlationId,
      duration: Date.now() - startTime,
    });
    
    await recordMetric("action.failed", 1, {
      error: errorMessage,
    });
    
    // 12. SECURITY: Sanitize error message for client
    const clientMessage = sanitizeErrorMessage(error, "operation_failed");
    
    logResponse("example-feature", 500, { correlationId });
    
    return json({
      error: clientMessage,
      correlationId,
    }, 500);
  }
});

// Helper functions (business logic)

async function processAction(
  userId: string,
  metadata?: Record<string, unknown>,
): Promise<{ id: string; status: string }> {
  await logStructuredEvent("PROCESS_ACTION_START", { userId });
  
  // Simulated processing
  const result = {
    id: crypto.randomUUID(),
    status: "processed",
    userId,
    metadata,
  };
  
  await logStructuredEvent("PROCESS_ACTION_COMPLETE", {
    userId,
    resultId: result.id,
  });
  
  return result;
}

async function validateAction(
  userId: string,
  metadata?: Record<string, unknown>,
): Promise<{ id: string; status: string }> {
  await logStructuredEvent("VALIDATE_ACTION_START", { userId });
  
  const result = {
    id: crypto.randomUUID(),
    status: "validated",
    userId,
    metadata,
  };
  
  return result;
}

async function updateAction(
  userId: string,
  metadata?: Record<string, unknown>,
): Promise<{ id: string; status: string }> {
  await logStructuredEvent("UPDATE_ACTION_START", { userId });
  
  const result = {
    id: crypto.randomUUID(),
    status: "updated",
    userId,
    metadata,
  };
  
  return result;
}
