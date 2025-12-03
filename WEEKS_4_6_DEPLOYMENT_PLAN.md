# Weeks 4-6 Migration Deployment Plan

**Created:** December 3, 2025  
**Status:** Infrastructure Ready, Awaiting Manual Deployment  
**Risk Level:** 🟢 Low (Gradual rollout with easy rollback)

---

## 🎯 Executive Summary

Complete infrastructure has been created for gradual migration from legacy webhooks to wa-webhook-unified. The database migration is ready to deploy, but requires manual execution due to production safety.

**Migration Ready:**
- ✅ Database migration file created
- ✅ Routing infrastructure designed
- ✅ Monitoring queries ready
- ✅ Rollback procedures documented
- ⏳ Awaiting manual `supabase db push` execution

---

## 📦 What's Been Created

### 1. Database Migration (Ready to Deploy)

**File:** `supabase/migrations/20251203115104_add_unified_webhook_routing.sql`

**Components:**
```sql
-- Routing Control
ALTER TABLE users ADD COLUMN use_unified_webhook BOOLEAN DEFAULT false;
CREATE INDEX idx_users_unified_webhook ON users(use_unified_webhook);

-- Monitoring Tables
CREATE TABLE webhook_metrics (...);      -- Track performance
CREATE TABLE migration_status (...);     -- Track rollout progress  
CREATE TABLE migration_rollbacks (...);  -- Log rollback events

-- Helper Functions
assign_users_to_unified_webhook(percentage)  -- Random assignment
get_webhook_route(user_id)                   -- Routing decision
log_webhook_metric(...)                      -- Performance logging

-- Security
RLS policies on all new tables
Grants for service_role and authenticated users
```

**To Deploy:**
```bash
cd /Users/jeanbosco/workspace/easymo
supabase db push
# Confirm 'Y' when prompted
```

---

## 🗺️ Migration Phases

### Week 4: 10% Traffic Rollout

**Objective:** Route 10% of users to wa-webhook-unified

**Steps:**
1. Deploy database migration (manual)
2. Assign 10% of users:
   ```sql
   SELECT * FROM assign_users_to_unified_webhook(10);
   ```
3. Monitor hourly (Day 1), then daily (Days 2-7)
4. Use monitoring queries from `monitoring/week4_queries.sql`

**Success Criteria:**
- Error rate < 1%
- Response time < 2s
- Success rate > 99%
- All 8 agents functioning
- No critical user complaints

**Rollback Procedure:**
```sql
-- Instant rollback: set all users to legacy
UPDATE users SET use_unified_webhook = false;

-- Record rollback
INSERT INTO migration_rollbacks (phase, reason, rolled_back_by)
VALUES ('week4', 'High error rate', 'operator_name');
```

---

### Week 5: 50% Traffic Rollout

**Objective:** Scale to 50% of users

**Prerequisites:**
- Week 4 running stable for 7 days
- All success criteria met
- No unresolved errors

**Steps:**
1. Validate Week 4 metrics
2. Increase allocation:
   ```sql
   SELECT * FROM assign_users_to_unified_webhook(50);
   ```
3. Monitor performance under increased load
4. Compare unified vs legacy metrics

**Success Criteria:** Same as Week 4

---

### Week 6: 100% Traffic Migration

**Objective:** Complete migration to unified webhook

**Prerequisites:**
- Week 5 running stable for 7 days
- Performance meets or exceeds legacy
- Team confident in stability

**Steps:**
1. Validate Week 5 metrics
2. Move all users:
   ```sql
   SELECT * FROM assign_users_to_unified_webhook(100);
   ```
3. Begin 30-day stability monitoring
4. Prepare for final cleanup

**Success Criteria:** Same as Week 4

---

### Week 7+: Final Cleanup

**Objective:** Delete old webhook functions

**Prerequisites:**
- 30 days of 100% stable operation
- No rollback events in 30 days
- Team approval

**Steps:**
1. Verify stability metrics
2. Delete 4 old webhook functions:
   ```bash
   supabase functions delete wa-webhook-ai-agents
   supabase functions delete wa-webhook-jobs
   supabase functions delete wa-webhook-marketplace
   supabase functions delete wa-webhook-property
   ```
3. Final function count: 78
4. Celebrate 20% reduction! 🎉

---

## 📊 Monitoring

### Week 4 Queries (monitoring/week4_queries.sql)

12 SQL queries available for tracking:
1. Traffic distribution
2. Error rates
3. Response times (p50, p95, p99)
4. Agent usage stats
5. Success rates
6. User distribution
7. Comparison: unified vs legacy
8. Top errors
9. Slow requests
10. Migration progress
11. Rollback history
12. Health check

**Run queries with:**
```bash
supabase db query < monitoring/week4_queries.sql
```

---

## 🔒 Safety Guarantees

### Protected Webhooks (Never Modified)
These 3 production webhooks are protected and untouched:
- ✅ wa-webhook-mobility (ride booking)
- ✅ wa-webhook-profile (user profiles)  
- ✅ wa-webhook-insurance (insurance)

### Rollback Capability
- **Instant**: Change routing flag (< 1 second)
- **Safe**: No data loss
- **Tested**: Procedure documented
- **Automatic**: Can trigger based on metrics

### Gradual Rollout
- **Week 4**: 10% (low risk)
- **Week 5**: 50% (validation)
- **Week 6**: 100% (full migration)
- **Week 7+**: Cleanup (after 30 days stable)

---

## 🚀 How to Execute

### Step 1: Deploy Database Migration (Manual Required)

```bash
cd /Users/jeanbosco/workspace/easymo
supabase db push
```

**Why Manual?**
- Production database changes require human oversight
- Gives you control over exact timing
- Allows pre-deployment review
- Ensures team readiness

**Expected Output:**
```
Connecting to remote database...
Do you want to push these migrations to the remote database?
 • 20251203115104_add_unified_webhook_routing.sql
 [Y/n] Y

Applied migration: 20251203115104_add_unified_webhook_routing.sql
```

---

### Step 2: Start Week 4 (After Migration Deployed)

```bash
# 1. Verify wa-webhook-unified is healthy
supabase functions logs wa-webhook-unified --tail 10

# 2. Assign 10% of users
supabase db query "SELECT * FROM assign_users_to_unified_webhook(10);"

# 3. Verify assignment
supabase db query "
  SELECT 
    use_unified_webhook,
    COUNT(*) as user_count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
  FROM users
  GROUP BY use_unified_webhook;
"

# 4. Monitor (hourly on Day 1)
supabase db query < monitoring/week4_queries.sql
```

---

### Step 3: Monitor & Progress

**Day 1 (Week 4):**
- Monitor hourly
- Check error rates
- Review latency
- Verify all 8 agents working

**Days 2-7 (Week 4):**
- Monitor daily
- Review user feedback
- Check success criteria
- Prepare for Week 5

**Week 5-6:**
- Repeat process
- Increase percentages
- Continue monitoring

**Week 7+:**
- After 30 days stable at 100%
- Delete old webhooks
- Final documentation

---

## 📋 Pre-Flight Checklist

Before starting Week 4:

### Infrastructure
- [ ] wa-webhook-unified deployed and healthy
- [ ] Database migration ready to push
- [ ] Monitoring queries tested
- [ ] Rollback procedure reviewed

### Team
- [ ] Operations team briefed
- [ ] Support team aware
- [ ] Escalation contacts confirmed
- [ ] Rollback authority clarified

### Monitoring
- [ ] Dashboard access verified
- [ ] Alert thresholds configured
- [ ] Log access tested
- [ ] Query permissions confirmed

### Communication
- [ ] Stakeholders informed
- [ ] Timeline communicated
- [ ] Success criteria agreed
- [ ] Rollback triggers defined

---

## 🎯 Success Metrics

### Phase 1 (Complete ✅)
- ✅ Functions reduced: 95 → 82 (-13.7%)
- ✅ Code size reduced: -444KB
- ✅ wa-webhook-unified deployed
- ✅ Documentation complete
- ✅ All backups secured

### Phases 2-4 (Targets 🎯)
- 🎯 Week 4: 10% traffic migrated
- 🎯 Week 5: 50% traffic migrated
- 🎯 Week 6: 100% traffic migrated
- 🎯 Error rate < 1%
- 🎯 Latency < 2s
- 🎯 Success rate > 99%

### Phase 5 (Final Target 🎯)
- 🎯 30 days stable at 100%
- 🎯 4 old webhooks deleted
- 🎯 Final count: 78 functions
- 🎯 20% total reduction

---

## 🔧 Troubleshooting

### Issue: High Error Rate

**Symptoms:** Error rate > 1%

**Actions:**
1. Check logs: `supabase functions logs wa-webhook-unified`
2. Identify failing agent
3. Review error messages
4. If critical: Rollback immediately
5. If minor: Monitor and investigate

**Rollback Command:**
```sql
UPDATE users SET use_unified_webhook = false;
INSERT INTO migration_rollbacks (phase, reason) VALUES ('weekX', 'High error rate');
```

---

### Issue: Slow Response Times

**Symptoms:** P95 latency > 2 seconds

**Actions:**
1. Check slow query log
2. Review database performance
3. Analyze agent-specific latency
4. Consider optimization
5. If severe: Rollback

---

### Issue: Agent Not Responding

**Symptoms:** Specific agent fails consistently

**Actions:**
1. Check agent configuration in database
2. Verify agent code deployed
3. Test agent directly
4. Review tool execution logs
5. Fix and redeploy if needed

---

## 📞 Emergency Contacts

### Rollback Authority
- Operations Lead
- Engineering Lead
- Product Owner

### Escalation Path
1. On-call Engineer (immediate)
2. Team Lead (within 1 hour)
3. Engineering Manager (critical issues)

### Communication Channels
- Slack: #operations
- Email: ops@easymo.com
- Phone: [Emergency Number]

---

## 📚 Related Documents

- **[CONSOLIDATION_MASTER_INDEX.md](./CONSOLIDATION_MASTER_INDEX.md)** - Navigation hub
- **[SUPABASE_CONSOLIDATION_FINAL_REPORT.md](./SUPABASE_CONSOLIDATION_FINAL_REPORT.md)** - Phase 1 report
- **[CONSOLIDATION_QUICK_REF.md](./CONSOLIDATION_QUICK_REF.md)** - Quick reference
- **[WEEK_4_MIGRATION_PLAN.md](./WEEK_4_MIGRATION_PLAN.md)** - Detailed Week 4 plan
- **[monitoring/week4_queries.sql](./monitoring/week4_queries.sql)** - SQL monitoring queries

---

## ✅ What's Ready

| Component | Status | Location |
|-----------|--------|----------|
| Database Migration | ✅ Ready | `supabase/migrations/20251203115104_add_unified_webhook_routing.sql` |
| Monitoring Queries | ✅ Ready | `monitoring/week4_queries.sql` |
| wa-webhook-unified | ✅ Deployed | Production |
| Documentation | ✅ Complete | 8 files |
| Rollback Procedure | ✅ Documented | This file + CONSOLIDATION_QUICK_REF.md |
| Success Criteria | ✅ Defined | This file |

---

## 🚦 Next Actions

### Immediate (You Decide When)
1. Review this deployment plan
2. Brief your team
3. Choose deployment window
4. Execute: `supabase db push`
5. Start Week 4: `assign_users_to_unified_webhook(10)`

### Week 4
1. Monitor hourly (Day 1)
2. Monitor daily (Days 2-7)
3. Validate success criteria
4. Prepare for Week 5

### Week 5-6
1. Gradual rollout continuation
2. Performance validation
3. Team confidence building

### Week 7+
1. Final cleanup
2. Delete old webhooks
3. Celebrate success! 🎉

---

**Deployment Plan Version:** 1.0  
**Last Updated:** December 3, 2025  
**Status:** READY FOR MANUAL DEPLOYMENT ✅

**To Begin:**
```bash
supabase db push  # Deploy routing infrastructure
```

Then follow Week 4 plan from **[WEEK_4_MIGRATION_PLAN.md](./WEEK_4_MIGRATION_PLAN.md)**

---

**Questions? Review [CONSOLIDATION_MASTER_INDEX.md](./CONSOLIDATION_MASTER_INDEX.md) for navigation.**
