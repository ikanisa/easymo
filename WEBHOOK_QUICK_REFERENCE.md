# WhatsApp Webhook Enhancement - Quick Reference

## ⚡ Quick Start

### Enable Enhanced Processing
```bash
# In Supabase Edge Function environment
WA_ENHANCED_PROCESSING=true
```

### Check Health
```sql
SELECT * FROM check_webhook_system_health();
```

### View Metrics
```sql
SELECT * FROM webhook_conversation_health;
SELECT * FROM get_webhook_performance_stats(24);
```

## 🔍 Key Monitoring Queries

### Check for Stuck Conversations
```sql
SELECT COUNT(*) FROM stuck_webhook_conversations;
-- Alert if > 5
```

### Check DLQ Depth
```sql
SELECT COUNT(*) FROM webhook_dlq 
WHERE resolution_status = 'pending';
-- Alert if > 10
```

### Check Error Rate
```sql
SELECT SUM(error_count) 
FROM webhook_conversations 
WHERE created_at > NOW() - INTERVAL '1 hour';
-- Alert if > 10
```

### Check Processing Latency
```sql
SELECT p95_processing_ms 
FROM webhook_message_processing_metrics 
ORDER BY hour DESC 
LIMIT 1;
-- Alert if > 2000ms
```

## 🛠️ Common Operations

### Manual Cleanup
```sql
SELECT cleanup_stuck_webhook_conversations();
```

### Retry DLQ Messages
```sql
UPDATE webhook_dlq 
SET next_retry_at = NOW(),
    resolution_status = 'pending'
WHERE resolution_status = 'failed'
  AND retry_count < max_retries;
```

### View Recent State Transitions
```sql
SELECT * FROM recent_webhook_state_transitions 
LIMIT 10;
```

### Find High Error Conversations
```sql
SELECT id, user_id, error_count, status
FROM webhook_conversations
WHERE error_count > 3
ORDER BY error_count DESC
LIMIT 10;
```

## 📊 Dashboard Queries

### Processing Throughput (Last 24h)
```sql
SELECT 
  DATE_TRUNC('hour', processed_at) as hour,
  COUNT(*) as messages_processed
FROM processed_webhook_messages
WHERE processed_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;
```

### Error Distribution
```sql
SELECT 
  error,
  COUNT(*) as count
FROM webhook_dlq
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY error
ORDER BY count DESC;
```

### AI Agent Performance
```sql
SELECT * FROM webhook_agent_performance;
```

### Lock Contention
```sql
SELECT COUNT(*) as locked_conversations
FROM webhook_conversations
WHERE locked_by IS NOT NULL;
```

## 🚨 Troubleshooting

### Problem: Messages not processing
```sql
-- Check if duplicate
SELECT * FROM processed_webhook_messages 
WHERE whatsapp_message_id = 'MSG_ID';

-- Check if in DLQ
SELECT * FROM webhook_dlq 
WHERE whatsapp_message_id = 'MSG_ID';
```

### Problem: High DLQ count
```sql
-- Check error patterns
SELECT error, COUNT(*) 
FROM webhook_dlq 
GROUP BY error 
ORDER BY COUNT(*) DESC;
```

### Problem: Conversations stuck
```sql
-- Check stuck conversations
SELECT * FROM stuck_webhook_conversations;

-- Manual cleanup
SELECT cleanup_stuck_webhook_conversations();
```

### Problem: High latency
```sql
-- Check slowest messages
SELECT 
  whatsapp_message_id,
  processing_time_ms
FROM processed_webhook_messages
WHERE processed_at > NOW() - INTERVAL '1 hour'
ORDER BY processing_time_ms DESC
LIMIT 10;
```

## 🔐 Security Checks

### Verify RLS Enabled
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename LIKE 'webhook_%'
  OR tablename LIKE 'agent_%';
```

### Check Audit Trail
```sql
SELECT COUNT(*) 
FROM conversation_state_transitions
WHERE created_at > NOW() - INTERVAL '24 hours';
```

## 📈 Performance Tuning

### Index Usage
```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as scans,
  idx_tup_read as tuples_read
FROM pg_stat_user_indexes
WHERE tablename LIKE 'webhook_%'
  OR tablename LIKE 'agent_%'
ORDER BY idx_scan DESC;
```

### Table Sizes
```sql
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
  AND (tablename LIKE 'webhook_%' OR tablename LIKE 'agent_%')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## 🔄 Maintenance

### Daily Tasks
```sql
-- Check health
SELECT * FROM check_webhook_system_health();

-- Check performance
SELECT * FROM get_webhook_performance_stats(24);
```

### Weekly Tasks
```sql
-- Archive old processed messages (optional)
DELETE FROM processed_webhook_messages 
WHERE processed_at < NOW() - INTERVAL '30 days';

-- Archive old DLQ entries
DELETE FROM webhook_dlq 
WHERE created_at < NOW() - INTERVAL '30 days'
  AND resolution_status IN ('resolved', 'failed');
```

## 🎯 Feature Flag Strategies

### Gradual Rollout
```typescript
// Enable for percentage of users
const rolloutPercentage = 10; // 10%
const hash = hashUserId(userId) % 100;
const enabled = hash < rolloutPercentage;
```

### Test User List
```typescript
const testUsers = ['user123', 'beta456'];
const enabled = testUsers.includes(userId);
```

### A/B Testing
```typescript
// Enable for 50% (A/B test)
const enabled = hashUserId(userId) % 2 === 0;
```

## 📞 Support

### Health Check Endpoint
```bash
curl https://project.supabase.co/functions/v1/wa-webhook/health
```

### Metrics Endpoint
```bash
curl https://project.supabase.co/functions/v1/wa-webhook/metrics
```

### Prometheus Format
```bash
curl -H "Accept: text/plain" \
  https://project.supabase.co/functions/v1/wa-webhook/metrics
```

## 🔗 Documentation Links

- **Implementation Guide**: `WEBHOOK_ENHANCEMENT_GUIDE.md`
- **Summary**: `WEBHOOK_ENHANCEMENT_SUMMARY.md`
- **Integration Example**: `supabase/functions/wa-webhook/integration-example.ts`
- **Validation Script**: `scripts/validate-webhook-enhancement.sh`
- **Ground Rules**: `docs/GROUND_RULES.md`

## 🎓 Training Queries

### Understand Data Flow
```sql
-- 1. Message received
SELECT * FROM processed_webhook_messages 
ORDER BY processed_at DESC LIMIT 5;

-- 2. Conversation created/updated
SELECT * FROM webhook_conversations 
ORDER BY updated_at DESC LIMIT 5;

-- 3. State transitions logged
SELECT * FROM recent_webhook_state_transitions LIMIT 5;

-- 4. AI context stored
SELECT * FROM agent_contexts 
ORDER BY updated_at DESC LIMIT 5;

-- 5. Session metrics tracked
SELECT * FROM agent_sessions 
ORDER BY started_at DESC LIMIT 5;
```

---

**Version**: 1.0
**Last Updated**: 2025-11-16
**Status**: Production Ready
