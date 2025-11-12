# Database Infrastructure Documentation

This document describes the comprehensive database infrastructure implemented in EasyMO's Supabase instance.

## Overview

The database schema is organized into modular migration files, following best practices for:
- Partitioning for high-volume tables
- Row-Level Security (RLS) policies
- Observability and audit trails
- ACID compliance for financial operations
- Event sourcing for system events

## Core Infrastructure Components

### 1. Transaction & Payment System
**Migration:** `20260401120000_transactions_payments.sql`

**Tables:**
- `transactions` (partitioned) - Financial transactions with idempotency
- `payment_methods` - User payment method storage
- `transaction_events` - Transaction lifecycle audit trail

**Features:**
- Partitioned by month for scalability
- Idempotency key support
- Complete transaction lifecycle tracking
- RLS policies for data security

**Usage:**
```sql
-- Create a transaction with idempotency
SELECT public.create_transaction(
  p_user_id := auth.uid(),
  p_type := 'credit',
  p_amount := 100.00,
  p_currency := 'RWF',
  p_idempotency_key := 'unique-key-123'
);

-- Update transaction status
SELECT public.update_transaction_status(
  p_transaction_id := 'uuid-here',
  p_new_status := 'completed'
);
```

### 2. WhatsApp Integration
**Migration:** `20260401110000_whatsapp_sessions.sql`

**Tables:**
- `whatsapp_sessions` - Active WhatsApp session tracking
- `whatsapp_message_queue` - Outbound message queue

**Features:**
- Session lifecycle management
- Message queuing with priority
- Retry logic with exponential backoff
- Activity tracking

**Usage:**
```sql
-- Enqueue a WhatsApp message
SELECT public.enqueue_whatsapp_message(
  p_recipient_phone := '+250788123456',
  p_message_type := 'text',
  p_message_payload := '{"text": "Hello!"}'::jsonb,
  p_priority := 5
);

-- Update session activity
SELECT public.update_whatsapp_session_activity(
  p_phone_number := '+250788123456',
  p_increment_message_count := true
);
```

### 3. Service Registry & Feature Flags
**Migration:** `20260401130000_service_registry_feature_flags.sql`

**Tables:**
- `service_registry` - Microservice discovery and health tracking
- `feature_flags` - Dynamic feature management
- `feature_flag_evaluations` - Feature flag audit trail

**Features:**
- Service health monitoring
- Heartbeat tracking
- Multiple rollout strategies (percentage, user_list, condition)
- Feature flag evaluation history

**Usage:**
```sql
-- Register a service
SELECT public.register_service(
  p_service_name := 'wallet-service',
  p_service_type := 'microservice',
  p_version := '1.0.0',
  p_endpoint := 'http://wallet:3000',
  p_capabilities := '["transfer", "balance"]'::jsonb
);

-- Check if feature is enabled
SELECT public.is_feature_enabled(
  p_flag_key := 'wallet.service',
  p_user_id := auth.uid(),
  p_environment := 'production'
);
```

### 4. Service Configurations
**Migration:** `20260401170000_service_configurations.sql`

**Tables:**
- `configurations` - Service-specific configuration storage
- `configuration_history` - Configuration change audit trail

**Features:**
- Environment-specific configs (development, staging, production)
- Secret management with visibility controls
- Automatic change tracking via triggers
- Hierarchical config resolution (environment-specific → all)

**Usage:**
```sql
-- Set configuration
SELECT public.set_config(
  p_service_name := 'wallet-service',
  p_config_key := 'max_transfer_amount',
  p_config_value := '10000'::jsonb,
  p_environment := 'production',
  p_value_type := 'number'
);

-- Get configuration
SELECT public.get_config(
  p_service_name := 'wallet-service',
  p_config_key := 'max_transfer_amount',
  p_environment := 'production'
);

-- Get all configs for a service
SELECT * FROM public.get_service_configs(
  p_service_name := 'wallet-service',
  p_environment := 'production',
  p_include_secrets := false
);
```

### 5. Event Sourcing & Message Queue
**Migration:** `20260401140000_event_store_message_queue.sql`

**Tables:**
- `event_store` (partitioned) - Event sourcing for CQRS pattern
- `message_queue` - Async message processing
- `background_jobs` - Background job scheduling

**Features:**
- Event versioning
- Correlation and causation tracking
- Idempotent message processing
- Job retry mechanisms

**Usage:**
```sql
-- Append an event
SELECT public.append_event(
  p_aggregate_id := 'trip-123',
  p_aggregate_type := 'trip',
  p_event_type := 'trip_completed',
  p_payload := '{"fare": 5000}'::jsonb
);

-- Get aggregate history
SELECT * FROM public.get_aggregate_events(
  p_aggregate_type := 'trip',
  p_aggregate_id := 'trip-123'
);

-- Schedule a background job
SELECT public.schedule_job(
  p_job_type := 'payment_processing',
  p_job_name := 'Process Payment',
  p_payload := '{"amount": 5000}'::jsonb
);
```

### 6. System Observability
**Migration:** `20260401100000_system_observability.sql`

**Tables:**
- `system_metrics` (partitioned) - Performance metrics
- `system_audit_logs` (partitioned) - Comprehensive audit trail

**Features:**
- Time-series metrics storage
- Correlation ID tracking
- Actor-based auditing (user, service, system)
- Performance monitoring

**Usage:**
```sql
-- Record a metric
SELECT public.record_metric(
  p_service_name := 'api',
  p_metric_type := 'latency',
  p_metric_name := 'request_duration',
  p_value := 150,
  p_unit := 'ms',
  p_tags := '{"endpoint": "/api/trips"}'::jsonb
);

-- Log an audit event
SELECT public.log_audit_event(
  p_actor_type := 'user',
  p_actor_identifier := auth.uid()::text,
  p_action := 'trip_created',
  p_resource_type := 'trip',
  p_resource_id := 'trip-123'
);
```

### 7. Analytics Infrastructure
**Migration:** `20260401160000_analytics_infrastructure.sql`

**Tables:**
- `analytics_events` (partitioned) - User and system events
- `daily_metrics` (materialized view) - Aggregated daily metrics

**Features:**
- Partitioned for high-volume data
- Session tracking
- User engagement metrics
- Automated daily aggregations

**Usage:**
```sql
-- Track an event
SELECT public.track_event(
  p_event_name := 'trip_requested',
  p_event_category := 'user_action',
  p_properties := '{"origin": "Downtown", "destination": "Airport"}'::jsonb,
  p_session_id := 'session-123'
);

-- Refresh daily metrics (run periodically)
SELECT public.refresh_daily_metrics();

-- Query analytics
SELECT * FROM public.analytics_summary;
SELECT * FROM public.user_engagement_metrics WHERE user_id = auth.uid();
```

### 8. Cache Infrastructure
**Migration:** `20260401150000_location_cache_optimization.sql`

**Tables:**
- `cache_entries` - General-purpose key-value cache
- `locations` - User location storage with geospatial support
- `routes` - Cached routing information

**Features:**
- TTL-based expiration
- Tag-based invalidation
- Geospatial queries with PostGIS
- Route caching for performance

**Usage:**
```sql
-- Set cache value
SELECT public.set_cache(
  p_key := 'user:123:profile',
  p_value := '{"name": "John"}'::jsonb,
  p_ttl_seconds := 3600,
  p_tags := ARRAY['user', 'profile']
);

-- Get cache value
SELECT public.get_cache('user:123:profile');

-- Invalidate by tag
SELECT public.invalidate_cache_by_tag('user');

-- Find nearby locations
SELECT * FROM public.find_nearby_locations(
  p_lat := -1.9441,
  p_lng := 30.0619,
  p_radius_meters := 5000
);
```

### 9. Notifications System
**Migration:** `20251002120000_core_schema.sql`

**Tables:**
- `notifications` - User notification storage and delivery tracking

**Features:**
- Multi-channel support (WhatsApp, SMS, push, email)
- Priority-based delivery
- Status tracking
- Retry logic

## Best Practices

### 1. Use Correlation IDs
Always pass correlation IDs for distributed tracing:
```sql
-- In your code
const correlationId = crypto.randomUUID();
await supabase.rpc('create_transaction', {
  p_correlation_id: correlationId,
  // ... other params
});
```

### 2. Leverage Idempotency Keys
For financial and critical operations:
```sql
const idempotencyKey = `transfer-${userId}-${timestamp}`;
await supabase.rpc('create_transaction', {
  p_idempotency_key: idempotencyKey,
  // ... other params
});
```

### 3. Use Feature Flags
Gate new features behind flags:
```sql
-- Check if feature is enabled
const { data: isEnabled } = await supabase.rpc('is_feature_enabled', {
  p_flag_key: 'new_feature',
  p_user_id: user.id
});

if (isEnabled) {
  // Execute new feature code
}
```

### 4. Event Sourcing for Critical State
Use event store for audit trails:
```sql
-- Append events for state changes
await supabase.rpc('append_event', {
  p_aggregate_id: tripId,
  p_aggregate_type: 'trip',
  p_event_type: 'status_changed',
  p_payload: { from: 'pending', to: 'accepted' }
});
```

## Monitoring and Maintenance

### Daily Tasks
1. Refresh materialized views:
   ```sql
   SELECT public.refresh_daily_metrics();
   ```

2. Cleanup expired cache:
   ```sql
   SELECT public.cleanup_expired_cache();
   ```

3. Check service health:
   ```sql
   SELECT * FROM public.service_health_overview;
   ```

### Weekly Tasks
1. Review slow queries and add indexes
2. Check partition health and create new ones
3. Review feature flag usage
4. Analyze transaction patterns

### Monthly Tasks
1. Archive old partitions
2. Review and optimize materialized views
3. Audit configuration changes
4. Review analytics trends

## Partition Management

High-volume tables are partitioned by month. Create new partitions before the month starts:

```sql
-- Example: Create partition for June 2026
CREATE TABLE IF NOT EXISTS public.transactions_2026_06 
  PARTITION OF public.transactions
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

-- Create corresponding indexes
CREATE INDEX idx_transactions_user_created_06 
  ON public.transactions_2026_06 (user_id, created_at DESC);
```

## Security Considerations

1. **RLS Policies**: All tables have RLS enabled with appropriate policies
2. **Secret Storage**: Use `is_secret` flag in configurations table
3. **Audit Trails**: All critical operations are logged
4. **Data Encryption**: Sensitive data should be encrypted at application level
5. **Access Control**: Use service_role for backend operations only

## Troubleshooting

### High Query Times
1. Check indexes: `EXPLAIN ANALYZE SELECT ...`
2. Review partition boundaries
3. Check for missing correlation ID indexes

### Cache Misses
1. Review TTL settings
2. Check invalidation patterns
3. Monitor cache hit rates via `cache_stats` view

### Event Store Growth
1. Implement archival strategy for old events
2. Consider event snapshots for large aggregates
3. Monitor partition sizes

## Related Documentation

- [Ground Rules](./GROUND_RULES.md) - Development standards
- [Architecture](./ARCHITECTURE.md) - System architecture
- [README](../README.md) - Project overview
