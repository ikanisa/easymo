# Phase 3: Next Actions

**Date**: 2025-11-27  
**Status**: 60% Complete

## ✅ Already Completed

1. **Baseline Compliance Check** - Done! (compliance-baseline.txt exists)
2. **TypeScript Version Alignment** - All packages using 5.5.4
3. **Workspace Dependencies** - Using `workspace:*` protocol
4. **Shared Vitest Config** - Created (vitest.shared.ts)

## 🚀 Ready to Execute (Priority Order)

### 1. Console.log Replacement (HIGH PRIORITY - 2 hours)

**Current State**: 209 files checked, multiple violations found

**Action**:
```bash
# Dry run first to see what would change
./scripts/maintenance/replace-console-logs.sh --dry-run

# Apply changes
./scripts/maintenance/replace-console-logs.sh

# Verify
pnpm lint
git diff
```

**Files Most Affected** (from compliance-baseline.txt):
- `supabase/functions/wa-webhook-*/*.ts` - Multiple functions
- `supabase/functions/video-performance-summary/index.ts`
- `supabase/functions/vehicle-ocr/index.ts`

**Manual Review Needed**:
- Complex console.log statements with multiple arguments
- Console.log inside error handlers
- Debug console.log that should be log.debug()

---

### 2. Admin App Consolidation (MEDIUM PRIORITY - 4 hours)

**Decision**: Keep `admin-app`, deprecate `admin-app-v2`

**Rationale**:
- admin-app has: Tauri desktop, Sentry, shared packages, React Query persistence
- admin-app-v2 has: Fewer features, no unique critical functionality

**Actions**:
```bash
# 1. Feature comparison
ls -la admin-app/ > admin-app-features.txt
ls -la admin-app-v2/ > admin-app-v2-features.txt
diff admin-app-features.txt admin-app-v2-features.txt

# 2. Check for unique components in v2
find admin-app-v2/components -name "*.tsx" > v2-components.txt
find admin-app/components -name "*.tsx" > v1-components.txt
comm -23 <(sort v2-components.txt) <(sort v1-components.txt)

# 3. Mark as deprecated
echo "# ⚠️ DEPRECATED - Use admin-app instead" > admin-app-v2/DEPRECATED.md

# 4. Update pnpm-workspace.yaml
# Remove: - admin-app-v2

# 5. Update CI (.github/workflows/admin-app-ci.yml)
# Remove admin-app-v2 jobs
```

**Migration Checklist**:
- [ ] Compare package.json dependencies
- [ ] Check for unique components/utilities
- [ ] Verify all features exist in admin-app
- [ ] Create DEPRECATED.md in admin-app-v2
- [ ] Update pnpm-workspace.yaml
- [ ] Update CI/CD workflows
- [ ] Test admin-app build still works

---

### 3. Jest → Vitest Migration (MEDIUM PRIORITY - 6 hours)

**Services Still Using Jest**:
- `services/wallet-service`
- `services/profile`
- Possibly others in services/ directory

**Migration Script**: Already created at `scripts/migration/jest-to-vitest.ts`

**Actions**:
```bash
# 1. Check which services use Jest
find services/ -name "jest.config.*" -o -name "*.spec.ts" -o -name "*.test.ts" | \
  grep -v node_modules | \
  xargs grep -l "from 'jest'" 2>/dev/null || echo "None found"

# 2. Run migration (dry-run first)
npx tsx scripts/migration/jest-to-vitest.ts --target=services/wallet-service --dry-run

# 3. Apply migration
npx tsx scripts/migration/jest-to-vitest.ts --target=services/wallet-service

# 4. Create vitest.config.ts
cat > services/wallet-service/vitest.config.ts <<'EOF'
import { defineConfig, mergeConfig } from 'vitest/config';
import { nodeConfig } from '../../vitest.shared';

export default mergeConfig(nodeConfig, defineConfig({
  test: {
    root: __dirname,
    coverage: {
      thresholds: {
        global: {
          statements: 90,
          branches: 85,
          functions: 90,
          lines: 90,
        },
      },
    },
    testTimeout: 30000,
  },
}));
EOF

# 5. Update package.json
# Change: "test": "jest" → "test": "vitest run"

# 6. Remove jest dependencies
# Remove: jest, @types/jest, ts-jest from devDependencies

# 7. Test the migration
cd services/wallet-service
pnpm test

# 8. Repeat for other services
```

---

### 4. ESLint Zero Warnings (HIGH PRIORITY - 4 hours)

**Current State**: Some warnings accepted (see package.json lint scripts)

**Actions**:
```bash
# 1. Get baseline
pnpm lint 2>&1 | tee lint-warnings-baseline.txt

# 2. Update eslint.config.mjs to error on warnings
# Add: "no-console": ["error", { allow: ["warn", "error"] }]

# 3. Run auto-fix
pnpm lint:fix

# 4. Check remaining issues
pnpm lint

# 5. Manual fixes for:
#    - @typescript-eslint/no-explicit-any
#    - @typescript-eslint/no-unused-vars
#    - Missing return types

# 6. Add pre-commit hook
cat > .husky/pre-commit <<'EOF'
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

pnpm lint --max-warnings=0
EOF

chmod +x .husky/pre-commit
```

**Common Violations to Fix**:
1. `console.log` → Use structured logging (already covered above)
2. `any` types → Add proper types
3. Unused variables → Remove or prefix with `_`
4. Missing function return types → Add explicit types

---

### 5. Observability Compliance Fixes (HIGH PRIORITY - 6 hours)

**Based on compliance-baseline.txt findings**:

**Files Needing Fixes**:
1. **Edge Functions** (Most Critical):
   - `supabase/functions/wa-webhook-property/index.ts`
   - `supabase/functions/wa-webhook-profile/index.ts`
   - `supabase/functions/wa-webhook-mobility/index.ts`
   - `supabase/functions/wa-webhook-jobs/index.ts`
   - `supabase/functions/wa-webhook-insurance/index.ts`

2. **Services** (if any violations found)

**Fix Template for Edge Functions**:
```typescript
// ADD at top of file:
import { logStructuredEvent } from '../_shared/observability.ts';

// REPLACE console.log with:
await logStructuredEvent('EVENT_NAME', {
  correlationId: req.headers.get('x-correlation-id') || crypto.randomUUID(),
  ...eventData
});

// ADD correlation ID extraction:
const correlationId = req.headers.get('x-correlation-id') || crypto.randomUUID();

// PASS correlation ID to downstream calls:
await fetch(url, {
  headers: {
    'x-correlation-id': correlationId,
    ...otherHeaders
  }
});
```

**Actions**:
```bash
# 1. Fix one file as template
# Edit: supabase/functions/wa-webhook-property/index.ts
# Apply template above

# 2. Test the fix
deno test --allow-env --allow-read --allow-net supabase/functions/wa-webhook-property

# 3. Apply to remaining files
# Use find/replace or manual fixes

# 4. Re-run compliance check
npx tsx scripts/audit/observability-compliance.ts > compliance-after-fixes.txt

# 5. Compare before/after
diff compliance-baseline.txt compliance-after-fixes.txt
```

---

## 📊 Success Metrics

After completing above tasks:

- [ ] **Zero console.log** in production code (except test files)
- [ ] **Zero ESLint warnings** (`pnpm lint` passes with no warnings)
- [ ] **90%+ observability compliance** (from compliance checker)
- [ ] **Single admin app** (admin-app-v2 deprecated)
- [ ] **All services on Vitest** (no Jest dependencies)
- [ ] **70%+ test coverage** maintained

---

## ⏱️ Time Estimates

| Task | Estimated | Priority |
|------|-----------|----------|
| Console.log replacement | 2h | HIGH |
| Observability fixes | 6h | HIGH |
| ESLint zero warnings | 4h | HIGH |
| Admin app consolidation | 4h | MEDIUM |
| Jest → Vitest migration | 6h | MEDIUM |
| **TOTAL** | **22h** | |

---

## 🎯 Next Session Goals

**Immediate (Next 2 hours)**:
1. Run console.log replacement script
2. Fix top 10 observability violations
3. Verify with linter

**Short-term (Next 8 hours)**:
1. Complete observability fixes
2. Achieve ESLint zero warnings
3. Deprecate admin-app-v2

**Medium-term (Remaining 12 hours)**:
1. Complete Jest → Vitest migrations
2. Phase 4 prep (documentation cleanup)
3. Final verification

---

## 📝 Commands Quick Reference

```bash
# Compliance check
npx tsx scripts/audit/observability-compliance.ts

# Console.log replacement
./scripts/maintenance/replace-console-logs.sh --dry-run
./scripts/maintenance/replace-console-logs.sh

# Linting
pnpm lint
pnpm lint:fix

# Testing
pnpm test
pnpm --filter @easymo/admin-app test

# Build verification
pnpm build:deps
pnpm build

# Git status
git status
git diff --stat
```

---

## 🚧 Blockers / Risks

**None identified** - All tasks are independent and can be executed in parallel or sequentially.

**Notes**:
- Backup before running console.log replacement: `git add . && git commit -m "Checkpoint before console.log replacement"`
- Test after each major change
- Review diffs carefully before committing
