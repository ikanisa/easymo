# Phase 3: Code Quality & Standardization

**Status**: In Progress  
**Duration**: Week 3 (40 hours)  
**Completion**: 60%

## ✅ Completed Tasks

### Task 3.0: Workspace Dependencies Fixed
- [x] TypeScript version aligned to 5.5.4
- [x] pnpm overrides configured
- [x] Workspace protocol (`workspace:*`) enforced

## 🚧 In Progress

### Task 3.1: Admin App Consolidation
**Priority**: P1  
**Effort**: 8 hours  
**Status**: Ready to execute

**Actions**:
1. Feature comparison (admin-app vs admin-app-v2)
2. Merge unique features from v2 to v1
3. Mark admin-app-v2 as deprecated
4. Update pnpm-workspace.yaml
5. Remove from CI

**Files to Create**:
- `scripts/migration/merge-admin-apps.ts`
- `admin-app-v2/DEPRECATED.md`

### Task 3.2: Relocate Stray Service Files
**Priority**: P2  
**Effort**: 2 hours  
**Status**: Ready to execute

**Actions**:
1. Create `@easymo/media-utils` package
2. Migrate `services/audioUtils.ts`
3. Migrate `services/gemini.ts` to `@easymo/ai-core`
4. Update all imports

### Task 3.3: Test Framework Standardization
**Priority**: P2  
**Effort**: 8 hours  
**Status**: 30% complete

**Progress**:
- [x] Shared vitest config created (`vitest.shared.ts`)
- [x] Admin-app using Vitest
- [ ] Migrate wallet-service from Jest to Vitest
- [ ] Migrate profile service from Jest to Vitest
- [ ] Add tests to bar-manager-app

**Files to Create**:
- `scripts/migration/jest-to-vitest.ts`
- `services/wallet-service/vitest.config.ts`
- `services/profile/vitest.config.ts`

### Task 3.4: ESLint Zero Warnings
**Priority**: P2  
**Effort**: 8 hours  
**Status**: 20% complete

**Actions**:
1. Update ESLint config to error on warnings
2. Replace all `console.log` with structured logging
3. Fix `@typescript-eslint/no-explicit-any` violations
4. Add pre-commit hook

**Files to Create**:
- `scripts/codemod/replace-console.ts`
- `packages/commons/src/logger/console-wrapper.ts`
- `eslint.config.strict.mjs`

## 📋 Remaining Tasks

### Task 3.5: Observability Compliance
**Priority**: P1  
**Effort**: 8 hours

**Actions**:
1. Create compliance checker script
2. Audit all services for:
   - Structured logging with correlation IDs
   - PII masking in logs
   - Metrics recording
   - Health endpoints
3. Fix non-compliant services

**Files to Create**:
- `scripts/audit/observability-compliance.ts`
- `docs/OBSERVABILITY_AUDIT_REPORT.md`

### Task 3.6: Performance Optimization
**Priority**: P2  
**Effort**: 10 hours

**Actions**:
1. Bundle size optimization
2. Database query optimization
3. Redis caching implementation
4. API response time improvements

## Next Steps

### Immediate (Next 2 hours)
1. Run observability baseline check
2. Create admin app migration script
3. Execute console.log replacement (dry-run first)

### Short-term (Next 8 hours)
1. Complete Jest → Vitest migrations
2. Achieve ESLint zero warnings
3. Run full compliance audit

### Medium-term (Next 20 hours)
1. Performance optimization
2. Security hardening
3. Additional testing
4. Production readiness checklist

## Commands

```bash
# Check current state
pnpm lint 2>&1 | tee lint-warnings.txt
pnpm type-check

# Run migrations
npx tsx scripts/migration/merge-admin-apps.ts --dry-run
npx tsx scripts/migration/jest-to-vitest.ts --target=services/wallet-service --dry-run

# Compliance check
npx tsx scripts/audit/observability-compliance.ts > compliance-baseline.txt

# Console.log replacement
npx tsx scripts/codemod/replace-console.ts --dry-run

# Test everything
pnpm build:deps
pnpm lint
pnpm type-check
pnpm test
```

## Success Criteria

- [ ] Only 1 admin app (admin-app-v2 deprecated)
- [ ] All services using Vitest (no Jest)
- [ ] Zero ESLint warnings
- [ ] 70%+ test coverage
- [ ] All services observability-compliant
- [ ] TypeScript 5.5.4 everywhere
- [ ] All workspace deps use `workspace:*`

## Blocked/Risks

- **None currently** - All dependencies resolved

## Notes

- compliance-baseline.txt already exists (baseline captured)
- vitest.shared.ts already created
- TypeScript 5.5.4 alignment complete
