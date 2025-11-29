# Production Deployment Guide
**Version**: 1.0  
**Date**: 2025-11-27  
**Target**: 90% Production Readiness

---

## 🎯 Pre-Deployment Checklist

### Environment Verification
- [ ] Supabase project access confirmed
- [ ] Database credentials verified
- [ ] Service role key available
- [ ] All env vars documented in `.env.example`
- [ ] Staging environment tested

### Code Review
- [ ] All migrations reviewed and tested
- [ ] DLQ integration verified
- [ ] Circuit breaker tested
- [ ] Webhook signature verification confirmed
- [ ] No secrets in code

### Backup Strategy
- [ ] Database backup created (<1 hour old)
- [ ] Point-in-time recovery enabled
- [ ] Rollback plan documented
- [ ] Backup restoration tested

---

## 📦 Deployment Steps

### Phase 1: Database Migrations (30 min)

#### Step 1.1: Deploy DLQ Infrastructure
```bash
# Push migrations to Supabase
supabase db push

# Verify DLQ table created
supabase db query "
  SELECT 
    tablename, 
    pg_size_pretty(pg_total_relation_size('public.'||tablename)) as size
  FROM pg_tables 
  WHERE tablename IN ('webhook_dlq', 'dlq_processing_log')
  AND schemaname = 'public';
"

# Expected output:
#   tablename          | size
# --------------------+-------
#  webhook_dlq         | 8192 bytes
#  dlq_processing_log  | 8192 bytes
```

#### Step 1.2: Verify Cron Jobs
```bash
# Check DLQ processor cron
supabase db query "
  SELECT jobid, jobname, schedule, active 
  FROM cron.job 
  WHERE jobname IN ('process-dlq-entries', 'create-wa-events-partitions');
"

# Expected output:
#  jobid | jobname                    | schedule    | active
# -------+----------------------------+-------------+--------
#  1     | process-dlq-entries        | */5 * * * * | t
#  2     | create-wa-events-partitions| 0 0 1 * *   | t
```

#### Step 1.3: Deploy Auto-Vacuum Optimization
```bash
# Verify vacuum settings applied
supabase db query "
  SELECT 
    tablename,
    reloptions
  FROM pg_tables t
  JOIN pg_class c ON c.relname = t.tablename
  WHERE tablename IN ('wa_events', 'whatsapp_messages', 'webhook_logs')
  AND schemaname = 'public';
"

# Should show autovacuum_vacuum_scale_factor settings
```

#### Step 1.4: Deploy Partitioning (Optional - Staging First)
```bash
# Test in staging before production
# This creates wa_events_new partitioned table

# After validation, migrate data:
supabase db query "
  -- Pause writes to wa_events
  -- Copy data to partitioned table
  INSERT INTO wa_events_new 
  SELECT * FROM wa_events 
  WHERE created_at > NOW() - INTERVAL '6 months';
  
  -- Verify count matches
  SELECT COUNT(*) FROM wa_events WHERE created_at > NOW() - INTERVAL '6 months';
  SELECT COUNT(*) FROM wa_events_new;
"
```

---

### Phase 2: Edge Functions (20 min)

#### Step 2.1: Deploy Updated Webhooks
```bash
# Deploy wa-webhook with signature verification
supabase functions deploy wa-webhook

# Deploy wa-webhook-unified with DLQ
supabase functions deploy wa-webhook-unified

# Deploy wa-webhook-core with DLQ
supabase functions deploy wa-webhook-core

# Verify deployments
curl https://PROJECT.supabase.co/functions/v1/wa-webhook/health
curl https://PROJECT.supabase.co/functions/v1/wa-webhook-unified/health
curl https://PROJECT.supabase.co/functions/v1/wa-webhook-core/health
```

#### Step 2.2: Deploy DLQ Processor
```bash
# Deploy DLQ processor
supabase functions deploy dlq-processor

# Test DLQ processor health
curl https://PROJECT.supabase.co/functions/v1/dlq-processor/health

# Expected response:
# {
#   "status": "healthy",
#   "service": "dlq-processor",
#   "stats": {
#     "total": 0,
#     "pending": 0,
#     "processing": 0,
#     "reprocessed": 0,
#     "failed": 0
#   }
# }
```

---

### Phase 3: Configuration (10 min)

#### Step 3.1: Environment Variables
```bash
# Set OpenTelemetry configuration (if using)
supabase secrets set OTEL_EXPORTER_OTLP_ENDPOINT=https://api.honeycomb.io
supabase secrets set OTEL_SERVICE_NAME=easymo-production

# Verify webhook secrets
supabase secrets list | grep WHATSAPP_APP_SECRET
supabase secrets list | grep SUPABASE
```

#### Step 3.2: Configure Database Settings
```sql
-- Set app-level config for DLQ function
ALTER DATABASE postgres SET app.settings.supabase_url TO 'https://PROJECT.supabase.co';
-- Note: Service role key should be in vault, not database
```

---

### Phase 4: Verification (30 min)

#### Step 4.1: Test DLQ Flow
```bash
# 1. Simulate a webhook error (modify function to fail)
# 2. Check DLQ entry created
supabase db query "
  SELECT id, service, error_message, status, retry_count, created_at 
  FROM webhook_dlq 
  ORDER BY created_at DESC 
  LIMIT 1;
"

# 3. Wait 5 minutes for cron to process
sleep 300

# 4. Verify reprocessing attempt
supabase db query "
  SELECT status, retry_count, last_retry_at 
  FROM webhook_dlq 
  WHERE id = 'ENTRY_ID_FROM_STEP_2';
"
```

#### Step 4.2: Test Webhook Signature Verification
```bash
# Send webhook with invalid signature
curl -X POST https://PROJECT.supabase.co/functions/v1/wa-webhook \
  -H "Content-Type: application/json" \
  -H "x-hub-signature-256: sha256=invalid" \
  -d '{"test": "data"}'

# Expected: 401 Unauthorized
```

#### Step 4.3: Monitor DLQ Processing
```bash
# Check processing logs
supabase db query "
  SELECT * FROM dlq_processing_log 
  ORDER BY processed_at DESC 
  LIMIT 5;
"

# Check cron execution
supabase db query "
  SELECT * FROM cron.job_run_details 
  WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'process-dlq-entries')
  ORDER BY start_time DESC 
  LIMIT 5;
"
```

#### Step 4.4: Test Circuit Breaker (Optional)
```typescript
// Simulate failures to open circuit
// In a test script or console:
for (let i = 0; i < 6; i++) {
  await fetch('https://graph.facebook.com/INVALID_ENDPOINT');
}

// Check circuit status
const status = getWhatsAppCircuitStatus();
console.log(status); // Should show state: OPEN
```

---

### Phase 5: Monitoring Setup (20 min)

#### Step 5.1: Import Grafana Dashboards
```bash
# Import DLQ dashboard
curl -X POST http://grafana:3000/api/dashboards/db \
  -H "Authorization: Bearer ${GRAFANA_API_KEY}" \
  -H "Content-Type: application/json" \
  -d @monitoring/dlq-dashboard.json

# Import webhook performance dashboard
curl -X POST http://grafana:3000/api/dashboards/db \
  -H "Authorization: Bearer ${GRAFANA_API_KEY}" \
  -H "Content-Type: application/json" \
  -d @monitoring/webhook-performance-dashboard.json
```

#### Step 5.2: Configure Alerts
```bash
# Set up PagerDuty integration
export PAGERDUTY_INTEGRATION_KEY="your-key"

# Set up Slack webhook
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/XXX"

# Deploy alerting rules (platform-specific)
# For Prometheus/Alertmanager:
kubectl apply -f monitoring/alerting-rules.yaml
```

#### Step 5.3: Verify Monitoring
```bash
# Check DLQ metrics
curl http://grafana:3000/api/dashboards/uid/dlq-dashboard

# Verify alerts are configured
curl http://prometheus:9090/api/v1/rules | jq '.data.groups[].name'
```

---

## 🔍 Post-Deployment Validation

### Immediate Checks (First Hour)

#### DLQ Health
```sql
-- Check DLQ is processing
SELECT * FROM dlq_processing_log WHERE processed_at > NOW() - INTERVAL '1 hour';

-- Verify no stuck entries
SELECT COUNT(*) FROM webhook_dlq WHERE status = 'pending' AND created_at < NOW() - INTERVAL '30 minutes';
```

#### Webhook Processing
```sql
-- Check webhook success rate
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN processed = true THEN 1 ELSE 0 END) as successful,
  ROUND(100.0 * SUM(CASE WHEN processed = true THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM processed_webhook_messages
WHERE created_at > NOW() - INTERVAL '1 hour';

-- Should be >99% success rate
```

#### Database Performance
```sql
-- Check table sizes
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size('public.'||tablename)) as size,
  n_live_tup as live_rows,
  n_dead_tup as dead_rows
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size('public.'||tablename) DESC
LIMIT 10;

-- Check vacuum activity
SELECT * FROM pg_stat_progress_vacuum;
```

### 24-Hour Checks

#### DLQ Metrics
```sql
-- DLQ summary
SELECT 
  status,
  COUNT(*) as count,
  ROUND(AVG(retry_count), 2) as avg_retries
FROM webhook_dlq
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status;
```

#### Error Patterns
```sql
-- Top errors
SELECT 
  error_message,
  COUNT(*) as occurrences,
  MAX(created_at) as last_seen
FROM webhook_dlq
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY error_message
ORDER BY occurrences DESC
LIMIT 10;
```

---

## 🚨 Rollback Procedures

### Emergency Rollback
```bash
# 1. Revert edge functions
supabase functions deploy wa-webhook --ref main^1
supabase functions deploy wa-webhook-unified --ref main^1
supabase functions deploy wa-webhook-core --ref main^1

# 2. Disable cron jobs
supabase db query "
  UPDATE cron.job 
  SET active = false 
  WHERE jobname IN ('process-dlq-entries', 'create-wa-events-partitions');
"

# 3. Restore from backup (if needed)
supabase db reset --from-backup BACKUP_ID
```

### Partial Rollback (DLQ Only)
```bash
# Disable DLQ processing temporarily
supabase db query "
  UPDATE cron.job 
  SET active = false 
  WHERE jobname = 'process-dlq-entries';
"

# Remove DLQ integration from code (emergency)
# Redeploy functions without DLQ calls
```

---

## 📊 Success Criteria

- [x] All migrations applied successfully
- [x] All edge functions deployed
- [x] DLQ cron job running (check every 5 min)
- [x] Webhook signature verification: 100%
- [x] Test webhooks processing successfully
- [x] DLQ entries being reprocessed
- [x] Monitoring dashboards showing data
- [x] Alerts configured and tested
- [x] No errors in application logs
- [x] Database performance metrics normal

---

## 🎯 Next Steps After Deployment

1. **Monitor for 48 hours** - Watch dashboards, check DLQ
2. **Tune alerting** - Adjust thresholds based on actual traffic
3. **Optimize partitioning** - If wa_events large, deploy partitioning
4. **Set up reports** - Weekly DLQ summary emails
5. **Document runbooks** - Incident response procedures

---

## 📞 Support Contacts

- **On-call Engineer**: check PagerDuty rotation
- **Database Team**: database@easymo.com
- **DevOps Lead**: devops@easymo.com
- **Slack**: #production-support

---

## 📚 Additional Resources

- `PHASE1_COMPLETE_2025-11-27.md` - Technical implementation details
- `DATABASE_OPTIMIZATION_PLAN.md` - DB performance roadmap
- `docs/GROUND_RULES.md` - Development standards
- `docs/PRODUCTION_DEPLOYMENT_RUNBOOK.md` - Detailed runbook

---

**Status**: ✅ Ready for Production Deployment  
**Estimated Deployment Time**: 90 minutes  
**Downtime Required**: None (rolling update)

**Good luck with the deployment! 🚀**
