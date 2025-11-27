# EasyMO Production Readiness Implementation Plan

**Version**: 1.0  
**Date**: 2025-11-27  
**Duration**: 4 Weeks (20 Working Days)  
**Total Effort**: ~160 developer hours  
**Team Size**: 2-3 developers  
**Target Launch**: 2025-12-25

## Executive Summary

This plan addresses all 23 issues identified in the audit, organized into 4 phases prioritized by risk and impact. P0 blockers are resolved in Week 1, followed by infrastructure improvements and cleanup.

## Phase Summary

| Phase | Duration | Focus | Issues | Effort |
|-------|----------|-------|--------|--------|
| **Phase 1** | Week 1 | Security & Testing | #5, #6, #7, #18 | 56h |
| **Phase 2** | Week 2 | DevOps & Infrastructure | #10, #11, #9, #16, #23 | 42h |
| **Phase 3** | Week 3 | Code Quality | #2, #3, #8, #12, #13, #14 | 36h |
| **Phase 4** | Week 4 | Documentation & Cleanup | #1, #4, #15, #17, #19, #20, #21, #22 | 26h |

---

## 🔴 PHASE 1: Security & Critical Testing (Week 1)

**Objective**: Ensure all financial operations are secure, audited, and properly tested.

### Tasks Overview

| Task | Issue | Priority | Effort | Owner |
|------|-------|----------|--------|-------|
| Rate Limiting | #5 | P0 | 8h | Backend Dev |
| RLS Audit | #6 | P0 | 16h | DB Engineer |
| Wallet Tests | #7 | P0 | 24h | Senior Dev |
| Audit Triggers | #18 | P0 | 8h | DB Engineer |

### 1.1 Rate Limiting Implementation

**Deliverables**:
- [ ] Rate limit module in `_shared/rate-limit.ts`
- [ ] Applied to all 80+ edge functions
- [ ] Verification script passing
- [ ] Metrics logged

**Rate Limits**:
- WhatsApp Webhooks: 100 req/min
- Payment Webhooks: 50 req/min
- AI Agents: 30 req/min
- Admin APIs: 200 req/min

**Implementation**: See [QUICK_START.md](./QUICK_START.md) Task 1

### 1.2 Complete RLS Audit

**Deliverables**:
- [ ] RLS audit SQL script
- [ ] All financial tables have RLS enabled
- [ ] Audit triggers on 10 financial tables
- [ ] Weekly RLS audit GitHub Action

**Tables Requiring RLS**:
1. `wallet_accounts`
2. `wallet_entries`
3. `wallet_transactions`
4. `payments`
5. `payment_intents`
6. `momo_transactions`
7. `revolut_transactions`
8. `invoices`
9. `subscriptions`
10. `refunds`

**Implementation**: See [QUICK_START.md](./QUICK_START.md) Task 2

### 1.3 Wallet Service Test Coverage

**Coverage Goals**:
| Module | Current | Target |
|--------|---------|--------|
| wallet-service/transfer | ~40% | 95% |
| wallet-service/balance | ~50% | 90% |
| wallet-service/reconciliation | ~30% | 90% |
| momo-allocator | ~45% | 85% |

**Critical Test Cases**:
- ✅ Double-entry bookkeeping verification
- ✅ Idempotency enforcement
- ✅ Overdraft prevention
- ✅ Concurrent transfer handling
- ✅ Transaction rollback on failure
- ✅ Audit trail creation

**Implementation**: See [QUICK_START.md](./QUICK_START.md) Task 3

### 1.4 Audit Trigger Verification

**Deliverables**:
- [ ] Audit log table with proper schema
- [ ] Triggers on all 10 financial tables
- [ ] Changed fields tracking
- [ ] Correlation ID propagation

**Implementation**: See [QUICK_START.md](./QUICK_START.md) Task 4

---

## 🟡 PHASE 2: DevOps & Infrastructure (Week 2)

**Objective**: Consolidate deployment infrastructure and ensure production-ready operations.

### Tasks Overview

| Task | Issue | Priority | Effort | Owner |
|------|-------|----------|--------|-------|
| Deployment Consolidation | #10 | P1 | 8h | DevOps |
| Build Automation | #11 | P1 | 2h | Build Engineer |
| Workflow Deduplication | #9 | P2 | 4h | DevOps |
| Health Checks | #16 | P1 | 8h | Backend Dev |
| Deployment Docs | #23 | P2 | 4h | DevOps |

### 2.1 Consolidate Deployment Scripts

**Problem**: 50+ shell scripts in root directory

**Solution**: New structure
```
scripts/
├── deploy/
│   ├── all.sh              # One script to rule them all
│   ├── edge-functions.sh
│   ├── migrations.sh
│   ├── services.sh
│   └── frontend.sh
├── verify/
│   ├── all.sh
│   ├── health-checks.sh
│   └── rate-limiting.sh
└── maintenance/
    ├── rotate-secrets.sh
    └── backup-database.sh
```

**Deliverables**:
- [ ] Unified `deploy/all.sh` script
- [ ] Old scripts archived to `scripts/.archive/`
- [ ] Documentation in `scripts/README.md`

### 2.2 Automate Build Order

**Problem**: Manual build sequence required

**Solution**: Add to root `package.json`
```json
{
  "scripts": {
    "prebuild": "pnpm run build:deps",
    "build:deps": "pnpm --filter @va/shared build && pnpm --filter @easymo/commons build",
    "build": "turbo run build --filter=!@va/shared --filter=!@easymo/commons"
  }
}
```

**Deliverables**:
- [ ] Automated prebuild script
- [ ] Turbo configuration
- [ ] CI using new scripts

### 2.3 Health Check Implementation

**Required Endpoints**:
- `/health` - Overall status
- `/health/liveness` - K8s liveness probe
- `/health/readiness` - Service readiness

**Services Requiring Health Checks** (12):
1. wallet-service
2. agent-core
3. broker-orchestrator
4. buyer-service
5. vendor-service
6. ranking-service
7. attribution-service
8. video-orchestrator
9. voice-bridge
10. wa-webhook-ai-agents
11. whatsapp-pricing-server
12. whatsapp-webhook-worker

**Deliverables**:
- [ ] Health check module in `@easymo/commons`
- [ ] Endpoints on all 12 services
- [ ] Verification script

### 2.4 Document Deployment Architecture

**Deliverables**:
- [ ] Platform responsibility matrix
- [ ] Environment configuration guide
- [ ] Deployment runbook

**Platform Breakdown**:
- **Netlify**: Frontend apps (admin-app, waiter-pwa)
- **Supabase**: Edge Functions (80+ functions)
- **Cloud Run**: Microservices (12 services)
- **Supabase**: Database (PostgreSQL)

---

## 🟢 PHASE 3: Code Quality & Standardization (Week 3)

**Objective**: Improve code quality, reduce technical debt, standardize tooling.

### Tasks Overview

| Task | Issue | Priority | Effort | Owner |
|------|-------|----------|--------|-------|
| Admin App Decision | #2 | P1 | 8h | Tech Lead |
| Clean Services Dir | #3 | P2 | 2h | Backend Dev |
| Standardize Tests | #8 | P2 | 16h | QA Engineer |
| Fix TypeScript Versions | #12 | P2 | 4h | Build Engineer |
| Fix Dependencies | #13 | P2 | 2h | Build Engineer |
| Zero ESLint Warnings | #14 | P2 | 4h | All Devs |

### 3.1 Deprecate Duplicate Admin App

**Decision Required**: Keep `admin-app` or `admin-app-v2`?

**Recommendation**: Keep `admin-app` (has Tauri desktop support)

**Tasks**:
- [ ] Migrate improvements from v2 to main
- [ ] Archive admin-app-v2
- [ ] Update documentation
- [ ] Update deployment scripts

### 3.2 Standardize Test Framework

**Problem**: Mixed Jest and Vitest usage

**Solution**: Migrate all to Vitest

**Deliverables**:
- [ ] All services using Vitest
- [ ] Consistent test configuration
- [ ] Updated CI workflows

### 3.3 Achieve Zero ESLint Warnings

**Current**: "2 console warnings OK"  
**Target**: 0 warnings

**Tasks**:
- [ ] Fix existing warnings
- [ ] Update ESLint config to error on warnings
- [ ] Update CI to fail on warnings

---

## 🔵 PHASE 4: Documentation & Cleanup (Week 4)

**Objective**: Organize documentation, verify performance optimizations, create API docs.

### Tasks Overview

| Task | Issue | Priority | Effort | Owner |
|------|-------|----------|--------|-------|
| Clean Root Directory | #1 | P1 | 2h | Any Dev |
| Verify .env.example | #4 | P2 | 1h | Security |
| Observability Audit | #15 | P2 | 4h | Backend Dev |
| Clarify Migration Dirs | #17 | P2 | 2h | DB Engineer |
| Bundle Analysis | #19 | P2 | 4h | Frontend Dev |
| Index Verification | #20 | P2 | 4h | DB Engineer |
| Organize Docs | #21 | P2 | 6h | Tech Writer |
| API Documentation | #22 | P2 | 8h | Backend Dev |

### 4.1 Clean Root Directory

**Problem**: 80+ markdown files in root

**Solution**:
```bash
mkdir -p docs/sessions docs/architecture/diagrams
mv *_COMPLETE*.md *_STATUS*.md *_SUMMARY*.txt docs/sessions/
mv *_VISUAL*.txt *_ARCHITECTURE*.txt docs/architecture/
```

**Deliverables**:
- [ ] Root directory clean
- [ ] Files organized in `/docs`
- [ ] Updated `.gitignore`

### 4.2 Organize Documentation

**New Structure**:
```
docs/
├── README.md (index)
├── architecture/
│   ├── OVERVIEW.md
│   └── diagrams/
├── deployment/
│   ├── RUNBOOK.md
│   └── ROLLBACK.md
├── production-readiness/
│   ├── AUDIT_REPORT.md
│   ├── IMPLEMENTATION_PLAN.md
│   └── QUICK_START.md
├── api/
│   ├── REST_API.md
│   └── WEBHOOKS.md
└── sessions/ (archived)
```

### 4.3 Create API Documentation

**Deliverables**:
- [ ] OpenAPI specs for REST endpoints
- [ ] GraphQL schema documentation
- [ ] Webhook documentation
- [ ] Authentication guide

### 4.4 Database Index Verification

**Tasks**:
- [ ] Audit all high-traffic queries
- [ ] Run EXPLAIN ANALYZE on critical queries
- [ ] Verify indexes exist
- [ ] Document index strategy

---

## Success Criteria by Phase

### ✅ Phase 1 Complete When:
- [ ] All P0 security issues resolved
- [ ] Rate limiting active on 80+ edge functions
- [ ] All financial tables have RLS + audit triggers
- [ ] Wallet service test coverage ≥ 80%

### ✅ Phase 2 Complete When:
- [ ] Single unified deployment script works
- [ ] All 12 services have health check endpoints
- [ ] Build order automated
- [ ] Deployment architecture documented

### ✅ Phase 3 Complete When:
- [ ] Single admin app version active
- [ ] All tests use Vitest
- [ ] TypeScript versions consistent
- [ ] Zero ESLint warnings

### ✅ Phase 4 Complete When:
- [ ] Root directory clean (<10 files)
- [ ] Documentation organized in `/docs`
- [ ] API documentation complete
- [ ] All database indexes verified

---

## Risk Mitigation

### High-Risk Items

**1. Wallet Test Coverage (24h)**
- **Risk**: Most time-consuming task
- **Mitigation**: Allocate senior developer, start Day 1
- **Contingency**: Focus on critical paths if time runs short

**2. RLS Audit (16h)**
- **Risk**: Database expertise required
- **Mitigation**: Assign experienced DB engineer
- **Contingency**: Phased rollout if complex

**3. Admin App Deprecation**
- **Risk**: Requires product decision
- **Mitigation**: Get decision in Phase 1
- **Contingency**: Can delay to post-launch if needed

### Contingency Plans

- If Phase 1 extends beyond Week 1, delay Phase 3 tasks
- Phase 3 and 4 can run in parallel if resources available
- Documentation (Phase 4) can continue post-launch if needed

---

## Resource Allocation

### Recommended Team

| Role | Allocation | Primary Tasks |
|------|-----------|---------------|
| Senior Backend Developer | 100% Week 1, 50% Weeks 2-4 | Wallet tests, health checks |
| Database Engineer | 100% Week 1-2, 25% Weeks 3-4 | RLS audit, triggers, indexes |
| DevOps Engineer | 25% Week 1, 100% Week 2, 50% Weeks 3-4 | Deployment consolidation, CI/CD |
| Technical Writer | 0% Weeks 1-3, 100% Week 4 | Documentation cleanup |

### Weekly Commitment

| Week | Focus | Team Commitment |
|------|-------|-----------------|
| Week 1 | P0 Blockers | 100% (all hands) |
| Week 2 | Infrastructure | 80% |
| Week 3 | Code Quality | 60% |
| Week 4 | Documentation | 40% (can parallel) |

---

## Progress Tracking

### Daily Standup Questions (Week 1)

1. Which P0 task are you working on?
2. What's blocking you?
3. What's your confidence level (1-5) for completing on time?

### Weekly Metrics

Track in GitHub Project:

| Week | Metric | Target | Actual |
|------|--------|--------|--------|
| 1 | P0 issues resolved | 4/4 | ___ |
| 1 | Edge functions with rate limiting | 80/80 | ___ |
| 1 | Wallet test coverage | 80%+ | ___ |
| 2 | Services with health checks | 12/12 | ___ |
| 2 | Deployment scripts consolidated | Yes | ___ |
| 3 | ESLint warnings | 0 | ___ |
| 4 | Root directory file count | <10 | ___ |

---

## Go/No-Go Decision (End of Week 4)

### Production Readiness Checklist

#### Security (Must Pass)
- [ ] Rate limiting verified on all public endpoints
- [ ] RLS policies on all financial tables
- [ ] Audit triggers functional
- [ ] Secret scanning passed
- [ ] Webhook signatures verified

#### Testing (Must Pass)
- [ ] Wallet service ≥80% coverage
- [ ] E2E payment flow tests pass
- [ ] Load testing completed

#### Operations (Must Pass)
- [ ] All services have health checks
- [ ] Monitoring dashboards configured
- [ ] Rollback procedures documented
- [ ] On-call rotation defined

#### Documentation (Nice to Have)
- [ ] API documentation complete
- [ ] Deployment runbook exists
- [ ] Root directory clean

### Decision Matrix

| Must Pass Failed | Nice to Have Failed | Decision |
|------------------|---------------------|----------|
| 0 | 0-1 | ✅ GO |
| 0 | 2-3 | ⚠️ GO with caveats |
| 1 | Any | ❌ NO-GO - Fix blocker |
| 2+ | Any | ❌ NO-GO - Postpone launch |

---

## Post-Launch (Week 5+)

### Monitoring (First 48 Hours)

- [ ] Watch error rates (target: <0.1%)
- [ ] Monitor rate limit hits
- [ ] Verify audit logs populating
- [ ] Check wallet transaction success rate

### Quick Wins

After launch, address remaining P2 issues:
- Bundle size optimization
- Remaining documentation
- Code quality improvements

---

## Timeline Summary

```
Week 1: 🔴 Security & Testing (P0)
├── Rate Limiting (8h)
├── RLS Audit (16h)
├── Wallet Tests (24h)
└── Audit Triggers (8h)

Week 2: 🟡 DevOps (P1)
├── Deploy Scripts (8h)
├── Build Automation (2h)
├── Health Checks (8h)
└── Documentation (4h)

Week 3: 🟢 Code Quality (P2)
├── Admin App (8h)
├── Test Framework (16h)
└── TypeScript/ESLint (8h)

Week 4: 🔵 Cleanup (P2)
├── Root Cleanup (2h)
├── Docs Organization (8h)
├── API Docs (8h)
└── DB Indexes (4h)

Week 5: 🚀 LAUNCH
```

---

## Next Steps

1. **Immediate**: Review and approve this plan
2. **Day 1**: Assign owners to Phase 1 tasks  
3. **Week 1**: Daily standups to track P0 progress
4. **Week 2**: Begin Phase 2 while monitoring Phase 1 completion
5. **Week 4**: Final go/no-go decision

**Questions?** See [QUICK_START.md](./QUICK_START.md) for immediate action items.

**Detailed Issues?** See [AUDIT_REPORT.md](./AUDIT_REPORT.md) for full context.
