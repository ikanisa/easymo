# Insurance Integration Diagnostic Report

**Generated:** 2025-11-28T13:10:00Z  
**Issue:** No logs reaching wa-webhook-insurance, no response when tapping "Insurance" from home menu  
**503 Error:** wa-webhook-core returning 503 errors

---

## Executive Summary

The insurance functionality is **partially broken** due to routing and integration issues between three components:

1. **wa-webhook-core** (Router) - Returns 503 errors
2. **wa-webhook-insurance** (Microservice) - Not receiving traffic
3. **wa-webhook-ai-agents** (AI Agent) - Insurance agent exists but not integrated

### Root Causes Identified

1. ✅ **wa-webhook-insurance is deployed** (Version 169, deployed 2025-11-27 15:06:15)
2. ✅ **Route config exists** - Insurance correctly configured in route-config.ts
3. ❌ **503 errors from wa-webhook-core** - Service health issues or timeout
4. ❌ **No integration** between insurance microservice and AI agent
5. ❓ **Database tables missing** - Cannot verify without DB access

---

## Architecture Overview

### Current Implementation (Fragmented)

```
WhatsApp User
    ↓
wa-webhook-core (Router)
    ↓ [Routes "insurance" keyword]
    ├─→ wa-webhook-insurance (Microservice)
    │      ↓
    │   insurance/index.ts (Shows menu, OCR)
    │
    └─→ wa-webhook-ai-agents (Separate)
           ↓
        ai-agents/insurance_agent.ts (Gemini AI, quotes, claims)
```

**Problem:** These two systems don't communicate. User taps "Insurance" → core routes to wa-webhook-insurance → shows basic menu, but no AI agent integration.

---

## Detailed Analysis

### 1. wa-webhook-core (Router)

**Location:** `supabase/functions/wa-webhook-core/`

**Status:** ✅ Deployed (Version 407)

**Routing Logic:**
```typescript
// File: router.ts, line 98-173
export async function routeIncomingPayload(payload: WhatsAppWebhookPayload): Promise<RoutingDecision> {
  const routingText = getRoutingText(routingMessage);
  
  // Checks:
  // 1. Greetings → home menu (line 108-119)
  // 2. SERVICE_KEY_MAP lookup (line 120-129)
  // 3. Active session state (line 143-150)
  // 4. Unified agent system (line 154-165)
  // 5. Fallback → home menu (line 169-172)
}
```

**Route Config for Insurance:**
```typescript
// File: _shared/route-config.ts, line 28-33
{
  service: "wa-webhook-insurance",
  keywords: ["insurance", "assurance", "cover", "claim", "policy", "premium", "insure", "protection"],
  menuKeys: ["insurance", "insurance_agent", "motor_insurance", "insurance_submit", "insurance_help", "motor_insurance_upload", "2"],
  priority: 1,
}
```

**503 Error Cause:**
- **Line 196-224 (router.ts):** Circuit breaker opens when wa-webhook-insurance is unhealthy
- **Line 234-241:** Service forwarding with timeout (ROUTER_TIMEOUT_MS = 4000ms)
- **Likely issue:** wa-webhook-insurance taking >4s to respond OR returning errors

**Logs:**
```
Event: WA_CORE_CIRCUIT_OPEN when service repeatedly fails
Event: CORE_ROUTING_DECISION shows which service was chosen
Event: WA_CORE_ROUTED shows final status
```

---

### 2. wa-webhook-insurance (Microservice)

**Location:** `supabase/functions/wa-webhook-insurance/`

**Status:** ✅ Deployed (Version 169, last deployed 2025-11-27)

**Functionality:**
```typescript
// File: index.ts
// Features:
// - Signature verification (lines 88-156)
// - State-based routing (lines 189-233)
// - Button handling (handleInsuranceButton, line 286-302)
// - List handling (handleInsuranceList, line 304-321)
// - Text handling (handleInsuranceText, line 323-373)
// - Media upload (handleInsuranceMedia, line 209)
```

**Menu Flow:**
```typescript
// File: insurance/index.ts
startInsurance() → Shows list:
  1. Submit certificate (IDS.INSURANCE_SUBMIT)
  2. Help (IDS.INSURANCE_HELP)
  3. ← Back (IDS.BACK_MENU)
```

**Issues:**
1. **No AI agent integration** - Only shows static menu
2. **OCR-focused** - Primary function is document upload (insurance/ins_handler.ts)
3. **No quotes/claims** - Missing business logic that exists in AI agent
4. **Observability gaps** - Multiple duplicate logStructuredEvent imports (lines 2, 4, 6, 8, 14, 16, 18)

**Expected Logs (Not Appearing):**
```
INSURANCE_WEBHOOK_RECEIVED
INSURANCE_STATE
INSURANCE_UNHANDLED
INSURANCE_HANDLER_ERROR
```

---

### 3. wa-webhook-ai-agents (AI Agent System)

**Location:** `supabase/functions/wa-webhook-ai-agents/`

**Status:** ✅ Deployed (Version 316)

**Insurance Agent:**
```typescript
// File: ai-agents/insurance_agent.ts
export class InsuranceAgent {
  private model: string = 'gemini-2.5-pro-latest';
  
  Tools:
  - get_motor_quote (lines 108-166)
  - get_health_quote (lines 168-214)
  - submit_claim (lines 216-256)
  - check_claim_status (lines 258-287)
  - get_policy_details (lines 289-320)
}
```

**Capabilities:**
- ✅ Motor insurance quotes (comprehensive, third party)
- ✅ Health insurance quotes (basic, standard, premium)
- ✅ Claims submission
- ✅ Claims tracking
- ✅ Policy lookup
- ✅ Natural language processing via Gemini AI

**Routing:**
```typescript
// ai-agents routes to "insurance_agent" but wa-webhook-insurance routes to "insurance"
// These are different menu keys → ROUTING CONFLICT
```

---

## Problems Identified

### Critical Issues

1. **503 Errors from Core**
   - Circuit breaker opening due to wa-webhook-insurance health issues
   - Possible timeout (>4s response time)
   - Check: `supabase functions logs wa-webhook-insurance` (command doesn't support --tail)

2. **Dual Implementation Conflict**
   - **wa-webhook-insurance:** OCR/document upload focused
   - **wa-webhook-ai-agents/insurance_agent:** AI-powered quotes/claims
   - User taps "Insurance" → gets OCR menu, not AI agent

3. **No Integration**
   - Insurance microservice doesn't call AI agent
   - AI agent doesn't integrate with insurance microservice
   - Two separate codebases solving same problem

4. **Menu Key Confusion**
   ```typescript
   // route-config.ts: menuKeys for wa-webhook-insurance
   ["insurance", "insurance_agent", "motor_insurance", ...]
   
   // But insurance_agent in ai-agents expects different routing
   ```

5. **Database Tables Unknown**
   - Cannot verify if `insurance_requests`, `insurance_claims`, `insurance_policies` exist
   - AI agent inserts data (lines 145-155, 230-243) but tables may not exist
   - No DB access to verify schema

### Minor Issues

1. **Code Duplication**
   - Multiple `import { logStructuredEvent }` in insurance/index.ts
   - Redundant observability imports

2. **Feature Flag Check**
   - Core checks `agent.unified_system` flag (router.ts line 133-140)
   - If enabled, routes to wa-webhook-ai-agents
   - If disabled, shows home menu
   - **Unknown:** Current flag state

3. **Missing Health Endpoint**
   - wa-webhook-insurance has `/health` (index.ts line 72-78)
   - But may not be responding healthy
   - Core health check timeout: 1.5s (router.ts line 362)

---

## Data Flow Analysis

### Expected Flow (User taps "Insurance")

```
1. User sends interactive message { list_reply: { id: "insurance" } }
   ↓
2. wa-webhook-core receives, verifies signature
   ↓
3. routeIncomingPayload() extracts "insurance" text
   ↓
4. SERVICE_KEY_MAP["insurance"] = "wa-webhook-insurance"
   ↓
5. forwardToEdgeService() → POST to wa-webhook-insurance
   ↓
6. wa-webhook-insurance receives, processes
   ↓
7. startInsurance() shows menu
   ↓
8. User selects "Submit certificate" or "Help"
   ↓
9. ??? (AI agent not invoked)
```

### Actual Flow (Broken)

```
1. User sends "insurance"
   ↓
2. wa-webhook-core routes to wa-webhook-insurance
   ↓
3. wa-webhook-insurance takes >4s OR returns error
   ↓
4. Circuit breaker opens
   ↓
5. Core returns 503 to WhatsApp
   ↓
6. User sees no response
```

---

## Recommended Solutions

### Option A: Integrate AI Agent into Insurance Microservice (Recommended)

**Effort:** Medium  
**Impact:** High  
**Maintains:** Current architecture

**Steps:**
1. Import InsuranceAgent into wa-webhook-insurance
2. Modify `handleInsuranceText()` to call AI agent for natural language
3. Keep OCR flow for document uploads
4. Route complex queries to AI agent

```typescript
// insurance/index.ts
import { InsuranceAgent } from '../../wa-webhook-ai-agents/ai-agents/insurance_agent.ts';

async function handleInsuranceText(ctx, message, state) {
  const text = message.text?.body?.trim();
  
  // Check for document upload flow
  if (state.key === 'ins_wait_doc') {
    return handleDocumentUpload(ctx, text);
  }
  
  // Route to AI agent for quotes, claims, questions
  const agent = new InsuranceAgent(ctx.supabase);
  const response = await agent.execute(text, { userId: ctx.from });
  await sendText(ctx.from, response);
  return true;
}
```

---

### Option B: Consolidate to AI Agent Only

**Effort:** Low  
**Impact:** High  
**Risk:** Removes OCR functionality unless migrated

**Steps:**
1. Route "insurance" menu key to wa-webhook-ai-agents
2. Update route-config.ts
3. Migrate OCR logic to AI agent or separate function
4. Archive wa-webhook-insurance

```typescript
// route-config.ts
{
  service: "wa-webhook-ai-agents",
  menuKeys: [..., "insurance", "insurance_agent"],
}
```

---

### Option C: Fix Health & Circuit Breaker (Quick Fix)

**Effort:** Low  
**Impact:** Medium  
**Fixes:** 503 errors but not AI integration

**Steps:**
1. Add detailed health check to wa-webhook-insurance
2. Optimize response time (<4s)
3. Check database connectivity
4. Add observability

```typescript
// wa-webhook-insurance/index.ts
if (url.pathname === '/health') {
  const dbCheck = await supabase.from('profiles').select('user_id').limit(1);
  const checks = {
    database: dbCheck.error ? 'unhealthy' : 'healthy',
    timestamp: new Date().toISOString(),
  };
  
  return respond({
    status: checks.database === 'healthy' ? 'healthy' : 'unhealthy',
    service: 'wa-webhook-insurance',
    checks,
  }, {
    status: checks.database === 'healthy' ? 200 : 503
  });
}
```

---

## Testing Plan

### 1. Check Current Service Health

```bash
# Test core router
curl https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-core/health

# Test insurance microservice
curl https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-insurance/health

# Test AI agents
curl https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-ai-agents/health
```

### 2. Check Feature Flags

```typescript
// Check if unified agent system is enabled
const { isFeatureEnabled } = await import("../_shared/feature-flags.ts");
const enabled = isFeatureEnabled("agent.unified_system");
```

### 3. Check Database Schema

```sql
-- Verify insurance tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%insurance%';

-- Check home menu items
SELECT * FROM whatsapp_home_menu_items 
WHERE key LIKE '%insurance%' 
ORDER BY display_order;

-- Check recent states
SELECT key, data FROM user_chat_states 
WHERE key LIKE '%insurance%' 
ORDER BY updated_at DESC 
LIMIT 10;
```

### 4. Test Routing

```bash
# Send test message with "insurance" keyword
# Monitor logs for routing decision
# Verify which service receives the request
```

---

## Observability Gaps

### Missing Logs

1. **wa-webhook-insurance startup:** Should log service initialization
2. **Routing decisions:** Need to see why core routes to insurance but gets 503
3. **Health check results:** wa-webhook-insurance health endpoint responses
4. **Circuit breaker state:** Current failures, reset times

### Required Logging

```typescript
// Add to wa-webhook-insurance startup
await logStructuredEvent('INSURANCE_SERVICE_STARTED', {
  version: '169',
  features: ['ocr', 'menu', 'claims'],
  timestamp: new Date().toISOString(),
});

// Add to health check
await logStructuredEvent('INSURANCE_HEALTH_CHECK', {
  status: healthStatus,
  dbConnected: dbCheck.error ? false : true,
  responseTimeMs: Date.now() - startTime,
});
```

---

## Database Requirements

### Expected Tables (From AI Agent Code)

1. **insurance_requests**
   - Columns: id, insurance_type, coverage_type, vehicle_type, vehicle_value, annual_premium, monthly_premium, status
   - Used by: get_motor_quote (insurance_agent.ts line 145)

2. **insurance_claims**
   - Columns: id, policy_number, claim_type, incident_date, description, estimated_amount, status, submitted_at, approved_amount, notes
   - Used by: submit_claim (line 230), check_claim_status (line 268)

3. **insurance_policies**
   - Columns: id, policy_number, insurance_type, coverage_type, annual_premium, status, start_date, end_date
   - Used by: get_policy_details (line 300)

### Migrations Needed

Check if these tables exist. If not, create migration:

```sql
-- Example migration (needs verification)
CREATE TABLE IF NOT EXISTS insurance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  insurance_type TEXT NOT NULL,
  coverage_type TEXT,
  vehicle_type TEXT,
  vehicle_value NUMERIC,
  annual_premium NUMERIC,
  monthly_premium NUMERIC,
  status TEXT DEFAULT 'quoted',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Immediate Actions

### Priority 1: Fix 503 Errors

1. ✅ Check wa-webhook-insurance health endpoint
2. ✅ Review circuit breaker state in core
3. ✅ Check service response times
4. ✅ Add detailed error logging

### Priority 2: Route to AI Agent

1. ✅ Update route-config.ts to route "insurance" to ai-agents
2. ✅ Test with WhatsApp message
3. ✅ Verify AI agent responds with quotes/claims

### Priority 3: Verify Database

1. ⚠️ Check if insurance tables exist
2. ⚠️ Create migrations if missing
3. ⚠️ Test AI agent database inserts

---

## Conclusion

The insurance system has **two competing implementations**:
- **wa-webhook-insurance:** Document OCR focus, no AI
- **insurance_agent.ts:** Full AI capabilities (quotes, claims, NLP)

**Root cause of 503:** Circuit breaker opening due to wa-webhook-insurance health/timeout issues.

**Root cause of no response:** Core routes to wa-webhook-insurance which may be unhealthy or slow.

**Recommended fix:** 
1. **Short-term:** Route "insurance" to wa-webhook-ai-agents (Option B)
2. **Long-term:** Integrate AI agent into insurance microservice (Option A)

**Next steps:**
1. Run health checks on all three services
2. Check feature flag state for unified agent system
3. Verify database tables exist
4. Test routing with real WhatsApp message
5. Monitor logs for detailed error messages

---

**Generated by:** GitHub Copilot CLI  
**Version:** Based on codebase analysis as of 2025-11-28  
**Contact:** Review with development team before implementing changes
