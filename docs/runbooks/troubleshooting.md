# Troubleshooting Guide

## Quick Diagnostics

### Check System Status

```bash
curl -s https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-core/health | jq
```

### Check Recent Errors

```bash
supabase functions logs wa-webhook-core --limit 50
supabase functions logs wa-webhook-core --limit 100 | grep -i error
```

## Common Problems

### Problem: Messages Not Being Delivered

**Symptoms:**
- Users send messages but get no response
- No errors in logs

**Diagnosis:**
1. Check webhook is registered with Meta
2. Check signature verification
3. Verify environment variables

**Solution:**
- Re-verify webhook in Meta dashboard
- Update secrets if needed
- Check Meta's webhook delivery logs

### Problem: High Latency

**Symptoms:**
- P99 latency > 2 seconds
- Users complaining about slow bot

**Diagnosis:**
```bash
curl -s .../metrics | jq '.metrics.histograms'
```

**Solution:**
- If DB slow: Check indexes, optimize queries
- If API slow: Add caching, increase timeouts
- If handler slow: Profile code, optimize logic

### Problem: Rate Limiting Users

**Symptoms:**
- Users getting "Too many requests" message
- 429 responses in logs

**Solution:**
- If legitimate: Increase rate limits in config
- If abuse: Block IP/user, investigate source
- Add user-specific rate limit overrides

### Problem: Database Connection Errors

**Symptoms:**
- "ECONNREFUSED" in logs
- Health check shows database disconnected

**Diagnosis:**
1. Check Supabase status: https://status.supabase.com/
2. Check connection pool
3. Check for connection leaks

**Solution:**
- Restart affected functions
- Increase pool size or fix leaks
- Wait for Supabase resolution

### Problem: State Machine Stuck

**Symptoms:**
- Users stuck in a flow
- "Session expired" not triggering

**Solution:**
```sql
-- Clear stuck state
DELETE FROM user_state WHERE user_id = '<user_id>';
```

## Log Analysis

### Common Log Patterns

```bash
# Successful message processing
grep "WEBHOOK_RECEIVED" | grep "handled.*true"

# Auth failures
grep "AUTH_FAILED"

# Rate limiting
grep "RATE_LIMITED\|429"

# Database errors
grep "DATABASE_ERROR\|ECONNREFUSED"
```

## Useful SQL Queries

### Check Recent Activity

```sql
-- Recent messages processed
SELECT created_at, whatsapp_e164, key 
FROM user_state 
ORDER BY updated_at DESC 
LIMIT 20;

-- Active trips
SELECT id, status, vehicle_type, created_at 
FROM trips 
WHERE status NOT IN ('completed', 'cancelled')
ORDER BY created_at DESC;
```

### Check System Health

```sql
-- Table sizes
SELECT 
  schemaname || '.' || relname AS table,
  pg_size_pretty(pg_total_relation_size(relid)) AS size
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 10;
```

## Escalation Path

1. **Level 1**: On-call engineer - Check runbooks, apply standard fixes
2. **Level 2**: Senior engineer - Complex debugging, code-level fixes
3. **Level 3**: Tech lead / External support - Architecture issues, vendor escalation

*Last Updated: 2025-12-02*
