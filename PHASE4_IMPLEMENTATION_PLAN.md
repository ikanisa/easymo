# PHASE 4: IMPLEMENTATION PLAN
## Buy-Sell Ecosystem Consolidation

**Status**: Ready for Implementation  
**Estimated Time**: 3 hours  
**Risk Level**: Medium  
**Rollback Plan**: Git revert + function redeploy

---

## STEP 1: FIX DUALAIPROVIDER IMPORT ⚠️ CRITICAL

**Priority**: **HIGHEST** - AI agent currently disabled  
**Time**: 60 minutes  
**Risk**: Medium

### 1.1 Find DualAIProvider Implementation

```bash
# Search for DualAIProvider across codebase
find supabase/functions -name "*.ts" -type f -exec grep -l "class DualAIProvider\|export.*DualAIProvider" {} \;

# Check wa-agent-waiter directory
ls -la supabase/functions/wa-agent-waiter/core/providers/
```

**Expected locations**:
- `supabase/functions/_shared/ai-providers/dual-ai-provider.ts`
- `supabase/functions/wa-agent-waiter/core/providers/dual-ai-provider.ts`
- `packages/*/src/providers/dual-ai-provider.ts`

### 1.2 Fix Import

**File**: `supabase/functions/wa-webhook-buy-sell/core/agent.ts`

**Current (Line 28-29)**:
```typescript
// TODO Phase 2: Fix DualAIProvider import - path broken
// import { DualAIProvider } from "../../wa-agent-waiter/core/providers/dual-ai-provider.ts";
type DualAIProvider = any; // Temporary workaround
```

**Option A - If provider exists**:
```typescript
import { DualAIProvider } from "../../_shared/ai-providers/dual-ai-provider.ts";
```

**Option B - If provider missing, inline minimal implementation**:
```typescript
// Minimal Gemini AI provider for Buy & Sell agent
class DualAIProvider {
  async chat(
    messages: Array<{ role: string; content: string }>,
    options?: { temperature?: number; maxTokens?: number; metadata?: any }
  ): Promise<string> {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: messages.map(m => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
          generationConfig: {
            temperature: options?.temperature ?? 0.7,
            maxOutputTokens: options?.maxTokens ?? 1024,
          },
        }),
      }
    );

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }
}
```

### 1.3 Remove Fallback Logic

**File**: `supabase/functions/wa-webhook-buy-sell/core/agent.ts`

**Current (Line 524-531)**:
```typescript
try {
  // TODO Phase 2: Fix DualAIProvider instantiation (path broken)
  // this.aiProvider = new DualAIProvider();
  this.aiProvider = null; // Temporarily disabled
  if (this.aiProvider === null) {
    logStructuredEvent(
      "MARKETPLACE_AGENT_PROVIDER_DISABLED",
      { reason: "DualAIProvider path broken", correlationId },
      "warn",
    );
  }
} catch (error) {
  this.aiProvider = null;
  logStructuredEvent(
    "MARKETPLACE_AGENT_PROVIDER_MISSING",
    {
      error: error instanceof Error ? error.message : String(error),
      correlationId,
    },
    "warn",
  );
}
```

**Replace with**:
```typescript
try {
  this.aiProvider = new DualAIProvider();
  logStructuredEvent(
    "MARKETPLACE_AGENT_PROVIDER_INITIALIZED",
    { correlationId },
    "info",
  );
} catch (error) {
  this.aiProvider = null;
  logStructuredEvent(
    "MARKETPLACE_AGENT_PROVIDER_ERROR",
    {
      error: error instanceof Error ? error.message : String(error),
      correlationId,
    },
    "error",
  );
  throw error; // Don't silently fail
}
```

### 1.4 Test AI Provider

```bash
# Deploy the fix
cd supabase
supabase functions deploy wa-webhook-buy-sell

# Test with curl
curl -X POST https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-buy-sell \
  -H "Content-Type: application/json" \
  -H "x-wa-internal-forward: true" \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "id": "test_'$(date +%s)'",
            "from": "250788000001",
            "type": "text",
            "text": { "body": "I need brake pads for a RAV4" }
          }]
        }
      }]
    }]
  }'

# Check logs - should NOT see "MARKETPLACE_AGENT_PROVIDER_DISABLED"
supabase functions logs wa-webhook-buy-sell --tail=20
```

**Success Criteria**:
- ✅ No "MARKETPLACE_AGENT_PROVIDER_DISABLED" logs
- ✅ AI processes message (not just welcome message)
- ✅ Response contains product search or clarifying question

---

## STEP 2: DEPRECATE AGENT-BUY-SELL FUNCTION

**Priority**: High  
**Time**: 30 minutes  
**Risk**: Low (only 106 invocations)

### 2.1 Add Deprecation Warning

**File**: `supabase/functions/agent-buy-sell/index.ts`

**Replace entire file**:
```typescript
/**
 * agent-buy-sell - DEPRECATED
 * 
 * This function is deprecated as of December 14, 2025.
 * All Buy & Sell functionality has been consolidated into wa-webhook-buy-sell.
 * 
 * Migration: Use wa-webhook-buy-sell instead (supports both webhook and API modes)
 * 
 * This function will be removed on January 14, 2026.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logStructuredEvent } from "../_shared/observability.ts";

const REDIRECT_URL = Deno.env.get("SUPABASE_URL") + "/functions/v1/wa-webhook-buy-sell";

serve(async (req: Request): Promise<Response> => {
  const correlationId = req.headers.get("x-correlation-id") ?? crypto.randomUUID();

  // Log deprecation event
  await logStructuredEvent(
    "AGENT_BUY_SELL_DEPRECATED_ACCESS",
    {
      method: req.method,
      redirectTo: "wa-webhook-buy-sell",
      correlationId,
      deprecationDate: "2025-12-14",
      removalDate: "2026-01-14",
    },
    "warn"
  );

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-correlation-id",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        status: "deprecated",
        message: "This function is deprecated. Use wa-webhook-buy-sell instead.",
        deprecation_date: "2025-12-14",
        removal_date: "2026-01-14",
        redirect_to: REDIRECT_URL,
      }),
      { 
        status: 410, // Gone
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }

  try {
    const body = await req.json();

    // Forward to wa-webhook-buy-sell
    const response = await fetch(REDIRECT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-wa-internal-forward": "true",
        "x-correlation-id": correlationId,
        "x-deprecation-redirect": "agent-buy-sell",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: "redirect_failed",
        message: "Could not redirect to wa-webhook-buy-sell" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

### 2.2 Update Route Config

**File**: `supabase/functions/_shared/route-config.ts`

**Current**:
```typescript
{
  service: "agent-buy-sell",
  keywords: [],
  menuKeys: [],
  priority: 99,
},
```

**Replace with**:
```typescript
{
  service: "agent-buy-sell",
  keywords: [],
  menuKeys: [],
  priority: 99,
  deprecated: true,
  redirectTo: "wa-webhook-buy-sell",
},
```

### 2.3 Deploy & Monitor

```bash
# Deploy deprecation
supabase functions deploy agent-buy-sell

# Monitor for redirects (should see AGENT_BUY_SELL_DEPRECATED_ACCESS logs)
supabase functions logs agent-buy-sell --tail=50 | grep DEPRECATED
```

**Monitoring Period**: 2 weeks (until December 28, 2025)

**If zero invocations after 2 weeks**: DELETE the function

---

## STEP 3: CLEAN ROUTING CONFIG

**Priority**: Medium  
**Time**: 15 minutes  
**Risk**: Low

### 3.1 Remove Phantom Services

**File**: `supabase/functions/_shared/route-config.ts`

**Current (Line 99-110)**:
```typescript
export const ROUTED_SERVICES: readonly string[] = [
  "wa-webhook-mobility",
  "wa-webhook-profile",
  "wa-webhook-wallet",
  "wa-webhook-buy-sell",
  "wa-webhook-buy-sell-directory",    // ❌ Never existed
  "wa-webhook-buy-sell-agent",        // ❌ Never existed
  "agent-buy-sell",                   // ⚠️ Deprecated
  "wa-agent-support",
  "wa-webhook-core",
  "wa-webhook", // Legacy fallback
] as const;
```

**Replace with**:
```typescript
/**
 * List of all routed services (for health checks, validation, etc.)
 * 
 * EasyMO Rwanda-only services:
 * - Mobility, Buy & Sell, Profile, Wallet, Support
 */
export const ROUTED_SERVICES: readonly string[] = [
  "wa-webhook-mobility",
  "wa-webhook-profile",
  "wa-webhook-wallet",
  "wa-webhook-buy-sell",
  "wa-agent-support",
  "wa-webhook-core",
  "wa-webhook", // Legacy fallback
] as const;
```

**Removed**:
- `wa-webhook-buy-sell-directory` (never deployed)
- `wa-webhook-buy-sell-agent` (never deployed)
- `agent-buy-sell` (deprecated, not routable anyway)

### 3.2 Verify Routing

```bash
# Test that routing still works
cd supabase
pnpm test -- --grep "route-config"

# Or manual test
node -e "
const { ROUTED_SERVICES } = require('./functions/_shared/route-config.ts');
console.log('Routed services:', ROUTED_SERVICES);
console.log('Count:', ROUTED_SERVICES.length);
"
```

---

## STEP 4: IMPROVE LOGGING IN WA-WEBHOOK-BUY-SELL

**Priority**: Low  
**Time**: 15 minutes  
**Risk**: Minimal

### 4.1 Add AI Fallback Metric

**File**: `supabase/functions/wa-webhook-buy-sell/core/agent.ts`

**Current (Line 564-579)**:
```typescript
// Fallback if no AI configured - show welcome message
if (!this.aiProvider) {
  logStructuredEvent(
    "MARKETPLACE_AGENT_NO_AI_PROVIDER",
    {
      phone: context.phone.slice(-4),
      correlationId: this.correlationId,
    },
    "warn",
  );
  
  return {
    message: WELCOME_MESSAGE,
    action: "continue",
    flowComplete: false,
  };
}
```

**Add metric**:
```typescript
// Fallback if no AI configured - show welcome message
if (!this.aiProvider) {
  logStructuredEvent(
    "MARKETPLACE_AGENT_NO_AI_PROVIDER",
    {
      phone: context.phone.slice(-4),
      correlationId: this.correlationId,
    },
    "warn",
  );
  
  recordMetric("marketplace.agent.ai_fallback", 1); // ✅ NEW
  
  return {
    message: WELCOME_MESSAGE,
    action: "continue",
    flowComplete: false,
  };
}
```

### 4.2 Add Startup Health Check

**File**: `supabase/functions/wa-webhook-buy-sell/core/agent.ts`

**After constructor (Line 543)**:
```typescript
constructor(
  supabase: SupabaseClient,
  correlationId?: string,
) {
  this.supabase = supabase;
  this.correlationId = correlationId;
  this.configLoader = new AgentConfigLoader(supabase);

  try {
    this.aiProvider = new DualAIProvider();
    logStructuredEvent(
      "MARKETPLACE_AGENT_PROVIDER_INITIALIZED",
      { correlationId },
      "info",
    );
  } catch (error) {
    this.aiProvider = null;
    logStructuredEvent(
      "MARKETPLACE_AGENT_PROVIDER_ERROR",
      {
        error: error instanceof Error ? error.message : String(error),
        correlationId,
      },
      "error",
    );
    throw error;
  }
}

// ✅ NEW - Static method to check provider availability
static async healthCheck(): Promise<{ healthy: boolean; aiProvider: boolean }> {
  try {
    const provider = new DualAIProvider();
    return { healthy: true, aiProvider: !!provider };
  } catch {
    return { healthy: false, aiProvider: false };
  }
}
```

**Add to index.ts health check (Line 74-81)**:
```typescript
// Health check (no verification params)
if (!mode && !token) {
  const health = await MarketplaceAgent.healthCheck(); // ✅ NEW
  
  return respond({
    status: "healthy",
    service: "wa-webhook-buy-sell",
    scope: "ai_agent_conversation",
    aiProvider: health.aiProvider, // ✅ NEW
    timestamp: new Date().toISOString(),
  });
}
```

---

## STEP 5: TESTING & DEPLOYMENT

**Time**: 60 minutes

### 5.1 Local Type Checking

```bash
cd supabase
deno check functions/wa-webhook-buy-sell/index.ts
deno check functions/agent-buy-sell/index.ts
deno check functions/_shared/route-config.ts
```

### 5.2 Deploy All Changes

```bash
# Deploy fixed wa-webhook-buy-sell
supabase functions deploy wa-webhook-buy-sell

# Deploy deprecated agent-buy-sell
supabase functions deploy agent-buy-sell

# No need to deploy route-config (shared module, auto-loaded)
```

### 5.3 Smoke Tests

```bash
# Test 1: wa-webhook-buy-sell health check (should show aiProvider: true)
curl https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-buy-sell | jq

# Test 2: Send test message (should get AI response, not just welcome)
curl -X POST https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-buy-sell \
  -H "Content-Type: application/json" \
  -H "x-wa-internal-forward: true" \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "id": "test_phase4_1",
            "from": "250788999001",
            "type": "text",
            "text": { "body": "I need laptop under 400k" }
          }]
        }
      }]
    }]
  }' | jq

# Test 3: agent-buy-sell health check (should show deprecated: true)
curl https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/agent-buy-sell | jq

# Test 4: agent-buy-sell redirect (should forward to wa-webhook-buy-sell)
curl -X POST https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/agent-buy-sell \
  -H "Content-Type: application/json" \
  -d '{
    "userPhone": "250788999002",
    "message": "test redirect"
  }' | jq
```

### 5.4 Monitor Logs

```bash
# Monitor wa-webhook-buy-sell (should see AI processing, not fallbacks)
supabase functions logs wa-webhook-buy-sell --tail=50 | grep -E "(MARKETPLACE_AGENT|AI_PROVIDER)"

# Monitor agent-buy-sell (should see DEPRECATED_ACCESS logs)
supabase functions logs agent-buy-sell --tail=20 | grep DEPRECATED
```

---

## SUCCESS CRITERIA

### Immediate (After deployment)
- [ ] wa-webhook-buy-sell health check shows `aiProvider: true`
- [ ] Test messages get AI responses (not just WELCOME_MESSAGE)
- [ ] No "MARKETPLACE_AGENT_PROVIDER_DISABLED" logs
- [ ] agent-buy-sell returns 410 Gone status
- [ ] agent-buy-sell redirects work (if POST requests)
- [ ] AGENT_BUY_SELL_DEPRECATED_ACCESS logs appear

### 2-Week Monitoring (Until December 28, 2025)
- [ ] agent-buy-sell invocations tracked
- [ ] wa-webhook-buy-sell invocations stable (no drop)
- [ ] No errors from redirects
- [ ] AI provider working consistently

### Final Cleanup (After 2 weeks)
- [ ] If agent-buy-sell invocations = 0: DELETE function
- [ ] Remove from route config
- [ ] Update documentation
- [ ] Mark Phase 4 complete

---

## ROLLBACK PLAN

If anything goes wrong:

```bash
# Rollback wa-webhook-buy-sell
git revert <commit-hash>
supabase functions deploy wa-webhook-buy-sell

# Rollback agent-buy-sell
git checkout HEAD~1 supabase/functions/agent-buy-sell/
supabase functions deploy agent-buy-sell

# Rollback route config
git checkout HEAD~1 supabase/functions/_shared/route-config.ts
```

**Rollback triggers**:
- wa-webhook-buy-sell error rate > 5%
- AI provider fails to initialize
- agent-buy-sell redirect causes errors
- Significant drop in wa-webhook-buy-sell traffic

---

## ESTIMATED TIMELINE

| Step | Time | Dependencies |
|------|------|--------------|
| 1. Fix DualAIProvider | 60 min | Find provider location |
| 2. Deprecate agent-buy-sell | 30 min | Step 1 complete |
| 3. Clean routing | 15 min | None |
| 4. Improve logging | 15 min | Step 1 complete |
| 5. Testing & deployment | 60 min | All steps complete |
| **TOTAL** | **3 hours** | - |

**Start**: December 14, 2025  
**Complete**: Same day (3 hours)  
**Final cleanup**: December 28, 2025 (if agent-buy-sell usage = 0)

---

## DOCUMENTATION UPDATES

After Phase 4 completion:

1. Update `BUY_SELL_README.md`:
   - Remove agent-buy-sell references
   - Update architecture diagram
   - Document single agent approach

2. Update `WEBHOOK_ECOSYSTEM_PHASES_PLAN.md`:
   - Mark Phase 4 complete
   - Add lessons learned

3. Create `PHASE4_COMPLETE.md`:
   - Summary of changes
   - Before/after metrics
   - Deprecation tracking

---

**Ready to implement?** Start with Step 1 (DualAIProvider fix) - it's the most critical!
