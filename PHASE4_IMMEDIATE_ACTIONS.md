# Phase 4: Immediate Actions Required

**Generated**: 2025-12-14  
**Priority**: 🔴 CRITICAL  
**Estimated Time**: 2-3 hours

---

## TL;DR - Critical Issue Found

**`agent-buy-sell` function is BROKEN**:
- Imports from non-existent file: `_shared/agents/buy-and-sell.ts`  
- Has 106 invocations in last 3 days - **all likely failed**
- Will throw import error on every request

**Root Cause**: Incomplete refactoring - shared agent module was never created

---

## Verification Steps (Run These First)

```bash
# 1. Confirm the shared agent file is missing
ls -la supabase/functions/_shared/agents/buy-and-sell.ts 2>&1

# 2. Check what's actually in the agents directory
ls -R supabase/functions/_shared/agents/

# 3. Check agent-buy-sell error logs
supabase functions logs agent-buy-sell --limit 20

# 4. Verify wa-webhook-buy-sell has the agent implementation
wc -l supabase/functions/wa-webhook-buy-sell/core/agent.ts

# 5. Check for TODO comments about this issue
grep -rn "TODO.*DualAIProvider" supabase/functions/wa-webhook-buy-sell/
```

---

## Action 1: Fix agent-buy-sell (CRITICAL - 30 minutes)

### Option A: Quick Fix - Use webhook's agent directly

**Pros**: Fast, no new files  
**Cons**: Tight coupling, not DRY

```typescript
// supabase/functions/agent-buy-sell/index.ts
// Change line 8-14 from:
import { 
  BuyAndSellAgent,
  type BuyAndSellContext,
  loadContext,
  saveContext,
  resetContext
} from "../_shared/agents/buy-and-sell.ts"; // ❌ BROKEN

// To:
import { 
  MarketplaceAgent,
  type MarketplaceContext as BuyAndSellContext,
} from "../wa-webhook-buy-sell/core/agent.ts"; // ✅ WORKS

// Then update line 29:
const agent = new MarketplaceAgent(supabase);

// And lines 64, 76:
const context = await MarketplaceAgent.loadContext(body.userPhone, supabase);
await MarketplaceAgent.saveContext(context, supabase);
```

### Option B: Proper Fix - Create shared agent (Recommended)

**Pros**: DRY, reusable, maintainable  
**Cons**: Takes longer (2 hours)

See detailed steps in `PHASE4_BUY_SELL_ANALYSIS_AND_PLAN.md` Phase 4.1

---

## Action 2: Decide on notify-buyers (10 minutes)

This function appears **orphaned** (no integrations found).

### Quick Decision Matrix:

| Question | Answer | Action |
|----------|--------|--------|
| Is it called by any webhook? | NO | Consider delete |
| Is it called by any scheduled job? | UNKNOWN | Check logs |
| Is there a feature flag for it? | NO | Consider delete |
| Is it documented anywhere? | NO | Consider delete |

**Recommended**: Check logs first, then delete if unused

```bash
# Check who's calling it
supabase functions logs notify-buyers --limit 50 | grep -E "(x-forwarded-for|referer|user-agent)"

# If no meaningful traffic → DELETE
git rm -r supabase/functions/notify-buyers
git commit -m "Remove unused notify-buyers function

- No webhook integration found
- No scheduled job found  
- 105 invocations likely from manual testing
- Can restore from git if needed later
- Part of Phase 4 cleanup"
```

---

## Action 3: Delete Backup Directory (5 minutes)

```bash
# Remove old backup (use git history instead)
rm -rf supabase/functions/wa-webhook-buy-sell/original-backup-for-ref/

git add -A
git commit -m "Clean up wa-webhook-buy-sell backup directory

- Remove original-backup-for-ref/
- Use git history for old implementations
- Part of Phase 4 consolidation"
```

---

## Action 4: Fix TODO in wa-webhook-buy-sell (15 minutes)

**File**: `supabase/functions/wa-webhook-buy-sell/core/agent.ts` lines 28-29

```typescript
// Before:
// TODO Phase 2: Fix DualAIProvider import - path broken
type DualAIProvider = any; // Temporary workaround

// After - Option 1 (if provider exists):
import { DualAIProvider } from "../../wa-agent-waiter/core/providers/dual-ai-provider.ts";

// After - Option 2 (if path broken, use direct import):
import { DualAIProvider } from "../../_shared/llm-providers/dual-ai.ts";

// After - Option 3 (if truly not needed):
// Remove type and refactor code to not use it
```

**Verify provider location first**:
```bash
find supabase/functions -name "dual-ai-provider.ts" -o -name "dual-ai.ts"
```

---

## Action 5: Add Critical Monitoring (20 minutes)

Add alerts for the broken function:

```typescript
// supabase/functions/agent-buy-sell/index.ts
// Add at top of try block (after line 51):

import { logStructuredEvent, recordMetric } from "../_shared/observability.ts";

// After line 52:
logStructuredEvent("AGENT_BUY_SELL_REQUEST", {
  userPhone: `***${body.userPhone.slice(-4)}`,
  messageLength: body.message.length,
  hasLocation: !!body.location,
  reset: !!body.reset,
});

// Before line 82 return:
const duration = Date.now() - startTime;
recordMetric("agent_buy_sell.success", 1, { duration_ms: duration });

// In catch block (line 83), add:
const duration = Date.now() - startTime;
logStructuredEvent("AGENT_BUY_SELL_ERROR", {
  error: error instanceof Error ? error.message : String(error),
  stack: error instanceof Error ? error.stack : undefined,
  duration_ms: duration,
}, "error");
recordMetric("agent_buy_sell.error", 1);
```

---

## Deployment Plan

### Stage 1: Quick Fix (TODAY)
```bash
# 1. Apply Option A (quick fix) to agent-buy-sell
# 2. Deploy
supabase functions deploy agent-buy-sell

# 3. Test immediately
curl -X POST https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/agent-buy-sell \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"userPhone":"250788000000","message":"test","reset":true}'

# 4. Monitor logs for 10 minutes
supabase functions logs agent-buy-sell --follow

# 5. If no errors, mark as resolved
```

### Stage 2: Proper Fix (THIS WEEK)
```bash
# 1. Create _shared/agents/marketplace.ts (Phase 4.1)
# 2. Update both agent-buy-sell and wa-webhook-buy-sell to use it
# 3. Add tests
# 4. Deploy to staging
# 5. Canary rollout to production
```

### Stage 3: Cleanup (NEXT WEEK)
```bash
# 1. Delete notify-buyers if unused
# 2. Consolidate wa-webhook-buy-sell files (23 → 10)
# 3. Add comprehensive documentation
# 4. Final testing
```

---

## Rollback Plan

If Option A breaks agent-buy-sell further:

```bash
# 1. Revert to previous deployment
supabase functions deploy agent-buy-sell --version $(supabase functions list | grep agent-buy-sell | awk '{print $3}')

# 2. Or deploy a minimal working version:
cat > supabase/functions/agent-buy-sell/index.ts << 'EOF'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve((req: Request) => {
  if (req.method === "GET") {
    return new Response(JSON.stringify({ status: "degraded", message: "Under maintenance" }), {
      headers: { "Content-Type": "application/json" },
    });
  }
  
  return new Response(JSON.stringify({ error: "temporarily_unavailable" }), {
    status: 503,
    headers: { "Content-Type": "application/json" },
  });
});
EOF

supabase functions deploy agent-buy-sell
```

---

## Success Criteria

### Immediate (Today)
- [ ] `agent-buy-sell` returns 200 OK on test request
- [ ] No import errors in logs
- [ ] Response contains valid JSON
- [ ] Error rate drops to 0%

### Short-term (This Week)
- [ ] Shared agent created
- [ ] Both functions use shared code
- [ ] notify-buyers decision made (keep/delete)
- [ ] Backup directory deleted
- [ ] TODO comment resolved

### Long-term (Next Week)
- [ ] File count reduced
- [ ] Documentation complete
- [ ] All tests passing
- [ ] Production monitoring confirms stability

---

## Questions to Answer

1. **Who is calling `agent-buy-sell`?**
   - Check logs for x-forwarded-for headers
   - Check if it's from admin panel, mobile app, or external

2. **Why does `notify-buyers` have 105 invocations?**
   - Manual testing?
   - Scheduled job?
   - External integration?

3. **Is the `DualAIProvider` TODO blocking anything?**
   - Check if agent.ts actually uses it
   - If yes, find correct import path
   - If no, remove the type declaration

4. **Are the database tables used by `notify-buyers` present?**
   ```sql
   SELECT tablename FROM pg_tables 
   WHERE tablename IN ('buyer_market_alerts', 'produce_catalog', 'vendor_inquiries');
   ```

---

## Communication

### Notify Team
```
🔴 CRITICAL: agent-buy-sell function broken

Issue: Function imports from non-existent file, causing all requests to fail
Impact: 106 failed invocations in last 3 days
Fix: Deploying quick fix now (ETA 30 min)
Follow-up: Proper refactoring in Phase 4.1 (this week)

Will notify when resolved.
```

### Post-Fix Update
```
✅ RESOLVED: agent-buy-sell function restored

Fix: Updated imports to use existing agent implementation
Status: Function now returning 200 OK, error rate at 0%
Next: Implementing proper shared agent architecture (Phase 4.1)

No further action needed from team.
```

---

## Next Steps After Immediate Fix

1. **Monitor for 24 hours**
   - Check error rates
   - Check response times
   - Check user complaints

2. **Schedule Phase 4.1 Implementation**
   - Create shared agent module
   - Write comprehensive tests
   - Deploy to staging
   - Canary rollout

3. **Complete Full Analysis**
   - Read `PHASE4_BUY_SELL_ANALYSIS_AND_PLAN.md`
   - Prioritize remaining tasks
   - Schedule with team

---

## Resources

- Full Analysis: `PHASE4_BUY_SELL_ANALYSIS_AND_PLAN.md`
- Function Logs: `supabase functions logs <function-name>`
- Deployment: `supabase functions deploy <function-name>`
- Testing: Use Postman collection or curl commands above

---

**IMPORTANT**: Start with Action 1 (fix agent-buy-sell). It's the only critical blocker. Everything else can wait.
