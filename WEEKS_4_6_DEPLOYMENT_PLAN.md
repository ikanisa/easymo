# Weeks 4-6 Deployment Plan - Phase 1 Consolidation

**Date:** December 3, 2025  
**Weeks:** 4-6 of 6  
**Phase:** Gradual Traffic Migration  
**Status:** 📋 PLANNED - Ready to Execute

---

## 🎯 Overview

Weeks 4-6 focus on **gradual traffic migration** with feature flags. All services are deployed and ready - this phase is about safely routing traffic to the consolidated `wa-webhook-unified` service.

**Key Principle:** Start at 0%, increase gradually, monitor continuously, rollback instantly if issues detected.

---

## 📅 Week 4: AI Agents Rollout (Days 1-7)

### Objective
Migrate AI agent traffic from `wa-webhook-ai-agents` to `wa-webhook-unified`

### Pre-Deployment Checklist
- [ ] Verify `wa-webhook-unified` deployed to production
- [ ] Confirm all environment variables set to 0%:
  - `UNIFIED_ROLLOUT_PERCENT=0`
- [ ] Test deployment health endpoint
- [ ] Verify database connectivity (ai_agent_system_instructions, ai_agent_personas tables)
- [ ] Set up monitoring dashboards for AI agents

### Gradual Rollout Schedule

**Day 1-2: 5% Traffic**
```bash
# Set environment variable
UNIFIED_ROLLOUT_PERCENT=5

# Monitor for 48 hours
- Error rate < 0.1% ✅
- Latency p95 < 1200ms ✅
- Session continuity 100% ✅
- No customer complaints ✅
```

**Day 3-4: 10% Traffic**
```bash
UNIFIED_ROLLOUT_PERCENT=10

# Monitor for 48 hours
- Compare metrics: unified vs legacy
- Check agent responses quality
- Verify database-driven config working
```

**Day 5: 25% Traffic**
```bash
UNIFIED_ROLLOUT_PERCENT=25

# Monitor for 24 hours
- Increased sample size
- Performance comparison
```

**Day 6: 50% Traffic**
```bash
UNIFIED_ROLLOUT_PERCENT=50

# Monitor for 24 hours
- Half traffic on unified
- Stress test at scale
```

**Day 7: 100% Traffic**
```bash
UNIFIED_ROLLOUT_PERCENT=100

# All AI agent traffic on wa-webhook-unified
- Monitor for 48+ hours
- Document performance
```

### Monitoring Metrics

| Metric | Threshold | Action if Exceeded |
|--------|-----------|-------------------|
| Error Rate | > 1% | Rollback to previous % |
| Latency p95 | > 2000ms | Investigate, consider rollback |
| Session Break | > 0.5% | Immediate rollback |
| Customer Complaints | > 3/day | Investigate issues |

### Rollback Procedure

```bash
# Instant rollback
UNIFIED_ROLLOUT_PERCENT=0

# Wait 5 minutes, verify traffic back to wa-webhook-ai-agents
# Investigate logs, fix issues
# Resume rollout from lower percentage
```

### Success Criteria
- [ ] 100% of AI agent traffic on wa-webhook-unified
- [ ] Error rate ≤ baseline (wa-webhook-ai-agents)
- [ ] Latency ≤ baseline
- [ ] Zero session breaks
- [ ] All 8 agents working correctly
- [ ] Database-driven config verified

---

## �� Week 5: Jobs Domain Rollout (Days 8-14)

### Objective
Migrate job board traffic from `wa-webhook-jobs` to `wa-webhook-unified/domains/jobs/`

### Pre-Rollout Checklist
- [ ] Verify Week 4 AI agents at 100% and stable
- [ ] Test jobs domain in staging
- [ ] Confirm environment variables:
  - `ENABLE_UNIFIED_JOBS=false` (start)
  - `JOBS_ROLLOUT_PERCENT=0` (start)
- [ ] Set up jobs-specific monitoring dashboard

### Gradual Rollout Schedule

**Day 8-9: Enable + 5% Traffic**
```bash
ENABLE_UNIFIED_JOBS=true
JOBS_ROLLOUT_PERCENT=5

# Monitor for 48 hours
- Job posting works ✅
- Job search works ✅
- Job applications work ✅
- Employer dashboard works ✅
```

**Day 10: 10% Traffic**
```bash
JOBS_ROLLOUT_PERCENT=10

# Monitor for 24 hours
- End-to-end job flows
- Payment processing (if applicable)
```

**Day 11: 25% Traffic**
```bash
JOBS_ROLLOUT_PERCENT=25

# Monitor for 24 hours
```

**Day 12: 50% Traffic**
```bash
JOBS_ROLLOUT_PERCENT=50

# Monitor for 24 hours
```

**Day 13-14: 100% Traffic**
```bash
JOBS_ROLLOUT_PERCENT=100

# Monitor for 48+ hours
- All jobs traffic on unified
```

### Jobs-Specific Monitoring

| Feature | Metric | Threshold |
|---------|--------|-----------|
| Job Posting | Success rate | > 98% |
| Job Search | Response time | < 500ms |
| Applications | Delivery rate | > 99% |
| Notifications | Send rate | > 95% |

### Success Criteria
- [ ] 100% of jobs traffic on wa-webhook-unified
- [ ] All job features working (post, search, apply, notify)
- [ ] No data loss or corruption
- [ ] Performance ≥ baseline

---

## 📅 Week 6: Marketplace & Property Rollout (Days 15-21)

### Objective
Migrate marketplace and property domain traffic to `wa-webhook-unified`

### Pre-Rollout Checklist
- [ ] Verify Weeks 4-5 at 100% and stable
- [ ] Test both domains in staging
- [ ] Confirm environment variables at 0%:
  - `ENABLE_UNIFIED_MARKETPLACE=false`
  - `MARKETPLACE_ROLLOUT_PERCENT=0`
  - `ENABLE_UNIFIED_PROPERTY=false`
  - `PROPERTY_ROLLOUT_PERCENT=0`

### Rollout Strategy: Parallel Migration

**Note:** Marketplace and property can be rolled out simultaneously since they're independent domains.

**Day 15-16: 5% Traffic (Both Domains)**
```bash
# Marketplace
ENABLE_UNIFIED_MARKETPLACE=true
MARKETPLACE_ROLLOUT_PERCENT=5

# Property
ENABLE_UNIFIED_PROPERTY=true
PROPERTY_ROLLOUT_PERCENT=5

# Monitor both for 48 hours
```

**Day 17: 10% Traffic**
```bash
MARKETPLACE_ROLLOUT_PERCENT=10
PROPERTY_ROLLOUT_PERCENT=10

# Monitor for 24 hours
```

**Day 18: 25% Traffic**
```bash
MARKETPLACE_ROLLOUT_PERCENT=25
PROPERTY_ROLLOUT_PERCENT=25
```

**Day 19: 50% Traffic**
```bash
MARKETPLACE_ROLLOUT_PERCENT=50
PROPERTY_ROLLOUT_PERCENT=50
```

**Day 20-21: 100% Traffic**
```bash
MARKETPLACE_ROLLOUT_PERCENT=100
PROPERTY_ROLLOUT_PERCENT=100

# Monitor for 48+ hours
```

### Domain-Specific Monitoring

**Marketplace:**
- Product listing creation
- Buy/sell transactions
- Payment processing
- Media uploads
- Search functionality

**Property:**
- Property listings
- Rental applications
- Property search
- Contact owners
- Viewing schedules

### Success Criteria
- [ ] 100% marketplace traffic on wa-webhook-unified
- [ ] 100% property traffic on wa-webhook-unified
- [ ] All features working in both domains
- [ ] No transaction failures
- [ ] Performance ≥ baseline for both

---

## 🚨 Risk Mitigation

### Technical Safeguards

1. **Feature Flags:** All domains have independent toggles
2. **Gradual Rollout:** Never jump percentages, always incremental
3. **Instant Rollback:** Set percentage to 0% immediately
4. **Independent Domains:** Issues in one don't affect others
5. **Monitoring:** Real-time alerts on all metrics

### Operational Safeguards

1. **On-Call Coverage:** Team available during rollout hours
2. **Rollback Drills:** Test rollback procedure before each week
3. **Communication Plan:** Notify stakeholders before each increase
4. **Documentation:** Log all changes and observations
5. **User Support:** Extra support staff during migration

### Contingency Plans

**Scenario 1: High Error Rate (> 1%)**
- Action: Immediate rollback to previous %
- Wait: 24 hours
- Investigate: Review logs, identify root cause
- Fix: Deploy fix to wa-webhook-unified
- Resume: Start from 0% again

**Scenario 2: Performance Degradation**
- Action: Hold at current %
- Investigate: Check database, network, scaling
- Optimize: Fix performance issue
- Continue: Resume rollout after fix

**Scenario 3: Data Inconsistency**
- Action: Immediate rollback to 0%
- Freeze: Stop all migrations
- Audit: Check data integrity
- Fix: Resolve data issues
- Verify: Full testing before resuming

---

## 📊 Week-by-Week Summary

| Week | Domain | Start % | End % | Duration | Risk |
|------|--------|---------|-------|----------|------|
| 4 | AI Agents | 0% | 100% | 7 days | LOW |
| 5 | Jobs | 0% | 100% | 7 days | LOW |
| 6 | Marketplace | 0% | 100% | 7 days | LOW |
| 6 | Property | 0% | 100% | 7 days | LOW |

**Total Migration:** 21 days  
**Services Migrated:** 4 (agents, jobs, marketplace, property)  
**Overall Risk:** LOW (gradual + feature flags)

---

## ✅ Final Success Criteria (End of Week 6)

- [ ] All AI agents at 100% on wa-webhook-unified (stable 7+ days)
- [ ] Jobs domain at 100% on wa-webhook-unified (stable 7+ days)
- [ ] Marketplace at 100% on wa-webhook-unified (stable 7+ days)
- [ ] Property at 100% on wa-webhook-unified (stable 7+ days)
- [ ] All metrics ≥ baseline performance
- [ ] Zero critical incidents
- [ ] User satisfaction maintained or improved
- [ ] Ready to archive old services (Week 7+)

---

## 🔴 Critical Services Remain Protected

Throughout Weeks 4-6:
- 🔴 wa-webhook-mobility - UNTOUCHED ✅
- 🔴 wa-webhook-profile - UNTOUCHED ✅
- 🔴 wa-webhook-insurance - UNTOUCHED ✅

**No changes, no consolidation, no migration.**

---

## 📚 Documentation Deliverables

- [ ] Daily rollout logs (Weeks 4-6)
- [ ] Performance comparison reports
- [ ] Incident reports (if any)
- [ ] User feedback summary
- [ ] Final migration report (Week 6 end)

---

**Status:** 📋 PLANNED - Ready for Week 4 Execution  
**Next Action:** Begin Week 4 Day 1 - Deploy at 0%, enable 5% AI agents  
**Timeline:** 21 days (3 weeks)  
**Risk Level:** 🟢 LOW (feature flags + gradual rollout)
