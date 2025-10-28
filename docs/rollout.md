# Rollout Plan & Launch Gates

## Overview

This document defines the staged rollout process for production releases, launch gates, and rollback procedures for the easyMO platform.

## Table of Contents

1. [Rollout Strategy](#rollout-strategy)
2. [Launch Gates](#launch-gates)
3. [Rollout Phases](#rollout-phases)
4. [Rollback Procedures](#rollback-procedures)
5. [Post-Launch Monitoring](#post-launch-monitoring)

---

## Rollout Strategy

### Principles

- **Feature Flags**: All new features controlled by flags
- **Gradual Rollout**: Start with internal users, then staged percentages
- **Fast Rollback**: Single-click rollback via feature flags
- **Observability**: Monitor metrics at each stage
- **Additive Only**: No breaking changes to production

### Environments

1. **Local**: Developer workstations
2. **Staging**: `staging.supabase.co` (pre-production testing)
3. **Production**: `production.supabase.co` (live users)

---

## Launch Gates

### Pre-Launch Checklist

#### Code Quality
- [ ] All CI checks passing (lint, typecheck, tests)
- [ ] Code review approved by 2+ engineers
- [ ] Security review completed (if applicable)
- [ ] Performance benchmarks met
- [ ] Documentation updated

#### Database
- [ ] Migrations applied in staging
- [ ] RLS policies tested
- [ ] Indexes verified (EXPLAIN ANALYZE)
- [ ] Backup taken before migration
- [ ] Rollback SQL prepared

#### Security
- [ ] WhatsApp signature tests passing
- [ ] Destination URL allowlist verified
- [ ] Rate limits configured
- [ ] Secrets rotated (if needed)
- [ ] No hardcoded secrets in code

#### Observability
- [ ] Structured logging in place
- [ ] Metrics/counters added
- [ ] Dashboards created/updated
- [ ] Alerts configured
- [ ] Runbook updated

#### Feature Flags
- [ ] Flag exists in database
- [ ] Default value set (OFF in production)
- [ ] Admin panel toggle works
- [ ] Flag documented in /docs/flags.md

#### Testing
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Manual smoke tests completed
- [ ] Load testing completed (if applicable)
- [ ] Edge cases validated

---

## Rollout Phases

### Phase 1: Internal Testing (Day 1)

**Target**: easyMO team members only

**Actions**:
1. Deploy to production with feature flag OFF
2. Enable flag for internal user IDs only
3. Test all flows end-to-end
4. Monitor logs and dashboards

**Success Criteria**:
- No errors for 24 hours
- All flows work as expected
- Performance within targets

**Rollback Trigger**:
- Any P0/P1 incident
- > 5% error rate

---

### Phase 2: Beta Users (Day 3)

**Target**: 10% of users (selected beta testers)

**Actions**:
1. Enable flag for beta user segment
2. Send announcement to beta users
3. Monitor metrics closely
4. Collect feedback

**Success Criteria**:
- Error rate < 1%
- p95 latency < 500ms
- Positive user feedback
- No security incidents

**Rollback Trigger**:
- Error rate > 2%
- User complaints > 5
- Security incident

---

### Phase 3: Gradual Rollout (Day 7+)

**Target**: 25% → 50% → 75% → 100% of users

**Actions**:
1. Increase rollout percentage every 2-3 days
2. Monitor key metrics at each stage
3. Pause if issues detected
4. Complete rollout after 100% stable

**Success Criteria (per stage)**:
- Error rate < 0.5%
- p95 latency < 400ms
- No user complaints
- Business metrics positive

**Rollback Trigger**:
- Error rate > 1%
- p95 latency > 1000ms
- Critical bug discovered

---

### Phase 4: Full Launch (Day 14+)

**Target**: 100% of users, flag removed

**Actions**:
1. Verify 100% rollout stable for 3+ days
2. Remove feature flag from code
3. Update documentation (mark as "launched")
4. Announce to all users

**Success Criteria**:
- 100% stable for 72 hours
- No open P0/P1 issues
- User feedback positive
- Business metrics meet goals

---

## Rollback Procedures

### Level 1: Feature Flag Disable (Fastest)

**Time**: < 1 minute

**Steps**:
```bash
# Via Admin Panel
1. Navigate to Settings → Feature Flags
2. Toggle feature OFF
3. Verify change in logs

# Via Database (emergency)
psql $SUPABASE_DB_URL <<SQL
UPDATE settings SET value = 'false' WHERE key = 'feature_name.enabled';
SQL
```

**Use When**:
- High error rate detected
- Security vulnerability discovered
- User complaints spike

---

### Level 2: Environment Variable Rollback

**Time**: < 5 minutes

**Steps**:
```bash
# Update Supabase secret
supabase secrets set FEATURE_ENABLED=false --project-ref <ref>

# Functions auto-reload with new secret
# Verify change
curl https://<ref>.supabase.co/functions/v1/health
```

**Use When**:
- Feature flag DB update fails
- Need global disable across all functions

---

### Level 3: Code Rollback

**Time**: < 15 minutes

**Steps**:
```bash
# Checkout previous version
git log --oneline -10
git checkout <previous-commit>

# Redeploy affected functions
supabase functions deploy wa-router wa-webhook --project-ref <ref>

# Verify deployment
supabase functions list --project-ref <ref>

# Return to main
git checkout main
```

**Use When**:
- Feature flag disable not sufficient
- Code bug cannot be hotfixed quickly
- Need full revert to previous state

---

### Level 4: Database Rollback

**Time**: < 30 minutes

**Steps**:
```bash
# Connect to database
psql $SUPABASE_DB_URL

# Apply reverse migration (prepared beforehand)
\i migrations/reverse/20250128_rollback_feature.sql

# Verify data integrity
SELECT COUNT(*) FROM affected_table;

# Redeploy functions if schema changed
supabase functions deploy --all --project-ref <ref>
```

**Use When**:
- Migration causes data corruption
- Schema change breaks application
- Must restore previous database state

**Note**: Always test rollback SQL in staging first.

---

## Post-Launch Monitoring

### First 24 Hours

**Monitor** (check every 2 hours):
- Error rate
- Response time (p50, p95, p99)
- User complaints
- Business metrics

**Alerts**:
- Set to high sensitivity
- Escalate immediately on threshold breach

---

### First Week

**Monitor** (check daily):
- Trend analysis (error rates, latency)
- User feedback (support tickets, reviews)
- Business impact (conversion, engagement)

**Actions**:
- Hotfix bugs as discovered
- Tune performance if needed
- Adjust feature based on feedback

---

### Ongoing

**Monitor** (weekly review):
- Feature adoption rate
- Performance trends
- Technical debt accumulation

**Actions**:
- Schedule follow-up improvements
- Remove temporary code/flags
- Update documentation

---

## Example: Deep-link Service Rollout

### Timeline

| Phase | Target | Duration | Success Metric |
|-------|--------|----------|----------------|
| Internal | 10 team members | 2 days | 0 errors |
| Beta | 100 users | 5 days | < 1% error rate |
| 25% | 2,500 users | 3 days | < 0.5% error rate |
| 50% | 5,000 users | 3 days | < 0.5% error rate |
| 75% | 7,500 users | 3 days | < 0.5% error rate |
| 100% | 10,000 users | 7 days | < 0.5% error rate |
| **Total** | | **23 days** | |

### Feature Flag

```sql
-- Create flag
INSERT INTO settings (key, value, metadata) VALUES (
  'deeplinks.enabled',
  'false',
  jsonb_build_object(
    'rollout_percentage', 0,
    'target_user_ids', ARRAY[]::uuid[],
    'launched_at', NULL
  )
);

-- Enable for internal users
UPDATE settings 
SET 
  value = 'true',
  metadata = jsonb_set(
    metadata,
    '{target_user_ids}',
    '["uuid1", "uuid2"]'::jsonb
  )
WHERE key = 'deeplinks.enabled';

-- Gradual rollout by percentage
UPDATE settings 
SET metadata = jsonb_set(metadata, '{rollout_percentage}', '25')
WHERE key = 'deeplinks.enabled';

-- Full launch
UPDATE settings 
SET 
  value = 'true',
  metadata = jsonb_set(metadata, '{rollout_percentage}', '100')
WHERE key = 'deeplinks.enabled';
```

### Rollback Scenario

**Issue**: 5% error rate detected at 25% rollout.

**Action**:
1. **Immediate** (1 min): Disable feature flag
2. **Investigate** (10 min): Check logs, identify root cause
3. **Decide** (5 min): Hotfix or full rollback?
4. **Execute** (varies): Apply fix, test in staging
5. **Retry** (next day): Re-enable flag for beta users

**Communication**:
- Post in #incidents channel
- Update status page
- Notify affected users (if needed)

---

## Rollback Decision Matrix

| Issue | Severity | Rollback Method | Time to Execute |
|-------|----------|-----------------|-----------------|
| High error rate (>5%) | P0 | Feature flag OFF | 1 min |
| Security vulnerability | P0 | Feature flag OFF + code rollback | 5 min |
| Performance degradation | P1 | Feature flag OFF | 1 min |
| Minor bug | P2 | Hotfix in next deployment | Next day |
| User confusion | P2 | Improve docs, adjust UI | Next sprint |

---

## Launch Approval

### Approvers

| Role | Approval Required For |
|------|----------------------|
| Engineering Lead | All launches |
| Security Lead | Security-sensitive features |
| Product Manager | User-facing features |
| CTO | Major releases |

### Approval Checklist

- [ ] All launch gates passed
- [ ] Rollback plan documented
- [ ] On-call engineer briefed
- [ ] Status page ready
- [ ] User communication drafted (if needed)

---

**Last Updated**: 2025-10-28  
**Owner**: easyMO Release Management Team  
**Review Cycle**: Per release
