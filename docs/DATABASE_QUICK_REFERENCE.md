# Database Schema Enhancements - Quick Reference

Quick reference guide for developers using the new database schema enhancements.

## Table of Contents

- [Recording Metrics](#recording-metrics)
- [Logging Audit Events](#logging-audit-events)
- [Feature Flags](#feature-flags)
- [WhatsApp Sessions](#whatsapp-sessions)
- [Transactions](#transactions)
- [Event Sourcing](#event-sourcing)
- [Background Jobs](#background-jobs)
- [Caching](#caching)
- [Location Queries](#location-queries)
- [Farm Verification & Shipments](#farm-verification--shipments)

---

## Recording Metrics

**Record a metric from any service:**

```typescript
// Edge Function (Deno)
await supabase.rpc("record_metric", {
  p_service_name: "wa-webhook-core",
  p_metric_type: "latency",
  p_metric_name: "message_processing",
  p_value: 125,
  p_unit: "ms",
  p_tags: { message_type: "text", status: "success" },
});

// Node.js Microservice
await supabase.rpc("record_metric", {
  p_service_name: "wallet-service",
  p_metric_type: "throughput",
  p_metric_name: "transactions_processed",
  p_value: 1,
  p_unit: "count",
});
```

**View recent metrics:**

```sql
SELECT * FROM recent_metrics_by_service;
```

---

## Logging Audit Events

**Log a user action:**

```typescript
await supabase.rpc("log_audit_event", {
  p_actor_type: "user",
  p_actor_identifier: userId,
  p_action: "wallet_transfer",
  p_resource_type: "transaction",
  p_resource_id: transactionId,
  p_metadata: { amount: 1000, currency: "RWF" },
  p_correlation_id: req.headers["x-correlation-id"],
});
```

**Log a service action:**

```typescript
await supabase.rpc("log_audit_event", {
  p_actor_type: "service",
  p_actor_identifier: "mobility-orchestrator",
  p_action: "driver_matched",
  p_resource_type: "trip",
  p_resource_id: tripId,
  p_metadata: { driver_id: driverId, distance_km: 2.5 },
  p_correlation_id: correlationId,
});
```

---

## Feature Flags

**Check if feature is enabled for user:**

```typescript
const isEnabled = await supabase.rpc("is_feature_enabled", {
  p_flag_key: "new_checkout_flow",
  p_user_id: userId,
  p_environment: "production",
});

if (isEnabled) {
  // Use new feature
  return newCheckoutFlow();
} else {
  // Use existing implementation
  return legacyCheckoutFlow();
}
```

**Create a new feature flag:**

```sql
INSERT INTO feature_flags (
  key, name, description, enabled,
  rollout_strategy, rollout_percentage, environment
) VALUES (
  'video_calls',
  'Video Calling Feature',
  'Enable video calls between users',
  true,
  'percentage',
  10,  -- Start with 10% rollout
  'production'
);
```

**Update rollout percentage:**

```sql
UPDATE feature_flags
SET rollout_percentage = 50
WHERE key = 'video_calls';
```

**View active feature flags:**

```sql
SELECT * FROM feature_flag_overview;
```

---

## WhatsApp Sessions

**Update session activity:**

```typescript
// Called when processing a WhatsApp message
await supabase.rpc("update_whatsapp_session_activity", {
  p_phone_number: "+250788123456",
  p_increment_message_count: true,
});
```

**Enqueue an outbound message:**

```typescript
const messageId = await supabase.rpc("enqueue_whatsapp_message", {
  p_recipient_phone: "+250788123456",
  p_message_type: "text",
  p_message_payload: {
    text: "Your ride has been confirmed!",
    preview_url: false,
  },
  p_priority: 7, // High priority (1-10 scale)
  p_correlation_id: tripId,
});
```

**Check session statistics:**

```sql
SELECT * FROM whatsapp_session_stats;
SELECT * FROM whatsapp_queue_stats;
```

---

## Transactions

**Create a transaction with idempotency:**

```typescript
const txnId = await supabase.rpc("create_transaction", {
  p_user_id: userId,
  p_type: "payment",
  p_amount: 1000.0,
  p_currency: "RWF",
  p_idempotency_key: `order-payment-${orderId}`,
  p_metadata: {
    order_id: orderId,
    payment_method: "mobile_money",
    provider: "mtn_momo",
  },
});
```

**Update transaction status:**

```typescript
// When payment is confirmed
await supabase.rpc("update_transaction_status", {
  p_transaction_id: txnId,
  p_new_status: "completed",
});

// When payment fails
await supabase.rpc("update_transaction_status", {
  p_transaction_id: txnId,
  p_new_status: "failed",
  p_error_message: "Insufficient funds",
});
```

**View transaction summary:**

```sql
SELECT * FROM transaction_summary;
SELECT * FROM user_recent_transactions WHERE user_id = '...';
```

---

## Event Sourcing

**Append an event:**

```typescript
// Trip started event
await supabase.rpc("append_event", {
  p_aggregate_id: tripId,
  p_aggregate_type: "trip",
  p_event_type: "trip_started",
  p_payload: {
    driver_id: driverId,
    passenger_id: passengerId,
    pickup_location: { lat: -1.9536, lng: 30.0606 },
    started_at: new Date().toISOString(),
  },
  p_correlation_id: correlationId,
  p_metadata: { source: "mobile_app", version: "2.1.0" },
});

// Driver arrived event
await supabase.rpc("append_event", {
  p_aggregate_id: tripId,
  p_aggregate_type: "trip",
  p_event_type: "driver_arrived",
  p_payload: {
    arrived_at: new Date().toISOString(),
    location: { lat: -1.9536, lng: 30.0606 },
  },
  p_correlation_id: correlationId,
});
```

**Reconstruct aggregate state from events:**

```typescript
// Get all events for a trip
const { data: events } = await supabase.rpc("get_aggregate_events", {
  p_aggregate_type: "trip",
  p_aggregate_id: tripId,
  p_limit: 100,
});

// Replay events to build current state
let tripState = { status: "pending" };
for (const event of events) {
  switch (event.event_type) {
    case "trip_started":
      tripState = { ...tripState, status: "active", ...event.payload };
      break;
    case "driver_arrived":
      tripState = { ...tripState, driver_arrived_at: event.payload.arrived_at };
      break;
    case "trip_completed":
      tripState = { ...tripState, status: "completed", ...event.payload };
      break;
  }
}
```

**View event statistics:**

```sql
SELECT * FROM event_store_stats;
```

---

## Background Jobs

**Schedule a job:**

```typescript
const jobId = await supabase.rpc("schedule_job", {
  p_job_type: "send_notification",
  p_job_name: "Trip reminder notification",
  p_payload: {
    user_id: userId,
    trip_id: tripId,
    notification_type: "trip_reminder",
  },
  p_scheduled_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
  p_priority: 5,
  p_idempotency_key: `trip-reminder-${tripId}`,
});
```

**Mark job as completed:**

```typescript
await supabase.rpc("complete_job", {
  p_job_id: jobId,
  p_result: {
    notification_sent: true,
    sent_at: new Date().toISOString(),
  },
});
```

**View job statistics:**

```sql
SELECT * FROM background_job_stats;

-- Check pending jobs
SELECT * FROM background_jobs
WHERE status = 'pending'
ORDER BY priority DESC, scheduled_at
LIMIT 10;
```

---

## Caching

**Set a cache value:**

```typescript
await supabase.rpc("set_cache", {
  p_key: "user_preferences:" + userId,
  p_value: { theme: "dark", language: "en", notifications: true },
  p_ttl_seconds: 3600, // 1 hour
  p_cache_type: "user_data",
  p_tags: ["user:" + userId, "preferences"],
});
```

**Get a cache value:**

```typescript
const { data: cachedValue } = await supabase.rpc('get_cache', {
  p_key: 'user_preferences:' + userId
});

if (cachedValue) {
  return cachedValue;
} else {
  // Cache miss, fetch from source
  const preferences = await fetchUserPreferences(userId);
  // Store in cache for next time
  await supabase.rpc('set_cache', {...});
  return preferences;
}
```

**Invalidate cache by tag:**

```typescript
// When user updates preferences, invalidate all user caches
await supabase.rpc("invalidate_cache_by_tag", {
  p_tag: "user:" + userId,
});
```

**View cache statistics:**

```sql
SELECT * FROM cache_stats;
```

---

## Location Queries

**Find nearby locations:**

```typescript
// Find nearby pickup points
const { data: nearbyLocations } = await supabase.rpc("find_nearby_locations", {
  p_lat: -1.9536,
  p_lng: 30.0606,
  p_radius_meters: 5000, // 5km radius
  p_location_type: "pickup",
  p_limit: 20,
});

// Results include distance in meters
nearbyLocations.forEach((loc) => {
  console.log(`${loc.address} - ${loc.distance_meters}m away`);
});
```

**Get cached route:**

```typescript
// Check if route is cached (within 100m of endpoints)
const { data: cachedRoute } = await supabase.rpc('get_cached_route', {
  p_origin_lat: -1.9536,
  p_origin_lng: 30.0606,
  p_dest_lat: -1.9706,
  p_dest_lng: 30.1044,
  p_max_age_minutes: 60  // Only use cache if less than 1 hour old
});

if (cachedRoute && cachedRoute.length > 0) {
  // Use cached route
  const route = cachedRoute[0];
  return {
    distance_meters: route.distance_meters,
    duration_seconds: route.duration_seconds,
    polyline: route.route_polyline
  };
} else {
  // Fetch from routing API and cache
  const route = await fetchFromGoogleMaps(...);
  // Store in cache...
  return route;
}
```

---

## Farm Verification & Shipments

**Store verification artifacts + create a farm profile:**

```typescript
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

await supabase.storage
  .from("verification-artifacts")
  .upload(`farms/${farmId}/national-id.jpg`, fileBlob, { upsert: true });

await supabase.from("farms").insert({
  id: farmId,
  owner_profile_id: userId,
  name: "Kigali Fresh Produce",
  momo_number: "+2507XXXXXXX",
  momo_name: "Aline Mukamana",
  id_document_path: `farms/${farmId}/national-id.jpg`,
  id_verification_status: "pending",
  momo_verification_status: "pending",
});
```

**Schedule a pickup (photo proof required):**

```typescript
await supabase.rpc("schedule_pickup", {
  p_farm_id: farmId,
  p_listing_id: listingId,
  p_pickup_at: new Date().toISOString(),
  p_pickup_photo_path: `pickup-photos/${farmId}/${Date.now()}.jpg`,
  p_pickup_address: "Gahanga collection point",
  p_pickup_lat: -1.939,
  p_pickup_lng: 30.1,
  p_quantity_committed: 1200,
  p_metadata: { commodity: "tomatoes", unit: "kg" },
});
```

**Ops dashboards + metrics:**

- Query `public.ops_pickup_metrics` for daily fill rate, spoilage, deposit success and pickup
  utilization.
- `monitoring/operations-metrics.sql` ships ready-made spoilage, deposit and utilization queries.
- `monitoring/operations-dashboard.json` plugs those queries into the monitoring stack so ops can
  review fulfillment health next to webhook alerts.

---

## Service Registry

**Register a service:**

```typescript
// Called at service startup
const serviceId = await supabase.rpc("register_service", {
  p_service_name: "wallet-service",
  p_service_type: "microservice",
  p_version: "2.1.0",
  p_endpoint: "http://wallet-service:3000",
  p_health_check_url: "http://wallet-service:3000/health",
  p_capabilities: ["wallet_transfer", "balance_inquiry", "transaction_history"],
});
```

**Send heartbeat:**

```typescript
// Called periodically (e.g., every 30 seconds)
await supabase.rpc("service_heartbeat", {
  p_service_name: "wallet-service",
  p_status: "healthy",
  p_metrics: {
    active_connections: 45,
    requests_per_minute: 120,
    error_rate: 0.01,
  },
});
```

**View service health:**

```sql
SELECT * FROM service_health_overview;
```

---

## Common Patterns

### Correlation ID Tracking

Always include correlation IDs for distributed tracing:

```typescript
// Generate at entry point
const correlationId = req.headers['x-correlation-id'] || crypto.randomUUID();

// Pass to all operations
await supabase.rpc('log_audit_event', {
  ...,
  p_correlation_id: correlationId
});

await supabase.rpc('append_event', {
  ...,
  p_correlation_id: correlationId
});

// Include in downstream API calls
await fetch(url, {
  headers: {
    'x-correlation-id': correlationId
  }
});
```

### Idempotency Keys

Use for all financial operations:

```typescript
// Generate idempotent key from business context
const idempotencyKey = `wallet-transfer-${sourceWalletId}-${destWalletId}-${Date.now()}`;

const txnId = await supabase.rpc('create_transaction', {
  ...,
  p_idempotency_key: idempotencyKey
});

// If called again with same key, returns existing transaction
```

### Error Handling

All RPC calls should include error handling:

```typescript
try {
  const result = await supabase.rpc("function_name", params);
  if (result.error) throw result.error;
  return result.data;
} catch (error) {
  console.error("RPC call failed:", error);
  // Log to audit
  await supabase.rpc("log_audit_event", {
    p_actor_type: "system",
    p_action: "function_error",
    p_resource_type: "rpc_call",
    p_metadata: { error: error.message, function: "function_name" },
  });
  throw error;
}
```

---

## Monitoring Queries

### Check System Health

```sql
-- Service health
SELECT * FROM service_health_overview
WHERE health_status IN ('warning', 'critical');

-- Queue backlogs
SELECT * FROM whatsapp_queue_stats
WHERE status = 'pending' AND message_count > 100;

SELECT * FROM message_queue_stats
WHERE status = 'pending' AND message_count > 50;

-- Failed jobs
SELECT * FROM background_job_stats
WHERE status = 'failed' AND job_count > 0;

-- Transaction failures
SELECT * FROM transaction_summary
WHERE status = 'failed'
ORDER BY transaction_count DESC;
```

### Performance Metrics

```sql
-- Slowest services (by average latency)
SELECT
  service_name,
  AVG(value) as avg_latency_ms
FROM system_metrics
WHERE metric_type = 'latency'
  AND created_at > now() - interval '1 hour'
GROUP BY service_name
ORDER BY avg_latency_ms DESC
LIMIT 10;

-- Cache hit rate
SELECT
  cache_type,
  active_count,
  expired_count,
  ROUND(100.0 * active_count / (active_count + expired_count), 2) as hit_rate_percent
FROM cache_stats;
```

---

## Best Practices

1. **Always use correlation IDs** for tracking requests across services
2. **Use idempotency keys** for financial operations and critical actions
3. **Record metrics** for all significant operations
4. **Log audit events** for user actions and state changes
5. **Cache expensive operations** (routing, external API calls)
6. **Use feature flags** for new features (start with low percentage)
7. **Event source critical aggregates** for audit and replay capability
8. **Monitor queue depths** to detect processing issues
9. **Set appropriate TTLs** for cached data
10. **Include metadata** in events and logs for debugging

---

For complete documentation, see [DATABASE_SCHEMA_ENHANCEMENTS.md](./DATABASE_SCHEMA_ENHANCEMENTS.md)
