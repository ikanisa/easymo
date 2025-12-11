# Disaster Recovery Runbook - EasyMO Platform

**Version**: 1.0  
**Last Updated**: 2025-11-29  
**Owner**: Platform/DevOps Team  
**Severity Levels**: P0 (Critical) | P1 (High) | P2 (Medium) | P3 (Low)

---

## 📋 Quick Reference

### Emergency Contacts

| Role               | Contact              | Availability     |
| ------------------ | -------------------- | ---------------- |
| On-Call Engineer   | +254-XXX-XXXX        | 24/7             |
| Platform Lead      | platform@easymo.com  | 8am-6pm EAT      |
| Database Admin     | dba@easymo.com       | On-call rotation |
| Security Team      | security@easymo.com  | 24/7             |
| Incident Commander | incidents@easymo.com | On-call rotation |

### Critical URLs

```bash
# Production
https://app.easymo.com              # Main application
https://admin.easymo.com            # Admin panel
https://api.easymo.com              # API gateway

# Monitoring
https://grafana.easymo.com          # Dashboards
https://prometheus.easymo.com       # Metrics
https://sentry.easymo.com           # Error tracking

# Infrastructure
https://console.cloud.google.com    # GCP Console
https://supabase.com/dashboard      # Supabase Dashboard
```

### Service Status Dashboard

```bash
# Check all services
curl https://status.easymo.com/api/health

# Individual services
https://status.easymo.com/voice-bridge
https://status.easymo.com/agent-core
https://status.easymo.com/whatsapp-webhook
```

---

## 🚨 P0: Critical Service Outage

**Definition**: Complete service unavailable, revenue impact, customer-facing issues

### Incident Response Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. DETECT (0-5 min)                                         │
│    → Alerts fired, user reports, monitoring shows RED       │
├─────────────────────────────────────────────────────────────┤
│ 2. ACKNOWLEDGE (0-2 min)                                    │
│    → Page on-call engineer                                  │
│    → Post in #incidents Slack channel                       │
│    → Update status page: "Investigating"                    │
├─────────────────────────────────────────────────────────────┤
│ 3. ASSESS (2-10 min)                                        │
│    → Check Grafana dashboards                               │
│    → Review error logs in Sentry                            │
│    → Identify blast radius                                  │
├─────────────────────────────────────────────────────────────┤
│ 4. MITIGATE (10-30 min)                                     │
│    → Execute recovery playbook (see below)                  │
│    → Implement temporary workaround if needed               │
│    → Update status page with ETA                            │
├─────────────────────────────────────────────────────────────┤
│ 5. RESOLVE (30-60 min)                                      │
│    → Verify service restored                                │
│    → Monitor for regression                                 │
│    → Update status page: "Resolved"                         │
├─────────────────────────────────────────────────────────────┤
│ 6. POST-MORTEM (Within 48h)                                 │
│    → Document timeline                                      │
│    → Root cause analysis                                    │
│    → Action items to prevent recurrence                     │
└─────────────────────────────────────────────────────────────┘
```

### Recovery Playbooks

#### 1. Complete Platform Outage

**Symptoms**: All services down, no traffic

**Diagnosis**:

```bash
# Check GCP infrastructure
gcloud compute instances list --project=easymo-prod
gcloud container clusters list --project=easymo-prod

# Check Kubernetes pods
kubectl get pods -n production
kubectl get svc -n production

# Check database
psql -h db.easymo.com -U admin -d production -c "SELECT 1"
```

**Recovery Steps**:

```bash
# 1. Check cluster health
kubectl cluster-info
kubectl get nodes

# 2. If nodes are down, restart cluster
gcloud container clusters resize easymo-prod --num-nodes=3

# 3. Redeploy critical services
kubectl rollout restart deployment/whatsapp-webhook -n production
kubectl rollout restart deployment/agent-core -n production
kubectl rollout restart deployment/voice-bridge -n production

# 4. Verify health
kubectl get pods -n production -w
curl https://api.easymo.com/health

# 5. Check traffic
watch -n 5 'kubectl top pods -n production'
```

**Rollback**:

```bash
# If deployment caused outage, rollback
kubectl rollout undo deployment/whatsapp-webhook -n production
kubectl rollout status deployment/whatsapp-webhook -n production
```

---

#### 2. Database Failure

**Symptoms**: 500 errors, "connection refused", timeout errors

**Diagnosis**:

```bash
# Check Supabase status
curl https://status.supabase.com/api/v2/status.json

# Check connection from service
kubectl exec -it deployment/agent-core -n production -- \
  psql -h db.supabase.co -U postgres -d production -c "SELECT now()"

# Check replication lag
SELECT client_addr, state, sync_state,
       pg_wal_lsn_diff(pg_current_wal_lsn(), sent_lsn) AS lag
FROM pg_stat_replication;
```

**Recovery Steps**:

```bash
# 1. Failover to read replica (if available)
# Update connection string to point to replica
kubectl set env deployment/agent-core -n production \
  DATABASE_URL=postgresql://user:pass@replica.supabase.co/production

# 2. If primary is down, promote replica
# In Supabase dashboard: Database > Replicas > Promote to Primary

# 3. Restore from backup (last resort)
# In Supabase dashboard: Database > Backups > Restore
# Select latest point-in-time backup

# 4. Verify data integrity
psql -c "SELECT COUNT(*) FROM voice_calls WHERE created_at > NOW() - INTERVAL '1 hour'"
psql -c "SELECT COUNT(*) FROM whatsapp_messages WHERE created_at > NOW() - INTERVAL '1 hour'"
```

**Data Loss Prevention**:

```bash
# Point-in-time recovery (PITR)
# Supabase allows recovery to any point in last 7 days
# 1. Go to Supabase Dashboard > Database > Backups
# 2. Select "Point in Time Recovery"
# 3. Choose timestamp BEFORE incident
# 4. Restore to new database
# 5. Verify data, then switch connection string
```

---

#### 3. WhatsApp Webhook Failure

**Symptoms**: Messages not delivered, webhook timeouts, 524 errors

**Diagnosis**:

```bash
# Check webhook pod health
kubectl get pods -l app=whatsapp-webhook -n production
kubectl logs -f deployment/whatsapp-webhook -n production --tail=100

# Check Meta webhook verification
curl -X GET "https://api.easymo.com/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test"

# Check rate limits
curl -I https://graph.facebook.com/v18.0/me/messages
```

**Recovery Steps**:

```bash
# 1. Scale up pods if overwhelmed
kubectl scale deployment/whatsapp-webhook -n production --replicas=5

# 2. Check circuit breaker state
curl https://api.easymo.com/internal/circuit-breaker/status

# 3. Reset circuit breaker if stuck open
curl -X POST https://api.easymo.com/internal/circuit-breaker/reset

# 4. Clear message queue backlog
kubectl exec -it deployment/whatsapp-webhook-worker -n production -- \
  redis-cli -h redis.production LLEN wa_message_queue

# 5. Process backlog
kubectl scale deployment/whatsapp-webhook-worker -n production --replicas=10
```

**WhatsApp Business API Issues**:

```bash
# Check Meta API status
curl https://www.metastatus.com/api/v2/components.json | jq '.components[] | select(.name | contains("WhatsApp"))'

# Verify webhook subscription
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://graph.facebook.com/v18.0/YOUR_PHONE_ID/subscribed_apps"

# Resubscribe if needed
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  "https://graph.facebook.com/v18.0/YOUR_PHONE_ID/subscribed_apps"
```

---

#### 4. Agent-Core / AI Services Failure

**Symptoms**: AI responses timeout, 503 errors, agent not responding

**Diagnosis**:

```bash
# Check agent-core logs
kubectl logs -f deployment/agent-core -n production | grep ERROR

# Check OpenAI API status
curl https://status.openai.com/api/v2/status.json

# Check Google AI status
curl https://status.cloud.google.com/incidents.json

# Check circuit breaker
kubectl exec -it deployment/agent-core -n production -- \
  curl localhost:3000/internal/circuit-breaker/metrics
```

**Recovery Steps**:

```bash
# 1. Check API key validity
kubectl get secret ai-provider-keys -n production -o jsonpath='{.data.OPENAI_API_KEY}' | base64 -d

# 2. Switch to backup provider
kubectl set env deployment/agent-core -n production \
  PRIMARY_AI_PROVIDER=google

# 3. Increase timeouts temporarily
kubectl set env deployment/agent-core -n production \
  AI_REQUEST_TIMEOUT_MS=30000

# 4. Restart agent-core
kubectl rollout restart deployment/agent-core -n production

# 5. Verify AI responses
curl -X POST https://api.easymo.com/ai/test \
  -H "Content-Type: application/json" \
  -d '{"prompt":"test","user_id":"admin"}'
```

---

#### 5. Voice Bridge Failure

**Symptoms**: Calls not connecting, audio issues, Twilio errors

**Diagnosis**:

```bash
# Check voice-bridge logs
kubectl logs -f deployment/voice-bridge -n production

# Check Twilio status
curl https://status.twilio.com/api/v2/status.json

# Check SIP connectivity
kubectl exec -it deployment/voice-bridge -n production -- \
  curl -v sip:bridge@sip.easymo.com
```

**Recovery Steps**:

```bash
# 1. Restart voice-bridge
kubectl rollout restart deployment/voice-bridge -n production

# 2. Check Twilio credentials
kubectl get secret twilio-credentials -n production

# 3. Verify SIP configuration
kubectl exec -it deployment/voice-bridge -n production -- \
  cat /app/config/sip.yml

# 4. Test call flow
curl -X POST https://api.easymo.com/calls/outbound \
  -H "Content-Type: application/json" \
  -d '{"to":"+254712345678","from":"sip:test@easymo"}'
```

---

## 🔥 P1: High Priority Issues

### Rate Limiting Triggered

**Symptoms**: 429 errors, users blocked

**Recovery**:

```bash
# Check current rate limits
curl https://api.easymo.com/internal/rate-limit/status

# Identify affected IPs
kubectl logs deployment/voice-bridge -n production | grep "RATE_LIMIT_EXCEEDED"

# Temporarily increase limits (emergency only)
kubectl set env deployment/voice-bridge -n production \
  RATE_LIMIT_MAX=200

# Or whitelist specific IP
kubectl exec -it deployment/voice-bridge -n production -- \
  redis-cli SET "ratelimit:whitelist:192.168.1.1" "1" EX 3600
```

### Circuit Breaker Stuck Open

**Symptoms**: "Circuit breaker open" errors, services failing fast

**Recovery**:

```bash
# Check circuit breaker state
curl https://api.easymo.com/internal/circuit-breaker/metrics | jq '.["agent-core-api"]'

# Manual reset
curl -X POST https://api.easymo.com/internal/circuit-breaker/reset \
  -H "Content-Type: application/json" \
  -d '{"name":"agent-core-api"}'

# Verify recovery
watch -n 2 'curl -s https://api.easymo.com/internal/circuit-breaker/metrics | jq .state'
```

---

## 💾 Data Recovery Procedures

### Restore from Backup

**Daily Backups** (Automated):

- Location: GCS bucket `gs://easymo-prod-backups/supabase/`
- Retention: 30 days
- Schedule: Daily at 02:00 UTC

**Recovery Steps**:

```bash
# 1. List available backups
gsutil ls gs://easymo-prod-backups/supabase/

# 2. Download backup
gsutil cp gs://easymo-prod-backups/supabase/backup-2025-11-29.sql.gz /tmp/

# 3. Restore to test database first
gunzip /tmp/backup-2025-11-29.sql.gz
psql -h db-test.supabase.co -U postgres -d test_restore < /tmp/backup-2025-11-29.sql

# 4. Verify data integrity
psql -h db-test.supabase.co -d test_restore -c "SELECT COUNT(*) FROM users"

# 5. If verified, restore to production
# CAUTION: This will overwrite current data
psql -h db.supabase.co -U postgres -d production < /tmp/backup-2025-11-29.sql
```

### Point-in-Time Recovery (PITR)

**Available for**: Last 7 days (Supabase Pro plan)

**Steps**:

1. Navigate to Supabase Dashboard > Database > Backups
2. Click "Point in Time Recovery"
3. Select exact timestamp (e.g., "2025-11-29 08:45:23")
4. Choose recovery destination:
   - New database (recommended for testing)
   - Overwrite current database (destructive)
5. Monitor restoration progress
6. Verify data integrity
7. Update application connection string if needed

### Manual Data Export

```bash
# Export specific tables
pg_dump -h db.supabase.co -U postgres -d production \
  -t voice_calls -t whatsapp_messages -t transactions \
  > critical_data_export_$(date +%Y%m%d_%H%M%S).sql

# Export to CSV for analysis
psql -h db.supabase.co -d production -c "\COPY voice_calls TO '/tmp/voice_calls.csv' CSV HEADER"
```

---

## 🔄 Rollback Procedures

### Application Rollback

```bash
# List deployment history
kubectl rollout history deployment/whatsapp-webhook -n production

# Rollback to previous version
kubectl rollout undo deployment/whatsapp-webhook -n production

# Rollback to specific revision
kubectl rollout undo deployment/whatsapp-webhook -n production --to-revision=5

# Monitor rollback
kubectl rollout status deployment/whatsapp-webhook -n production
```

### Database Migration Rollback

```bash
# Prisma migrations
cd packages/db
pnpm prisma migrate resolve --rolled-back "20251129_broken_migration"

# Supabase migrations
cd supabase
supabase db reset --db-url postgresql://...

# Manual SQL rollback
psql -h db.supabase.co -d production < migrations/rollback_20251129.sql
```

---

## 📊 Verification & Testing

### Post-Recovery Checklist

```bash
# 1. Health checks
curl https://api.easymo.com/health | jq '.status'
curl https://admin.easymo.com/api/health | jq '.status'

# 2. Critical flows
# - User can send WhatsApp message
# - Agent responds correctly
# - Voice call connects
# - Transaction completes

# 3. Monitor error rates
# Should be < 1% within 5 minutes of recovery
curl https://prometheus.easymo.com/api/v1/query?query=rate(http_requests_total{status=~"5.."}[5m])

# 4. Check data consistency
psql -d production -c "
  SELECT
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '5 min') as recent_records,
    COUNT(*) FILTER (WHERE created_at IS NULL) as null_timestamps
  FROM voice_calls
"

# 5. Verify integrations
# - WhatsApp webhook receiving
# - Twilio calls working
# - OpenAI API responding
# - Payment gateway active
```

---

## 📞 Escalation Matrix

### Incident Severity

| Level | Description          | Response Time | Escalation            |
| ----- | -------------------- | ------------- | --------------------- |
| P0    | Complete outage      | < 5 min       | Immediate - all hands |
| P1    | Partial outage       | < 15 min      | Senior engineer       |
| P2    | Degraded performance | < 1 hour      | On-call engineer      |
| P3    | Minor issue          | < 4 hours     | Next business day     |

### Escalation Path

```
1. On-Call Engineer (0-15 min)
   ↓ (if not resolved)
2. Senior Platform Engineer (15-30 min)
   ↓ (if not resolved)
3. Platform Lead (30-60 min)
   ↓ (if not resolved)
4. CTO / VP Engineering (60+ min)
```

---

## 📝 Post-Incident Process

### Post-Mortem Template

```markdown
# Incident Post-Mortem - [INCIDENT ID]

**Date**: 2025-11-29 **Duration**: 45 minutes **Severity**: P0 **Services Affected**:
whatsapp-webhook, agent-core **Impact**: 10,000 users unable to send messages

## Timeline

- 08:00 UTC: First alert triggered
- 08:02 UTC: On-call engineer paged
- 08:05 UTC: Incident declared, #incidents channel opened
- 08:15 UTC: Root cause identified (database connection pool exhausted)
- 08:25 UTC: Mitigation applied (increased pool size)
- 08:45 UTC: Service fully restored

## Root Cause

Database connection pool configured for 20 connections, but peak load reached 35 concurrent queries.

## Resolution

- Increased pool size from 20 to 50
- Added connection pool monitoring alert
- Implemented connection pool metrics dashboard

## Action Items

- [ ] Update connection pool defaults in all services (Owner: @platform)
- [ ] Add load testing for connection pool limits (Owner: @qa)
- [ ] Document connection pool sizing guide (Owner: @docs)
- [ ] Schedule review of all resource limits (Owner: @sre)

## Lessons Learned

1. Connection pool limits should be tested under load
2. Need better visibility into connection pool metrics
3. Alert thresholds need adjustment (current: 80% pool usage)
```

---

## 🔐 Security Incident Response

### Suspected Breach

**Immediate Actions**:

```bash
# 1. Rotate all API keys
kubectl create secret generic ai-provider-keys \
  --from-literal=OPENAI_API_KEY=new_key \
  --from-literal=GOOGLE_AI_KEY=new_key \
  --dry-run=client -o yaml | kubectl apply -f -

# 2. Revoke compromised tokens
psql -d production -c "
  UPDATE api_tokens SET revoked_at = NOW()
  WHERE created_by = 'SUSPECTED_USER_ID'
"

# 3. Enable audit logging
kubectl set env deployment/agent-core -n production \
  AUDIT_LOG_LEVEL=debug

# 4. Review access logs
kubectl logs deployment/agent-core -n production --since=24h | grep "UNAUTHORIZED"
```

### DDoS Attack

```bash
# 1. Enable aggressive rate limiting
kubectl set env deployment/whatsapp-webhook -n production \
  RATE_LIMIT_MAX=10 \
  RATE_LIMIT_WINDOW_MS=60000

# 2. Block malicious IPs
kubectl exec -it deployment/nginx -n production -- \
  nginx -s reload -c /etc/nginx/nginx.conf

# 3. Enable Cloudflare "Under Attack" mode
# Via Cloudflare dashboard

# 4. Monitor attack metrics
watch -n 5 'kubectl top pods -n production'
```

---

## 📚 Runbook Maintenance

**Review Schedule**: Monthly  
**Owner**: Platform Team  
**Last Review**: 2025-11-29

**Update Triggers**:

- New service deployed
- Infrastructure change
- Post-incident learnings
- Quarterly review

**Version Control**: This runbook is stored in `docs/disaster-recovery.md`

---

## 🎯 Success Metrics

**Recovery Time Objectives (RTO)**:

- P0 incidents: < 1 hour
- P1 incidents: < 4 hours
- P2 incidents: < 24 hours

**Recovery Point Objectives (RPO)**:

- Database: < 15 minutes (PITR)
- File storage: < 1 hour (backup frequency)
- Configuration: < 5 minutes (GitOps)

**Targets**:

- Uptime: 99.9% (< 43 minutes downtime/month)
- MTTR (Mean Time to Recovery): < 30 minutes
- MTBF (Mean Time Between Failures): > 720 hours (30 days)

---

**END OF RUNBOOK**

_For questions or updates, contact: platform@easymo.com_
