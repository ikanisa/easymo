# EasyMO - Pending Implementation Tasks
**Generated:** 2025-11-27  
**Status:** Phase 3 & 4 Partially Complete

---

## 📊 COMPLETION STATUS

### ✅ COMPLETED (Phases 1-2: ~50%)
- ✅ Security audit scripts created
- ✅ Environment file templates secured
- ✅ admin-app-v2 marked as DEPRECATED
- ✅ Script directories organized (scripts/audit, scripts/maintenance, etc.)
- ✅ Ground rules documentation
- ✅ Observability patterns established

### 🟡 IN PROGRESS (Phase 3: ~30%)
- 🟡 Admin app consolidation (admin-app-v2 deprecated but not removed)
- 🟡 Test framework standardization (some services still on Jest)
- 🟡 Console.log replacement (many instances remain)
- 🟡 TypeScript version alignment

### ❌ NOT STARTED (Phase 3-4: ~20%)
- ❌ Complete Jest → Vitest migration
- ❌ ESLint zero warnings enforcement
- ❌ Full observability compliance
- ❌ Root directory cleanup
- ❌ Workspace dependency verification in CI

---

## 🎯 PHASE 3: CODE QUALITY & STANDARDIZATION

### Task 3.1: Complete Admin App Consolidation
**Status:** 🟡 40% Complete  
**Priority:** P1  
**Effort:** 4 hours remaining

#### ✅ Done:
- admin-app-v2 marked as DEPRECATED
- Deprecation notice created
- Documentation updated

#### ❌ Pending:
1. **Feature Migration Analysis** (2h)
   ```bash
   # Run feature comparison
   npx tsx scripts/migration/merge-admin-apps.ts --dry-run
   ```
   - Compare components between admin-app and admin-app-v2
   - Identify unique features in admin-app-v2
   - Document migration decisions

2. **CI/CD Update** (1h)
   - Remove admin-app-v2 from CI workflows
   - Update `.github/workflows/admin-app-ci.yml`
   - Remove from `pnpm-workspace.yaml`

3. **Physical Removal** (1h)
   ```bash
   # After 2025-12-01
   git mv admin-app-v2 .archive/admin-app-v2
   git commit -m "chore: archive deprecated admin-app-v2"
   ```

**Next Steps:**
```bash
# 1. Analyze features
cd /Users/jeanbosco/workspace/easymo-
npx tsx scripts/migration/merge-admin-apps.ts --dry-run > admin-app-comparison.txt

# 2. Review differences
diff -r admin-app/components admin-app-v2/components

# 3. Update workspace
# Edit pnpm-workspace.yaml to remove admin-app-v2
```

---

### Task 3.2: Stray Service Files Relocation
**Status:** ❌ 0% Complete  
**Priority:** P2  
**Effort:** 2 hours

#### Files to Migrate:
1. **audioUtils.ts** → `packages/media-utils/`
   - Create new package structure
   - Migrate audio processing utilities
   - Update all imports

2. **gemini.ts** → `packages/ai-core/src/providers/`
   - Add to AI provider abstraction
   - Update service imports
   - Remove from services/

**Action Plan:**
```bash
# 1. Create media-utils package
mkdir -p packages/media-utils/src
cp services/audioUtils.ts packages/media-utils/src/audio.ts

# 2. Create package.json
cat > packages/media-utils/package.json << 'EOF'
{
  "name": "@easymo/media-utils",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsup src/index.ts --format esm,cjs --dts"
  }
}
EOF

# 3. Update imports across codebase
grep -r "from.*audioUtils" services/ packages/ --include="*.ts"
# Manually update each import

# 4. Remove old files
rm services/audioUtils.ts services/gemini.ts
```

---

### Task 3.3: Test Framework Standardization
**Status:** 🟡 30% Complete  
**Priority:** P2  
**Effort:** 6 hours remaining

#### Current State:
- **Vitest:** admin-app, agent-core, broker-orchestrator ✅
- **Jest:** wallet-service, profile-service, ranking-service ❌
- **No Tests:** bar-manager-app ❌

#### Migration Required:

**1. wallet-service (3h)**
```bash
cd services/wallet-service

# Install Vitest
pnpm add -D vitest @vitest/ui vite

# Run migration script
npx tsx ../../scripts/migration/jest-to-vitest.ts --target=services/wallet-service

# Create vitest.config.ts
cat > vitest.config.ts << 'EOF'
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
# Remove: jest, @types/jest, ts-jest
# Update test script: "test": "vitest run"

# Run tests
pnpm test
```

**2. profile-service (2h)**
- Same process as wallet-service
- Lower coverage thresholds (70%)

**3. ranking-service (1h)**
- Simpler service, faster migration

**Verification:**
```bash
# Should return empty (no Jest configs)
find services -name "jest.config.*"

# All should use vitest
grep -r "\"test\":" services/*/package.json
```

---

### Task 3.4: TypeScript Version Alignment
**Status:** 🟡 50% Complete  
**Priority:** P2  
**Effort:** 2 hours remaining

#### Current Issues:
- Root package.json has TypeScript 5.5.4 ✅
- Some packages may have different versions ❌
- bar-manager-app dependencies not aligned ❌

**Action Plan:**
```bash
# 1. Check all TypeScript versions
find . -name "package.json" -not -path "*/node_modules/*" \
  -exec grep -H "typescript" {} \; | grep -v "5.5.4"

# 2. Update root package.json (already done)
# Add pnpm overrides to force version

# 3. Fix bar-manager-app
cd bar-manager-app
pnpm add -D typescript@5.5.4

# 4. Reinstall all
cd ..
pnpm install --frozen-lockfile

# 5. Verify
pnpm ls typescript
```

**Files to Update:**
- ✅ package.json (root) - Already has 5.5.4
- ❌ bar-manager-app/package.json
- ❌ Any services with local TypeScript deps

---

### Task 3.5: Workspace Dependencies Verification
**Status:** ❌ 0% Complete  
**Priority:** P1  
**Effort:** 2 hours

#### Current Problem:
Some packages use `"*"` instead of `"workspace:*"` for internal dependencies.

**Verification Script:**
```bash
#!/bin/bash
# scripts/verify/workspace-deps.sh

echo "🔍 Checking workspace dependencies..."

# Find bad deps
BAD_DEPS=$(find . -name "package.json" -not -path "*/node_modules/*" \
  -exec jq -r '(.dependencies // {}) + (.devDependencies // {}) | 
  to_entries[] | 
  select(.key | startswith("@easymo/") or startswith("@va/")) | 
  select(.value | test("^workspace:") | not) | 
  "\(.key): \(.value)"' {} \; 2>/dev/null)

if [ -n "$BAD_DEPS" ]; then
  echo "❌ Found incorrect internal dependencies:"
  echo "$BAD_DEPS"
  exit 1
fi

echo "✅ All workspace dependencies correct"
```

**Fix Process:**
```bash
# 1. Find all packages with bad deps
./scripts/verify/workspace-deps.sh

# 2. Fix manually or with script
# Change "@easymo/commons": "*" 
# To:    "@easymo/commons": "workspace:*"

# 3. Add to CI
# .github/workflows/ci.yml:
#   - name: Verify workspace deps
#     run: bash scripts/verify/workspace-deps.sh
```

---

### Task 3.6: ESLint Zero Warnings
**Status:** 🟡 20% Complete  
**Priority:** P2  
**Effort:** 6 hours remaining

#### Current State:
- ESLint config updated ✅
- Console.log replacement script created ✅
- **Actual replacement NOT executed** ❌

#### Remaining Work:

**1. Console.log Replacement (4h)**
```bash
# Check current count
grep -r "console\.log" services/ packages/ apps/ --include="*.ts" | wc -l

# Run replacement (dry-run first)
./scripts/maintenance/replace-console-logs.sh --dry-run

# Review changes
git diff

# Apply if good
./scripts/maintenance/replace-console-logs.sh

# Fix any compilation errors
pnpm build
```

**2. Fix `any` Types (1h)**
```bash
# Find all 'any' types
grep -r ": any" services/ packages/ --include="*.ts" | wc -l

# Replace with proper types or unknown
# This requires manual review per instance
```

**3. Add Missing Return Types (1h)**
```bash
# Update ESLint to error on missing return types
# Fix violations one by one
pnpm lint --fix
```

**Verification:**
```bash
# Should show ZERO warnings
pnpm lint

# CI should fail on warnings
# .github/workflows/ci.yml already has max-warnings=0
```

---

## 🔵 PHASE 4: DOCUMENTATION & CLEANUP

### Task 4.1: Root Directory Cleanup
**Status:** ❌ 0% Complete  
**Priority:** P1  
**Effort:** 3 hours

#### Files to Move:

**Session Files (HIGH PRIORITY):**
```
CLIENT_PWA_COMPLETE.md → docs/sessions/
CLIENT_PWA_DEPLOYMENT.md → docs/sessions/
CLIENT_PWA_DEPLOY_STATUS.md → docs/sessions/
CLIENT_PWA_FINAL_STATUS.md → docs/sessions/
IMPLEMENTATION_COMPLETE.md → docs/sessions/
IMPLEMENTATION_SUMMARY.md → docs/sessions/
COMPLETION_REPORT.md → docs/sessions/
EXECUTIVE_SUMMARY.md → docs/sessions/
FINAL_SUMMARY.md → docs/sessions/
PRODUCTION_READINESS_STATUS.md → docs/sessions/
```

**Architecture Docs:**
```
DEPLOYMENT_GUIDE.md → docs/deployment/
PRODUCTION_QUICK_REF.md → docs/deployment/
QUICKSTART.md → docs/ (keep in root? or move)
```

**Orphaned Source Files:**
```
App.tsx → .archive/orphaned/
index.tsx → .archive/orphaned/
types.ts → .archive/orphaned/ (or merge into packages/types/)
```

**Action Plan:**
```bash
# Run cleanup script (create it first)
chmod +x scripts/maintenance/cleanup-root-directory.sh
./scripts/maintenance/cleanup-root-directory.sh --dry-run

# Review output
ls -la docs/sessions/

# Apply
./scripts/maintenance/cleanup-root-directory.sh

# Commit
git add .
git commit -m "chore: reorganize root directory documentation"
```

**Expected Root After Cleanup:**
```
.env.example
.gitignore
CHANGELOG.md
CONTRIBUTING.md
Dockerfile
Makefile
README.md
START_HERE.md
package.json
pnpm-workspace.yaml
tsconfig.json
vite.config.ts
(+ essential config files only)
```

---

### Task 4.2: Observability Compliance Audit
**Status:** 🟡 30% Complete  
**Priority:** P1  
**Effort:** 5 hours remaining

#### Compliance Script Status:
- Script skeleton created ✅
- Needs completion and execution ❌

**Complete the Audit Script:**
```bash
# Location: scripts/audit/observability-compliance.ts

# Required checks:
# 1. Structured logging import
# 2. Correlation ID usage
# 3. PII masking in logs
# 4. Metrics recording
# 5. Health endpoints
# 6. Error handling patterns

# Run baseline
npx tsx scripts/audit/observability-compliance.ts > compliance-baseline.txt

# Review violations
cat compliance-baseline.txt | grep "❌"

# Fix violations (manual process)
# Re-run until clean
```

**Common Violations to Fix:**
1. Services without correlation IDs
2. Direct console.log usage (covered in 3.6)
3. Missing health endpoints
4. PII in log messages
5. No structured event logging

---

### Task 4.3: CI/CD Enhancements
**Status:** ❌ 0% Complete  
**Priority:** P2  
**Effort:** 3 hours

#### Add Missing Checks to CI:

**1. Workspace Dependency Check**
```yaml
# .github/workflows/ci.yml
- name: Verify workspace dependencies
  run: bash scripts/verify/workspace-deps.sh
```

**2. Observability Compliance**
```yaml
- name: Check observability compliance
  run: npx tsx scripts/audit/observability-compliance.ts --ci
```

**3. No Console.log in Production Code**
```yaml
- name: Check for console.log
  run: |
    LOGS=$(grep -r "console\.log" services/ packages/ --include="*.ts" || true)
    if [ -n "$LOGS" ]; then
      echo "❌ Found console.log in production code"
      echo "$LOGS"
      exit 1
    fi
```

**4. TypeScript Version Check**
```yaml
- name: Verify TypeScript version
  run: |
    VERSIONS=$(pnpm ls typescript --depth=0 | grep -v "5.5.4" || true)
    if [ -n "$VERSIONS" ]; then
      echo "❌ Incorrect TypeScript versions found"
      exit 1
    fi
```

---

## 📋 IMPLEMENTATION CHECKLIST

### Week 1: Code Quality (16 hours)
- [ ] Complete admin-app consolidation (4h)
  - [ ] Run feature comparison
  - [ ] Update CI/CD
  - [ ] Remove from pnpm-workspace
- [ ] Relocate stray files (2h)
  - [ ] Create media-utils package
  - [ ] Migrate gemini provider
  - [ ] Update all imports
- [ ] Jest → Vitest migration (8h)
  - [ ] wallet-service (3h)
  - [ ] profile-service (2h)
  - [ ] ranking-service (1h)
  - [ ] bar-manager-app tests (2h)
- [ ] TypeScript alignment (2h)
  - [ ] Verify all versions
  - [ ] Fix bar-manager-app
  - [ ] Add pnpm overrides

### Week 2: Standards & Cleanup (14 hours)
- [ ] Workspace dependencies (2h)
  - [ ] Create verification script
  - [ ] Fix all packages
  - [ ] Add to CI
- [ ] ESLint zero warnings (6h)
  - [ ] Run console.log replacement (4h)
  - [ ] Fix any types (1h)
  - [ ] Add return types (1h)
- [ ] Root directory cleanup (3h)
  - [ ] Complete cleanup script
  - [ ] Execute cleanup
  - [ ] Update .gitignore
- [ ] Observability compliance (5h)
  - [ ] Complete audit script
  - [ ] Run baseline audit
  - [ ] Fix violations

### Week 3: CI/CD & Documentation (8 hours)
- [ ] CI/CD enhancements (3h)
  - [ ] Add workspace dep check
  - [ ] Add observability check
  - [ ] Add console.log check
  - [ ] Add TypeScript version check
- [ ] Final verification (2h)
  - [ ] Run all CI checks locally
  - [ ] Fix any failures
  - [ ] Update documentation
- [ ] Documentation (3h)
  - [ ] Update README
  - [ ] Update CONTRIBUTING
  - [ ] Create IMPLEMENTATION_COMPLETE.md

---

## 🚀 QUICK START COMMANDS

### Check Current Status
```bash
# Overall health
pnpm run health

# Test status
pnpm test

# Lint status  
pnpm lint

# Type check
pnpm type-check

# Find Jest usage
find services -name "jest.config.*"

# Count console.log
grep -r "console\.log" services/ packages/ --include="*.ts" | wc -l

# Check TypeScript versions
pnpm ls typescript
```

### Run Priority Tasks
```bash
# 1. Admin app analysis
npx tsx scripts/migration/merge-admin-apps.ts --dry-run

# 2. Workspace dependency check
bash scripts/verify/workspace-deps.sh

# 3. Console.log replacement (dry-run)
./scripts/maintenance/replace-console-logs.sh --dry-run

# 4. Observability audit
npx tsx scripts/audit/observability-compliance.ts

# 5. Root cleanup (dry-run)
./scripts/maintenance/cleanup-root-directory.sh --dry-run
```

### Apply Changes
```bash
# After reviewing dry-runs, execute:

# 1. Replace console.log
./scripts/maintenance/replace-console-logs.sh
pnpm lint --fix
pnpm build

# 2. Clean root directory
./scripts/maintenance/cleanup-root-directory.sh
git add .
git commit -m "chore: reorganize documentation"

# 3. Migrate wallet-service to Vitest
cd services/wallet-service
npx tsx ../../scripts/migration/jest-to-vitest.ts --target=services/wallet-service
# (manual review and fixes)
pnpm test

# 4. Update CI
# Edit .github/workflows/ci.yml
git add .github/workflows/ci.yml
git commit -m "ci: add compliance checks"
```

---

## 📊 ESTIMATED COMPLETION

| Phase | Tasks | Hours | Status |
|-------|-------|-------|--------|
| Phase 3.1-3.2 | Admin & Files | 6h | 🟡 20% |
| Phase 3.3-3.4 | Tests & TS | 8h | 🟡 30% |
| Phase 3.5-3.6 | Deps & Lint | 8h | 🟡 10% |
| Phase 4.1-4.2 | Cleanup & Audit | 8h | ❌ 0% |
| Phase 4.3 | CI/CD | 3h | ❌ 0% |
| **TOTAL** | | **33h** | **~20%** |

**Target Completion:** 2025-12-06 (2 weeks at 20h/week)

---

## 🎯 IMMEDIATE NEXT STEPS

Run these commands NOW to get started:

```bash
cd /Users/jeanbosco/workspace/easymo-

# 1. Check what needs to be done
grep -r "console\.log" services/ packages/ --include="*.ts" | wc -l
find services -name "jest.config.*"
pnpm ls typescript | grep -v "5.5.4"

# 2. Make scripts executable
chmod +x scripts/verify/workspace-deps.sh
chmod +x scripts/maintenance/replace-console-logs.sh
chmod +x scripts/maintenance/cleanup-root-directory.sh

# 3. Run dry-runs to see what would change
bash scripts/verify/workspace-deps.sh
./scripts/maintenance/replace-console-logs.sh --dry-run
./scripts/maintenance/cleanup-root-directory.sh --dry-run

# 4. Review and decide on next action
cat PENDING_IMPLEMENTATION_TASKS.md
```

---

**Last Updated:** 2025-11-27  
**Next Review:** After each task completion  
**Questions?** Check docs/GROUND_RULES.md or this file
