# AI Agents Location Integration - Migration Guide

**Status**: IN PROGRESS  
**Phase**: 1 - Priority 2  
**Estimated Time**: 2.5 hours  
**Progress**: 1/5 agents complete (20%)  

---

## 📊 Overview

Migrating all AI agents to use standardized location utilities from `location-helper.ts`.

### Goals
1. Replace text-based location searches with GPS-based proximity search
2. Integrate 30-minute location cache
3. Use saved locations (home/work/school)
4. Provide consistent location prompts across all agents
5. Enable distance-based result sorting

---

## ✅ Completed Agents

### 1. jobs_agent.ts ✅ (20% complete)

**Changes Made**:
- ✅ Added `AgentLocationHelper` import
- ✅ Created `locationHelper` instance
- ✅ Updated `search_jobs` tool to use GPS search
- ✅ Added automatic location resolution (cache → saved → prompt)
- ✅ Integrated with `search_nearby_jobs()` RPC
- ✅ Fallback to text search if GPS unavailable
- ✅ Added distance display in results

**Before**:
```typescript
search_jobs(role, location, min_salary, job_type)
// Text-based location search: .ilike('location', '%Kigali%')
```

**After**:
```typescript
search_jobs(user_id, role, min_salary, job_type, radius_km)
// GPS search: search_nearby_jobs(lat, lng, radius_km)
// Automatic location resolution
// Distance shown in km
```

**Impact**:
- Users get jobs sorted by distance
- Automatic location caching (30min)
- Saved home location support
- Better relevance for job seekers

---

## ⏳ Pending Agents

### 2. farmer_agent.ts (NEXT - 30min)

**Current State**: Uses text-based location
**Migration Plan**:
1. Add `AgentLocationHelper` import
2. Update `search_markets` tool
3. Update `search_suppliers` tool  
4. Update `get_farm_advice` tool (optional - location context)
5. Add location-aware crop pricing

**Tools to Update**:
- `search_agricultural_markets` → Use GPS search
- `find_suppliers` → Distance-based sorting
- `get_crop_prices` → Location-specific pricing

**Expected Impact**:
- Farmers find nearest markets/suppliers
- Distance-based routing to markets
- Location-specific pricing data

---

### 3. business_broker_agent.ts (30min)

**Current State**: No location integration
**Migration Plan**:
1. Add `AgentLocationHelper` import
2. Create `search_businesses` tool (GPS-based)
3. Add location prompts
4. Integrate with `search_nearby_businesses()` RPC (needs creation)

**Tools to Create/Update**:
- `search_businesses_for_sale` → GPS search
- `find_commercial_properties` → Distance sorting
- `get_business_valuations` → Location-based

**Expected Impact**:
- Buyers find businesses in their area
- Sellers reach local buyers
- Location-specific market insights

---

### 4. waiter_agent.ts (30min)

**Current State**: Basic implementation, no location
**Migration Plan**:
1. Add `AgentLocationHelper` import
2. Update `search_restaurants` tool
3. Update `find_job_openings` tool
4. Add location-based recommendations

**Tools to Update**:
- `search_restaurant_jobs` → GPS search
- `find_restaurants` → Distance sorting
- `get_restaurant_recommendations` → Nearby suggestions

**Expected Impact**:
- Restaurant workers find nearby jobs
- Location-based restaurant discovery
- Commute distance considerations

---

### 5. real_estate_agent.ts (30min)

**Current State**: Partial location integration
**Migration Plan**:
1. Verify `AgentLocationHelper` usage
2. Ensure `search_properties` uses GPS
3. Standardize location prompts
4. Test with `search_nearby_properties()` RPC

**Tools to Verify/Update**:
- `search_properties` → Verify GPS integration
- `get_property_details` → Add distance context
- `schedule_viewing` → Location-aware scheduling

**Expected Impact**:
- Buyers see properties by distance
- Better property discovery
- Location context in all searches

---

## 📁 Files

### Created
1. ✅ `ai-agents/location-helper.ts` (11.4 KB)
   - `AgentLocationHelper` class
   - Standard location resolution
   - Location prompts (EN/FR/RW)
   - GPS search helpers

### Modified
1. ✅ `ai-agents/jobs_agent.ts` (+120 lines)
   - Location-aware job search
   - GPS integration
   - Distance display

### Pending
2. ⏳ `ai-agents/farmer_agent.ts`
3. ⏳ `ai-agents/business_broker_agent.ts`
4. ⏳ `ai-agents/waiter_agent.ts`
5. ⏳ `ai-agents/real_estate_agent.ts`

---

## 🔧 Standard Migration Pattern

### Step 1: Import Helper
```typescript
import { AgentLocationHelper } from "./location-helper.ts";
```

### Step 2: Add to Constructor
```typescript
export class YourAgent {
  private locationHelper: AgentLocationHelper;
  
  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.locationHelper = new AgentLocationHelper(supabase);
  }
}
```

### Step 3: Update Search Tool
```typescript
{
  name: 'search_items',
  description: 'Search for items near user location',
  parameters: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'User ID for location lookup' },
      radius_km: { type: 'number', default: 50 },
      // ... other filters
    },
    required: ['user_id']
  },
  execute: async (params) => {
    // Resolve location
    const locationResult = await this.locationHelper.resolveUserLocation(
      params.user_id,
      'your_agent'
    );

    if (!locationResult.location) {
      return {
        message: 'Please share your location to search nearby.',
        needs_location: true,
      };
    }

    // GPS search
    const { data, error } = await this.supabase.rpc('search_nearby_items', {
      _lat: locationResult.location.lat,
      _lng: locationResult.location.lng,
      _radius_km: params.radius_km || 50,
      _limit: 20,
    });

    return {
      count: data?.length || 0,
      location_context: this.locationHelper.formatLocationContext(locationResult.location),
      items: data,
    };
  }
}
```

---

## 🧪 Testing Checklist

For each agent:
- [ ] Location prompt appears when no location available
- [ ] Cached location is used (30min TTL)
- [ ] Saved home location is used
- [ ] GPS search returns distance
- [ ] Results sorted by distance
- [ ] Fallback to text search works
- [ ] Multilingual prompts work (EN/FR/RW)

---

## 📊 Progress Tracking

| Agent | Status | Time | GPS Search | Cache | Saved Loc | Prompts |
|-------|--------|------|------------|-------|-----------|---------|
| jobs_agent | ✅ Done | 30min | ✅ | ✅ | ✅ | ✅ |
| farmer_agent | ⏳ Next | 30min | ⏳ | ⏳ | ⏳ | ⏳ |
| business_broker | ⏳ Pending | 30min | ❌ | ❌ | ❌ | ❌ |
| waiter_agent | ⏳ Pending | 30min | ❌ | ❌ | ❌ | ❌ |
| real_estate | ⏳ Pending | 30min | ⚠️ | ❌ | ❌ | ❌ |

**Overall**: 20% complete (1/5 agents)

---

## 🎯 Success Criteria

- [ ] All 5 agents use `AgentLocationHelper`
- [ ] All agents support GPS-based search
- [ ] All agents use 30-min location cache
- [ ] All agents support saved locations
- [ ] All agents have multilingual prompts
- [ ] All distance results show in km
- [ ] Fallback to text search works

---

## 📝 Next Steps

1. **Now**: Migrate farmer_agent (30min)
2. **Then**: Migrate business_broker_agent (30min)
3. **Then**: Migrate waiter_agent (30min)
4. **Then**: Finalize real_estate_agent (30min)
5. **Finally**: Test all agents (30min)

**Total Time Remaining**: 2 hours

---

## 🚀 Deployment

After all migrations:
```bash
supabase functions deploy wa-webhook-ai-agents --no-verify-jwt
```

Test each agent:
```bash
# Test jobs agent
curl -X POST .../wa-webhook-ai-agents \
  -d '{"agent": "jobs", "message": "find jobs", "phone": "+250..."}'

# Test farmer agent  
curl -X POST .../wa-webhook-ai-agents \
  -d '{"agent": "farmer", "message": "find markets", "phone": "+250..."}'
```

---

**Status**: jobs_agent migration complete ✅  
**Next**: farmer_agent migration  
**ETA**: 2 hours remaining  
