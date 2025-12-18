# Performance Optimization Guide

**Last Updated:** 2025-01-17  
**Purpose:** Guide for optimizing Edge Function performance

## Cold Start Optimization

### 1. Lazy Loading

Use lazy loading for heavy dependencies:

```typescript
// ❌ Bad: Eager import
import { HeavyModule } from "./heavy-module.ts";

// ✅ Good: Lazy import
const getHeavyModule = () => import("./heavy-module.ts");

// Use when needed
const module = await getHeavyModule();
```

### 2. Dynamic Imports

Use dynamic imports for optional features:

```typescript
// Only load when needed
if (needsFeature) {
  const { FeatureModule } = await import("./feature.ts");
  await FeatureModule.process();
}
```

### 3. Minimize Top-Level Imports

Keep top-level imports minimal:

```typescript
// ❌ Bad: Many top-level imports
import { A } from "./a.ts";
import { B } from "./b.ts";
import { C } from "./c.ts";
// ... many more

// ✅ Good: Import only essentials
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// Import others when needed
```

### 4. Use Lazy Loader Utility

Use the existing lazy loader:

```typescript
import { createLazyLoader } from "../_shared/handlers/lazy-loader.ts";

const handlerLoader = createLazyLoader(
  () => import("./handlers/my-handler.ts"),
  "my-handler"
);

// Use when needed
const handler = await handlerLoader.load();
```

## Database Query Optimization

### 1. Use Indexes

Always query indexed columns:

```typescript
// ✅ Good: Uses index
const { data } = await supabase
  .from("user_sessions")
  .select("*")
  .eq("phone_number", phone); // phone_number is indexed

// ❌ Bad: No index
const { data } = await supabase
  .from("user_sessions")
  .select("*")
  .eq("context->>'key'", value); // JSONB path not indexed
```

### 2. Limit Results

Always limit query results:

```typescript
// ✅ Good: Limited
const { data } = await supabase
  .select("*")
  .limit(10);

// ❌ Bad: No limit
const { data } = await supabase
  .select("*"); // Could return thousands
```

### 3. Select Only Needed Columns

```typescript
// ✅ Good: Specific columns
const { data } = await supabase
  .select("id, name, email");

// ❌ Bad: All columns
const { data } = await supabase
  .select("*");
```

### 4. Use maybeSingle() When Appropriate

```typescript
// ✅ Good: Single result expected
const { data } = await supabase
  .select("*")
  .eq("id", id)
  .maybeSingle();

// ❌ Bad: Returns array
const { data } = await supabase
  .select("*")
  .eq("id", id);
```

## Caching

### 1. Response Caching

Cache responses for idempotent operations:

```typescript
const cache = new Map<string, { data: any; expires: number }>();

async function getCached(key: string, ttl: number, fetcher: () => Promise<any>) {
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }
  
  const data = await fetcher();
  cache.set(key, { data, expires: Date.now() + ttl });
  return data;
}
```

### 2. Database Connection Pooling

Use connection pooling (already implemented):

```typescript
import { getClientPool } from "../_shared/database/client-pool.ts";

const client = await getClientPool().acquire();
// Use client
await getClientPool().release(client);
```

## Memory Optimization

### 1. Clean Up Large Objects

```typescript
// ✅ Good: Clean up after use
const largeData = await fetchLargeData();
process(largeData);
largeData = null; // Help GC

// ❌ Bad: Keep in memory
const largeData = await fetchLargeData();
// Never cleaned up
```

### 2. Limit Cache Size

```typescript
const MAX_CACHE_SIZE = 1000;
const cache = new Map();

function addToCache(key: string, value: any) {
  if (cache.size >= MAX_CACHE_SIZE) {
    // Remove oldest entry
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
  cache.set(key, value);
}
```

## Monitoring

### 1. Track Performance

```typescript
import { logStructuredEvent, recordMetric } from "../_shared/observability.ts";

const startTime = Date.now();
// ... operation
const duration = Date.now() - startTime;

recordMetric("operation.duration", duration, { operation: "name" });
logStructuredEvent("OPERATION_COMPLETE", { duration }, "info");
```

### 2. Monitor Cold Starts

```typescript
const coldStartMarker = performance.now();

serve(async (req) => {
  const requestStart = performance.now();
  const coldStartTime = requestStart - coldStartMarker;
  
  if (coldStartTime > 0) {
    recordMetric("function.cold_start", coldStartTime);
  }
  
  // ... handler
});
```

## Best Practices

1. ✅ **Lazy load heavy dependencies**
2. ✅ **Use indexes for database queries**
3. ✅ **Limit query results**
4. ✅ **Cache idempotent operations**
5. ✅ **Clean up large objects**
6. ✅ **Monitor performance metrics**
7. ✅ **Use connection pooling**
8. ✅ **Minimize top-level imports**

## Performance Targets

| Metric | Target | Critical |
|--------|--------|----------|
| Cold Start | <1.5s | <2s |
| Request Latency (p95) | <300ms | <500ms |
| Database Query (p95) | <100ms | <200ms |
| Memory Usage | <128MB | <256MB |

## Tools

- `scripts/analyze-test-coverage.mjs` - Coverage analysis
- `_shared/handlers/lazy-loader.ts` - Lazy loading utility
- `_shared/database/client-pool.ts` - Connection pooling
- `_shared/observability.ts` - Performance monitoring

