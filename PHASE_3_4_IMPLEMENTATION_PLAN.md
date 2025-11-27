# EasyMO Phase 3 & 4 Implementation Plan
## Complete Refactoring & Cleanup Roadmap

**Status**: IN PROGRESS  
**Last Updated**: 2025-11-27  
**Total Estimated Time**: 33 hours  
**Priority Order**: P0 → P1 → P2  

---

## 🚨 CRITICAL PATH (P0) - MUST DO FIRST (4 hours)

### Task 1: TypeScript Version Alignment [2h]
**Why First**: Blocking all TypeScript compilation and IDE issues

**Actions**:
```bash
# 1. Audit current state
find . -name "package.json" -not -path "*/node_modules/*" -exec grep -H "typescript" {} \;

# 2. Update root package.json
# Add to package.json:
{
  "devDependencies": {
    "typescript": "5.5.4"
  },
  "pnpm": {
    "overrides": {
      "typescript": "5.5.4"
    }
  }
}

# 3. Fix all packages
pnpm install
pnpm --filter @easymo/bar-manager-app install

# 4. Verify
pnpm exec tsc --version  # Should show 5.5.4 everywhere
```

**Verification**:
- [ ] All package.json files use TypeScript 5.5.4
- [ ] No version conflicts in pnpm-lock.yaml
- [ ] `pnpm exec tsc --version` returns 5.5.4
- [ ] All apps build successfully

**Files to Update**:
- `package.json` (root)
- `bar-manager-app/package.json`
- `admin-app/package.json`
- Any service with TS version mismatches

---

### Task 2: Workspace Dependencies Fix [2h]
**Why Second**: Blocking proper monorepo builds

**Actions**:
```bash
# 1. Create verification script
# Already provided in plan: scripts/verify/workspace-deps.sh

# 2. Run audit
chmod +x scripts/verify/workspace-deps.sh
./scripts/verify/workspace-deps.sh

# 3. Fix violations (example)
# In admin-app/package.json:
# Change: "@easymo/commons": "*"
# To:     "@easymo/commons": "workspace:*"

# 4. Update all packages
pnpm install

# 5. Verify
./scripts/verify/workspace-deps.sh
```

**Verification**:
- [ ] Script runs without errors
- [ ] All `@easymo/*` and `@va/*` deps use `workspace:*`
- [ ] Added to CI: `.github/workflows/validate.yml`

**Files to Check**:
- `admin-app/package.json`
- `bar-manager-app/package.json`
- `waiter-pwa/package.json`
- All services in `services/*/package.json`

---

## 🔴 HIGH PRIORITY (P1) - Week 1 (12 hours)

### Task 3: Admin App Consolidation [4h]

**Phase 1: Analysis (1h)**
```bash
# Compare features
diff -r admin-app admin-app-v2 > admin-apps-diff.txt

# Key files to review:
- admin-app/components/ vs admin-app-v2/components/
- admin-app/lib/ vs admin-app-v2/lib/
- admin-app/app/ vs admin-app-v2/app/
```

**Phase 2: Migration (2h)**
```bash
# Run migration script (provided in plan)
chmod +x scripts/migration/merge-admin-apps.ts
npx tsx scripts/migration/merge-admin-apps.ts --dry-run
npx tsx scripts/migration/merge-admin-apps.ts

# Manually merge unique features identified in diff
```

**Phase 3: Deprecation (1h)**
```bash
# 1. Add DEPRECATED.md to admin-app-v2
# 2. Update pnpm-workspace.yaml (remove admin-app-v2)
# 3. Update CI workflows to exclude admin-app-v2
# 4. Test admin-app builds and runs
cd admin-app
npm ci
npm run build
npm test -- --run
```

**Deliverables**:
- [ ] `admin-apps-comparison.md` - Feature matrix
- [ ] `admin-app-v2/DEPRECATED.md` created
- [ ] Unique features migrated to admin-app
- [ ] `pnpm-workspace.yaml` updated
- [ ] CI workflows updated
- [ ] admin-app builds and tests pass

---

### Task 4: Root Directory Cleanup [3h]

**Execution**:
```bash
# 1. Make cleanup script executable
chmod +x scripts/maintenance/cleanup-root-directory.sh

# 2. Dry run first
./scripts/maintenance/cleanup-root-directory.sh --dry-run > cleanup-plan.txt

# 3. Review the plan
cat cleanup-plan.txt

# 4. Execute cleanup
./scripts/maintenance/cleanup-root-directory.sh

# 5. Verify root is clean
ls -la | grep -E '\.(md|txt|sh)$' | wc -l  # Should be minimal
```

**Expected Moves**:
- `*_COMPLETE*.md` → `docs/sessions/`
- `*_STATUS*.md` → `docs/sessions/`
- `*_VISUAL*.txt` → `docs/architecture/diagrams/`
- `deploy-*.sh` → `scripts/deploy/`
- `verify-*.sh` → `scripts/verify/`
- `App.tsx`, `index.tsx` → `.archive/orphaned/`

**Verification**:
- [ ] Root contains only essential config files
- [ ] All session notes in `docs/sessions/`
- [ ] All scripts in `scripts/` subdirectories
- [ ] Index generated: `docs/archive/INDEX.md`
- [ ] Git status shows moves (not deletions)

---

### Task 5: Observability Compliance Audit [5h]

**Phase 1: Create Checker (2h)**
```bash
# Use provided script: scripts/audit/observability-compliance.ts
chmod +x scripts/audit/observability-compliance.ts

# Run baseline audit
npx tsx scripts/audit/observability-compliance.ts > compliance-baseline.txt
```

**Phase 2: Fix Violations (3h)**

Priority order:
1. **Edge Functions** (1h) - Add correlation IDs, structured logging
2. **Services** (1.5h) - Ensure childLogger usage, fix PII masking
3. **PWAs** (0.5h) - Client-side logging if applicable

**Example Fixes**:
```typescript
// BEFORE (supabase/functions/wa-webhook/index.ts)
console.log('Webhook received', req);

// AFTER
import { logStructuredEvent } from '../_shared/observability.ts';
const correlationId = req.headers.get('x-correlation-id') || crypto.randomUUID();
await logStructuredEvent('WEBHOOK_RECEIVED', { 
  correlationId,
  method: req.method 
});
```

**Verification**:
- [ ] Compliance score > 80%
- [ ] All critical services have correlation IDs
- [ ] No PII in logs (check with `grep -r 'phone\|email\|password'`)
- [ ] Health endpoints in all services

---

## 🟡 MEDIUM PRIORITY (P2) - Week 2 (17 hours)

### Task 6: Stray Files Relocation [2h]

**Actions**:
```bash
# 1. Create packages/media-utils
mkdir -p packages/media-utils/src
# Add files from plan (audio.ts, package.json)

# 2. Migrate audioUtils.ts
# Move services/audioUtils.ts → packages/media-utils/src/audio.ts

# 3. Update imports across codebase
grep -r "audioUtils" --include="*.ts" --include="*.tsx" .

# 4. Create packages/ai-core (if not exists)
mkdir -p packages/ai-core/src/providers

# 5. Migrate gemini.ts
# Move services/gemini.ts → packages/ai-core/src/providers/gemini.ts

# 6. Remove stray files
chmod +x scripts/maintenance/remove-stray-service-files.sh
./scripts/maintenance/remove-stray-service-files.sh

# 7. Build new packages
pnpm --filter @easymo/media-utils build
pnpm --filter @easymo/ai-core build
```

**Verification**:
- [ ] `packages/media-utils` created and builds
- [ ] `packages/ai-core` updated with Gemini provider
- [ ] All imports updated
- [ ] Stray files archived and removed
- [ ] Tests pass

---

### Task 7: Jest → Vitest Migration [8h]

**Services to Migrate**:
1. `wallet-service` (3h) - Complex, financial critical
2. `profile-service` (2h)
3. `ranking-service` (1h)
4. `bar-manager-app` - Add tests (2h)

**Process per Service**:
```bash
# Example: wallet-service
cd services/wallet-service

# 1. Run migration script
npx tsx ../../scripts/migration/jest-to-vitest.ts --target=services/wallet-service --dry-run
npx tsx ../../scripts/migration/jest-to-vitest.ts --target=services/wallet-service

# 2. Create vitest.config.ts (use template from plan)
# 3. Update package.json
# Change:
"scripts": {
  "test": "jest"
}
# To:
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest"
}

# 4. Remove Jest
rm jest.config.js
npm uninstall jest @types/jest ts-jest

# 5. Install Vitest
pnpm add -D vitest @vitest/ui

# 6. Run tests
pnpm test

# 7. Fix any failures
# Common issues:
# - Mock syntax differences
# - Timer handling
# - Module resolution
```

**Verification per Service**:
- [ ] All tests converted and passing
- [ ] Coverage maintained or improved
- [ ] `vitest.config.ts` created
- [ ] CI updated to use Vitest
- [ ] Jest removed from dependencies

---

### Task 8: ESLint Zero Warnings [6h]

**Sub-task 8.1: Replace console.log (3h)**

```bash
# 1. Install ts-morph for codemod
pnpm add -D ts-morph

# 2. Run console replacement (dry-run)
npx tsx scripts/codemod/replace-console.ts --dry-run

# 3. Review changes
git diff

# 4. Apply changes
npx tsx scripts/codemod/replace-console.ts

# 5. Manual fixes for complex cases
# Review each file, ensure semantic event names
```

**Sub-task 8.2: Fix TypeScript any (2h)**

```bash
# 1. Find all 'any' usages
pnpm exec tsc --noEmit 2>&1 | grep "implicit 'any'"

# 2. Fix with proper types
# Example fixes:
# BEFORE: const data: any = await fetch(...)
# AFTER:  const data: ApiResponse = await fetch(...)

# 3. Add return types
# BEFORE: async function processPayment(...)
# AFTER:  async function processPayment(...): Promise<PaymentResult>
```

**Sub-task 8.3: Update ESLint Config (1h)**

```bash
# 1. Update eslint.config.mjs (provided in plan)
# 2. Run lint
pnpm lint

# 3. Fix remaining issues
pnpm lint --fix

# 4. Verify zero warnings
pnpm lint 2>&1 | grep -i warning | wc -l  # Should be 0
```

**Verification**:
- [ ] `pnpm lint` shows 0 warnings, 0 errors
- [ ] All `console.log` replaced with structured logging
- [ ] No `any` types (except where explicitly allowed)
- [ ] All functions have return types
- [ ] Pre-commit hook enforces lint

---

## 🔵 LOW PRIORITY (P3) - Week 3 (Optional Enhancements)

### Task 9: CI/CD Enhancements [3h]

**Add to `.github/workflows/ci.yml`**:
```yaml
# After install step
- name: Verify Workspace Dependencies
  run: ./scripts/verify/workspace-deps.sh

- name: Check Observability Compliance
  run: |
    npx tsx scripts/audit/observability-compliance.ts
    # Fail if compliance < 80%

- name: Verify No Console.log
  run: |
    if grep -r "console\.log" --include="*.ts" --include="*.tsx" src/ services/ packages/; then
      echo "❌ Found console.log statements. Use structured logging."
      exit 1
    fi
```

**Verification**:
- [ ] Workspace check runs in CI
- [ ] Observability check runs in CI
- [ ] Console.log check runs in CI
- [ ] CI passes on main branch

---

### Task 10: Security Audit [2h]

```bash
# 1. Run env audit
chmod +x scripts/security/audit-env-files.sh
./scripts/security/audit-env-files.sh

# 2. Check for secrets in code
pnpm exec secretlint "**/*"

# 3. Dependency audit
pnpm audit --audit-level=moderate

# 4. Fix critical/high vulnerabilities
pnpm audit --fix
```

---

## 📊 Progress Tracking

### Completion Checklist

**Phase 3: Code Quality (22h)**
- [ ] TypeScript 5.5.4 aligned (2h) - P0
- [ ] Workspace deps fixed (2h) - P0
- [ ] Admin apps consolidated (4h) - P1
- [ ] Stray files relocated (2h) - P2
- [ ] Jest → Vitest migration (8h) - P2
- [ ] ESLint zero warnings (6h) - P2

**Phase 4: Cleanup (11h)**
- [ ] Root directory cleaned (3h) - P1
- [ ] Observability compliance (5h) - P1
- [ ] CI/CD enhanced (3h) - P3

---

## 🚀 Quick Start (Day 1)

```bash
# 1. TypeScript alignment (30 minutes)
# Edit package.json, run pnpm install, verify

# 2. Workspace deps (30 minutes)
./scripts/verify/workspace-deps.sh
# Fix violations, re-run

# 3. Run baseline audits (30 minutes)
npx tsx scripts/audit/observability-compliance.ts > compliance-baseline.txt
pnpm lint 2>&1 > lint-baseline.txt

# 4. Start admin-app analysis (1 hour)
diff -r admin-app admin-app-v2 > admin-apps-diff.txt
# Review and plan migration
```

**End of Day 1 Goal**: P0 tasks complete, baseline metrics captured

---

## 📈 Success Metrics

**Code Quality**:
- ✅ TypeScript: Single version (5.5.4) across all packages
- ✅ Dependencies: 100% workspace protocol compliance
- ✅ Tests: 100% Vitest (0% Jest)
- ✅ Lint: 0 warnings, 0 errors

**Observability**:
- ✅ Compliance score > 80%
- ✅ Correlation IDs in all services
- ✅ Structured logging (0 console.log)

**Repository Health**:
- ✅ Root directory: < 10 files (only configs)
- ✅ Documentation: Organized in docs/
- ✅ Scripts: Organized in scripts/

---

## 🆘 Troubleshooting

### TypeScript Version Issues
```bash
# Clear cache
rm -rf node_modules/.cache
pnpm store prune

# Reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install --frozen-lockfile
```

### Workspace Dependency Errors
```bash
# Rebuild shared packages
pnpm --filter @va/shared build
pnpm --filter @easymo/commons build
pnpm build
```

### Vitest Migration Failures
```bash
# Common fixes:
# 1. Update imports: import { vi } from 'vitest'
# 2. Fix mocks: vi.fn() instead of jest.fn()
# 3. Update timers: vi.useFakeTimers()
```

---

## 📞 Support

**Questions?**
- Check: `docs/GROUND_RULES.md`
- Check: `.github/copilot-instructions.md`
- Review: `QUICKSTART.md`

**Next Steps After Completion**:
1. Run full test suite: `pnpm test`
2. Run full build: `pnpm build`
3. Deploy to staging
4. Production readiness review
