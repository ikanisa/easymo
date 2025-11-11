# Agent Fallback Migration Guide

## Overview

This guide helps migrate existing agent routes to use the centralized fallback system.

## Benefits of Migration

- ✅ **Consistent behavior** across all agents
- ✅ **Better error messages** for users
- ✅ **Less code duplication** (reduce by ~50 lines per agent)
- ✅ **Automatic ranking** of fallback results
- ✅ **Built-in testing** support with synthetic failures
- ✅ **Easier maintenance** (update one system vs many files)

## Before & After Example

### Before (Old Pattern)

```typescript
// app/api/agents/example/route.ts
const fallbackData = [
  { id: "1", name: "Example 1" },
  { id: "2", name: "Example 2" },
];

function fallback(message: string) {
  return jsonOk({
    items: fallbackData,
    total: fallbackData.length,
    hasMore: false,
    integration: {
      status: "degraded",
      target: "agents_example",
      message,
      remediation: "Check Supabase credentials.",
    },
  });
}

export const GET = createHandler("api.example", async (request) => {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return fallback("Supabase unavailable.");
  }
  
  const { data, error } = await admin.from("items").select("*");
  if (error) {
    return fallback(error.message ?? "Query failed.");
  }
  
  return jsonOk({ items: data });
});
```

### After (New Pattern)

```typescript
// app/api/agents/example/route.ts
import {
  createFallbackResponse,
  classifyError,
  getUserMessage,
  paginateFallback,
} from "@/lib/agents/fallback-system";
import { getFallbackData } from "@/lib/agents/fallback-data";

function fallback(error: any, params?: { limit?: number; offset?: number }) {
  const errorType = classifyError(error);
  const userMessage = getUserMessage(errorType);
  
  const fallbackData = getFallbackData("example");
  const paginated = paginateFallback(fallbackData, params?.limit, params?.offset);
  
  return jsonOk({
    items: paginated.data,
    total: paginated.total,
    hasMore: paginated.hasMore,
    integration: {
      status: "degraded",
      target: "agents_example",
      message: userMessage,
      remediation: "Check Supabase credentials or ensure example view is deployed.",
      timestamp: new Date().toISOString(),
    },
  });
}

export const GET = createHandler("api.example", async (request, _, { recordMetric }) => {
  // Add synthetic failure testing support
  const params = new URL(request.url).searchParams;
  if (params.get("simulateFailure") === "true") {
    recordMetric("agents.example.synthetic_failure", 1);
    return fallback(new Error("Synthetic failure for testing"), {
      limit: Number(params.get("limit")) || undefined,
      offset: Number(params.get("offset")) || undefined,
    });
  }
  
  const admin = getSupabaseAdminClient();
  if (!admin) {
    recordMetric("agents.example.supabase_missing", 1);
    return fallback(new Error("Supabase admin client unavailable."));
  }
  
  const { data, error } = await admin.from("items").select("*");
  if (error) {
    recordMetric("agents.example.supabase_error", 1, { message: error.message });
    return fallback(error);
  }
  
  return jsonOk({ items: data });
});
```

## Migration Steps

### Step 1: Add Imports

```typescript
import {
  createFallbackResponse,
  classifyError,
  getUserMessage,
  paginateFallback,
} from "@/lib/agents/fallback-system";
import { getFallbackData } from "@/lib/agents/fallback-data";
```

### Step 2: Add Mock Data to fallback-data.ts

If your agent type isn't already in `lib/agents/fallback-data.ts`, add it:

```typescript
export const fallbackYourAgent = [
  {
    id: "mock-1",
    // ... your fields
    createdAt: new Date().toISOString(),
  },
  {
    id: "mock-2",
    // ... your fields
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
];

// Add to getFallbackData function
export function getFallbackData(agentType: string): any[] {
  switch (agentType) {
    // ... existing cases
    case "your-agent":
      return fallbackYourAgent;
    // ...
  }
}
```

### Step 3: Replace Fallback Function

Replace your hardcoded fallback function with:

```typescript
function fallback(error: any, params?: { limit?: number; offset?: number }) {
  const errorType = classifyError(error);
  const userMessage = getUserMessage(errorType);
  
  const fallbackData = getFallbackData("your-agent-type");
  const paginated = paginateFallback(fallbackData, params?.limit, params?.offset);
  
  return jsonOk({
    yourDataKey: paginated.data,
    total: paginated.total,
    hasMore: paginated.hasMore,
    integration: {
      status: "degraded",
      target: "agents_your_agent",
      message: userMessage,
      remediation: "Your remediation message here.",
      timestamp: new Date().toISOString(),
    },
  });
}
```

### Step 4: Add Synthetic Failure Support

Add this at the start of your handler:

```typescript
export const GET = createHandler("api.your_agent", async (request, _, { recordMetric }) => {
  let params: z.infer<typeof querySchema>;
  try {
    params = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  } catch (error) {
    return zodValidationError(error);
  }
  
  // Synthetic failure testing
  if (params.simulateFailure) {
    recordMetric("agents.your_agent.synthetic_failure", 1);
    return fallback(new Error("Synthetic failure for testing"), params);
  }
  
  // ... rest of handler
});
```

And add to your schema:

```typescript
const querySchema = z.object({
  // ... existing fields
  simulateFailure: z.coerce.boolean().optional(),
});
```

### Step 5: Update Error Handling

Replace all `return fallback("message")` with `return fallback(error, params)`:

```typescript
// Old
if (!admin) {
  return fallback("Supabase unavailable.");
}

// New
if (!admin) {
  recordMetric("agents.your_agent.supabase_missing", 1);
  return fallback(new Error("Supabase admin client unavailable."), params);
}
```

### Step 6: Test

Test your changes:

```bash
# Test normal operation
curl "http://localhost:3000/api/agents/your-agent"

# Test fallback
curl "http://localhost:3000/api/agents/your-agent?simulateFailure=true"

# Test pagination in fallback
curl "http://localhost:3000/api/agents/your-agent?simulateFailure=true&limit=5&offset=0"

# Run automated tests
npm test -- your-agent
```

## Testing Checklist

- [ ] Normal operation works (real data)
- [ ] Fallback works (`simulateFailure=true`)
- [ ] Pagination works in fallback mode
- [ ] Error messages are user-friendly
- [ ] Metrics are recorded correctly
- [ ] Integration status is correct

## Common Patterns

### Pattern 1: With Search

```typescript
const fallbackData = getFallbackData("your-agent");
const filtered = filterBySearch(fallbackData, params.search, ["name", "description"]);
const paginated = paginateFallback(filtered, params.limit, params.offset);
```

### Pattern 2: With Ranking

```typescript
import { rankItems, scoreItem } from "@/lib/agents/fallback-system";

const fallbackData = getFallbackData("your-agent");
const ranked = rankItems(fallbackData, scoreItem, 10); // Top 10
const paginated = paginateFallback(ranked, params.limit, params.offset);
```

### Pattern 3: Custom Scoring

```typescript
const ranked = rankItems(
  fallbackData,
  (item) => {
    // Custom scoring logic
    const baseScore = scoreItem(item);
    const urgencyBonus = item.urgency === "high" ? 0.2 : 0;
    return baseScore + urgencyBonus;
  },
  20
);
```

## Migration Priority

Migrate in this order:

1. **High-traffic agents** (driver-requests, pharmacy)
2. **Agents with frequent errors** (check logs)
3. **New agents** (use new pattern from start)
4. **Low-traffic agents** (migrate when touching code)

## Rollback Plan

If issues arise:

1. Keep old fallback function commented out
2. Test in dev/staging first
3. Deploy to single agent as canary
4. Monitor metrics for 24h
5. Roll out to remaining agents

## Support

Questions? Check:
- `docs/PHASE_3_FALLBACK_HARDENING.md` - Full documentation
- `lib/agents/fallback-system.ts` - System implementation
- `__tests__/lib/agents/fallback-system.test.ts` - Example usage

---

**Last Updated:** 2025-11-11  
**Status:** Production Ready ✅
