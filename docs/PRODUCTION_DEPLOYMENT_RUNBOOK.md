# Production Deployment Runbook - EasyMO v2.0

**Version**: 2.0.0  
**Last Updated**: 2025-11-11  
**Owner**: DevOps + Engineering  
**Estimated Duration**: 2 hours (including monitoring)  
**Downtime**: Zero (rolling update)

---

## 📋 Pre-Deployment Checklist

### 1. Staging Validation ✅

- [ ] All tests passing in staging (84 unit + 21 synthetic)
- [ ] Load test completed (100 concurrent users, <2% error rate)
- [ ] Manual E2E testing complete (all user flows)
- [ ] Performance benchmarks met (p95 <1s)
- [ ] QA sign-off received
- [ ] Product sign-off received
- [ ] Security review complete

### 2. Team Readiness ✅

- [ ] On-call engineer identified and alerted
- [ ] Backup engineer on standby
- [ ] Engineering manager notified
- [ ] Support team briefed
- [ ] Stakeholders notified (email sent)
- [ ] War room channel created (#v2-deployment)

### 3. Infrastructure Readiness ✅

- [ ] Production environment healthy (check dashboards)
- [ ] Database backup completed (<1 hour old)
- [ ] Rollback plan validated
- [ ] Monitoring dashboards configured
- [ ] Alerting rules active (PagerDuty/Slack)
- [ ] Feature flags configured (start at 1%)

### 4. Code Readiness ✅

- [ ] Latest code in `main` branch
- [ ] All CI checks passing
- [ ] Version tagged (`v2.0.0`)
- [ ] Changelog updated
- [ ] Migration scripts tested in staging

---

## 🚀 Deployment Timeline

**Total Duration**: ~2 hours  
**Launch Window**: Tuesday 9:00 AM - 11:00 AM EAT (off-peak)

| Phase          | Duration | Start Time | Activities                      |
| -------------- | -------- | ---------- | ------------------------------- |
| Pre-Deploy     | 15 min   | 08:45 AM   | Final checks, team sync         |
| Database       | 15 min   | 09:00 AM   | Backup + migrations             |
| Edge Functions | 10 min   | 09:15 AM   | Deploy Supabase functions       |
| Microservices  | 20 min   | 09:25 AM   | Rolling update (12 services)    |
| Feature Flags  | 5 min    | 09:45 AM   | Enable at 1%                    |
| Smoke Tests    | 15 min   | 09:50 AM   | Automated + manual              |
| Monitoring     | 60 min   | 10:05 AM   | Watch metrics, collect feedback |
| Sign-Off       | 10 min   | 11:05 AM   | Confirm success, notify         |

---

## 🔧 Phase 1: Pre-Deployment (15 minutes)

### 1.1 Team Sync (08:45 AM)

**Slack Announcement**:

```
@channel 🚀 EasyMO v2.0 Deployment Starting

Timeline: 09:00 AM - 11:00 AM EAT
War Room: #v2-deployment
On-Call: @engineer-name
Status Page: https://status.easymo.com

Expected downtime: ZERO (rolling update)
Rollout: 1% → 100% over 10 days

Stand by for updates! 📊
```

### 1.2 Final Health Check

```bash
# Check production services
kubectl get pods -n easymo-prod
# All should be Running (0 CrashLoopBackOff)

# Check databases
psql -h prod-db.easymo.com -c "SELECT 1;"
# Should return: 1

# Check Supabase
curl https://lhbowpbcpwoiparwnwgt.supabase.co/rest/v1/
# Should return: 200 OK

# Check Redis
redis-cli -h prod-redis.easymo.com PING
# Should return: PONG

# Check Kafka
kafka-topics.sh --list --bootstrap-server prod-kafka:9092
# Should list topics
```

### 1.3 Set Maintenance Mode (Optional)

If deploying during business hours, optionally enable maintenance banner:

```bash
# Admin dashboard banner
curl -X POST https://api.easymo.com/admin/banner \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"message": "System upgrade in progress. Service uninterrupted.", "type": "info"}'
```

---

## 💾 Phase 2: Database Migrations (15 minutes)

### 2.1 Backup Database (5 minutes)

**CRITICAL: Always backup before migrations!**

```bash
# Set timestamp
BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Backup Supabase DB
pg_dump -h lhbowpbcpwoiparwnwgt.db.supabase.co \
  -U postgres \
  -d postgres \
  -F c \
  -f backups/supabase_prod_${BACKUP_TIMESTAMP}.dump

# Backup Agent-Core DB
pg_dump -h prod-agent-db.easymo.com \
  -U easymo_admin \
  -d agent_core_prod \
  -F c \
  -f backups/agent_core_prod_${BACKUP_TIMESTAMP}.dump

# Verify backups
ls -lh backups/*.dump
# Should show two recent files

# Upload to S3 (secure storage)
aws s3 cp backups/supabase_prod_${BACKUP_TIMESTAMP}.dump \
  s3://easymo-db-backups/v2-migration/
aws s3 cp backups/agent_core_prod_${BACKUP_TIMESTAMP}.dump \
  s3://easymo-db-backups/v2-migration/
```

### 2.2 Apply Supabase Migrations (5 minutes)

```bash
# Set Supabase project
export SUPABASE_PROJECT_REF=lhbowpbcpwoiparwnwgt

# Apply migrations (additive only, per ground rules)
supabase db push --project-ref $SUPABASE_PROJECT_REF

# Verify new tables created
psql -h lhbowpbcpwoiparwnwgt.db.supabase.co -U postgres <<EOF
\dt agent_*
-- Should show:
-- agent_sessions
-- agent_requests
-- agent_metrics
-- agent_fallbacks
EOF

# Check row counts (should be 0 for new tables)
psql -h lhbowpbcpwoiparwnwgt.db.supabase.co -U postgres <<EOF
SELECT
  'agent_sessions' as table, COUNT(*) as rows FROM agent_sessions
UNION ALL
SELECT 'agent_requests', COUNT(*) FROM agent_requests
UNION ALL
SELECT 'agent_metrics', COUNT(*) FROM agent_metrics
UNION ALL
SELECT 'agent_fallbacks', COUNT(*) FROM agent_fallbacks;
EOF
# All should show 0 rows (new tables)
```

### 2.3 Apply Agent-Core Migrations (5 minutes)

```bash
# Set database URL
export DATABASE_URL="postgresql://easymo_admin:password@prod-agent-db.easymo.com:5432/agent_core_prod"

# Run Prisma migrations
pnpm --filter @easymo/db prisma:migrate:deploy

# Verify migrations applied
pnpm --filter @easymo/db prisma:migrate:status
# Should show: No pending migrations

# Generate Prisma client (if needed)
pnpm --filter @easymo/db prisma:generate
```

**Rollback Point 1**: If migrations fail, see Rollback Procedures section.

---

## ☁️ Phase 3: Deploy Edge Functions (10 minutes)

### 3.1 Deploy Supabase Functions

```bash
# Deploy all functions at once
supabase functions deploy --project-ref $SUPABASE_PROJECT_REF --no-verify-jwt

# Or deploy individually (safer)
supabase functions deploy wa-webhook --project-ref $SUPABASE_PROJECT_REF --no-verify-jwt
supabase functions deploy admin-agents --project-ref $SUPABASE_PROJECT_REF --no-verify-jwt
supabase functions deploy admin-metrics --project-ref $SUPABASE_PROJECT_REF --no-verify-jwt
# ... repeat for all functions

# Verify deployment
curl https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/_health
# Expected: {"status":"healthy","version":"2.0.0"}
```

> **JWT Verification Policy**  
> Supabase’s “Verify JWT with legacy secret” switch must remain **OFF** for every WhatsApp-facing function. Always deploy with `--no-verify-jwt` (as shown above) and, after each deploy, visit Supabase Dashboard → Functions → Settings to confirm the Legacy JWT toggle is disabled. All authentication is handled inside the functions via WhatsApp HMAC signatures; leaving the legacy check enabled will reject legitimate webhook traffic.

### 3.2 Test Webhook Endpoint

```bash
# Test WhatsApp webhook (verification)
curl -X GET "https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook?hub.mode=subscribe&hub.challenge=test&hub.verify_token=$WA_VERIFY_TOKEN"
# Expected: test

# Test webhook message processing (dry run)
curl -X POST https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "250780000000",
            "type": "text",
            "text": {"body": "test"}
          }]
        }
      }]
    }]
  }'
# Expected: 200 OK (check logs for processing)
```

**Rollback Point 2**: If edge functions fail, redeploy previous version.

---

## 🐳 Phase 4: Deploy Microservices (20 minutes)

### 4.1 Update Docker Images

```bash
# Build and push new images (CI should handle this)
# If manual deployment needed:

docker build -t easymo/agent-core:v2.0.0 services/agent-core/
docker push easymo/agent-core:v2.0.0

docker build -t easymo/ranking-service:v2.0.0 services/ranking-service/
docker push easymo/ranking-service:v2.0.0

# ... repeat for all 12 services
```

### 4.2 Deploy with Zero Downtime (Rolling Update)

```bash
# Deploy agent-core (central orchestration)
kubectl set image deployment/agent-core \
  agent-core=easymo/agent-core:v2.0.0 \
  -n easymo-prod

kubectl rollout status deployment/agent-core -n easymo-prod
# Wait for: deployment "agent-core" successfully rolled out

# Deploy ranking-service
kubectl set image deployment/ranking-service \
  ranking-service=easymo/ranking-service:v2.0.0 \
  -n easymo-prod

kubectl rollout status deployment/ranking-service -n easymo-prod

# Deploy wallet-service
kubectl set image deployment/wallet-service \
  wallet-service=easymo/wallet-service:v2.0.0 \
  -n easymo-prod

kubectl rollout status deployment/wallet-service -n easymo-prod

# Deploy vendor-service
kubectl set image deployment/vendor-service \
  vendor-service=easymo/vendor-service:v2.0.0 \
  -n easymo-prod

kubectl rollout status deployment/vendor-service -n easymo-prod

# ... repeat for remaining 8 services:
# - buyer-service
# - station-service
# - driver-service
# - voice-bridge
# - marketplace-service
# - property-service
# - healthcare-service
# - customer-support-service
```

### 4.3 Verify Deployments

```bash
# Check all pods are running
kubectl get pods -n easymo-prod | grep -v Running
# Should return nothing (all Running)

# Check logs for errors
kubectl logs -n easymo-prod deployment/agent-core --tail=50
# Should show: "Agent Core v2.0.0 started successfully"

# Check service health endpoints
curl https://api.easymo.com/health/agent-core
curl https://api.easymo.com/health/ranking-service
curl https://api.easymo.com/health/wallet-service
curl https://api.easymo.com/health/whatsapp-webhook-worker | jq
# All should return: 200 OK
# WhatsApp webhook worker health must report:
#   "status": "ok"
#   "checks.openai.status": "ok"
#   "checks.redis.status": "ok"
#   "checks.supabase.status": "ok"
# If any probe is "fail" or the endpoint returns HTTP 503, pause the rollout
# and investigate Redis, Supabase, or OpenAI connectivity before proceeding.
```

**Rollback Point 3**: If deployments fail, rollback via kubectl.

---

## 🎛️ Phase 5: Enable Feature Flags (5 minutes)

### 5.1 Start with 1% Rollout

```bash
# Set environment variables (Kubernetes ConfigMap)
kubectl create configmap feature-flags \
  --from-literal=FEATURE_AI_AGENTS=true \
  --from-literal=FEATURE_AI_AGENTS_ROLLOUT_PERCENTAGE=1 \
  --from-literal=FEATURE_BUYER_AGENT=true \
  --from-literal=FEATURE_STATION_AGENT=true \
  --from-literal=FEATURE_VENDOR_AGENT=true \
  --from-literal=FEATURE_DRIVER_AGENT=true \
  --from-literal=FEATURE_ADMIN_AGENT=true \
  --from-literal=FEATURE_CUSTOMER_SUPPORT_AGENT=true \
  --from-literal=FEATURE_MARKETPLACE_AGENT=false \
  -n easymo-prod \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart pods to pick up new config
kubectl rollout restart deployment/agent-core -n easymo-prod
kubectl rollout status deployment/agent-core -n easymo-prod
```

### 5.2 Verify Feature Flags Active

```bash
# Check environment variable
kubectl exec -n easymo-prod deployment/agent-core -- \
  env | grep FEATURE_AI_AGENTS
# Expected: FEATURE_AI_AGENTS=true
# Expected: FEATURE_AI_AGENTS_ROLLOUT_PERCENTAGE=1

# Test with internal user (whitelisted for testing)
# Send test WhatsApp message from internal number
# Should route to AI agent (check logs)
```

---

## 🧪 Phase 6: Smoke Tests (15 minutes)

### 6.1 Automated Tests

```bash
# Run smoke test suite
./scripts/prod-smoke-test.sh

# Expected output:
# ✅ Database connectivity: PASS
# ✅ Supabase functions: PASS
# ✅ Microservices health: PASS
# ✅ WhatsApp webhook: PASS
# ✅ Agent routing: PASS (1% traffic)
# ✅ Fallback mechanisms: PASS
# ✅ Payment integration: PASS
```

### 6.2 Manual Tests (Internal Team)

**Test Scenarios**:

1. **AI Agent Flow** (Internal WhatsApp Number):

   ```
   Send: "I need vegetables"
   Expected: AI agent responds with vendors
   Verify: Check logs for agent routing
   ```

2. **Traditional Flow** (Send "MENU"):

   ```
   Send: "MENU"
   Expected: Menu buttons appear
   Verify: No AI agent triggered
   ```

3. **Fallback Scenario** (Temporarily disable agent):

   ```
   Disable agent → Send message
   Expected: Graceful fallback to menu
   Re-enable agent
   ```

4. **Payment Flow**:

   ```
   Complete order → Pay with wallet
   Expected: Payment successful, balance updated
   ```

5. **Admin Dashboard**:
   ```
   Navigate to /agents/dashboard
   Expected: Metrics flowing, 1% rollout visible
   ```

### 6.3 Check Metrics

```bash
# Open monitoring dashboards
open https://admin.easymo.com/agents/dashboard

# Verify metrics:
# - Request volume: Low (1% traffic)
# - Success rate: >99%
# - Response time p95: <1s
# - Fallback rate: <10%
# - Error rate: <1%
```

**Rollback Point 4**: If smoke tests fail, disable feature flags immediately.

---

## 📊 Phase 7: Monitoring (60 minutes)

### 7.1 First Hour Intensive Monitoring

**Dashboard Checklist** (check every 10 minutes):

- [ ] **Error Rate**: <1% ✅
- [ ] **Response Time p95**: <1s ✅
- [ ] **Fallback Rate**: <10% ✅
- [ ] **Agent Success Rate**: >99% ✅
- [ ] **Database Connections**: Normal ✅
- [ ] **Redis Hit Rate**: >80% ✅
- [ ] **Kafka Lag**: <100ms ✅

**Log Monitoring**:

```bash
# Watch agent-core logs
kubectl logs -f -n easymo-prod deployment/agent-core | grep ERROR

# Watch Supabase function logs
supabase functions logs wa-webhook --project-ref $SUPABASE_PROJECT_REF --tail

# Watch for fallback events
psql -h prod-db -c "SELECT COUNT(*) FROM agent_fallbacks WHERE created_at > NOW() - INTERVAL '10 minutes';"
# Should be low (<10)
```

**User Feedback**:

- Monitor support tickets (should be minimal)
- Check #user-feedback Slack channel
- Watch for error reports in WhatsApp

### 7.2 Alerts Configuration

Ensure these alerts are active:

```yaml
# PagerDuty / Slack Alerts
- name: High Error Rate
  condition: error_rate > 0.05
  action: Page on-call engineer

- name: Service Down
  condition: uptime < 0.99
  action: Page engineering manager

- name: High Fallback Rate
  condition: fallback_rate > 0.30
  action: Slack #engineering-alerts

- name: Slow Response
  condition: p95_response_time > 2000
  action: Slack #engineering-alerts
```

### 7.3 Rollout Decision Point (10:05 AM)

**After 1 hour, decide**:

✅ **Proceed** if:

- Error rate <1%
- No critical issues
- User feedback positive
- Support tickets normal

⚠️ **Hold** if:

- Error rate 1-5%
- Minor issues (fixable)
- Investigate further

🛑 **Rollback** if:

- Error rate >5%
- Critical bugs
- User complaints spike
- System instability

---

## ✅ Phase 8: Sign-Off (10 minutes)

### 8.1 Success Confirmation

```bash
# Generate deployment report
./scripts/deployment-report.sh > deployment_report_v2.0.0.txt

# Should include:
# - All services: ✅ Healthy
# - Database: ✅ Migrations applied
# - Feature flags: ✅ Active at 1%
# - Tests: ✅ All passing
# - Metrics: ✅ Within targets
# - Incidents: 0
```

### 8.2 Team Notifications

**Slack Announcement**:

```
@channel ✅ EasyMO v2.0 Deployment SUCCESSFUL!

Status: LIVE (1% rollout)
Duration: 2 hours
Downtime: 0 minutes
Errors: 0 critical

Next Steps:
- Continue monitoring for 24 hours
- Increase rollout to 5% tomorrow
- Full rollout by Day 10

Thanks to the team! 🎉

Dashboard: https://admin.easymo.com/agents/dashboard
```

**Email to Stakeholders**:

```
Subject: EasyMO v2.0 Successfully Deployed

Hi Team,

EasyMO v2.0 "Intelligent Mobility" has been successfully deployed to production!

Deployment Summary:
✅ Zero downtime
✅ All tests passing
✅ 1% rollout active
✅ Monitoring stable

Key Features Live:
🤖 AI Agents (6 types)
🔄 Intelligent Fallback
📊 Real-time Observability

Gradual Rollout Schedule:
- Day 1: 1% (today)
- Day 2: 5%
- Day 3: 10%
- Day 7: 50%
- Day 10: 100%

Release Notes: https://easymo.com/releases/v2.0

Questions? Reply to this email or Slack #v2-deployment

Thanks,
Engineering Team
```

### 8.3 Post-Deployment Tasks

- [ ] Update status page (deployment complete)
- [ ] Close war room channel (or archive)
- [ ] Schedule Day 2 review meeting
- [ ] Document lessons learned
- [ ] Update runbook with any deviations

---

## 📈 Gradual Rollout Schedule

After successful Day 1 deployment, increase rollout:

| Day | Percentage | Users (~) | Command                     |
| --- | ---------- | --------- | --------------------------- |
| 1   | 1%         | 100       | `ROLLOUT_PERCENTAGE=1`      |
| 2   | 5%         | 500       | `ROLLOUT_PERCENTAGE=5`      |
| 3   | 10%        | 1,000     | `ROLLOUT_PERCENTAGE=10`     |
| 4   | 25%        | 2,500     | `ROLLOUT_PERCENTAGE=25`     |
| 7   | 50%        | 5,000     | `ROLLOUT_PERCENTAGE=50`     |
| 8   | 75%        | 7,500     | `ROLLOUT_PERCENTAGE=75`     |
| 9   | 90%        | 9,000     | `ROLLOUT_PERCENTAGE=90`     |
| 10  | 100%       | All       | `ROLLOUT_PERCENTAGE=100` 🎉 |

**Increase Command**:

```bash
# Update feature flag
kubectl patch configmap feature-flags \
  -n easymo-prod \
  -p '{"data":{"FEATURE_AI_AGENTS_ROLLOUT_PERCENTAGE":"5"}}'

# Restart to apply
kubectl rollout restart deployment/agent-core -n easymo-prod
```

**Between Each Increase**:

1. Monitor for 2-4 hours
2. Check metrics (error rate, fallback rate)
3. Review user feedback
4. Verify no issues before next increase

---

## 🆘 Troubleshooting

### Issue: Database Migration Failed

**Symptoms**: Migration script errors, tables not created

**Solution**:

```bash
# Check migration status
supabase db diff --schema public

# Rollback to backup (last resort)
pg_restore -h prod-db -d postgres backups/supabase_prod_TIMESTAMP.dump

# Re-apply migrations
supabase db push --project-ref $SUPABASE_PROJECT_REF
```

### Issue: Edge Function Not Responding

**Symptoms**: 500 errors, timeouts

**Solution**:

```bash
# Check function logs
supabase functions logs wa-webhook --project-ref $SUPABASE_PROJECT_REF

# Redeploy function
supabase functions deploy wa-webhook --project-ref $SUPABASE_PROJECT_REF --no-verify-jwt

# Test endpoint
curl https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook
```

### Issue: Microservice Crash Loop

**Symptoms**: Pods restarting, CrashLoopBackOff status

**Solution**:

```bash
# Check pod logs
kubectl logs -n easymo-prod deployment/agent-core --tail=100

# Check events
kubectl get events -n easymo-prod | grep agent-core

# Rollback deployment
kubectl rollout undo deployment/agent-core -n easymo-prod
```

### Issue: High Error Rate (>5%)

**Symptoms**: Alerts firing, errors in logs

**Solution**:

```bash
# Immediate: Disable feature flags
kubectl patch configmap feature-flags \
  -n easymo-prod \
  -p '{"data":{"FEATURE_AI_AGENTS":"false"}}'

# Investigate root cause
kubectl logs -n easymo-prod deployment/agent-core | grep ERROR

# Fix and redeploy
```

---

## 📞 Support Contacts

**During Deployment**:

- On-Call Engineer: [Name] - PagerDuty / Phone
- Backup Engineer: [Name] - Slack @username
- Engineering Manager: [Name] - Phone
- War Room: #v2-deployment

**Post-Deployment**:

- Engineering Support: #engineering-support
- DevOps Team: #devops
- Incident Response: PagerDuty

---

## 📚 Related Documents

- **Rollback Procedures**: `docs/ROLLBACK_PROCEDURES.md`
- **Migration Guide**: `docs/MIGRATION_GUIDE_v2.md`
- **Known Issues**: `docs/KNOWN_ISSUES.md`
- **Support Runbook**: `docs/SUPPORT_RUNBOOK.md`
- **Engineering Runbook**: `docs/ENGINEERING_RUNBOOK.md`

---

**Document Version**: 1.0  
**Last Updated**: 2025-11-11  
**Status**: Production Ready  
**Next Review**: Post-deployment retrospective

---

_For deployment support, contact: devops@easymo.com_
