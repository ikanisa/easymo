# AI Agent Location & Intent Standardization
**Date**: 2025-11-26  
**Status**: ✅ IMPLEMENTED  
**Scope**: All AI Agents

---

## Executive Summary

**Critical Requirement**: ALL AI agents MUST follow standardized location resolution and intent extraction before processing user requests.

**Two Standard Processes**:
1. **Location Resolution** (Priority: Cache → Saved → Prompt)
2. **Intent Extraction** (Natural language → Metadata)

---

## 1. Location Resolution Standard

### Priority Order (MUST Follow)

```
1. Fresh Shared Location (if user just shared)
   ↓
2. 30-Minute Cached Location
   ↓
3. Saved Location (Home/Work based on agent type)
   ↓
4. Prompt User to Share Location
```

### Agent-Specific Location Preferences

| Agent Type | Preferred Location | Rationale |
|------------|-------------------|-----------|
| jobs_agent | **home** | Job seeker lives here |
| farmer_agent | **home** | Farm location |
| real_estate_agent | **home** | Where user lives/wants to live |
| business_broker_agent | **cache_first** | Current location for nearby businesses |
| rides_agent | **cache_first** | Current location for pickup |
| marketplace | **cache_first** | Current location for nearby items |
| waiter_agent | **cache_first** | Current location for restaurants |

### Configuration File

**File**: `supabase/functions/_shared/wa-webhook-shared/utils/location-resolver.ts`

```typescript
export const LOCATION_PREFERENCES = {
  jobs_agent: 'home',           // Use saved home location
  farmer_agent: 'home',          // Use farm (home) location
  real_estate_agent: 'home',     // Use home location
  business_broker_agent: 'cache_first', // Use current
  rides_agent: 'cache_first',    // Use current
  marketplace: 'cache_first',    // Use current
  waiter_agent: 'cache_first',   // Use current
};
```

---

## 2. Implementation Guide

### Step 1: Import Location Integration

```typescript
import { 
  prepareAgentLocation,
  formatLocationContext,
  type AgentLocationContext 
} from "../_shared/wa-webhook-shared/ai-agents/location-integration.ts";
```

### Step 2: Resolve Location Before Processing

```typescript
// In your agent's process() or execute() method
const locationCtx = await prepareAgentLocation({
  userId: ctx.profileId,
  userPhone: ctx.from,
  supabase: ctx.supabase,
  agentType: 'jobs_agent',  // Your agent type
  intent: 'job_search',      // Optional intent
  sharedLocation: message.location ? {
    lat: message.location.latitude,
    lng: message.location.longitude,
  } : undefined,
}, {
  agentType: 'jobs_agent',
  intent: 'job_search',
  requireLocation: true, // Set false if location is optional
});

// If null, user was prompted to share location
if (!locationCtx) {
  return true; // Exit gracefully
}

// Use location for your search
const results = await searchNearby(
  locationCtx.location.lat,
  locationCtx.location.lng
);
```

### Step 3: Show Location Context to User

```typescript
const locationMsg = formatLocationContext(locationCtx);
// Returns: "📍 Using your home location: Kigali, Rwanda"
// Or: "📍 Using your recent location (5 mins ago)"

await sendText(userPhone, locationMsg);
```

---

## 3. Location Resolution API

### Main Function: `resolveUserLocation()`

```typescript
const resolution = await resolveUserLocation(
  supabase,
  userId,
  {
    agentType: 'jobs_agent',
    intent: 'job_search',
    preferredLabel: 'home', // Optional override
  },
  30 // Cache validity in minutes
);
```

**Returns**:
```typescript
{
  location: {
    lat: number,
    lng: number,
    source: 'cache' | 'saved' | 'shared',
    label?: 'home' | 'work' | 'school',
    address?: string,
    cached_at?: string
  } | null,
  needsPrompt: boolean,
  promptMessage?: string,
  availableSaved?: Array<{label: string; address?: string}>
}
```

### Helper: `saveLocationToCache()`

```typescript
// Save fresh location to 30-minute cache
await saveLocationToCache(supabase, userId, lat, lng);
```

### Helper: `getUserSavedLocations()`

```typescript
const saved = await getUserSavedLocations(supabase, userId);
// Returns: [{label: 'home', lat: -1.9, lng: 30.0, address: 'Kigali'}]
```

---

## 4. Intent Extraction Standard

### Purpose
Convert natural language user messages into simple metadata that agents can process.

### Implementation

```typescript
import { extractUserIntent } from "../_shared/wa-webhook-shared/ai-agents/location-integration.ts";

const intent = extractUserIntent(userMessage, 'jobs_agent');
// Returns: { action: 'search', keywords: ['find', 'looking for'] }
```

### Supported Actions

| Action | Keywords | Use Case |
|--------|----------|----------|
| **search** | find, search, looking for, show me, need, want | Find/browse items |
| **list** | list, my, view my, show my | View user's own items |
| **create** | post, add, create, register, sell | Create new listings |
| **update** | edit, update, change, modify | Edit existing items |
| **delete** | delete, remove, cancel | Remove items |

---

## 5. Complete Agent Integration Example

### Jobs Agent - Full Implementation

```typescript
export class JobsAgent {
  async process(message: string, ctx: RouterContext): Promise<string> {
    // STEP 1: Resolve Location
    const locationCtx = await prepareAgentLocation({
      userId: ctx.profileId,
      userPhone: ctx.from,
      supabase: ctx.supabase,
      agentType: 'jobs_agent',
      sharedLocation: ctx.sharedLocation,
    }, {
      agentType: 'jobs_agent',
      requireLocation: true,
    });
    
    if (!locationCtx) {
      // User was prompted to share location
      return ""; // Return empty, already sent prompt
    }
    
    // STEP 2: Extract Intent
    const intent = extractUserIntent(message, 'jobs_agent');
    
    // STEP 3: Process Based on Intent & Location
    let results;
    switch (intent.action) {
      case 'search':
        results = await this.searchJobs(
          locationCtx.location.lat,
          locationCtx.location.lng,
          message // Original query for filtering
        );
        break;
      
      case 'list':
        results = await this.getMyJobs(ctx.profileId);
        break;
      
      case 'create':
        results = await this.createJobListing(ctx.profileId, message);
        break;
      
      default:
        results = await this.searchJobs(
          locationCtx.location.lat,
          locationCtx.location.lng,
          message
        );
    }
    
    // STEP 4: Format Response with Location Context
    const locationMsg = formatLocationContext(locationCtx);
    const response = `${locationMsg}\n\n${results}`;
    
    return response;
  }
}
```

---

## 6. Database Functions Required

### Already Implemented ✅

1. **`update_user_location_cache(user_id, lat, lng)`**
   - Saves location with 30-minute TTL
   - Updates `profiles.last_location` and `last_location_at`

2. **`get_cached_location(user_id, cache_minutes)`**
   - Returns cached location if valid (<30 mins)
   - Returns `{lat, lng, cached_at, is_valid}`

3. **`saved_locations` table**
   - Stores user's saved locations (home/work/school/other)
   - Columns: `user_id`, `label`, `lat`, `lng`, `address`

---

## 7. User Experience Flow

### Scenario 1: First-Time User (No Cached/Saved Location)

```
User: "Show me jobs near me"
  ↓
Agent: Checks cache → Not found
  ↓
Agent: Checks saved locations → None
  ↓
Agent: "📍 To find jobs near you, please share your location or save your home address in Profile → Saved Locations."
  ↓
User: [Shares location]
  ↓
Agent: Saves to 30-min cache
  ↓
Agent: "📍 Using your current location

Found 5 jobs near you:
1. Driver - 0.8km away - 150k RWF/month
2. ..."
```

### Scenario 2: Returning User (Cached Location Valid)

```
User: "Find apartments"
  ↓
Agent: Checks cache → Found (15 mins old)
  ↓
Agent: "📍 Using your recent location (15 mins ago)

Found 3 apartments near you:
1. 2BR in Kimihurura (1.2km) - 200k RWF
2. ..."
```

### Scenario 3: User with Saved Home Location

```
User: "Jobs near me"
  ↓
Agent: Checks cache → Expired (35 mins old)
  ↓
Agent: Checks saved → Found 'home' location
  ↓
Agent: "📍 Using your home location: Kigali, Nyarugenge

Found 8 jobs near your home:
1. Security Guard (0.5km) - 100k RWF
2. ..."
```

---

## 8. Migration Checklist for Existing Agents

### For Each Agent:

- [ ] Import location integration helper
- [ ] Call `prepareAgentLocation()` before processing
- [ ] Handle null return (user prompted)
- [ ] Use location context in search/queries
- [ ] Format location context in response
- [ ] Import intent extraction (optional but recommended)
- [ ] Process based on extracted intent
- [ ] Test with all 3 location sources (cache/saved/fresh)

### Agents to Update:

- [ ] jobs_agent.ts
- [ ] farmer_agent.ts
- [ ] business_broker_agent.ts
- [ ] waiter_agent (sales_agent.ts)
- [x] real_estate_agent.ts (GPS search added, needs standardization)

---

## 9. Testing Guide

### Test Cases

1. **Cache Hit** (Location shared <30 mins ago)
   - User shares location
   - Immediately asks for nearby items
   - Verify: Uses cached location, no prompt

2. **Cache Expired** (Location >30 mins old)
   - User shared location 31 mins ago
   - Asks for nearby items
   - Verify: Falls back to saved location or prompts

3. **Saved Location** (Home location saved)
   - User has home location saved
   - No recent cache
   - Asks for jobs
   - Verify: Uses saved home location

4. **No Location** (First time, no cache/saved)
   - New user
   - Asks for nearby items
   - Verify: Prompted to share location

5. **Fresh Share**
   - User shares location as first message
   - Verify: Saved to cache and used immediately

---

## 10. Performance Expectations

### Latency Targets

- Cache lookup: <50ms
- Saved location lookup: <100ms
- Total location resolution: <150ms
- GPS search (nearby): <200ms

### Cache Hit Rates (Expected)

- Active users: 70% cache hit rate
- New users: 30% saved location, 70% prompt
- Overall: 50% cache, 20% saved, 30% prompt

---

## 11. Files Reference

### Core Files

1. **Location Resolver**
   - `supabase/functions/_shared/wa-webhook-shared/utils/location-resolver.ts`
   - Main location resolution logic
   - 300+ lines, fully documented

2. **Location Integration**
   - `supabase/functions/_shared/wa-webhook-shared/ai-agents/location-integration.ts`
   - Agent-specific helpers
   - prepareAgentLocation(), formatLocationContext()

3. **Database Migrations**
   - `20251124000001_location_caching_driver_notifications.sql`
   - `20251125183621_mobility_core_tables.sql`
   - `20251126090000_nearby_properties_function.sql`

---

## 12. Monitoring & Logging

### Key Metrics to Track

```typescript
// Log location source for analytics
logStructuredEvent("AGENT_LOCATION_RESOLVED", {
  agent: 'jobs_agent',
  source: locationCtx.metadata.source, // cache | saved | shared
  label: locationCtx.metadata.label,    // home | work | null
  cache_age_minutes: calculateAge(locationCtx.location.cached_at),
});
```

### Dashboard Metrics

- Location source distribution (cache/saved/fresh)
- Cache hit rate by agent type
- Average cache age when used
- Prompt rate (how often users need to share)

---

## 13. Error Handling

### Graceful Degradation

```typescript
try {
  const locationCtx = await prepareAgentLocation(ctx, config);
  // ... use location
} catch (error) {
  console.error('location_resolution_failed', error);
  
  // Fallback: Prompt user
  await sendText(userPhone, 
    "📍 Please share your location to continue.");
  return null;
}
```

### Non-Blocking Cache Failures

- Cache save failures don't block execution
- Cache lookup failures fall through to saved locations
- All errors logged but don't crash agent

---

## 14. Future Enhancements

### Planned Features

1. **Location History** (Last 5 locations with timestamps)
2. **Auto-label Detection** (Detect home/work from usage patterns)
3. **Location Suggestions** ("You're near your saved work location")
4. **Radius Preferences** (Save search radius per agent)

---

## Conclusion

**Status**: ✅ STANDARDIZATION COMPLETE

**Implementation Required**: All agents must adopt this standard

**Estimated Migration Time**: 30 minutes per agent (5 agents = 2.5 hours)

**Benefits**:
- Consistent UX across all agents
- Reduced location prompts (30-min cache)
- Better search relevance (GPS-based)
- Simplified agent code (shared utilities)

---

**Document Version**: 1.0  
**Last Updated**: 2025-11-26  
**Status**: Production ready, migration in progress
