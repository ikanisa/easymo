# WA-Webhook-Core Critical Infrastructure

This directory contains the critical infrastructure components for the wa-webhook-core routing system.

## 📋 Overview

The wa-webhook-core ecosystem now includes:

1. **wa-webhook-core** - Main router (existing)
2. **dlq-processor** - Dead letter queue retry processor (NEW)
3. **session-cleanup** - Stale session cleanup (NEW)
4. **Integration tests** - End-to-end routing tests (NEW)
5. **Scheduled jobs** - Automated background tasks (NEW)

## 🚀 Quick Start

### Deploy All Components

```bash
./deploy-wa-webhook-core-infrastructure.sh
```

This will:
- Deploy dlq-processor edge function
- Deploy session-cleanup edge function
- Apply database migrations (scheduled jobs)
- Run integration tests

### Manual Deployment

```bash
# Deploy functions
supabase functions deploy dlq-processor --no-verify-jwt
supabase functions deploy session-cleanup --no-verify-jwt

# Apply migrations
supabase db push

# Run tests
cd supabase/functions/wa-webhook-core/__tests__
deno test --allow-net --allow-env integration.test.ts
```

## 📦 Components

### 1. DLQ Processor (`dlq-processor/`)

**Purpose**: Automatically retry failed webhook messages from the dead letter queue.

**Runs**: Every 5 minutes (scheduled via pg_cron)

**Logic**:
- Fetches up to 50 messages ready for retry
- Retries each message by re-posting to wa-webhook-core
- Marks successful retries as processed
- Abandons messages after 3 failed retries
- Uses exponential backoff (2, 4, 8 minutes)

**Manual Trigger**:
```bash
curl -X POST $SUPABASE_URL/functions/v1/dlq-processor \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

**Expected Response**:
```json
{
  "success": true,
  "processed": 5,
  "successful": 4,
  "failed": 1,
  "abandoned": 0,
  "durationMs": 1234
}
```

### 2. Session Cleanup (`session-cleanup/`)

**Purpose**: Remove stale user sessions and old DLQ messages.

**Runs**: Daily at 2 AM (scheduled via pg_cron)

**Logic**:
- Deletes user sessions with no activity for 24 hours (configurable)
- Deletes processed DLQ messages older than 7 days
- Prevents unbounded table growth

**Configuration**:
```bash
# Set custom session TTL (default: 24 hours)
export SESSION_TTL_HOURS=48
```

**Manual Trigger**:
```bash
curl -X POST $SUPABASE_URL/functions/v1/session-cleanup \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

**Expected Response**:
```json
{
  "success": true,
  "sessions": {
    "deleted": 42,
    "ttlHours": 24,
    "cutoffTime": "2025-11-24T19:00:00.000Z"
  },
  "dlq": {
    "deleted": 15,
    "retentionDays": 7
  },
  "durationMs": 234
}
```

### 3. Integration Tests (`__tests__/integration.test.ts`)

**Purpose**: Verify end-to-end routing behavior.

**Test Coverage**:
- ✅ Health check endpoint
- ✅ Keyword routing (rides, insurance, jobs, etc.)
- ✅ Menu/home keyword behavior
- ✅ State-based routing (session continuity)
- ✅ Fallback routing (unknown text)
- ✅ Rate limiting enforcement
- ✅ Correlation ID propagation
- ✅ Latency header presence
- ✅ Request ID generation

**Run Tests**:
```bash
cd supabase/functions/wa-webhook-core/__tests__
deno test --allow-net --allow-env integration.test.ts
```

### 4. Scheduled Jobs (Migration: `20251125195629_add_scheduled_jobs.sql`)

**Scheduled Tasks**:

| Job Name | Schedule | Function | Purpose |
|----------|----------|----------|---------|
| dlq-processor | Every 5 min | `/functions/v1/dlq-processor` | Retry failed messages |
| session-cleanup | Daily 2 AM | `/functions/v1/session-cleanup` | Clean stale data |

**View Jobs**:
```sql
SELECT jobname, schedule, active, jobid 
FROM cron.job 
WHERE jobname IN ('dlq-processor', 'session-cleanup');
```

**View Job History**:
```sql
SELECT jobname, runid, status, start_time, end_time 
FROM cron.job_run_details 
WHERE jobname IN ('dlq-processor', 'session-cleanup')
ORDER BY start_time DESC 
LIMIT 10;
```

**Manually Trigger Job**:
```sql
SELECT cron.schedule('dlq-processor-manual', 'now', 'SELECT 1');
```

## 🗄️ Database Schema

### wa_dead_letter_queue

Stores failed webhook messages for retry.

```sql
CREATE TABLE wa_dead_letter_queue (
  id UUID PRIMARY KEY,
  message_id TEXT,
  from_number TEXT NOT NULL,
  payload JSONB NOT NULL,
  error_message TEXT,
  error_stack TEXT,
  retry_count INTEGER DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### user_sessions

Tracks active service state per user.

```sql
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY,
  phone_number TEXT UNIQUE NOT NULL,
  active_service TEXT,
  context JSONB,
  last_interaction TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

## 📊 Monitoring

### Health Checks

```bash
# Core router health
curl $SUPABASE_URL/functions/v1/wa-webhook-core/health

# DLQ processor health
curl -X POST $SUPABASE_URL/functions/v1/dlq-processor \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

### Key Metrics

1. **DLQ Size**: `SELECT COUNT(*) FROM wa_dead_letter_queue WHERE processed = false;`
2. **Active Sessions**: `SELECT COUNT(*) FROM user_sessions WHERE active_service IS NOT NULL;`
3. **Retry Success Rate**: Check `DLQ_MESSAGE_PROCESSED` vs `DLQ_MESSAGE_ABANDONED` events
4. **Session Cleanup**: Check `SESSION_CLEANUP_COMPLETED` events

### Observability Events

All functions emit structured logs:

- `DLQ_PROCESSOR_STARTED`
- `DLQ_PROCESSOR_COMPLETED`
- `DLQ_MESSAGE_PROCESSED`
- `DLQ_MESSAGE_ABANDONED`
- `SESSION_CLEANUP_STARTED`
- `SESSION_CLEANUP_COMPLETED`

## 🔧 Configuration

### Environment Variables

```bash
# Required
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

# Optional
SESSION_TTL_HOURS=24              # Session expiry (default: 24)
WA_ROUTER_TIMEOUT_MS=4000         # Forward timeout (default: 4000)
WA_CORE_COLD_START_SLO_MS=1750    # Cold start SLO (default: 1750)
WA_CORE_P95_SLO_MS=1200           # P95 latency SLO (default: 1200)
```

## 🚨 Troubleshooting

### DLQ Messages Not Being Retried

```sql
-- Check scheduled job status
SELECT * FROM cron.job WHERE jobname = 'dlq-processor';

-- Check recent job runs
SELECT * FROM cron.job_run_details 
WHERE jobname = 'dlq-processor' 
ORDER BY start_time DESC LIMIT 5;

-- Manually trigger processor
curl -X POST $SUPABASE_URL/functions/v1/dlq-processor \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

### Sessions Not Being Cleaned

```sql
-- Check scheduled job status
SELECT * FROM cron.job WHERE jobname = 'session-cleanup';

-- View stale sessions
SELECT phone_number, last_interaction, 
       NOW() - last_interaction AS age
FROM user_sessions
WHERE last_interaction < NOW() - INTERVAL '24 hours';

-- Manually trigger cleanup
curl -X POST $SUPABASE_URL/functions/v1/session-cleanup \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

### Integration Tests Failing

```bash
# Check environment variables are set
echo $SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY

# Run tests with verbose output
cd supabase/functions/wa-webhook-core/__tests__
deno test --allow-net --allow-env --fail-fast integration.test.ts

# Test individual function
deno test --allow-net --allow-env --filter "Health check" integration.test.ts
```

## 📈 Performance

### Expected Performance

- **DLQ Processor**: ~50 messages in < 30s
- **Session Cleanup**: ~1000 sessions in < 5s
- **Integration Tests**: All tests in < 30s

### Optimization Tips

1. Increase DLQ batch size: Edit `getRetriableMessages(supabase, 100)`
2. Adjust retry schedule: Modify cron expression in migration
3. Tune session TTL: Set `SESSION_TTL_HOURS` environment variable

## 🔒 Security

- Both functions use `--no-verify-jwt` (internal only)
- Functions require `SUPABASE_SERVICE_ROLE_KEY`
- Scheduled jobs use internal authentication
- DLQ retries use `X-WA-Internal-Forward` header

## 📚 Related Documentation

- [ROUTING_CONSOLIDATION.md](../ROUTING_CONSOLIDATION.md) - Core routing architecture
- [WA_WEBHOOK_QUICK_REFERENCE.md](/WA_WEBHOOK_QUICK_REFERENCE.md) - Overall webhook system
- [GROUND_RULES.md](/docs/GROUND_RULES.md) - Observability requirements

## ✅ Production Readiness Checklist

- [x] DLQ processor deployed and scheduled
- [x] Session cleanup deployed and scheduled
- [x] Integration tests passing
- [x] Scheduled jobs configured
- [x] Health checks responding
- [x] Monitoring events emitting
- [x] Documentation complete

## 🎯 Next Steps

1. Monitor DLQ processor runs for first 24 hours
2. Verify session cleanup after first run
3. Set up alerting for DLQ size threshold
4. Consider adding metrics persistence (service_metrics table)

---

**Deployment Date**: 2025-11-25  
**Version**: 1.0.0  
**Status**: ✅ Production Ready
