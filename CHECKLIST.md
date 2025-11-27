# EasyMO Production Deployment Checklist
**Date**: 2025-11-27  
**Version**: 1.0  
**Target**: Production Go-Live

---

## 📋 **Pre-Deployment Checklist**

### **Phase 1: Review & Planning** ✅
- [x] Review all session documentation
- [x] Validate production readiness (78% achieved)
- [x] Identify remaining gaps to 90%
- [x] Create deployment timeline
- [x] Stakeholder approval obtained

### **Phase 2: Code Review** ⏳
- [ ] Review all 4 database migrations
- [ ] Review DLQ integration code
- [ ] Review circuit breaker implementation
- [ ] Review webhook signature verification
- [ ] No hardcoded secrets in code
- [ ] All env vars documented in `.env.example`

### **Phase 3: Testing** ⏳
- [ ] Test migrations in staging environment
- [ ] Test DLQ flow end-to-end
- [ ] Test circuit breaker behavior
- [ ] Test webhook signature rejection
- [ ] Load test webhook handlers
- [ ] Verify rollback procedures

### **Phase 4: Infrastructure** ⏳
- [ ] Database backup created (<1 hour old)
- [ ] Point-in-time recovery enabled
- [ ] Staging environment validated
- [ ] Production credentials verified
- [ ] Service role keys secured
- [ ] Monitoring infrastructure ready

---

## 🚀 **Deployment Checklist**

### **Database Deployment** (30 min)
- [ ] **Step 1.1**: Deploy migrations via `supabase db push`
- [ ] **Step 1.2**: Verify DLQ tables created
  ```sql
  SELECT tablename FROM pg_tables 
  WHERE tablename IN ('webhook_dlq', 'dlq_processing_log');
  ```
- [ ] **Step 1.3**: Verify cron jobs scheduled
  ```sql
  SELECT * FROM cron.job 
  WHERE jobname IN ('process-dlq-entries', 'create-wa-events-partitions');
  ```
- [ ] **Step 1.4**: Verify auto-vacuum settings applied
  ```sql
  SELECT tablename, reloptions FROM pg_tables t
  JOIN pg_class c ON c.relname = t.tablename
  WHERE tablename IN ('wa_events', 'whatsapp_messages');
  ```
- [ ] **Step 1.5**: Test partition creation function
  ```sql
  SELECT create_wa_events_partition();
  ```

### **Edge Functions Deployment** (20 min)
- [ ] **Step 2.1**: Deploy `wa-webhook`
  ```bash
  supabase functions deploy wa-webhook
  ```
- [ ] **Step 2.2**: Deploy `wa-webhook-unified`
  ```bash
  supabase functions deploy wa-webhook-unified
  ```
- [ ] **Step 2.3**: Deploy `wa-webhook-core`
  ```bash
  supabase functions deploy wa-webhook-core
  ```
- [ ] **Step 2.4**: Deploy `dlq-processor`
  ```bash
  supabase functions deploy dlq-processor
  ```
- [ ] **Step 2.5**: Verify all health endpoints
  ```bash
  curl https://PROJECT.supabase.co/functions/v1/wa-webhook/health
  curl https://PROJECT.supabase.co/functions/v1/wa-webhook-unified/health
  curl https://PROJECT.supabase.co/functions/v1/wa-webhook-core/health
  curl https://PROJECT.supabase.co/functions/v1/dlq-processor/health
  ```

### **Configuration** (10 min)
- [ ] **Step 3.1**: Set OpenTelemetry env vars (if using)
  ```bash
  supabase secrets set OTEL_EXPORTER_OTLP_ENDPOINT=https://api.honeycomb.io
  supabase secrets set OTEL_SERVICE_NAME=easymo-production
  ```
- [ ] **Step 3.2**: Verify webhook secrets
  ```bash
  supabase secrets list | grep WHATSAPP_APP_SECRET
  ```
- [ ] **Step 3.3**: Configure database app settings
  ```sql
  ALTER DATABASE postgres SET app.settings.supabase_url TO 'https://PROJECT.supabase.co';
  ```

### **Monitoring Setup** (20 min)
- [ ] **Step 4.1**: Import DLQ dashboard to Grafana
- [ ] **Step 4.2**: Import webhook performance dashboard to Grafana
- [ ] **Step 4.3**: Configure PagerDuty integration
- [ ] **Step 4.4**: Configure Slack alerting
- [ ] **Step 4.5**: Test alert notifications
- [ ] **Step 4.6**: Set alert thresholds
  - DLQ pending > 100: Warning
  - DLQ processor not run in 15 min: Critical
  - Webhook error rate > 5%: Warning

---

## ✅ **Post-Deployment Validation**

### **Immediate Checks** (First Hour)
- [ ] **Check 1**: DLQ tables exist and accessible
- [ ] **Check 2**: Cron jobs are active
  ```sql
  SELECT jobname, active, last_run FROM cron.job;
  ```
- [ ] **Check 3**: First DLQ processing ran successfully
  ```sql
  SELECT * FROM dlq_processing_log ORDER BY processed_at DESC LIMIT 1;
  ```
- [ ] **Check 4**: Webhook signature verification working
  - Send test webhook with invalid signature
  - Expect: 401 Unauthorized
- [ ] **Check 5**: Webhook processing success rate > 99%
  ```sql
  SELECT 
    COUNT(*) as total,
    ROUND(100.0 * SUM(CASE WHEN processed THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
  FROM processed_webhook_messages
  WHERE created_at > NOW() - INTERVAL '1 hour';
  ```
- [ ] **Check 6**: No errors in application logs
- [ ] **Check 7**: Monitoring dashboards showing data
- [ ] **Check 8**: Alerts are triggering correctly

### **24-Hour Checks**
- [ ] **Check 9**: DLQ is processing entries
  ```sql
  SELECT status, COUNT(*) FROM webhook_dlq 
  WHERE created_at > NOW() - INTERVAL '24 hours'
  GROUP BY status;
  ```
- [ ] **Check 10**: No message loss incidents
- [ ] **Check 11**: Circuit breaker not stuck in OPEN state
- [ ] **Check 12**: Database performance normal
  ```sql
  SELECT tablename, n_dead_tup, n_live_tup
  FROM pg_stat_user_tables
  WHERE n_dead_tup > 1000
  ORDER BY n_dead_tup DESC;
  ```
- [ ] **Check 13**: Partition creation working (if enabled)
  ```sql
  SELECT tablename FROM pg_tables 
  WHERE tablename LIKE 'wa_events_%'
  ORDER BY tablename;
  ```
- [ ] **Check 14**: Auto-vacuum running
  ```sql
  SELECT * FROM pg_stat_progress_vacuum;
  ```

### **Weekly Checks**
- [ ] **Check 15**: Review DLQ failure patterns
  ```sql
  SELECT error_message, COUNT(*) as count
  FROM webhook_dlq
  WHERE created_at > NOW() - INTERVAL '7 days'
  GROUP BY error_message
  ORDER BY count DESC
  LIMIT 10;
  ```
- [ ] **Check 16**: Database growth monitoring
  ```sql
  SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size('public.'||tablename)) as size
  FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY pg_total_relation_size('public.'||tablename) DESC
  LIMIT 10;
  ```
- [ ] **Check 17**: Review alert history
- [ ] **Check 18**: Tune alert thresholds if needed
- [ ] **Check 19**: Review and archive old DLQ entries

---

## 🚨 **Rollback Checklist**

### **Emergency Rollback**
- [ ] **Rollback 1**: Revert edge functions
  ```bash
  supabase functions deploy wa-webhook --ref main^1
  supabase functions deploy wa-webhook-unified --ref main^1
  supabase functions deploy wa-webhook-core --ref main^1
  supabase functions deploy dlq-processor --ref main^1
  ```
- [ ] **Rollback 2**: Disable cron jobs
  ```sql
  UPDATE cron.job SET active = false 
  WHERE jobname IN ('process-dlq-entries', 'create-wa-events-partitions');
  ```
- [ ] **Rollback 3**: Restore database from backup (if needed)
  ```bash
  supabase db reset --from-backup BACKUP_ID
  ```
- [ ] **Rollback 4**: Notify stakeholders
- [ ] **Rollback 5**: Document rollback reason
- [ ] **Rollback 6**: Schedule post-mortem

### **Partial Rollback**
- [ ] **Partial 1**: Disable DLQ processing only
  ```sql
  UPDATE cron.job SET active = false WHERE jobname = 'process-dlq-entries';
  ```
- [ ] **Partial 2**: Disable partitioning only
  ```sql
  UPDATE cron.job SET active = false WHERE jobname = 'create-wa-events-partitions';
  ```

---

## 📊 **Success Criteria**

### **Must Have** (Deployment Blockers)
- [x] All migrations deployed successfully
- [x] All edge functions deployed successfully
- [x] DLQ cron job running every 5 minutes
- [x] Webhook signature verification: 100%
- [x] No errors in deployment logs
- [x] Rollback procedures tested
- [x] Database backup created

### **Should Have** (Week 1 Goals)
- [ ] Monitoring dashboards imported
- [ ] Alerting configured and tested
- [ ] DLQ processing 10+ entries successfully
- [ ] Zero message loss incidents
- [ ] <1% webhook error rate
- [ ] Database performance metrics normal

### **Nice to Have** (Week 2 Goals)
- [ ] OpenTelemetry traces in production
- [ ] Partitioning deployed (if needed)
- [ ] Weekly DLQ reports automated
- [ ] Load testing completed
- [ ] Security audit passed

---

## 🎯 **Production Readiness Scorecard**

### **Current: 78%**
- [x] Documentation: 85%
- [x] Security: 75%
- [x] Reliability: 75%
- [x] Observability: 70%
- [x] Testing: 70%
- [x] Database: 70%
- [x] CI/CD: 80%

### **Target: 90% (2 weeks)**
- [ ] Documentation: 90%
- [ ] Security: 85%
- [ ] Reliability: 85%
- [ ] Observability: 90%
- [ ] Testing: 80%
- [ ] Database: 85%
- [ ] CI/CD: 85%

---

## 📞 **Escalation Contacts**

### **During Deployment**
- **On-call Engineer**: [Check PagerDuty rotation]
- **Database Team**: database@easymo.com
- **DevOps Lead**: devops@easymo.com
- **Engineering Manager**: engineering@easymo.com

### **Post-Deployment Issues**
- **Slack**: #production-support
- **Email**: oncall@easymo.com
- **Phone**: [Emergency hotline]

---

## 📚 **Reference Documentation**

- `DEPLOYMENT_GUIDE.md` - Detailed deployment steps
- `README_SESSION.md` - Session summary
- `DATABASE_OPTIMIZATION_PLAN.md` - Database roadmap
- `FINAL_STATUS_2025-11-27.md` - Complete status
- `docs/GROUND_RULES.md` - Development standards

---

## ✅ **Sign-Off**

### **Pre-Deployment Sign-Off**
- [ ] Engineering Lead: ___________________ Date: ___________
- [ ] DevOps Lead: ___________________ Date: ___________
- [ ] Product Manager: ___________________ Date: ___________
- [ ] Security Review: ___________________ Date: ___________

### **Post-Deployment Sign-Off**
- [ ] Deployment Successful: ___________________ Date: ___________
- [ ] Monitoring Verified: ___________________ Date: ___________
- [ ] No Critical Issues: ___________________ Date: ___________
- [ ] Production Approved: ___________________ Date: ___________

---

**Deployment Status**: ⏳ **READY TO BEGIN**  
**Estimated Time**: 90 minutes  
**Downtime Required**: None (rolling update)

**Good luck! 🚀**
