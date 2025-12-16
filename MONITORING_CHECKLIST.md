# Monitoring Checklist - Post Deployment

**Date:** 2025-12-16  
**Deployment:** QA Fixes - P0 and P1 Issues

---

## Immediate Monitoring (First 24 Hours)

### 1. Database Migration Status
- [ ] Verify foreign key constraints are active
  ```sql
  SELECT conname, contype, conrelid::regclass 
  FROM pg_constraint 
  WHERE conname LIKE 'fk_%' 
  ORDER BY conname;
  ```
- [ ] Verify indexes are created
  ```sql
  SELECT indexname, tablename 
  FROM pg_indexes 
  WHERE indexname LIKE 'idx_%' 
  ORDER BY tablename, indexname;
  ```
- [ ] Check phone number normalization
  ```sql
  SELECT phone, normalize_phone_number(phone) as normalized
  FROM whatsapp_users 
  WHERE phone != normalize_phone_number(phone)
  LIMIT 10;
  ```

### 2. Webhook Function Health
- [ ] Check function deployment status in Supabase Dashboard
  - `wa-webhook-mobility`
  - `wa-webhook-buy-sell`
  - `wa-webhook-profile`
  - `wa-webhook-core`
- [ ] Verify function logs for errors
  - Look for `MOBILITY_AUTH_FAILED`
  - Look for `BUY_SELL_ERROR`
  - Look for `PROFILE_SYSTEM_ERROR`
- [ ] Check function response times
  - Target: < 2 seconds for 95th percentile
  - Alert if > 5 seconds

### 3. Signature Verification
- [ ] Monitor `MOBILITY_SIGNATURE_VALID` events
- [ ] Monitor `MOBILITY_AUTH_BYPASS` events (should only be for internal forwards)
- [ ] Verify no unauthorized access attempts
  ```sql
  SELECT event, COUNT(*) 
  FROM structured_logs 
  WHERE event IN ('MOBILITY_AUTH_FAILED', 'BUY_SELL_AUTH_FAILED', 'PROFILE_AUTH_FAILED')
    AND created_at > NOW() - INTERVAL '1 hour'
  GROUP BY event;
  ```

### 4. Error Rates
- [ ] Monitor error rates per webhook
  ```sql
  SELECT 
    service,
    COUNT(*) as total,
    SUM(CASE WHEN level = 'error' THEN 1 ELSE 0 END) as errors,
    ROUND(100.0 * SUM(CASE WHEN level = 'error' THEN 1 ELSE 0 END) / COUNT(*), 2) as error_rate
  FROM structured_logs
  WHERE created_at > NOW() - INTERVAL '1 hour'
    AND service IN ('wa-webhook-mobility', 'wa-webhook-buy-sell', 'wa-webhook-profile')
  GROUP BY service;
  ```
- [ ] Target: < 1% error rate
- [ ] Alert if error rate > 5%

### 5. Profile Lookup Performance
- [ ] Monitor duplicate profile lookups in buy-sell
  - Should see only 1 lookup per request
  - Check for `BUY_SELL_PROFILE_LOOKUP_ERROR` events
- [ ] Monitor profile creation success rate
  ```sql
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN event = 'USER_ENSURE_ERROR' THEN 1 ELSE 0 END) as failures,
    ROUND(100.0 * SUM(CASE WHEN event = 'USER_ENSURE_ERROR' THEN 1 ELSE 0 END) / COUNT(*), 2) as failure_rate
  FROM structured_logs
  WHERE event IN ('USER_ENSURE_SUCCESS', 'USER_ENSURE_ERROR')
    AND created_at > NOW() - INTERVAL '1 hour';
  ```

### 6. Input Validation
- [ ] Monitor validation failures
  - `MOBILITY_INVALID_LOCATION` events
  - `MOBILITY_TEXT_TOO_LONG` events
  - `INPUT_VALIDATION_XSS` events
  - `INPUT_VALIDATION_SQL_INJECTION` events
- [ ] Check for suspicious patterns
  ```sql
  SELECT event, payload->>'from' as user_phone, created_at
  FROM structured_logs
  WHERE event IN ('INPUT_VALIDATION_XSS', 'INPUT_VALIDATION_SQL_INJECTION')
    AND created_at > NOW() - INTERVAL '1 hour'
  ORDER BY created_at DESC;
  ```

---

## Ongoing Monitoring (Weekly)

### 7. Database Performance
- [ ] Check index usage
  ```sql
  SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
  FROM pg_stat_user_indexes
  WHERE schemaname = 'public'
    AND indexname LIKE 'idx_%'
  ORDER BY idx_scan DESC;
  ```
- [ ] Monitor slow queries
  ```sql
  SELECT 
    query,
    calls,
    total_time,
    mean_time,
    max_time
  FROM pg_stat_statements
  WHERE mean_time > 1000  -- queries taking > 1 second on average
  ORDER BY mean_time DESC
  LIMIT 20;
  ```

### 8. Conversation History Cleanup
- [ ] Run cleanup function manually to test
  ```sql
  SELECT cleanup_old_conversation_history();
  ```
- [ ] Schedule cleanup job (if using pg_cron)
  ```sql
  SELECT cron.schedule(
    'cleanup-conversation-history',
    '0 2 * * *',  -- Daily at 2 AM
    $$SELECT cleanup_old_conversation_history()$$
  );
  ```
- [ ] Monitor cleanup effectiveness
  ```sql
  SELECT 
    phone,
    jsonb_array_length(conversation_history) as history_length
  FROM marketplace_conversations
  WHERE conversation_history IS NOT NULL
    AND jsonb_array_length(conversation_history) > 20
  ORDER BY history_length DESC
  LIMIT 10;
  ```

### 9. Memory Cleanup
- [ ] Run expired memory cleanup
  ```sql
  SELECT cleanup_expired_agent_memory();
  ```
- [ ] Schedule cleanup job
  ```sql
  SELECT cron.schedule(
    'cleanup-expired-memory',
    '0 3 * * *',  -- Daily at 3 AM
    $$SELECT cleanup_expired_agent_memory()$$
  );
  ```

### 10. Phone Number Normalization
- [ ] Verify all new phone numbers are normalized
  ```sql
  SELECT 
    phone,
    normalize_phone_number(phone) as normalized,
    CASE 
      WHEN phone = normalize_phone_number(phone) THEN 'OK'
      ELSE 'NEEDS_FIX'
    END as status
  FROM whatsapp_users
  WHERE created_at > NOW() - INTERVAL '1 day'
  ORDER BY created_at DESC
  LIMIT 20;
  ```

### 11. RLS Policy Effectiveness
- [ ] Test RLS policies (if authenticated access is enabled)
  ```sql
  -- Test as service role (should see all)
  SET ROLE service_role;
  SELECT COUNT(*) FROM marketplace_conversations;
  
  -- Test as authenticated user (should see only own)
  SET ROLE authenticated;
  SELECT COUNT(*) FROM marketplace_conversations;
  ```

---

## Alert Thresholds

### Critical Alerts (Immediate Action Required)
- Error rate > 10%
- Function deployment failures
- Database connection failures
- Signature verification failures > 5% of requests
- Foreign key constraint violations

### Warning Alerts (Investigate Within 24 Hours)
- Error rate > 5%
- Response time > 5 seconds (95th percentile)
- Profile lookup failures > 1%
- Input validation failures > 0.1%
- Conversation history > 30 messages per conversation

### Info Alerts (Monitor Trends)
- Error rate > 1%
- Response time > 2 seconds (95th percentile)
- Index scan ratio < 0.8 (80% of queries using indexes)

---

## Key Metrics Dashboard

### Webhook Performance
```sql
SELECT 
  service,
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as requests,
  SUM(CASE WHEN level = 'error' THEN 1 ELSE 0 END) as errors,
  ROUND(100.0 * SUM(CASE WHEN level = 'error' THEN 1 ELSE 0 END) / COUNT(*), 2) as error_rate_pct
FROM structured_logs
WHERE service IN ('wa-webhook-mobility', 'wa-webhook-buy-sell', 'wa-webhook-profile')
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY service, hour
ORDER BY hour DESC, service;
```

### User Activity
```sql
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(DISTINCT payload->>'from') as unique_users,
  COUNT(*) as total_messages
FROM structured_logs
WHERE event LIKE '%MESSAGE_RECEIVED%'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;
```

### Database Health
```sql
SELECT 
  schemaname,
  tablename,
  n_live_tup as live_rows,
  n_dead_tup as dead_rows,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'marketplace%'
ORDER BY n_dead_tup DESC;
```

---

## Troubleshooting Guide

### Issue: High Error Rate
1. Check function logs for specific error patterns
2. Verify database connectivity
3. Check for rate limiting issues
4. Review input validation failures

### Issue: Slow Response Times
1. Check database query performance
2. Verify indexes are being used
3. Check for N+1 query problems
4. Review function cold start times

### Issue: Signature Verification Failures
1. Verify `WHATSAPP_APP_SECRET` is set correctly
2. Check for internal forward header issues
3. Review signature verification logs
4. Verify webhook configuration in Meta

### Issue: Profile Lookup Failures
1. Check `ensure_whatsapp_user` RPC function
2. Verify database connectivity
3. Check for duplicate phone numbers
4. Review anonymous auth setup

---

## Next Steps

1. Set up automated alerts for critical thresholds
2. Create Grafana/Prometheus dashboards for key metrics
3. Schedule weekly performance reviews
4. Document any recurring issues and solutions
5. Update this checklist based on findings

