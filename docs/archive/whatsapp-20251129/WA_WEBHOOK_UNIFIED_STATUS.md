# wa-webhook-unified Status Report

**Date:** 2025-11-28  
**Current Status:** ❌ BOOT_ERROR (Not in Use)  
**Recommendation:** Low Priority - Future Project

---

## What is wa-webhook-unified?

**Purpose:** Consolidation project to merge 4 separate WhatsApp webhook microservices into one unified service.

**Target Services to Replace:**
1. wa-webhook-marketplace
2. wa-webhook-jobs  
3. wa-webhook-property
4. wa-webhook-ai-agents (partially)

**Goals:**
- 37% code reduction
- 75% service reduction (4 → 1)
- Unified session management
- Seamless agent handoffs
- Single deployment

---

## Current Status

### Deployment
- ✅ Function exists and is deployed (v49)
- ❌ Has boot errors (won't start)
- ❌ NOT used in production routing
- ❌ NOT referenced in route-config.ts

### Code Issues

**Type Errors Found:**
```
1. agents/base-agent.ts:118 - systemInstruction property doesn't exist in ModelParams
2. agents/base-agent.ts:126 - responseMimeType doesn't exist in GenerationConfig  
3. _shared/whatsapp-api.ts:24 - sendButtons missing required parameter
4. _shared/webhook-utils.ts:392 - error.message on unknown type
```

**Root Cause:** Gemini AI SDK version incompatibility
- Code written for older Gemini SDK
- Current SDK has different API surface
- Need to update to latest SDK patterns

---

## Why It's Not Critical

### Current Architecture is Working

All target services are **healthy and functional**:

| Service | Status | Users |
|---------|--------|-------|
| wa-webhook-marketplace | ✅ HEALTHY | Using it |
| wa-webhook-jobs | ✅ HEALTHY | Using it |
| wa-webhook-property | ✅ HEALTHY | Using it |
| wa-webhook-ai-agents | ❌ BOOT_ERROR | Not using |

### No Production Impact

- Unified service is **NOT** in the routing config
- All traffic goes to individual microservices
- Users are unaffected by unified service boot errors
- Individual services provide all functionality

---

## Project Status

### Completed Work

According to PROJECT_SUMMARY.md:

✅ Code consolidation (37% reduction)  
✅ 10 agents migrated  
✅ Unified session management  
✅ Test suite created  
✅ Feature flags implemented  
✅ Deployment scripts ready

### Incomplete Work

❌ Gemini SDK update needed  
❌ Final integration testing  
❌ Production rollout not started  
❌ Gradual migration not initiated

### Timeline

Based on git history:
- Last major work: Several weeks ago
- Phase 4 completed (observability/docs)
- Stalled at production rollout phase
- **Project appears paused**

---

## Boot Error Analysis

### Error Types

1. **Gemini SDK Incompatibility**
   ```typescript
   // Old API (in code):
   systemInstruction: this.buildPrompt(session)
   responseMimeType: "application/json"
   
   // New API (required):
   // Different property names/structure
   ```

2. **WhatsApp API Signature**
   ```typescript
   // Current code:
   await sendButtons(to, options.interactiveButtons);
   
   // Required signature:
   sendButtons(to, body, buttons)  // Missing parameters
   ```

3. **Type Safety**
   ```typescript
   // error is 'unknown' type
   error: error.message  // ❌ TypeScript error
   error: error instanceof Error ? error.message : String(error)  // ✅ Fix
   ```

---

## Recommendations

### Short-term (Immediate)

✅ **DO NOTHING** - Service not in use, no user impact

**Rationale:**
- Current microservices are healthy
- No production impact
- Fixing would require significant work
- Higher priority issues exist

### Medium-term (1-2 weeks)

If wanting to revive the project:

1. **Update Gemini SDK**
   ```bash
   # Update import to latest version
   import { GoogleGenerativeAI } from "npm:@google/generative-ai@0.21.0"
   ```

2. **Fix API calls**
   - Update systemInstruction to systemPrompt or correct property
   - Fix responseMimeType to match new SDK
   - Fix sendButtons call signature

3. **Type safety fixes**
   - Add proper error type guards
   - Fix unknown type handling

4. **Test locally**
   ```bash
   cd supabase/functions/wa-webhook-unified
   deno check index.ts
   deno test
   ```

5. **Deploy & verify**
   ```bash
   supabase functions deploy wa-webhook-unified --no-verify-jwt
   curl https://PROJECT.supabase.co/functions/v1/wa-webhook-unified/health
   ```

### Long-term (Future)

**Option A: Complete the Project**
- Fix all boot errors
- Complete testing
- Enable feature flags
- Gradual rollout to production
- Deprecate individual services
- **Effort:** 2-3 weeks
- **Benefit:** Simplified architecture, reduced costs

**Option B: Abandon the Project**
- Keep current microservice architecture
- Remove/archive wa-webhook-unified
- Continue with working services
- **Effort:** 1 day (cleanup)
- **Benefit:** Focus on features, not refactoring

**Option C: Pause Indefinitely**
- Leave as-is (current state)
- Revisit when there's a compelling reason
- **Effort:** 0 (status quo)
- **Benefit:** Preserve work for future

---

## Decision Matrix

| Factor | Complete Project | Abandon | Pause |
|--------|-----------------|---------|-------|
| User Impact | None | None | None |
| Dev Effort | High (2-3 weeks) | Low (1 day) | None |
| Code Quality | Better (consolidated) | Same | Same |
| Maintenance | Lower (1 service) | Same (4 services) | Same |
| Risk | Medium (migration) | Low | None |
| Urgency | Low | Low | Low |

---

## Conclusion

**Current Recommendation:** ✅ **OPTION C - PAUSE INDEFINITELY**

**Rationale:**
1. No user impact - all services working
2. No urgent need to fix
3. Significant effort required to complete
4. Higher priority work exists (insurance OCR, actual features)
5. Architecture decision can be deferred

**Action Items:**
- ✅ Document status (this file)
- ✅ Update audit reports to note "Not in use"
- ✅ Add to backlog for future consideration
- ❌ Do not spend time fixing now

**Future Trigger Events:**
- Cost optimization becomes priority
- Maintenance burden of 4 services becomes issue
- Need for unified session management emerges
- Have 2-3 weeks for refactoring project

---

## Files

**Location:** `supabase/functions/wa-webhook-unified/`

**Key Files:**
- `index.ts` - Entry point (has boot errors)
- `core/orchestrator.ts` - Central routing
- `agents/` - 10 agent implementations
- `README.md` - Project documentation
- `PROJECT_SUMMARY.md` - Achievement summary
- `DEPLOYMENT.md` - Deployment guide

**Dependencies:**
- Gemini AI SDK (outdated version)
- Supabase client
- WhatsApp API utils
- Observability tools

---

## Summary

wa-webhook-unified is a **future optimization project** that is:
- ✅ Well-designed and mostly complete
- ❌ Not production-ready (boot errors)
- ❌ Not currently used
- ⚠️ Paused/stalled
- ✅ Safe to ignore for now

**No action required unless/until there's a business need to consolidate services.**

---

*Generated: 2025-11-28T14:15:00Z*  
*Status: DOCUMENTED - No immediate action needed*
