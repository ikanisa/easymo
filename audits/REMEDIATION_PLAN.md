# Remediation Plan - EasyMO Go-Live Readiness

**Project:** ikanisa/easymo  
**Audit Date:** 2025-10-30  
**Plan Version:** 1.0  
**Status:** Draft - Pending Approval

---

## Executive Summary

This remediation plan sequences fixes for findings identified in the Go-Live Readiness Audit. It categorizes work into **Pre-Go-Live Blockers**, **Critical Post-Launch**, **Major**, and **Minor** priorities with clear ownership, effort estimates, and acceptance criteria.

**Total Effort Estimate:** 6-8 weeks (30-40 person-days)  
**Critical Path:** 10-12 days (blockers)  
**Teams Involved:** DevOps, Platform, Database, Development, Frontend

---

## Phase 1: Pre-Go-Live Blockers (MUST COMPLETE)

**Timeline:** 10-12 days before go-live  
**Gate:** Cannot deploy to production without completion  
**Sign-off Required:** CTO, Security Lead, Database Lead

### Finding #2: Dependency Vulnerabilities (Critical)

**Owner:** DevOps Team  
**Effort:** 3-5 days  
**Priority:** P0 - Blocker

#### Tasks

1. **Update Vulnerable Packages** (Day 1)
   ```bash
   # High severity
   pnpm update semver@^7.5.2
   pnpm update path-to-regexp@^6.3.0
   
   # Moderate severity
   pnpm update jose@^4.15.5
   pnpm update tar@^6.2.1
   pnpm update undici@^5.28.5
   pnpm update esbuild@^0.25.0
   ```
   
   **Success Criteria:**
   - `pnpm audit` shows 0 high, 0 critical CVEs
   - All packages update without breaking changes
   - Lock file committed and reviewed

2. **Run Comprehensive Test Suite** (Day 2-3)
   ```bash
   pnpm install --frozen-lockfile
   pnpm --filter @va/shared build
   pnpm --filter @easymo/commons build
   pnpm lint
   pnpm type-check
   pnpm test
   pnpm --filter @easymo/admin-app test
   pnpm test:functions
   ```
   
   **Success Criteria:**
   - All tests pass
   - No new type errors introduced
   - Lint warnings unchanged or reduced

3. **Deploy to Staging** (Day 3)
   ```bash
   # Deploy and smoke test
   git checkout -b chore/update-dependencies
   git commit -am "chore: update vulnerable dependencies"
   # Push and deploy via CI/CD
   ```
   
   **Success Criteria:**
   - Staging deployment succeeds
   - Health checks pass
   - Manual smoke tests complete (auth, core flows)

4. **Integration Testing** (Day 4)
   - Test all critical user journeys
   - Verify WhatsApp webhook processing
   - Test admin panel operations
   - Verify edge function execution
   - Test voice bridge and realtime features
   
   **Success Criteria:**
   - All critical paths functional
   - No regressions detected
   - Performance unchanged (latency, throughput)

5. **Security Validation** (Day 5)
   ```bash
   pnpm audit --audit-level moderate
   node scripts/assert-no-service-role-in-client.mjs
   # Optional: Run OWASP ZAP baseline scan
   ```
   
   **Success Criteria:**
   - No moderate+ vulnerabilities remain
   - Secret scanning passes
   - Security team sign-off

**Acceptance Criteria:**
- [ ] All 3 high CVEs patched
- [ ] All 8 moderate CVEs patched (or documented exceptions)
- [ ] Full test suite passes
- [ ] Staging deployment successful
- [ ] Integration tests pass
- [ ] Security team approval
- [ ] PR merged to main

**Rollback Plan:**
- If tests fail, revert to previous package versions
- Document incompatibility issues
- Seek alternative patches or mitigations

---

### Finding #5: Migration Safety Review (Major)

**Owner:** Database Team + DevOps  
**Effort:** 5-7 days  
**Priority:** P0 - Blocker

#### Tasks

1. **Create Migration Safety Checklist** (Day 1)
   
   Create `docs/db/MIGRATION_SAFETY_CHECKLIST.md`:
   ```markdown
   ## Safe Migration Patterns
   
   ### Index Creation
   - [ ] All new indexes use CONCURRENTLY
   - [ ] Indexes on large tables created off-hours (if needed)
   
   ### Column Changes
   - [ ] New columns added as nullable first
   - [ ] Type changes use expand-contract pattern
   - [ ] Backfills are batched (<=1000 rows per tx)
   
   ### Constraint Changes
   - [ ] Foreign keys added with NOT VALID
   - [ ] Validation happens in separate transaction
   - [ ] Check constraints added NOT VALID
   
   ### Enum Changes
   - [ ] Only adding values (never removing)
   - [ ] New values appended to end
   
   ### Lock Duration
   - [ ] No operation holds locks >5 seconds
   - [ ] Large operations split into batches
   ```

2. **Audit Recent Migrations** (Day 2-4)
   
   Review migrations from last 3 months (estimated 20-30 files):
   
   ```bash
   # Generate audit report
   cd supabase/migrations
   ls -lt *.sql | head -30 > /tmp/recent_migrations.txt
   
   # Check for unsafe patterns
   grep -r "CREATE INDEX" *.sql | grep -v "CONCURRENTLY" > /tmp/unsafe_indexes.txt
   grep -r "ALTER TABLE.*ALTER COLUMN.*TYPE" *.sql > /tmp/type_changes.txt
   grep -r "ALTER TABLE.*ADD COLUMN.*DEFAULT" *.sql > /tmp/default_additions.txt
   ```
   
   **Success Criteria:**
   - All unsafe patterns documented
   - Recommendations created for each issue
   - Risk assessment per migration
   
3. **Test Against Production-Sized Data** (Day 5-6)
   
   ```bash
   # Create test database with production volume
   # Restore anonymized production backup (or generate data)
   # Run migrations and measure lock duration
   
   psql $TEST_DB_URL << 'SQL'
   BEGIN;
   SET lock_timeout = '10s';
   -- Run migration content here
   COMMIT;
   SQL
   
   # Measure execution time and locks
   ```
   
   **Success Criteria:**
   - No migration holds exclusive locks >10 seconds
   - Backfills complete within timeout (5 minutes)
   - No deadlocks detected
   
4. **Create Migration Safety Linter** (Day 6-7)
   
   Create `scripts/lint-migrations.sh`:
   ```bash
   #!/bin/bash
   # Lint migrations for safety
   
   EXIT_CODE=0
   
   # Check for non-concurrent indexes
   if grep -r "CREATE INDEX" supabase/migrations/*.sql | grep -v "CONCURRENTLY"; then
     echo "ERROR: Non-concurrent index creation found"
     EXIT_CODE=1
   fi
   
   # Check for column type changes without comment
   if grep -r "ALTER TABLE.*ALTER COLUMN.*TYPE" supabase/migrations/*.sql; then
     echo "WARNING: Column type change detected - verify expand-contract pattern"
   fi
   
   # Check for large default values
   if grep -r "ALTER TABLE.*ADD COLUMN.*DEFAULT" supabase/migrations/*.sql; then
     echo "WARNING: Default value on new column - verify safety"
   fi
   
   exit $EXIT_CODE
   ```
   
   Add to CI:
   ```yaml
   - name: Lint migrations for safety
     run: bash scripts/lint-migrations.sh
   ```
   
   **Success Criteria:**
   - Linter detects known unsafe patterns
   - CI integration functional
   - Documentation updated

5. **Document Safe Patterns** (Day 7)
   
   Update `CONTRIBUTING.md` with migration section:
   ```markdown
   ## Database Migrations
   
   ### Zero-Downtime Requirements
   
   All migrations MUST be safe for zero-downtime deployment:
   
   1. Use `CREATE INDEX CONCURRENTLY`
   2. Add columns as nullable, backfill, then make NOT NULL
   3. Batch large updates (<=1000 rows per transaction)
   4. Add foreign keys with NOT VALID, validate separately
   5. Test against production-sized data
   
   ### Testing Checklist
   
   - [ ] Run migration against test DB with production volume
   - [ ] Measure lock duration (must be <10 seconds)
   - [ ] Verify backward compatibility
   - [ ] Test rollback procedure
   ```

**Acceptance Criteria:**
- [ ] Safety checklist created
- [ ] Last 30 migrations audited
- [ ] Unsafe patterns identified and documented
- [ ] Migrations tested with production-sized data
- [ ] Migration linter implemented and in CI
- [ ] Safe patterns documented in CONTRIBUTING.md
- [ ] Database team sign-off
- [ ] No migrations hold locks >10 seconds

**Rollback Plan:**
- If unsafe migration found, create fix migration
- Test fix thoroughly before deployment
- Document in migration notes

---

## Phase 2: Critical (2 Weeks Post-Launch)

**Timeline:** Sprints 1-2 after go-live  
**Gate:** Performance and observability requirements

### Finding #3: Console Logging (Major)

**Owner:** Development Team  
**Effort:** 2-3 days  
**Priority:** P1 - Critical

#### Tasks

1. **Replace console.log with Structured Logging** (Day 1-2)
   
   Files to update (20 instances):
   - ai/realtime/sipSession.ts (7)
   - ai/realtime/toolBridge.ts (2)
   - ai/responses/router.ts (1)
   - ai/tooling/callTool.ts (2)
   - apps/api/src/utils/logging.ts (1)
   - config/featureFlags.ts (1)
   - config/logging.ts (2)
   - config/otel.ts (2)
   - packages/agents/src/observability.ts (1)
   - scripts/mock-voice-data.ts (1)
   
   **Pattern:**
   ```typescript
   // Before:
   console.log("SIP session started", { callId });
   
   // After (Deno Edge Functions):
   import { logStructuredEvent } from "../_shared/observability.ts";
   await logStructuredEvent("SIP_SESSION_STARTED", { callId });
   
   // After (Node.js services):
   import { childLogger } from "@easymo/commons";
   const log = childLogger({ service: "voice-bridge" });
   log.info({ event: "SIP_SESSION_STARTED", callId });
   ```

2. **Update ESLint Rule to Error** (Day 2)
   
   Update `eslint.config.js`:
   ```javascript
   rules: {
     "no-console": ["error", { allow: ["warn", "error"] }]
   }
   ```

3. **Verify Observability** (Day 3)
   - Deploy to staging
   - Trigger events that previously used console.log
   - Verify logs appear in aggregation system
   - Verify correlation IDs present
   - Verify PII masking works
   
   **Success Criteria:**
   - All 20 console.log instances replaced
   - ESLint passes with no warnings
   - Structured logs visible in monitoring
   - No observability gaps

**Acceptance Criteria:**
- [ ] All console.log replaced with structured logging
- [ ] ESLint rule updated to error level
- [ ] PR merged
- [ ] Deployed to production
- [ ] Logs verified in monitoring system

---

### Finding #4: API Module Resolution (Major)

**Owner:** Platform Team  
**Effort:** 1-2 days  
**Priority:** P1 - Critical

#### Tasks

1. **Fix tsconfig Paths** (Day 1)
   
   Update `apps/api/tsconfig.json`:
   ```json
   {
     "extends": "../../tsconfig.base.json",
     "compilerOptions": {
       "paths": {
         "@easymo/commons": ["../../packages/commons/src/index.ts"],
         "@easymo/commons/*": ["../../packages/commons/src/*"],
         "@va/shared": ["../../packages/shared/src/index.ts"],
         "@va/shared/*": ["../../packages/shared/src/*"]
       }
     }
   }
   ```

2. **Update CI Build Order** (Day 1)
   
   Verify `.github/workflows/ci.yml` has:
   ```yaml
   - name: Build shared packages
     run: pnpm --filter @va/shared build && pnpm --filter @easymo/commons build
   
   - name: Type check
     run: pnpm type-check
   ```

3. **Test and Verify** (Day 2)
   ```bash
   pnpm --filter @va/shared build
   pnpm --filter @easymo/commons build
   pnpm --filter apps/api run type-check
   ```
   
   **Success Criteria:**
   - Type checking passes
   - IDE autocomplete works
   - No module resolution errors

**Acceptance Criteria:**
- [ ] Module resolution errors fixed
- [ ] Type checking passes
- [ ] IDE support restored
- [ ] CI pipeline validated
- [ ] Documentation updated

---

## Phase 3: Major (1-2 Months Post-Launch)

**Timeline:** Q1 2026  
**Gate:** Code quality and maintainability improvements

### Finding #1: TypeScript Strictness (Major)

**Owner:** Platform Team  
**Effort:** 3-5 weeks  
**Priority:** P2 - Major

#### Strategy: Incremental File-by-File Approach

1. **Enable Strict Mode Globally** (Week 1)
   
   Update `tsconfig.json`:
   ```json
   {
     "compilerOptions": {
       "strict": true,
       "noImplicitAny": true,
       "strictNullChecks": true,
       "noUncheckedIndexedAccess": true
     }
   }
   ```

2. **Create Baseline** (Week 1)
   ```bash
   pnpm type-check 2>&1 | tee /tmp/strict-errors-baseline.txt
   wc -l /tmp/strict-errors-baseline.txt
   # Estimate: 500-2000 errors
   ```

3. **Prioritize Critical Paths** (Week 1)
   - Authentication flows
   - Payment processing
   - Data mutations
   - API endpoints

4. **Fix Files Incrementally** (Weeks 2-5)
   
   **Week 2:** Core packages (20-30 files)
   - packages/commons/
   - packages/shared/
   
   **Week 3:** Services (30-40 files)
   - services/wallet-service/
   - services/agent-core/
   
   **Week 4:** Apps (40-50 files)
   - apps/api/
   - admin-app/ (critical paths)
   
   **Week 5:** Remaining (50-100 files)
   - src/ (Vite app)
   - Other services

5. **Add CI Gate** (Week 5)
   ```yaml
   - name: Type check strict
     run: pnpm type-check
     # Now fails on strict violations
   ```

**Acceptance Criteria:**
- [ ] Strict mode enabled
- [ ] All type errors fixed
- [ ] CI enforces strict mode
- [ ] Team trained on strict patterns
- [ ] Documentation updated

---

### Finding #8: Ground Rules Compliance (Major)

**Owner:** All Teams  
**Effort:** Medium-Large (varies)  
**Priority:** P2 - Major

#### Tasks by Rule

1. **Structured Logging** - See Finding #3 (covered above)

2. **Correlation IDs** (1 week)
   - Audit all API endpoints
   - Ensure x-request-id propagation
   - Add middleware for automatic ID generation
   - Verify in logs

3. **PII Masking** (2 weeks)
   - Create masking utility:
     ```typescript
     function maskPhone(phone: string): string {
       return phone.replace(/(\d{3})\d{3}(\d{3})/, "$1***$2");
     }
     ```
   - Audit all log statements
   - Apply masking to phone, email, names
   - Add tests for masking

4. **Feature Flag Compliance** (ongoing)
   - Audit new features for flags
   - Add flag check to PR template
   - Document flag lifecycle

**Acceptance Criteria:**
- [ ] All ground rules documented
- [ ] Compliance automation where possible
- [ ] PR checklist includes ground rules
- [ ] Team training completed

---

## Phase 4: Minor (Backlog)

**Timeline:** Continuous improvement  
**Priority:** P3 - Nice to have

### Finding #9: Bundle Size Analysis (Minor)

**Effort:** 2-3 days

1. Install bundle analyzer
2. Set performance budgets
3. Add Lighthouse CI
4. Optimize large bundles

### Finding #10: Enhanced CI Gates (Info)

**Effort:** Small-Medium (varies)

1. Add dependency scanning to CI
2. Integrate CodeQL SAST
3. Add coverage thresholds
4. Container scanning

---

## Success Metrics

### Phase 1 (Blockers)
- [ ] 0 high/critical CVEs remaining
- [ ] 100% migrations pass safety review
- [ ] Staging deployment successful

### Phase 2 (Critical)
- [ ] 0 console.log in production code
- [ ] API type checking passes
- [ ] Structured logs in monitoring

### Phase 3 (Major)
- [ ] TypeScript strict mode enabled
- [ ] <100 type errors remaining
- [ ] Ground rules compliance >90%

### Phase 4 (Minor)
- [ ] Bundle size <500KB
- [ ] Lighthouse score >90
- [ ] CI includes SAST

---

## Risk Assessment

| Phase | Risk | Mitigation |
|-------|------|------------|
| Phase 1 | Dependency updates break tests | Comprehensive testing, staging validation |
| Phase 1 | Migration safety issues found late | Early audit, test with production data |
| Phase 2 | Observability gaps after console.log removal | Verify logs in staging before production |
| Phase 3 | TypeScript strict causes regressions | Incremental approach, thorough testing |

---

## Communication Plan

### Weekly Updates
- Progress report to stakeholders
- Blockers and dependencies
- ETA adjustments

### Phase Completion
- Demo to team
- Documentation updates
- Lessons learned

### Go-Live Decision
- Final checklist review
- Sign-off from all owners
- Deployment window confirmed

---

**Plan Status:** Draft  
**Next Review:** Weekly during Phase 1  
**Maintained By:** Platform Team Lead
