# EasyMO Phase 3 & 4 Implementation Tracker
## Code Quality & Documentation Cleanup

**Document Version:** 3.0 (Actionable Edition)  
**Created:** 2025-11-27  
**Status:** 🚧 IN PROGRESS  
**Estimated Total Time:** 33 hours (4 days)

---

## 📊 PROGRESS OVERVIEW

| Phase | Tasks | Completed | In Progress | Pending | Progress |
|-------|-------|-----------|-------------|---------|----------|
| **Phase 3: Code Quality** | 6 | 0 | 0 | 6 | 0% |
| **Phase 4: Documentation** | 3 | 0 | 0 | 3 | 0% |
| **TOTAL** | **9** | **0** | **0** | **9** | **0%** |

---

## 🎯 PHASE 3: CODE QUALITY (22 hours)

### Priority 0 - BLOCKING (4 hours) ⚠️ DO FIRST

#### Task 3.1: TypeScript Version Alignment [2h]
**Status:** ❌ Not Started  
**Priority:** P0 - CRITICAL  
**Blocking:** All other tasks  
**Owner:** Build Engineer

**Current State:**
- Root package.json: TypeScript version varies
- Some packages use different versions
- bar-manager-app has dependency issues

**Acceptance Criteria:**
- [ ] All packages use TypeScript 5.5.4
- [ ] pnpm overrides configured in root package.json
- [ ] bar-manager-app dependencies aligned
- [ ] CI check enforces version consistency

**Implementation Steps:**
```bash
# Step 1: Audit current versions (5min)
find . -name "package.json" -not -path "*/node_modules/*" -exec grep -H '"typescript"' {} \;

# Step 2: Update root package.json (10min)
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

# Step 3: Fix bar-manager-app (30min)
cd bar-manager-app
# Update package.json with workspace:* deps
pnpm install

# Step 4: Clean install (15min)
cd ..
rm -rf node_modules pnpm-lock.yaml
pnpm install --frozen-lockfile

# Step 5: Verify (10min)
pnpm exec tsc --version
pnpm --filter @easymo/bar-manager-app exec tsc --version
pnpm type-check

# Step 6: Add CI check (15min)
# Create .github/workflows/typescript-version-check.yml
```

**Files to Modify:**
- `package.json` (root)
- `bar-manager-app/package.json`
- `.github/workflows/typescript-version-check.yml` (create)

**Verification:**
```bash
pnpm type-check && echo "✅ TypeScript aligned"
```

---

#### Task 3.2: Workspace Dependencies [2h]
**Status:** ❌ Not Started  
**Priority:** P0 - CRITICAL  
**Blocking:** Build consistency  
**Owner:** Build Engineer

**Current State:**
- Some packages use `"*"` instead of `"workspace:*"` for internal deps
- Leads to unpredictable version resolution
- admin-app has incorrect protocol

**Acceptance Criteria:**
- [ ] All internal deps use `workspace:*` protocol
- [ ] Verification script created and passing
- [ ] CI check added to prevent regressions

**Implementation Steps:**
```bash
# Step 1: Create verification script (30min)
# File: scripts/verify/workspace-deps.sh

# Step 2: Find and fix violations (45min)
# Search pattern:
grep -r '"@easymo/.*": "\*"' --include="package.json" | grep -v node_modules

# Fix in admin-app/package.json:
{
  "dependencies": {
    "@easymo/commons": "workspace:*",
    "@easymo/ui": "workspace:*",
    "@easymo/video-agent-schema": "workspace:*",
    "@va/shared": "workspace:*"
  }
}

# Step 3: Test (15min)
pnpm install --frozen-lockfile
pnpm build

# Step 4: Add to CI (15min)
# Add to .github/workflows/ci.yml
```

**Files to Create:**
- `scripts/verify/workspace-deps.sh`

**Files to Modify:**
- `admin-app/package.json`
- Any other packages with `"*"` protocol
- `.github/workflows/ci.yml`

**Verification:**
```bash
bash scripts/verify/workspace-deps.sh && echo "✅ All workspace deps correct"
```

---

### Priority 1 - HIGH (6 hours)

#### Task 3.3: Admin App Consolidation [4h]
**Status:** ❌ Not Started  
**Priority:** P1  
**Dependencies:** Task 3.1, 3.2  
**Owner:** Frontend Lead

**Current State:**
- `admin-app/` - Primary (Next.js 15.1.6, Tauri, Sentry, shared packages)
- `admin-app-v2/` - Duplicate (Next.js 15.1.6, no Tauri, no shared packages)
- Unclear which features are unique to v2

**Decision:** Keep `admin-app` as primary, archive `admin-app-v2`

**Acceptance Criteria:**
- [ ] Feature comparison document created
- [ ] Unique features migrated to admin-app (if any)
- [ ] admin-app-v2 marked with DEPRECATED.md
- [ ] CI updated to exclude admin-app-v2
- [ ] pnpm-workspace.yaml updated

**Implementation Steps:**
```bash
# Step 1: Feature comparison (1h)
# Create docs/admin-app-comparison.md
# Compare:
# - package.json dependencies
# - components/ directory
# - stores/ directory
# - lib/ utilities
# - pages/app/ routes

# Step 2: Migration script (1h)
npx tsx scripts/migration/merge-admin-apps.ts --dry-run
# Review output
npx tsx scripts/migration/merge-admin-apps.ts

# Step 3: Deprecation (30min)
# Create admin-app-v2/DEPRECATED.md
# Update pnpm-workspace.yaml (comment out admin-app-v2)

# Step 4: Update CI (30min)
# Remove admin-app-v2 from:
# - .github/workflows/admin-app-ci.yml (or exclude it)
# - Build scripts

# Step 5: Test (1h)
pnpm --filter @easymo/admin-app build
pnpm --filter @easymo/admin-app test
```

**Files to Create:**
- `docs/admin-app-comparison.md`
- `scripts/migration/merge-admin-apps.ts`
- `admin-app-v2/DEPRECATED.md`

**Files to Modify:**
- `pnpm-workspace.yaml`
- `.github/workflows/admin-app-ci.yml`

**Verification:**
```bash
pnpm --filter @easymo/admin-app build && \
pnpm --filter @easymo/admin-app test && \
echo "✅ Admin app consolidated"
```

---

#### Task 3.4: Stray Files Relocation [2h]
**Status:** ❌ Not Started  
**Priority:** P1  
**Dependencies:** None  
**Owner:** Backend Developer

**Current State:**
- `services/audioUtils.ts` - Should be in shared package
- `services/gemini.ts` - Should be in AI core package

**Acceptance Criteria:**
- [ ] `@easymo/media-utils` package created
- [ ] `@easymo/ai-core` package enhanced with Gemini provider
- [ ] Old files archived and removed
- [ ] All imports updated across codebase

**Implementation Steps:**
```bash
# Step 1: Create media-utils package (45min)
mkdir -p packages/media-utils/src
# Copy template from docs
# Move audioUtils.ts logic to packages/media-utils/src/audio.ts

# Step 2: Create/update ai-core package (45min)
mkdir -p packages/ai-core/src/providers
# Move gemini.ts to packages/ai-core/src/providers/gemini.ts

# Step 3: Update imports (15min)
# Find all imports:
grep -r "from.*services/audioUtils" --include="*.ts" --include="*.tsx"
grep -r "from.*services/gemini" --include="*.ts" --include="*.tsx"
# Update to new package imports

# Step 4: Archive and remove (15min)
bash scripts/maintenance/remove-stray-service-files.sh
```

**Files to Create:**
- `packages/media-utils/package.json`
- `packages/media-utils/src/audio.ts`
- `packages/media-utils/src/index.ts`
- `packages/ai-core/src/providers/gemini.ts`
- `scripts/maintenance/remove-stray-service-files.sh`

**Files to Delete:**
- `services/audioUtils.ts` (after migration)
- `services/gemini.ts` (after migration)

**Verification:**
```bash
pnpm --filter @easymo/media-utils build && \
pnpm --filter @easymo/ai-core build && \
echo "✅ Stray files relocated"
```

---

### Priority 2 - MEDIUM (12 hours)

#### Task 3.5: Jest → Vitest Migration [8h]
**Status:** ❌ Not Started  
**Priority:** P2  
**Dependencies:** Task 3.1  
**Owner:** QA Engineer

**Current State:**
- Mixed test frameworks: Jest (wallet, profile, ranking) and Vitest (admin, agent-core)
- Inconsistent test patterns
- Need unified configuration

**Acceptance Criteria:**
- [ ] Shared vitest config created (`vitest.shared.ts`)
- [ ] wallet-service migrated to Vitest
- [ ] profile service migrated to Vitest
- [ ] ranking-service migrated to Vitest
- [ ] bar-manager-app tests added
- [ ] All tests passing in CI

**Implementation Steps:**
```bash
# Step 1: Create shared config (1h)
# Create vitest.shared.ts (already exists, enhance it)

# Step 2: Migrate wallet-service (3h)
npx tsx scripts/migration/jest-to-vitest.ts --target=services/wallet-service --dry-run
npx tsx scripts/migration/jest-to-vitest.ts --target=services/wallet-service
cd services/wallet-service
rm jest.config.js
# Create vitest.config.ts
pnpm test

# Step 3: Migrate profile (2h)
npx tsx scripts/migration/jest-to-vitest.ts --target=services/profile
# Similar process

# Step 4: Migrate ranking (1h)
npx tsx scripts/migration/jest-to-vitest.ts --target=services/ranking-service

# Step 5: Add bar-manager tests (1h)
cd bar-manager-app
# Create basic test suite
pnpm test
```

**Files to Create:**
- `scripts/migration/jest-to-vitest.ts`
- `services/wallet-service/vitest.config.ts`
- `services/profile/vitest.config.ts`
- `services/ranking-service/vitest.config.ts`
- `bar-manager-app/test/setup.ts`

**Files to Delete:**
- `services/wallet-service/jest.config.js`
- `services/profile/jest.config.js`
- `services/ranking-service/jest.config.js`

**Files to Modify:**
- All `*.test.ts` files in affected services
- `package.json` in each service (update test script)

**Verification:**
```bash
pnpm --filter @easymo/wallet-service test && \
pnpm --filter @easymo/profile test && \
pnpm --filter @easymo/ranking-service test && \
pnpm --filter @easymo/bar-manager-app test && \
echo "✅ All services using Vitest"
```

---

#### Task 3.6: ESLint Zero Warnings [4h]
**Status:** ❌ Not Started  
**Priority:** P2  
**Dependencies:** None  
**Owner:** All Developers

**Current State:**
- 2 console.log warnings accepted in CI
- Some `any` types exist
- Missing return types on functions

**Acceptance Criteria:**
- [ ] ESLint config updated to error on warnings
- [ ] All `console.log` replaced with structured logging
- [ ] Zero ESLint warnings in CI
- [ ] Pre-commit hook enforcing lint

**Implementation Steps:**
```bash
# Step 1: Update ESLint config (30min)
# Modify eslint.config.mjs to error on console.log

# Step 2: Create logger wrapper (30min)
# Create packages/commons/src/logger/console-wrapper.ts

# Step 3: Run codemod (2h)
npx tsx scripts/codemod/replace-console.ts --dry-run
# Review changes
npx tsx scripts/codemod/replace-console.ts

# Step 4: Manual fixes (1h)
# Fix remaining console.log calls that need semantic event names
# Fix any remaining `any` types

# Step 5: Verify (30min)
pnpm lint
# Should have 0 warnings
```

**Files to Create:**
- `packages/commons/src/logger/console-wrapper.ts`
- `scripts/codemod/replace-console.ts`

**Files to Modify:**
- `eslint.config.mjs`
- All files with `console.log` calls (100+ files)

**Verification:**
```bash
pnpm lint 2>&1 | grep "warning" && echo "❌ Still has warnings" || echo "✅ Zero warnings"
```

---

## 🔵 PHASE 4: DOCUMENTATION & CLEANUP (11 hours)

### Task 4.1: Root Directory Cleanup [3h]
**Status:** ❌ Not Started  
**Priority:** P1  
**Dependencies:** None  
**Owner:** DevOps Engineer

**Current State:**
- 30+ session/status markdown files in root
- Architecture diagrams scattered
- Old scripts mixed with active ones
- Orphaned source files (App.tsx, index.tsx, types.ts)

**Acceptance Criteria:**
- [ ] All session files moved to `docs/sessions/`
- [ ] All architecture diagrams in `docs/architecture/`
- [ ] All scripts consolidated in `scripts/`
- [ ] Orphaned files archived
- [ ] Root contains only essential config files
- [ ] Archive index generated

**Implementation Steps:**
```bash
# Step 1: Review cleanup script (15min)
cat scripts/maintenance/cleanup-root-directory.sh

# Step 2: Dry run (15min)
bash scripts/maintenance/cleanup-root-directory.sh --dry-run

# Step 3: Execute cleanup (30min)
bash scripts/maintenance/cleanup-root-directory.sh

# Step 4: Update .gitignore (15min)
# Add session file patterns

# Step 5: Verify and commit (30min)
git status
git add .
git commit -m "chore: cleanup root directory - organize docs and scripts"

# Step 6: Update docs (1h)
# Create docs/archive/INDEX.md
# Update README.md with new structure
```

**Files to Create:**
- `scripts/maintenance/cleanup-root-directory.sh`
- `docs/archive/INDEX.md`
- `docs/sessions/` (directory)
- `docs/architecture/diagrams/` (directory)
- `scripts/deploy/` (directory)
- `.archive/orphaned/` (directory)

**Files to Move:**
- All `*_COMPLETE*.md` → `docs/sessions/`
- All `*_STATUS*.md` → `docs/sessions/`
- All `*_SUMMARY*.md` → `docs/sessions/`
- All `*_VISUAL*.txt` → `docs/architecture/diagrams/`
- All `deploy-*.sh` → `scripts/deploy/`
- All `verify-*.sh` → `scripts/verify/`
- `App.tsx`, `index.tsx`, `types.ts` → `.archive/orphaned/`

**Verification:**
```bash
# Should only show essential config files
ls -1 *.md *.json *.yaml *.yml *.toml Makefile Dockerfile 2>/dev/null | wc -l
# Should be < 15 files
```

---

### Task 4.2: Observability Compliance [5h]
**Status:** ❌ Not Started  
**Priority:** P1  
**Dependencies:** Task 3.6 (console.log replacement)  
**Owner:** SRE Engineer

**Current State:**
- Not all services use structured logging
- Correlation IDs not consistently implemented
- PII masking not enforced
- Metrics recording incomplete

**Acceptance Criteria:**
- [ ] Compliance checker script created
- [ ] All services pass correlation ID check
- [ ] PII masking verified
- [ ] Metrics recording verified
- [ ] Health endpoints verified
- [ ] Compliance report generated

**Implementation Steps:**
```bash
# Step 1: Create compliance checker (2h)
# Create scripts/audit/observability-compliance.ts

# Step 2: Run baseline audit (30min)
npx tsx scripts/audit/observability-compliance.ts > compliance-baseline.txt

# Step 3: Fix violations (2h)
# Based on compliance report:
# - Add correlation IDs to services missing them
# - Add PII masking where needed
# - Ensure all services have health endpoints
# - Add metrics recording where missing

# Step 4: Re-audit (30min)
npx tsx scripts/audit/observability-compliance.ts > compliance-final.txt
diff compliance-baseline.txt compliance-final.txt
```

**Files to Create:**
- `scripts/audit/observability-compliance.ts`
- `docs/OBSERVABILITY_COMPLIANCE.md`

**Files to Modify:**
- Services missing correlation ID handling
- Services with PII in logs
- Services without health endpoints

**Verification:**
```bash
npx tsx scripts/audit/observability-compliance.ts | grep "❌" && \
echo "❌ Compliance issues" || echo "✅ Fully compliant"
```

---

### Task 4.3: CI/CD Enhancements [3h]
**Status:** ❌ Not Started  
**Priority:** P2  
**Dependencies:** Tasks 3.2, 4.1, 4.2  
**Owner:** DevOps Engineer

**Current State:**
- No workspace dependency check in CI
- No observability compliance check
- No console.log detection

**Acceptance Criteria:**
- [ ] Workspace deps check added to CI
- [ ] Observability compliance check added
- [ ] Console.log detection added
- [ ] All checks passing

**Implementation Steps:**
```bash
# Step 1: Add workspace deps check (1h)
# Update .github/workflows/ci.yml:
- name: Verify workspace dependencies
  run: bash scripts/verify/workspace-deps.sh

# Step 2: Add observability check (1h)
- name: Check observability compliance
  run: npx tsx scripts/audit/observability-compliance.ts --ci

# Step 3: Add console.log check (30min)
- name: Check for console.log
  run: |
    if grep -r "console\.log" --include="*.ts" --include="*.tsx" services/ packages/ admin-app/; then
      echo "❌ Found console.log statements"
      exit 1
    fi

# Step 4: Test CI (30min)
git push origin feature/phase-3-4
# Watch CI run
```

**Files to Modify:**
- `.github/workflows/ci.yml`
- `.github/workflows/admin-app-ci.yml`

**Verification:**
```bash
# CI should pass with all new checks
echo "✅ CI enhanced and passing"
```

---

## 📝 NEXT STEPS (After Phase 3 & 4)

### Week 3-4: Performance & Security
- [ ] Performance optimization (caching, query optimization)
- [ ] Security audit (penetration test, vulnerability scan)
- [ ] E2E testing (Playwright/Cypress)
- [ ] Load testing (k6 or Artillery)

### Week 4: Production Readiness
- [ ] Monitoring & alerts setup
- [ ] Runbook creation
- [ ] Disaster recovery plan
- [ ] Production deployment checklist

---

## 🚀 GETTING STARTED

### Prerequisites
```bash
# Ensure you have the right tools
node --version  # Should be 20.x
pnpm --version  # Should be 10.18.3+
git --version

# Clean state
git status  # Should be clean
pnpm install --frozen-lockfile
```

### Start Implementation
```bash
# 1. Start with P0 tasks
echo "Starting Phase 3 & 4 Implementation"

# 2. Create feature branch
git checkout -b feature/phase-3-4-code-quality

# 3. Begin with Task 3.1 (TypeScript Alignment)
# Follow the task steps above

# 4. Commit frequently
git add .
git commit -m "feat(phase3): task 3.1 - typescript version alignment"

# 5. Continue with next tasks in order
```

### Daily Checklist
- [ ] Update task status in this document
- [ ] Run verification commands
- [ ] Commit changes with descriptive messages
- [ ] Update progress percentage
- [ ] Note any blockers or issues

---

## 📊 METRICS & SUCCESS CRITERIA

### Phase 3 Success Metrics
- [ ] TypeScript version: 100% at 5.5.4
- [ ] Workspace deps: 100% using `workspace:*`
- [ ] Test framework: 100% Vitest (except Deno functions)
- [ ] ESLint warnings: 0
- [ ] Build time: < 5 seconds
- [ ] Test time: < 10 seconds

### Phase 4 Success Metrics
- [ ] Root directory files: < 15 essential configs
- [ ] Observability compliance: 100%
- [ ] CI pipeline time: < 30 minutes
- [ ] Documentation coverage: 100%

---

## 🔗 RELATED DOCUMENTS

- [Ground Rules](./docs/GROUND_RULES.md) - Mandatory compliance
- [Architecture](./docs/ARCHITECTURE.md) - System design
- [Quick Start](./QUICKSTART.md) - Getting started
- [Contributing](./CONTRIBUTING.md) - Development workflow

---

**Last Updated:** 2025-11-27  
**Next Review:** After each task completion  
**Questions:** Contact team lead or post in #easymo-dev
