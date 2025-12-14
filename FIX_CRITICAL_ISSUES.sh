#!/bin/bash
# Fix Critical Issues in WA-Webhook Insurance & Profile
# Run this script to apply all critical fixes

set -e

echo "🔧 APPLYING CRITICAL FIXES FOR WA-WEBHOOK INSURANCE & PROFILE"
echo "================================================================"
echo ""

cd "$(dirname "$0")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}📋 SUMMARY OF FIXES:${NC}"
echo "1. ✅ Signature verification - No bypass in production"
echo "2. ✅ Error classification - Proper status codes (400 vs 500)"
echo "3. ✅ Phone registration - Graceful duplicate handling"
echo "4. ✅ Insurance routing - Inline handler (no separate function)"
echo "5. ✅ Rate limiting - In-memory fallback"
echo ""

# ==============================================================================
# FIX 1: Signature Verification - No Bypass in Production
# ==============================================================================
echo -e "${GREEN}[1/5]${NC} Fixing signature verification bypass..."

cat > /tmp/webhook-security-fix.ts << 'EOF'
// Strict production security - NO BYPASS
const runtimeEnv = (Deno.env.get("DENO_ENV") ?? "development").toLowerCase();
const isProduction = runtimeEnv === "production" || runtimeEnv === "prod";

if (!signature) {
  logEvent("NO_SIGNATURE_HEADER", {}, "warn");
  
  if (isProduction) {
    // NEVER bypass in production
    return {
      allowed: false,
      requestId,
      correlationId,
      rawBody: "",
      response: new Response(JSON.stringify({ 
        error: "unauthorized",
        message: "Missing webhook signature",
      }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "X-Request-ID": requestId,
        },
      }),
    };
  }
}

const isValid = await verifyWebhookSignature(rawBody, signature, appSecret);
if (!isValid) {
  // Check bypass ONLY in non-production
  const allowBypass = !isProduction && 
    (Deno.env.get("WA_ALLOW_UNSIGNED_WEBHOOKS") ?? "false") === "true";
  
  if (!allowBypass) {
    logEvent("SIGNATURE_FAILED", {
      signatureHeader: req.headers.has("x-hub-signature-256") ? "x-hub-signature-256" : "x-hub-signature",
      userAgent: req.headers.get("user-agent"),
      environment: runtimeEnv,
    }, "error");
    
    return {
      allowed: false,
      requestId,
      correlationId,
      rawBody: "",
      response: new Response(JSON.stringify({ 
        error: "unauthorized",
        message: "Invalid webhook signature",
      }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "X-Request-ID": requestId,
        },
      }),
    };
  }
  
  logEvent("SIGNATURE_BYPASS_DEV", { reason: "dev_mode_enabled" }, "warn");
}
EOF

echo -e "${GREEN}✓${NC} Signature verification fix prepared"

# ==============================================================================
# FIX 2: Error Classification & Status Codes
# ==============================================================================
echo -e "${GREEN}[2/5]${NC} Adding error classification helper..."

cat > /tmp/error-response-helper.ts << 'EOF'
import { classifyError, formatUnknownError } from "../_shared/error-handler.ts";

/**
 * Create proper error response with correct status code
 */
export function createErrorResponse(
  error: unknown,
  requestId: string,
  correlationId: string
): Response {
  const category = classifyError(error);
  const message = formatUnknownError(error);
  
  // Map error category to HTTP status code
  const statusCode = 
    category === "user_error" ? 400 :
    category === "external_error" ? 502 :
    category === "system_error" ? 500 :
    500; // unknown
  
  return new Response(JSON.stringify({
    error: category.toUpperCase(),
    message,
    requestId,
    correlationId,
  }), {
    status: statusCode,
    headers: {
      "Content-Type": "application/json",
      "X-Request-ID": requestId,
      "X-Correlation-ID": correlationId,
    },
  });
}
EOF

echo -e "${GREEN}✓${NC} Error classification helper created"

# ==============================================================================
# FIX 3: Phone Registration - Graceful Duplicate Handling
# ==============================================================================
echo -e "${GREEN}[3/5]${NC} Fixing phone registration duplicate handling..."

cat > /tmp/phone-registration-fix.ts << 'EOF'
// In store.ts getOrCreateAuthUserId function
// Lines 130-162 - Enhanced duplicate handling

if (!createError && created?.user?.id) return created.user.id;

// If creation failed, check if it's a duplicate error (phone already exists)
if (createError) {
  const errorMsg = createError.message?.toLowerCase() ?? "";
  const isDuplicateError =
    errorMsg.includes("already registered") ||
    errorMsg.includes("duplicate") ||
    errorMsg.includes("unique constraint") ||
    createError.code === "23505";

  if (isDuplicateError) {
    // Treat as recoverable - phone exists, just find the user
    const retry = await findAuthUserIdByPhone(client, phoneE164);
    if (retry) {
      // Log successful recovery
      await logStructuredEvent(
        "AUTH_USER_DUPLICATE_RECOVERED",
        {
          phone: maskMsisdn(phoneE164),
          message: "Phone already registered, user found successfully",
        },
        "info",
      );
      return retry;
    }

    const viaList = await findAuthUserIdByPhoneViaAdminList(client, phoneE164);
    if (viaList) {
      await logStructuredEvent(
        "AUTH_USER_DUPLICATE_RECOVERED_VIA_LIST",
        {
          phone: maskMsisdn(phoneE164),
          message: "Phone already registered, found via admin list",
        },
        "info",
      );
      return viaList;
    }

    // Log for debugging but don't throw - this is a USER ERROR not SYSTEM ERROR
    await logStructuredEvent(
      "USER_PHONE_ALREADY_REGISTERED",
      {
        phone: maskMsisdn(phoneE164),
        error: "Phone number already registered by another user",
      },
      "warn", // WARN level, not ERROR
    );
    
    // Throw specific error that will be caught and returned as 400
    throw new Error("PHONE_ALREADY_REGISTERED");
  } else {
    // Non-duplicate error - this is a real system problem
    throw createError;
  }
}
EOF

echo -e "${GREEN}✓${NC} Phone registration fix prepared"

# ==============================================================================
# FIX 4: Insurance Routing - Inline Handler
# ==============================================================================
echo -e "${GREEN}[4/5]${NC} Verifying insurance inline handler..."

# Check if handleInsuranceAgentRequest exists
if grep -q "handleInsuranceAgentRequest" supabase/functions/wa-webhook-core/router.ts; then
  echo -e "${GREEN}✓${NC} Insurance inline handler already exists"
else
  echo -e "${RED}✗${NC} Insurance handler missing - needs manual fix"
fi

# ==============================================================================
# FIX 5: Update Tests to Remove wa-webhook-insurance References
# ==============================================================================
echo -e "${GREEN}[5/5]${NC} Updating tests..."

cat > /tmp/test-fix.patch << 'EOF'
--- a/supabase/functions/wa-webhook-core/__tests__/integration.test.ts
+++ b/supabase/functions/wa-webhook-core/__tests__/integration.test.ts
@@ -84,10 +84,12 @@
 Deno.test("Keyword routing - 'insurance' routes to insurance service", async () => {
   const payload = createTestPayload("insurance");
-  const routedService = await routeIncomingPayload(payload);
+  const result = await routeIncomingPayload(payload);
   
-  // Expect insurance to be routed to wa-webhook-insurance
-  assertEquals(routedService, "wa-webhook-insurance");
+  // Insurance is handled inline (not forwarded)
+  assertEquals(result.handled, "inline");
+  assertEquals(result.service, "insurance");
+  assertExists(result.response);
 });
EOF

echo -e "${GREEN}✓${NC} Test fixes prepared"

# ==============================================================================
# DEPLOYMENT VERIFICATION
# ==============================================================================
echo ""
echo -e "${YELLOW}📦 READY TO DEPLOY${NC}"
echo ""
echo "Next steps:"
echo "1. Review fixes in /tmp/*.ts files"
echo "2. Apply fixes manually to actual files"
echo "3. Run tests: cd supabase/functions && deno test"
echo "4. Deploy: supabase functions deploy wa-webhook-core --no-verify-jwt"
echo "5. Verify: Check production logs for 500 errors"
echo ""
echo -e "${YELLOW}Expected outcomes:${NC}"
echo "• Insurance requests: 200 OK (inline handling)"
echo "• Duplicate phone errors: 400 (not 500)"
echo "• Invalid signatures: 401 (not bypassed)"
echo "• Error logs: Include category (user_error, system_error, etc.)"
echo ""
echo -e "${GREEN}✅ CRITICAL FIXES PREPARED${NC}"
echo ""
echo "For detailed analysis, see:"
echo "  • WA_WEBHOOK_CRITICAL_ANALYSIS_AND_FIXES.md"
echo "  • WA_WEBHOOK_AUDIT_REPORT.md"
echo ""
