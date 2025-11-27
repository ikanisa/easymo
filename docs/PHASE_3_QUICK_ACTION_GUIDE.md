# Phase 3 Quick Action Guide
**Code Quality & Standardization - Week 3**

## 🎯 Today's Tasks (2025-11-27)

### 1. Workspace Dependencies Fix (2 hours) - PRIORITY 1

```bash
# Check current state
bash scripts/verify/workspace-deps.sh

# Fix admin-app
cd admin-app
# Update package.json to use workspace:* for all @easymo/ and @va/ deps

# Fix bar-manager-app  
cd ../bar-manager-app
# Update package.json to use workspace:* for all internal deps

# Fix other services
# Use find-replace: "*" → "workspace:*" for internal packages only

# Verify
pnpm install --frozen-lockfile
bash scripts/verify/workspace-deps.sh
```

### 2. Console.log Replacement (4 hours) - PRIORITY 2

```bash
# Dry run first
npx tsx scripts/codemod/replace-console.ts --dry-run

# Apply to services (one at a time)
npx tsx scripts/codemod/replace-console.ts --target=services/wallet-service
npx tsx scripts/codemod/replace-console.ts --target=services/profile

# Apply to edge functions
# Manual replacement needed for Deno functions
# Use pattern: console.log() → await logStructuredEvent()

# Test
pnpm lint
pnpm test
```

### 3. Jest to Vitest Migration (2 hours) - PRIORITY 3

```bash
# Migrate wallet-service
npx tsx scripts/migration/jest-to-vitest.ts --target=services/wallet-service --dry-run
npx tsx scripts/migration/jest-to-vitest.ts --target=services/wallet-service

# Create vitest.config.ts
cat > services/wallet-service/vitest.config.ts << 'EOF'
import { defineConfig, mergeConfig } from 'vitest/config';
import { nodeConfig } from '../../vitest.shared';

export default mergeConfig(nodeConfig, defineConfig({
  test: {
    coverage: {
      thresholds: {
        global: { statements: 90, branches: 85, functions: 90, lines: 90 }
      }
    }
  }
}));
EOF

# Update package.json
cd services/wallet-service
# Change "test": "jest" → "test": "vitest run"
# Remove jest dependencies, add vitest

# Test
pnpm test
```

## 📋 Checklists

### Workspace Dependencies Checklist
- [ ] Run `scripts/verify/workspace-deps.sh` (baseline)
- [ ] Update admin-app/package.json
- [ ] Update bar-manager-app/package.json
- [ ] Update services/*/package.json files
- [ ] Update packages/*/package.json files
- [ ] Run `pnpm install --frozen-lockfile`
- [ ] Verify: `scripts/verify/workspace-deps.sh` (should pass)
- [ ] Build: `pnpm build`
- [ ] Commit changes

### Console.log Replacement Checklist
- [ ] Run compliance check: `npx tsx scripts/audit/observability-compliance.ts`
- [ ] Create branch: `git checkout -b refactor/structured-logging`
- [ ] Services: Run codemod on each service
- [ ] Edge Functions: Manual replacement (Deno)
- [ ] Admin Apps: Replace with appropriate logger
- [ ] Test: `pnpm lint` (no console.log errors)
- [ ] Test: `pnpm test` (all passing)
- [ ] Verify: Re-run compliance check (100% target)
- [ ] Commit and push

### Test Migration Checklist
- [ ] wallet-service: Jest → Vitest
- [ ] profile service: Jest → Vitest
- [ ] bar-manager-app: Add Vitest
- [ ] Create vitest.config.ts for each
- [ ] Update package.json scripts
- [ ] Remove Jest dependencies
- [ ] Run tests: `pnpm --filter <pkg> test`
- [ ] Update CI workflows
- [ ] Commit changes

## 🚀 Quick Commands

```bash
# Full quality check
pnpm lint && pnpm type-check && pnpm test

# Observability compliance
npx tsx scripts/audit/observability-compliance.ts > compliance-after-cleanup.txt
diff compliance-baseline.txt compliance-after-cleanup.txt

# Security audit
bash scripts/security/audit-env-files.sh

# Workspace verification
bash scripts/verify/workspace-deps.sh

# Build all packages
pnpm --filter @va/shared build && \
pnpm --filter @easymo/commons build && \
pnpm build

# Test specific service
pnpm --filter @easymo/wallet-service test

# Clean and rebuild
rm -rf node_modules
pnpm install --frozen-lockfile
pnpm build
```

## 📊 Progress Tracking

### Completed ✅
- [x] Admin app consolidation (admin-app-v2 deprecated)
- [x] Migration scripts created
- [x] Audit scripts created
- [x] Shared vitest config created

### In Progress 🔄
- [ ] Workspace dependencies (0/20 packages)
- [ ] Console.log replacement (0/50 files)
- [ ] Jest to Vitest migration (0/3 services)

### Pending ⏳
- [ ] TypeScript version alignment
- [ ] ESLint zero warnings
- [ ] Root directory cleanup

## 🎯 Success Criteria

### Must Have
- ✅ All workspace deps use `workspace:*` protocol
- ✅ Zero ESLint warnings in CI
- ✅ All services use Vitest (except Edge Functions = Deno Test)
- ✅ TypeScript 5.5.4 everywhere
- ✅ No console.log in production code

### Should Have
- 90%+ observability compliance
- All tests passing
- Build time < 10 minutes
- Documentation updated

### Nice to Have
- Pre-commit hooks enforcing standards
- Automated compliance checks in CI
- Coverage > 70%

## 🔗 Quick Links

- [Phase 3 Status](/docs/PHASE_3_IMPLEMENTATION_STATUS.md)
- [Ground Rules](/docs/GROUND_RULES.md)
- [Next Steps](/docs/NEXT_STEPS.md)
- [Compliance Baseline](/compliance-baseline.txt)

## ⚠️ Common Issues

### Issue: pnpm install fails
**Solution:** Build shared packages first
```bash
pnpm --filter @va/shared build && pnpm --filter @easymo/commons build
```

### Issue: Vitest import errors
**Solution:** Check vitest.config.ts paths match tsconfig.json

### Issue: Console.log codemod breaks code
**Solution:** Run with --dry-run first, review changes, apply manually if needed

### Issue: Workspace protocol not recognized
**Solution:** Update pnpm to ≥10.18.3
```bash
npm install -g pnpm@10.18.3
```

---

**Remember:** Test after each change, commit frequently, and check CI status!
