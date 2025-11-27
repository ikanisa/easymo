# Location Integration - Next Session TODO
**Date**: 2025-11-26  
**Current Status**: 90% Complete  
**Target**: 100% Complete (4.5 hours)

---

## Quick Start

This session completed:
- ✅ Property cache integration (deployed)
- ✅ Verified Profile, Marketplace, Unified already complete
- ✅ Increased coverage: 40% → 90%

**Remaining**: Jobs service + AI agents migration

---

## Priority 1: Jobs Service Integration (2 hours) → 95%

### Current State
- ❌ No 30-min cache
- ❌ No saved location support
- ❌ No GPS nearby search
- ⚠️ Basic location message handling exists

### Files to Modify
1. `supabase/functions/wa-webhook-jobs/index.ts`
2. Create: `supabase/functions/wa-webhook-jobs/handlers/location.ts`
3. Migration: Create `nearby_jobs()` RPC

### Implementation Steps

#### Step 1: Create Location Handler (30min)
```typescript
// supabase/functions/wa-webhook-jobs/handlers/location.ts

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function resolveJobLocation(
  supabase: SupabaseClient,
  userId: string
): Promise<{ lat: number; lng: number } | null> {
  // 1. Check 30-min cache
  const { data: cached } = await supabase.rpc('get_cached_location', {
    _user_id: userId,
    _cache_minutes: 30
  });
  
  if (cached && cached[0]?.is_valid) {
    return { lat: cached[0].lat, lng: cached[0].lng };
  }
  
  // 2. Try saved home location
  const { data: saved } = await supabase
    .from('saved_locations')
    .select('lat, lng')
    .eq('user_id', userId)
    .eq('label', 'home')
    .single();
    
  if (saved?.lat && saved?.lng) {
    return { lat: saved.lat, lng: saved.lng };
  }
  
  return null;
}

export async function cacheJobLocation(
  supabase: SupabaseClient,
  userId: string,
  lat: number,
  lng: number
): Promise<void> {
  await supabase.rpc('update_user_location_cache', {
    _user_id: userId,
    _lat: lat,
    _lng: lng
  });
}
```

#### Step 2: Create nearby_jobs() RPC (30min)
```sql
-- supabase/migrations/YYYYMMDDHHMMSS_add_nearby_jobs_rpc.sql

BEGIN;

CREATE OR REPLACE FUNCTION nearby_jobs(
  user_lat FLOAT,
  user_lng FLOAT,
  radius_km FLOAT DEFAULT 50,
  max_results INT DEFAULT 20
)
RETURNS TABLE (
  job_id UUID,
  title TEXT,
  description TEXT,
  location_text TEXT,
  distance_km FLOAT,
  salary_min NUMERIC,
  salary_max NUMERIC,
  currency TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id as job_id,
    j.title,
    j.description,
    j.location as location_text,
    ROUND(
      (ST_DistanceSphere(
        ST_MakePoint(user_lng, user_lat)::geography,
        ST_MakePoint(j.longitude, j.latitude)::geography
      ) / 1000.0)::numeric, 
      2
    ) as distance_km,
    j.salary_min,
    j.salary_max,
    j.currency,
    j.created_at
  FROM jobs j
  WHERE j.status = 'active'
    AND j.latitude IS NOT NULL
    AND j.longitude IS NOT NULL
    AND ST_DWithin(
      ST_MakePoint(user_lng, user_lat)::geography,
      ST_MakePoint(j.longitude, j.latitude)::geography,
      radius_km * 1000
    )
  ORDER BY distance_km ASC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

COMMIT;
```

#### Step 3: Integrate into Jobs Service (1 hour)
```typescript
// supabase/functions/wa-webhook-jobs/index.ts

import { resolveJobLocation, cacheJobLocation } from "./handlers/location.ts";

// When user searches for jobs
async function handleJobSearch(ctx: RouterContext, message: any) {
  let location = null;
  
  // If location shared, cache it
  if (message.location) {
    const lat = message.location.latitude;
    const lng = message.location.longitude;
    await cacheJobLocation(ctx.supabase, ctx.profileId, lat, lng);
    location = { lat, lng };
  } else {
    // Try cache/saved
    location = await resolveJobLocation(ctx.supabase, ctx.profileId);
  }
  
  if (!location) {
    // Prompt for location
    await sendText(ctx.from, 
      "📍 Please share your location to find jobs near you.\n\n" +
      "Or use: Menu → Profile → Saved Locations to set your home."
    );
    return;
  }
  
  // Search with GPS
  const { data: jobs } = await ctx.supabase.rpc('nearby_jobs', {
    user_lat: location.lat,
    user_lng: location.lng,
    radius_km: 50,
    max_results: 20
  });
  
  if (!jobs || jobs.length === 0) {
    await sendText(ctx.from, "No jobs found within 50km of your location.");
    return;
  }
  
  // Display results with distance
  let message = `🔍 Found ${jobs.length} jobs near you:\n\n`;
  jobs.forEach((job, i) => {
    message += `${i+1}. ${job.title}\n`;
    message += `   📍 ${job.distance_km}km away\n`;
    message += `   💰 ${job.salary_min}-${job.salary_max} ${job.currency}\n\n`;
  });
  
  await sendText(ctx.from, message);
}
```

---

## Priority 2: AI Agents Migration (2.5 hours) → 100%

### Current State
- ✅ Infrastructure ready (`location-helper.ts`)
- ✅ `prepareAgentLocation()` utility exists
- ❌ 0/5 agents migrated

### Files to Modify
1. `supabase/functions/wa-webhook-ai-agents/ai-agents/jobs_agent.ts`
2. `supabase/functions/wa-webhook-ai-agents/ai-agents/farmer_agent.ts`
3. `supabase/functions/wa-webhook-ai-agents/ai-agents/business_broker_agent.ts`
4. `supabase/functions/wa-webhook-ai-agents/ai-agents/waiter_agent.ts`
5. `supabase/functions/wa-webhook-ai-agents/ai-agents/real_estate_agent.ts`

### Migration Pattern (30min each)

#### Template for Each Agent
```typescript
import { prepareAgentLocation } from "./location-helper.ts";

export async function execute_<agent>_agent(
  ctx: AgentContext,
  userMessage: string
) {
  // 1. Resolve location FIRST
  const locationResult = await prepareAgentLocation(
    ctx.supabase,
    ctx.userId,
    ctx.userPhone,
    ctx.messageLocation
  );
  
  // 2. Check if location needed but missing
  if (locationResult.needs_prompt) {
    await sendText(ctx.from, locationResult.prompt_message);
    return { 
      success: true, 
      status: "awaiting_location" 
    };
  }
  
  // 3. Use location in agent prompt
  const systemPrompt = `
    You are a ${agent_name}.
    User location: ${locationResult.location.lat}, ${locationResult.location.lng}
    Source: ${locationResult.location.source}
    
    Use this for proximity-based recommendations.
  `;
  
  // 4. Call LLM with location context
  const response = await callGemini(systemPrompt, userMessage, {
    location: locationResult.location
  });
  
  return response;
}
```

#### Agent-Specific Notes

**jobs_agent.ts**:
- Use location for job search radius
- Filter by distance
- Sort by proximity

**farmer_agent.ts**:
- Find nearby markets
- Weather for location
- Local crop prices

**business_broker_agent.ts**:
- Find businesses in area
- Local regulations
- Nearby opportunities

**waiter_agent.ts**:
- Nearby restaurants
- Local events
- Delivery radius

**real_estate_agent.ts**:
- Already partially done
- Finalize GPS search
- Add cache integration

---

## Testing Plan

### Jobs Service Tests (30min)
```bash
# 1. Test cache save
curl -X POST https://.../wa-webhook-jobs \
  -H "Content-Type: application/json" \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "+250788123456",
            "type": "location",
            "location": {
              "latitude": -1.9441,
              "longitude": 30.0619
            }
          }]
        }
      }]
    }]
  }'

# 2. Verify cache
SELECT * FROM user_location_cache 
WHERE user_id = (
  SELECT user_id FROM profiles WHERE whatsapp_e164 = '+250788123456'
)
ORDER BY cached_at DESC LIMIT 1;

# 3. Test nearby search
SELECT * FROM nearby_jobs(-1.9441, 30.0619, 50, 20);
```

### AI Agents Tests (30min)
```bash
# For each agent:
# 1. Send message without location
# 2. Verify prompt for location
# 3. Share location
# 4. Verify cached
# 5. Send another message
# 6. Verify uses cache (no re-prompt)
```

---

## Deployment Commands

### Jobs Service
```bash
# 1. Apply migration
supabase db push

# 2. Verify RPC
supabase db functions list | grep nearby_jobs

# 3. Deploy service
supabase functions deploy wa-webhook-jobs --no-verify-jwt

# 4. Test
curl https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-jobs/health
```

### AI Agents
```bash
# Deploy all agents
supabase functions deploy wa-webhook-ai-agents --no-verify-jwt

# Test
curl https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-ai-agents/health
```

---

## Success Criteria

### Jobs Service ✅ When:
- [ ] Location shared → Cached (30min TTL)
- [ ] Cache used on subsequent requests
- [ ] GPS search returns jobs sorted by distance
- [ ] Saved home location works
- [ ] Tests pass

### AI Agents ✅ When:
- [ ] All 5 agents use `prepareAgentLocation()`
- [ ] Consistent location prompts
- [ ] Cache working across agents
- [ ] Location context in LLM calls
- [ ] Tests pass for each agent

### Overall ✅ When:
- [ ] Coverage: 100% (8/8 services)
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Monitoring working

---

## Time Estimate

| Task | Estimated | Actual |
|------|-----------|--------|
| Jobs location handler | 30min | |
| Jobs nearby_jobs RPC | 30min | |
| Jobs integration | 60min | |
| Jobs testing | 30min | |
| **Jobs Total** | **2h** | |
| | | |
| Migrate jobs_agent | 30min | |
| Migrate farmer_agent | 30min | |
| Migrate business_agent | 30min | |
| Migrate waiter_agent | 30min | |
| Finalize real_estate | 30min | |
| **Agents Total** | **2.5h** | |
| | | |
| **Grand Total** | **4.5h** | |

---

## Quick Reference

### Check Cache
```sql
SELECT user_id, lat, lng, cached_at, 
       EXTRACT(EPOCH FROM (NOW() - cached_at))/60 as age_minutes
FROM user_location_cache
WHERE cached_at > NOW() - INTERVAL '1 hour'
ORDER BY cached_at DESC;
```

### Check Saved Locations
```sql
SELECT user_id, label, lat, lng, created_at
FROM saved_locations
WHERE label = 'home'
ORDER BY created_at DESC
LIMIT 20;
```

### Test GPS Distance
```sql
SELECT 
  ST_DistanceSphere(
    ST_MakePoint(30.0619, -1.9441)::geography,
    ST_MakePoint(30.0734, -1.9536)::geography
  ) / 1000.0 as distance_km;
-- Should return ~1.5km
```

---

## Files Reference

### Location Utilities
- `supabase/functions/_shared/wa-webhook-shared/utils/location-resolver.ts`
- `supabase/functions/wa-webhook-ai-agents/ai-agents/location-helper.ts`
- `supabase/functions/wa-webhook-property/handlers/location-handler.ts`
- `supabase/functions/wa-webhook-unified/core/location-handler.ts`

### Examples (Copy from these)
- Cache integration: `wa-webhook-property/property/rentals.ts` (lines 395-400, 619-624)
- Saved locations: `wa-webhook-marketplace/index.ts` (lines 393-413)
- GPS search: `wa-webhook-mobility/handlers/nearby.ts`

---

## Notes

- All infrastructure is ready ✅
- Patterns are proven and working ✅
- Just need to apply to Jobs + AI agents ✅
- Low risk - following established patterns ✅

---

**Next Session Goal**: 90% → 100% (4.5 hours)  
**Start with**: Jobs service (highest impact)  
**Then**: AI agents (better UX)  
**Result**: Complete location integration across entire platform 🎉
