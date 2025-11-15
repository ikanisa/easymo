# Phase 5: Cutover Readiness Plan

**Status**: 🚧 IN PROGRESS  
**Phase**: 5 of 5  
**Start Date**: 2025-11-11  
**Target Completion**: TBD  
**Dependencies**: Phase 4 (QA + Observability) ✅ COMPLETE

---

## 📋 Overview

Phase 5 prepares the AI agents system for production cutover. This phase focuses on final polish,
staging validation, deployment procedures, and team readiness.

### Objectives

1. ✅ **UX Polish**: User-facing messages, error handling, accessibility
2. ✅ **Release Documentation**: Release notes, migration guides, known limitations
3. 🚧 **Staging Validation**: Full regression on staging with real data
4. 🚧 **Production Readiness**: Deployment scripts, monitoring, rollback procedures
5. 🚧 **Team Enablement**: Support training, runbooks, escalation paths

---

## 🎯 Success Criteria

- [ ] All user-facing messages reviewed and approved
- [ ] Release notes and migration guide published
- [ ] Staging environment smoke tests pass (100%)
- [ ] Production deployment runbook validated
- [ ] Support team trained and signed off
- [ ] Feature flag strategy documented
- [ ] Rollback procedure tested
- [ ] Post-launch monitoring dashboard ready

---

## 📦 Deliverables

### 1. UX Polish & Final Testing

#### 1.1 User-Facing Messages Audit

**Owner**: Product Team  
**Timeline**: Week 1

- [ ] Review all agent responses for:
  - Clarity and friendliness
  - Grammar and spelling
  - Cultural sensitivity
  - Appropriate emoji usage
- [ ] Test error messages:
  - Downtime scenarios
  - Invalid inputs
  - Payment failures
  - Vendor unavailability
- [ ] Accessibility review:
  - Screen reader compatibility
  - Keyboard navigation
  - Language localization readiness

**Artifacts**:

- `docs/UX_MESSAGE_AUDIT.md` - Complete message inventory
- `supabase/functions/_shared/messages.ts` - Centralized message library

#### 1.2 E2E User Journey Testing

**Owner**: QA Team  
**Timeline**: Week 1-2

Test complete user flows:

- [ ] Buyer: Search → Select → Pay → Track delivery
- [ ] Station: Accept order → Prepare → Complete
- [ ] Vendor: Manage menu → View orders → Update availability
- [ ] Driver: Accept delivery → Navigate → Confirm
- [ ] Agent fallback scenarios (all 9 patterns from Phase 4)

**Tools**:

```bash
# Run E2E suite
pnpm test:e2e

# Interactive testing
./test-ai-agents.sh --interactive
```

---

### 2. Release Documentation

#### 2.1 Release Notes

**Owner**: Product + Engineering  
**Timeline**: Week 1

Create `RELEASE_NOTES_v2.0.md` covering:

**New Features**:

- 🤖 6 AI Agents (buyer, station, vendor, driver, admin, customer-support)
- 🔄 Intelligent fallback handling
- 📊 Real-time observability dashboard
- 🎯 Advanced vendor ranking
- 💳 Integrated wallet system

**Improvements**:

- Enhanced error messages
- Faster response times
- Better context retention
- Proactive notifications

**Known Limitations**:

- AI agents support English only (initial release)
- Max 5 retries on API failures
- 30-second timeout on LLM calls
- Marketplace agent not yet active

**Breaking Changes**:

- None (backward compatible)

#### 2.2 Migration Guide

**Owner**: Engineering  
**Timeline**: Week 1

Create `docs/MIGRATION_GUIDE_v2.md`:

**For End Users**:

- What's changing in WhatsApp interactions
- How to use new AI features
- Opt-out procedures
- Support contacts

**For Administrators**:

- Feature flag activation steps
- Configuration changes
- Database migrations checklist
- Monitoring setup

**For Developers**:

- API changes (if any)
- New environment variables
- Updated deployment procedures
- Testing requirements

#### 2.3 Known Issues & Workarounds

**Owner**: Engineering  
**Timeline**: Week 1

Document in `docs/KNOWN_ISSUES.md`:

- Edge cases with limited test coverage
- Vendor data quality issues
- Third-party API limitations
- Temporary workarounds

---

### 3. Staging Environment Validation

#### 3.1 Staging Deployment

**Owner**: DevOps  
**Timeline**: Week 2

- [ ] Deploy to staging (staging.easymo.com)
- [ ] Configure production-like infrastructure:
  - Redis cluster
  - Kafka brokers
  - Supabase project (staging)
  - Agent-Core microservices
- [ ] Enable feature flags:
  ```bash
  # Staging environment
  FEATURE_AI_AGENTS=true
  FEATURE_BUYER_AGENT=true
  FEATURE_STATION_AGENT=true
  FEATURE_VENDOR_AGENT=true
  FEATURE_DRIVER_AGENT=true
  FEATURE_ADMIN_AGENT=true
  FEATURE_CUSTOMER_SUPPORT_AGENT=true
  FEATURE_MARKETPLACE_AGENT=false  # Phase 6
  ```

#### 3.2 Smoke Tests

**Owner**: QA + Engineering  
**Timeline**: Week 2

**Automated Suite**:

```bash
# Full regression (all 84 tests)
pnpm exec vitest run

# Synthetic failures (21 scenarios)
pnpm test:synthetic

# Agent integration tests
./test-ai-agents.sh --env staging

# Load test (100 concurrent users)
./scripts/load-test-agents.sh --concurrency 100 --duration 300
```

**Manual Testing Checklist**:

- [ ] Real WhatsApp number registration
- [ ] End-to-end order flow (5+ orders)
- [ ] Payment processing (test cards)
- [ ] Agent handoffs (buyer → station → driver)
- [ ] Error scenarios (network failures, invalid inputs)
- [ ] Admin dashboard (metrics flowing correctly)
- [ ] Webhook reliability (1000+ messages)

**Success Criteria**:

- 100% automated tests passing
- <2% error rate on load test
- <500ms p95 response time
- Zero critical bugs

#### 3.3 Staging Sign-Off

**Owner**: Product + QA  
**Timeline**: End of Week 2

- [ ] QA sign-off document
- [ ] Product owner approval
- [ ] Security review (if required)
- [ ] Stakeholder demo

---

### 4. Production Readiness

#### 4.1 Deployment Runbook

**Owner**: DevOps + Engineering  
**Timeline**: Week 2-3

Create `docs/PRODUCTION_DEPLOYMENT_RUNBOOK.md`:

**Pre-Deployment Checklist**:

- [ ] Staging tests passing
- [ ] Database migrations dry-run
- [ ] Rollback plan validated
- [ ] Monitoring dashboards configured
- [ ] On-call rotation scheduled
- [ ] Support team trained
- [ ] Stakeholders notified

**Deployment Steps**:

1. **Database Migrations** (15 min)

   ```bash
   # Backup production database
   pg_dump -h prod-db.easymo.com > backup_$(date +%s).sql

   # Apply migrations (additive only, per ground rules)
   supabase db push --project-ref <prod-ref>
   pnpm --filter @easymo/db prisma:migrate:deploy
   ```

2. **Deploy Supabase Functions** (10 min)

   ```bash
   # Deploy edge functions
   supabase functions deploy --project-ref <prod-ref>

   # Verify health
   curl https://prod.easymo.com/_health
   ```

3. **Deploy Microservices** (20 min)

   ```bash
   # Rolling update (zero downtime)
   kubectl apply -f infrastructure/k8s/agent-core.yaml
   kubectl rollout status deployment/agent-core
   kubectl apply -f infrastructure/k8s/ranking-service.yaml
   kubectl rollout status deployment/ranking-service
   # ... repeat for all 12 services
   ```

4. **Enable Feature Flags** (5 min, gradual rollout)

   ```bash
   # Start with 1% traffic
   FEATURE_AI_AGENTS_ROLLOUT_PERCENTAGE=1

   # Monitor for 1 hour, then increase
   # 1% → 5% → 10% → 25% → 50% → 100% (over 24 hours)
   ```

5. **Smoke Test Production** (15 min)
   ```bash
   ./scripts/prod-smoke-test.sh
   ```

**Post-Deployment**:

- [ ] Verify metrics flowing (Supabase logs, Grafana)
- [ ] Check error rates (<1%)
- [ ] Test sample orders (internal team)
- [ ] Monitor for 1 hour (all hands)
- [ ] Send go-live notification

#### 4.2 Rollback Procedures

**Owner**: DevOps + Engineering  
**Timeline**: Week 2

Document in `docs/ROLLBACK_PROCEDURES.md`:

**Scenario 1: Critical Bug Discovered**

- Disable feature flags immediately:
  ```bash
  FEATURE_AI_AGENTS=false
  ```
- Revert to last known good deployment
- Notify stakeholders

**Scenario 2: Performance Degradation**

- Reduce rollout percentage:
  ```bash
  FEATURE_AI_AGENTS_ROLLOUT_PERCENTAGE=0
  ```
- Investigate logs and metrics
- Scale infrastructure if needed

**Scenario 3: Database Migration Failure**

- Restore from backup:
  ```bash
  psql -h prod-db.easymo.com < backup_<timestamp>.sql
  ```
- Revert code deployment
- Root cause analysis

**Rollback Testing**:

- [ ] Test feature flag disable (staging)
- [ ] Test deployment rollback (staging)
- [ ] Test database restore (separate test env)
- [ ] Document time-to-rollback (<10 min target)

#### 4.3 Monitoring & Alerting

**Owner**: DevOps + Engineering  
**Timeline**: Week 2-3

**Dashboards** (Grafana/Supabase):

- [ ] Agent performance dashboard
  - Request volume
  - Success/failure rates
  - Response times (p50, p95, p99)
  - Fallback trigger frequency
- [ ] Business metrics dashboard
  - Orders per hour
  - Conversion rates (search → order)
  - Average order value
  - Customer satisfaction (via feedback)
- [ ] Infrastructure dashboard
  - Service health
  - Database connections
  - Kafka lag
  - Redis hit rate

**Alerts** (PagerDuty/Slack):

- [ ] Error rate >5% (critical)
- [ ] Response time p95 >2s (warning)
- [ ] Service down (critical)
- [ ] Database connection pool exhausted (critical)
- [ ] Fallback rate >30% (warning)

**Log Aggregation**:

- [ ] Supabase function logs → Datadog/Logstash
- [ ] Microservice logs → ELK stack
- [ ] Structured event correlation (correlation IDs)

#### 4.4 Production Configuration

**Owner**: DevOps  
**Timeline**: Week 2

**Environment Variables** (production):

```bash
# Supabase
SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<prod-key>  # Vault-managed

# OpenAI
OPENAI_API_KEY=<prod-key>  # Vault-managed
OPENAI_MODEL=gpt-4-turbo-2024-04-09

# Feature Flags
FEATURE_AI_AGENTS=true
FEATURE_AI_AGENTS_ROLLOUT_PERCENTAGE=1  # Start at 1%
FEATURE_BUYER_AGENT=true
FEATURE_STATION_AGENT=true
FEATURE_VENDOR_AGENT=true
FEATURE_DRIVER_AGENT=true
FEATURE_ADMIN_AGENT=true
FEATURE_CUSTOMER_SUPPORT_AGENT=true
FEATURE_MARKETPLACE_AGENT=false

# Observability
LOG_LEVEL=info
ENABLE_STRUCTURED_LOGGING=true
ENABLE_METRICS=true

# Rate Limits
AGENT_MAX_RETRIES=5
AGENT_TIMEOUT_MS=30000
RATE_LIMIT_PER_USER=60  # per minute
```

**Infrastructure**:

- [ ] Production Supabase project (separate from staging)
- [ ] Kubernetes cluster (12 microservices)
- [ ] Redis cluster (3 nodes, HA)
- [ ] Kafka cluster (3 brokers)
- [ ] PostgreSQL (RDS, multi-AZ)
- [ ] CDN (CloudFront/Cloudflare)

---

### 5. Team Enablement

#### 5.1 Support Team Training

**Owner**: Product + Engineering  
**Timeline**: Week 3

**Training Session** (2 hours):

- AI agents overview (how they work)
- Common user issues & solutions
- Escalation procedures
- How to read dashboards
- Feature flag controls

**Training Materials**:

- [ ] Support runbook (`docs/SUPPORT_RUNBOOK.md`)
- [ ] FAQ document
- [ ] Video walkthrough
- [ ] Hands-on sandbox environment

**Support Runbook Topics**:

1. Agent not responding → Check feature flags, service health
2. Wrong responses → Log correlation ID, escalate to engineering
3. Payment failures → Check wallet service logs
4. Vendor not found → Verify vendor data in database
5. User stuck in loop → Manual intervention via admin dashboard

#### 5.2 Engineering Runbook

**Owner**: Engineering  
**Timeline**: Week 3

Create `docs/ENGINEERING_RUNBOOK.md`:

**Common Issues**: | Issue | Detection | Investigation | Resolution |
|-------|-----------|---------------|------------| | LLM timeout | Error rate spike | Check OpenAI
status | Increase timeout, retry | | Fallback storm | Fallback metric >50% | Check agent logs |
Disable agent, investigate | | Kafka lag | Lag metric >1000 | Check consumer health | Scale
consumers | | Database deadlock | Slow query logs | Analyze query plans | Optimize indexes | | Redis
eviction | Cache hit rate drop | Check memory usage | Scale Redis |

**Escalation Paths**:

- L1: Support team (user-facing issues)
- L2: On-call engineer (technical issues)
- L3: Engineering lead (architectural decisions)
- Emergency: Disable feature flags, page engineering manager

#### 5.3 Post-Launch Monitoring Plan

**Owner**: Engineering + Product  
**Timeline**: Week 3 (covers first 30 days post-launch)

**Day 1-7 (Intensive Monitoring)**:

- [ ] War room (Slack channel): All stakeholders
- [ ] Hourly metrics review
- [ ] Daily standup at 9am, 5pm
- [ ] On-call engineer available 24/7

**Week 2-4 (Standard Monitoring)**:

- [ ] Daily metrics review
- [ ] Weekly retrospective
- [ ] Incident postmortems (if any)
- [ ] User feedback collection

**Success Metrics**:

- Error rate <1%
- Agent response time p95 <1s
- Fallback rate <10%
- User satisfaction >4.5/5
- Order volume increase >20%

---

## 🚀 Rollout Strategy

### Gradual Feature Flag Rollout

**Phase 5A: Internal Testing** (Day 1)

- Enable for internal team only (10 users)
- Test all flows manually
- Fix any immediate issues

**Phase 5B: Beta Users** (Days 2-3)

- Enable for 1% of users (~100 users)
- Monitor closely
- Collect feedback

**Phase 5C: Controlled Rollout** (Days 4-7)

- Day 4: 5% (500 users)
- Day 5: 10% (1,000 users)
- Day 6: 25% (2,500 users)
- Day 7: 50% (5,000 users)

**Phase 5D: Full Rollout** (Days 8-10)

- Day 8: 75%
- Day 9: 90%
- Day 10: 100% 🎉

**Rollback Triggers**:

- Error rate >5%
- User complaints >10/hour
- Critical bug discovered
- Business metrics drop >10%

---

## 📊 Tracking & Metrics

### Implementation Progress

Track in this document:

| Task                | Owner       | Status         | Completion Date |
| ------------------- | ----------- | -------------- | --------------- |
| UX message audit    | Product     | 🚧 In Progress | -               |
| E2E testing         | QA          | 🚧 In Progress | -               |
| Release notes       | Product     | 🚧 In Progress | -               |
| Migration guide     | Engineering | 🚧 In Progress | -               |
| Staging deployment  | DevOps      | 📝 Planned     | -               |
| Smoke tests         | QA          | 📝 Planned     | -               |
| Deployment runbook  | DevOps      | 🚧 In Progress | -               |
| Rollback procedures | DevOps      | 🚧 In Progress | -               |
| Monitoring setup    | DevOps      | 📝 Planned     | -               |
| Support training    | Product     | 📝 Planned     | -               |
| Engineering runbook | Engineering | 🚧 In Progress | -               |

**Legend**: ✅ Complete | 🚧 In Progress | 📝 Planned

### Key Metrics (Post-Launch)

**Technical Metrics**:

- Error rate: Target <1%
- Response time p95: Target <1s
- Fallback rate: Target <10%
- Uptime: Target 99.9%

**Business Metrics**:

- Orders per day: Baseline + 20% target
- Conversion rate: Baseline + 15% target
- User satisfaction: >4.5/5
- Support tickets: Baseline - 30% target

---

## 🔗 Related Documentation

- **Phase 4 Completion**: `docs/PHASE4_COMPLETION.md`
- **QA Plan**: `docs/QA_OBSERVABILITY_PLAN.md`
- **Architecture**: `docs/ARCHITECTURE.md`
- **Ground Rules**: `docs/GROUND_RULES.md`
- **Agent Catalog**: `docs/AGENT_CATALOG_COMPLETE.md`

---

## ⏭️ Next Steps

1. **Immediate** (This Week):
   - Begin UX message audit
   - Draft release notes
   - Set up staging environment

2. **Short-term** (Next 2 Weeks):
   - Complete staging validation
   - Finalize deployment runbook
   - Train support team

3. **Launch Day** (Week 3+):
   - Execute production deployment
   - Begin gradual rollout
   - Monitor intensively

---

## 📝 Notes & Decisions

### Decision Log

**2025-11-11**: Phase 5 kickoff

- Decided on gradual rollout strategy (1% → 100% over 10 days)
- Support training scheduled for Week 3
- Staging environment to mirror production exactly

---

**Document Version**: 1.0  
**Status**: IN PROGRESS  
**Last Updated**: 2025-11-11  
**Next Review**: Weekly until completion
