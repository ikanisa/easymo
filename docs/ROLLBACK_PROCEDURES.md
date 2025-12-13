# Rollback Procedures - EasyMO v2.0

**Version**: 2.0.0  
**Last Updated**: 2025-11-11  
**Owner**: DevOps + Engineering  
**Target Time**: <10 minutes  
**Risk Level**: Low (well-tested procedures)

---

## 📋 Overview

This document provides step-by-step procedures for rolling back EasyMO v2.0 deployment in case of
critical issues. All procedures are designed for rapid execution (<10 minutes) with minimal user
impact.

**Rollback Triggers**:

- 🔴 Error rate >5%
- 🔴 Critical bug discovered
- 🔴 User complaints >10/hour
- 🔴 Business metrics drop >10%
- 🔴 System instability
- 🔴 Security vulnerability discovered

---

## 🚨 Emergency Rollback Decision Matrix

| Severity | Condition        | Action               | Time Limit  |
| -------- | ---------------- | -------------------- | ----------- |
| **P0**   | System down      | Full rollback        | <5 min      |
| **P1**   | Error rate >10%  | Full rollback        | <10 min     |
| **P2**   | Error rate 5-10% | Reduce rollout → Fix | <15 min     |
| **P3**   | Minor issues     | Monitor → Fix        | <30 min     |
| **P4**   | Cosmetic         | Schedule fix         | Next sprint |

---

## ⚡ Quick Rollback (Method 1: Feature Flags)

**Best For**: Quick disable without code changes  
**Downtime**: None  
**Duration**: <2 minutes  
**Risk**: Minimal

### Step 1: Disable All AI Features

```bash
# Immediate: Disable feature flags
kubectl patch configmap feature-flags \
  -n easymo-prod \
  -p '{"data":{
    "FEATURE_AI_AGENTS":"false",
    "FEATURE_AI_AGENTS_ROLLOUT_PERCENTAGE":"0"
  }}'

# Restart agent-core to apply immediately
kubectl rollout restart deployment/agent-core -n easymo-prod
kubectl rollout status deployment/agent-core -n easymo-prod
```

### Step 2: Verify Rollback

```bash
# Check environment variable
kubectl exec -n easymo-prod deployment/agent-core -- \
  env | grep FEATURE_AI_AGENTS
# Expected: FEATURE_AI_AGENTS=false

# Test with WhatsApp message
# Should fallback to traditional menu (no AI)

# Check error rate (should drop immediately)
open https://admin.easymo.com/agents/dashboard
```

### Step 3: Communicate

```bash
# Slack announcement
cat << EOF
@channel ⚠️ ROLLBACK EXECUTED

AI features temporarily disabled due to [ISSUE].

Status: Traditional flows active (100%)
Impact: Users fallback to menus (no service disruption)
Investigation: In progress

Updates: #v2-deployment
EOF
```

**When to Use**: Minor to moderate issues that don't require code changes.

---

## 🔄 Partial Rollback (Method 2: Reduce Traffic)

**Best For**: Issues affecting only some users  
**Downtime**: None  
**Duration**: <3 minutes  
**Risk**: Minimal

### Step 1: Reduce Rollout Percentage

```bash
# Reduce from current (e.g., 10%) to lower (e.g., 1%)
kubectl patch configmap feature-flags \
  -n easymo-prod \
  -p '{"data":{"FEATURE_AI_AGENTS_ROLLOUT_PERCENTAGE":"1"}}'

# Restart to apply
kubectl rollout restart deployment/agent-core -n easymo-prod
```

### Step 2: Identify Affected Users

```bash
# Find users experiencing errors
psql -h prod-db <<EOF
SELECT user_id, COUNT(*) as error_count
FROM agent_fallbacks
WHERE created_at > NOW() - INTERVAL '10 minutes'
  AND reason = 'error'
GROUP BY user_id
ORDER BY error_count DESC
LIMIT 20;
EOF

# Whitelist working users, blacklist problematic ones
```

### Step 3: Monitor Improvement

```bash
# Watch error rate drop
watch -n 5 'curl -s https://api.easymo.com/metrics/errors | jq ".error_rate"'
# Should decrease with reduced traffic
```

**When to Use**: Issues appear in specific user segments or edge cases.

---

## 🐳 Service Rollback (Method 3: Container Rollback)

**Best For**: Deployment introduced breaking changes  
**Downtime**: <30 seconds per service  
**Duration**: <10 minutes  
**Risk**: Low

### Step 1: Rollback Agent-Core

```bash
# Check rollout history
kubectl rollout history deployment/agent-core -n easymo-prod

# Rollback to previous version
kubectl rollout undo deployment/agent-core -n easymo-prod

# Wait for rollback to complete
kubectl rollout status deployment/agent-core -n easymo-prod
# Expected: deployment "agent-core" successfully rolled out
```

### Step 2: Rollback Dependent Services

```bash
# Rollback in reverse order of deployment
kubectl rollout undo deployment/ranking-service -n easymo-prod
kubectl rollout undo deployment/wallet-service -n easymo-prod
kubectl rollout undo deployment/buyer-service -n easymo-prod
kubectl rollout undo deployment/station-service -n easymo-prod
kubectl rollout undo deployment/driver-service -n easymo-prod
kubectl rollout undo deployment/voice-bridge -n easymo-prod
kubectl rollout undo deployment/marketplace-service -n easymo-prod
kubectl rollout undo deployment/property-service -n easymo-prod
kubectl rollout undo deployment/healthcare-service -n easymo-prod
kubectl rollout undo deployment/customer-support-service -n easymo-prod

# Wait for all to stabilize
kubectl get pods -n easymo-prod
# All should be Running
```

### Step 3: Verify Services

```bash
# Check health endpoints
for service in agent-core ranking-service wallet-service buyer-service; do
  echo "Checking $service..."
  curl -s https://api.easymo.com/health/$service | jq ".status"
done
# All should return: "healthy"
```

**When to Use**: Microservice bugs, performance degradation, unexpected behavior.

---

## ☁️ Edge Function Rollback (Method 4: Supabase Functions)

**Best For**: Webhook issues, edge function errors  
**Downtime**: <1 minute  
**Duration**: <5 minutes  
**Risk**: Low

### Step 1: Identify Previous Version

```bash
# List function versions (Supabase dashboard)
# Or use Git tags
git log --oneline supabase/functions/wa-webhook/ | head -5
```

### Step 2: Checkout Previous Version

```bash
# Checkout last known good commit
git checkout <commit-hash> -- supabase/functions/wa-webhook/

# Or restore from backup
cp -r backups/functions/wa-webhook supabase/functions/
```

### Step 3: Redeploy

```bash
# Deploy previous version
supabase functions deploy wa-webhook --project-ref lhbowpbcpwoiparwnwgt

# Verify
curl https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/_health
# Expected: {"status":"healthy","version":"v1.x"}
```

**When to Use**: WhatsApp webhook failures, edge function crashes.

---

## 💾 Database Rollback (Method 5: LAST RESORT)

**Best For**: Catastrophic database issues  
**Downtime**: 5-15 minutes  
**Duration**: 15-30 minutes  
**Risk**: HIGH (data loss possible)

⚠️ **WARNING**: Only use if database state is corrupted. Data created after backup will be lost!

### Step 1: Stop Traffic

```bash
# Disable all services writing to database
kubectl scale deployment --all --replicas=0 -n easymo-prod

# Wait for pods to terminate
kubectl get pods -n easymo-prod
# Should show 0 pods running
```

### Step 2: Restore Database

```bash
# Identify backup to restore
ls -lht backups/*.dump | head -5
# Choose backup from before deployment

# Restore Supabase DB
pg_restore -h lhbowpbcpwoiparwnwgt.db.supabase.co \
  -U postgres \
  -d postgres \
  -c \ # Clean (drop) existing objects
  backups/supabase_prod_TIMESTAMP.dump

# Restore Agent-Core DB
pg_restore -h prod-agent-db.easymo.com \
  -U easymo_admin \
  -d agent_core_prod \
  -c \
  backups/agent_core_prod_TIMESTAMP.dump
```

### Step 3: Verify Database

```bash
# Check table counts
psql -h prod-db <<EOF
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;
EOF

# Verify critical tables
psql -h prod-db <<EOF
SELECT COUNT(*) as users FROM users;
SELECT COUNT(*) as orders FROM orders;
SELECT COUNT(*) as vendors FROM vendors;
EOF
# Counts should match pre-migration values
```

### Step 4: Restart Services

```bash
# Scale services back up
kubectl scale deployment --all --replicas=3 -n easymo-prod

# Wait for healthy
kubectl get pods -n easymo-prod
# All should be Running

# Run smoke tests
./scripts/prod-smoke-test.sh
```

**When to Use**: Catastrophic database failure, corrupted data, migration completely broke schema.

**Data Loss Risk**: High! Only use if no other option.

---

## 🔍 Rollback Verification Checklist

After any rollback method, verify:

### 1. Services Health ✅

```bash
# All pods running
kubectl get pods -n easymo-prod | grep -v Running
# Should return nothing

# Health endpoints responding
curl https://api.easymo.com/health/agent-core
curl https://api.easymo.com/health/wallet-service
# Should return: 200 OK

# No errors in logs
kubectl logs -n easymo-prod deployment/agent-core --tail=50 | grep ERROR
# Should be minimal or none
```

### 2. User Experience ✅

```bash
# Send test WhatsApp message (traditional flow)
# Should receive menu buttons, not AI response

# Complete test order
# Should work normally (payment, confirmation, etc.)

# Check support tickets
# Should not spike after rollback
```

### 3. Metrics Stable ✅

```bash
# Open dashboard
open https://admin.easymo.com/agents/dashboard

# Verify:
# - Error rate: Back to baseline (<1%)
# - Response time: Normal (<1s p95)
# - Throughput: Normal
# - No alerts firing
```

### 4. Database Integrity ✅

```bash
# Check for orphaned records
psql -h prod-db <<EOF
SELECT COUNT(*) FROM agent_sessions WHERE status = 'pending' AND updated_at < NOW() - INTERVAL '1 hour';
EOF
# Should be 0 or very low

# Check row counts
psql -h prod-db <<EOF
SELECT COUNT(*) as users FROM users;
SELECT COUNT(*) as orders FROM orders WHERE created_at > NOW() - INTERVAL '24 hours';
EOF
# Counts should be reasonable
```

---

## 📊 Rollback Decision Tree

```
┌─────────────────────────────────────┐
│  Issue Detected                     │
└────────┬────────────────────────────┘
         │
         ▼
    ┌─────────────────┐
    │  Severity?      │
    └────┬─────┬──────┘
         │     │
    P0/P1│     │P2/P3
         │     │
         ▼     ▼
    ┌─────────────┐    ┌──────────────────┐
    │Quick Rollback│    │ Reduce Traffic   │
    │(Feature Flag)│    │ or Monitor       │
    └──────┬───────┘    └────────┬─────────┘
           │                     │
           ▼                     ▼
    ┌──────────────┐      ┌──────────────┐
    │Fixed?        │      │Fixed?        │
    └───┬────┬─────┘      └───┬────┬─────┘
       Yes   No              Yes   No
        │    │                │    │
        │    ▼                │    ▼
        │  Service           │  Full
        │  Rollback          │  Rollback
        │    │               │    │
        │    ▼               │    ▼
        │  Fixed?            │  Database
        │    │               │  Rollback
        │   Yes              │  (Last Resort)
        │    │               │
        └────┴───────────────┴────────────────►
                      │
                      ▼
            ┌──────────────────┐
            │ Post-Rollback    │
            │ Verification     │
            └──────────────────┘
                      │
                      ▼
            ┌──────────────────┐
            │ Root Cause       │
            │ Analysis         │
            └──────────────────┘
                      │
                      ▼
            ┌──────────────────┐
            │ Fix & Redeploy   │
            └──────────────────┘
```

---

## 🕐 Rollback Timeframes

| Method           | Downtime    | Duration  | Complexity | Risk     |
| ---------------- | ----------- | --------- | ---------- | -------- |
| Feature Flag     | 0 min       | <2 min    | Low        | Minimal  |
| Partial Rollout  | 0 min       | <3 min    | Low        | Minimal  |
| Service Rollback | <30 sec/svc | <10 min   | Medium     | Low      |
| Edge Function    | <1 min      | <5 min    | Low        | Low      |
| Database         | 5-15 min    | 15-30 min | High       | **HIGH** |

**Target**: Execute rollback in <10 minutes for any P0/P1 issue.

---

## 📞 Escalation Path

### Level 1: On-Call Engineer (0-5 minutes)

- Execute rollback procedures
- Monitor metrics
- Communicate in war room

### Level 2: Engineering Lead (5-15 minutes)

- Approve database rollback (if needed)
- Coordinate team response
- Communicate with stakeholders

### Level 3: Engineering Manager (15+ minutes)

- Authorize extended downtime
- Escalate to executives
- Manage external communication

**PagerDuty**: Automatically escalates if not acknowledged within 5 minutes.

---

## 📝 Post-Rollback Actions

### Immediate (0-1 hour)

1. **Incident Report**:

   ```bash
   # Create incident document
   cat > incidents/incident_v2.0_rollback_$(date +%Y%m%d).md <<EOF
   # Incident Report: v2.0 Rollback

   Date: $(date)
   Severity: [P0/P1/P2]
   Duration: [X] minutes

   ## Timeline
   - [Time] Issue detected
   - [Time] Rollback initiated
   - [Time] Rollback completed
   - [Time] Services verified

   ## Root Cause
   [Description]

   ## Resolution
   [What was done]

   ## Prevention
   [How to avoid in future]
   EOF
   ```

2. **Team Notification**:

   ```
   @channel ✅ ROLLBACK COMPLETE

   Issue: [Brief description]
   Rollback Method: [Feature Flag/Service/Database]
   Duration: [X] minutes
   Impact: [# users affected]

   Status: Services stable, monitoring ongoing
   Next Steps: Root cause analysis, fix development

   Timeline for fix: [TBD]
   ```

3. **User Communication** (if user-facing impact):

   ```
   Subject: Brief Service Disruption - Resolved

   Hi,

   We experienced a brief issue with our new AI features
   and have temporarily reverted to our previous system.

   Impact: [Minimal/None]
   Duration: [X] minutes
   Current Status: All services operating normally

   We apologize for any inconvenience. Our team is working
   on a fix.

   Questions? support@easymo.com
   ```

### Short-term (1-24 hours)

1. **Root Cause Analysis**:
   - Review logs and metrics
   - Identify exact failure point
   - Document technical details

2. **Fix Development**:
   - Create hotfix branch
   - Implement fix
   - Add tests to prevent recurrence

3. **Testing**:
   - Test fix in local environment
   - Deploy to staging
   - Full regression suite
   - QA sign-off

### Long-term (1-7 days)

1. **Postmortem**:
   - Team meeting (blameless)
   - Document lessons learned
   - Update procedures
   - Share with organization

2. **Prevention**:
   - Add monitoring/alerts
   - Update tests
   - Improve rollback procedures
   - Train team

3. **Redeployment**:
   - Plan next deployment
   - More conservative rollout
   - Extra monitoring

---

## 🧪 Rollback Testing

**Quarterly Drill**: Practice rollback procedures to ensure readiness.

### Test Checklist

- [ ] Feature flag disable (Method 1)
- [ ] Partial rollout reduction (Method 2)
- [ ] Service rollback (Method 3)
- [ ] Edge function rollback (Method 4)
- [ ] Database restore (Method 5) - **Staging Only!**

### Test Metrics

- Time to execute: Target <10 min
- Team coordination: Smooth?
- Communication: Clear?
- Verification: Complete?

**Last Tested**: [Date]  
**Next Test**: [Date + 90 days]

---

## 📚 Related Documents

- **Deployment Runbook**: `docs/PRODUCTION_DEPLOYMENT_RUNBOOK.md`
- **Engineering Runbook**: `docs/ENGINEERING_RUNBOOK.md`
- **Support Runbook**: `docs/SUPPORT_RUNBOOK.md`
- **Known Issues**: `docs/KNOWN_ISSUES.md`

---

## ✅ Rollback Success Criteria

After rollback, verify:

- ✅ Error rate <1% (back to baseline)
- ✅ All services healthy
- ✅ User experience normal
- ✅ Support tickets normal
- ✅ Metrics stable for 1 hour
- ✅ No alerts firing
- ✅ Team debriefed

**Only then**: Declare rollback successful.

---

**Document Version**: 1.0  
**Last Updated**: 2025-11-11  
**Status**: Production Ready  
**Next Review**: After first rollback (if any)

---

_For rollback support, contact: oncall@easymo.com | PagerDuty: @oncall-engineer_
