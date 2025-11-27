# Git Commit Strategy for Phase 3 & 4

## Commit Sequence

### Commit 1: Documentation (Current)
```bash
git add START_PHASE_3_4_HERE.md
git add PHASE_3_4_IMPLEMENTATION_GUIDE.md
git add PHASE_3_4_STATUS.md
git add PHASE_3_4_QUICK_REF.md

git commit -m "docs(phase3-4): add comprehensive implementation guide

- Add START_PHASE_3_4_HERE.md (quick start guide)
- Add PHASE_3_4_IMPLEMENTATION_GUIDE.md (detailed instructions)
- Add PHASE_3_4_STATUS.md (status tracker with checklists)
- Add PHASE_3_4_QUICK_REF.md (command reference)

Covers 33-39 hours of work across:
- P0: TypeScript alignment, workspace deps (4h)
- P1: Admin consolidation, test migration, ESLint (18h)
- P2: Documentation cleanup, observability, CI/CD (11h)

All tasks include implementation scripts and verification steps.
"
```

### Commit 2: P0 Critical Fixes
```bash
# After completing Tasks 3.1 & 3.2
git add package.json pnpm-lock.yaml
git add services/*/package.json
git add packages/*/package.json
git add bar-manager-app/package.json

git commit -m "fix(deps): align TypeScript 5.5.4 and workspace protocol

BREAKING CHANGE: All packages now use TypeScript 5.5.4

Changes:
- Enforce TypeScript 5.5.4 via pnpm overrides
- Fix all workspace deps to use workspace:* protocol
- Update bar-manager-app dependencies
- Add verification script

Verification:
- pnpm install --frozen-lockfile ✅
- pnpm build:deps ✅
- pnpm type-check ✅
- bash scripts/verify/workspace-deps.sh ✅

Fixes: #12, #13
"
```

### Commit 3: Admin Consolidation
```bash
# After completing Task 3.3
git add pnpm-workspace.yaml
git add .archive/deprecated-apps/
git add docs/admin-app-comparison.md
git add .github/workflows/

git commit -m "refactor(admin): consolidate admin apps, archive admin-app-v2

Changes:
- Archive admin-app-v2 to .archive/deprecated-apps/
- Update pnpm-workspace.yaml (already marked deprecated)
- Document feature comparison
- Verify admin-app has all functionality

Rationale:
- admin-app has more features (Tauri, Sentry, React Query)
- admin-app uses shared packages (@easymo/commons, @va/shared)
- admin-app-v2 was duplicate with fewer features

Verification:
- pnpm --filter @easymo/admin-app build ✅
- pnpm --filter @easymo/admin-app test ✅

Fixes: #2
"
```

### Commit 4: Test Framework Migration
```bash
# After completing Tasks 3.4 & 3.5
git add services/wallet-service/
git add services/profile/
git add services/ranking-service/
git add bar-manager-app/
git add vitest.shared.ts
git add packages/media-utils/
git add packages/ai-core/

git commit -m "test: migrate to Vitest and relocate stray files

Test Framework Migration:
- Migrate wallet-service from Jest to Vitest
- Migrate profile-service from Jest to Vitest
- Migrate ranking-service from Jest to Vitest
- Add tests to bar-manager-app
- Create shared vitest.shared.ts config

Stray Files:
- Move services/audioUtils.ts → packages/media-utils/
- Move services/gemini.ts → packages/ai-core/providers/
- Create @easymo/media-utils package
- Update imports across codebase

Verification:
- pnpm test ✅ (all tests passing)
- No Jest dependencies in services/
- Shared test config used

Fixes: #3, #8
"
```

### Commit 5: Code Quality
```bash
# After completing Task 3.6
git add eslint.config.mjs
git add services/**/*.ts
git add packages/**/*.ts
git add admin-app/**/*.ts
git add scripts/maintenance/replace-console-logs.sh
git add packages/commons/src/logger/console-wrapper.ts

git commit -m "style: achieve zero ESLint warnings

Changes:
- Replace all console.log with structured logging
- Fix all explicit 'any' types
- Add explicit return types
- Update ESLint config to error on warnings
- Create console wrapper for gradual migration

Logging Pattern:
- Before: console.log('message', data)
- After: log.info({ data }, 'message')

Verification:
- pnpm lint ✅ (0 errors, 0 warnings)
- All services use structured logging
- No 'any' types except where necessary

Fixes: #14
"
```

### Commit 6: Documentation Cleanup
```bash
# After completing Task 4.1
git add docs/sessions/
git add docs/architecture/
git add docs/roadmaps/
git add docs/archive/
git add scripts/deploy/
git add scripts/verify/
git add scripts/test/
git add scripts/checks/
git add .archive/orphaned/
git add .gitignore

git commit -m "docs: reorganize root directory and consolidate docs

Changes:
- Move 30+ session files to docs/sessions/
- Move architecture diagrams to docs/architecture/diagrams/
- Move roadmaps to docs/roadmaps/
- Consolidate scripts into scripts/ subdirectories
- Archive orphaned files (.archive/orphaned/)
- Update .gitignore for session files

Directory Structure:
docs/
  sessions/       - Implementation sessions
  architecture/   - Architecture docs and diagrams
  roadmaps/       - Project roadmaps
  archive/        - Archived content index

scripts/
  deploy/         - Deployment scripts
  verify/         - Verification scripts
  test/           - Test scripts
  checks/         - Check scripts
  maintenance/    - Maintenance scripts

Verification:
- Root contains only essential config files
- All documentation organized
- All scripts categorized

Fixes: #1
"
```

### Commit 7: Observability & CI/CD
```bash
# After completing Tasks 4.2 & 4.3
git add scripts/audit/observability-compliance.ts
git add .github/workflows/ci.yml
git add .github/workflows/admin-app-ci.yml

git commit -m "feat(observability): add compliance checks and CI verification

Observability:
- Add observability compliance audit script
- Check for structured logging usage
- Check for correlation ID handling
- Check for PII masking
- Verify health endpoints

CI/CD Enhancements:
- Add workspace dependency verification
- Add TypeScript version check
- Add observability compliance check
- Add console.log detection
- All checks run in CI

New CI Checks:
✅ Workspace dependencies use workspace:*
✅ TypeScript 5.5.4 across all packages
✅ Observability compliance
✅ No console.log in services/

Verification:
- npx tsx scripts/audit/observability-compliance.ts ✅
- All CI checks passing ✅

Fixes: #15
"
```

---

## Push Strategy

### Option A: Incremental Pushes
```bash
# After each commit
git push origin main

# Benefits:
# - Smaller, reviewable changes
# - CI feedback after each step
# - Easy to revert if issues
```

### Option B: Batch Push
```bash
# After all 7 commits
git push origin main

# Benefits:
# - Single CI run for everything
# - Atomic deployment
# - All changes together
```

### Option C: Branch First (Recommended for Large Changes)
```bash
# Create feature branch
git checkout -b feat/phase-3-4-implementation

# Make all commits
git commit ...

# Push to branch
git push origin feat/phase-3-4-implementation

# Create PR for review
gh pr create --title "Phase 3 & 4 Implementation" \
  --body "See START_PHASE_3_4_HERE.md for details"

# Merge after review
gh pr merge --squash
```

---

## Pre-Push Checklist

Before `git push`, verify:

```bash
# 1. All builds pass
pnpm install --frozen-lockfile
pnpm build:deps
pnpm build

# 2. All tests pass
pnpm test

# 3. No lint errors
pnpm lint

# 4. Verification scripts pass
bash scripts/verify/workspace-deps.sh
npx tsx scripts/audit/observability-compliance.ts

# 5. Git status clean
git status

# 6. Commit messages follow convention
git log --oneline -7
```

---

## Post-Push Verification

After `git push`, check:

1. **GitHub Actions**: All workflows green
2. **Build logs**: No warnings or errors
3. **Test coverage**: Maintained or improved
4. **Deployment**: Staging environment works

---

## Rollback Plan

If issues after push:

```bash
# Revert specific commit
git revert <commit-sha>
git push

# Or reset to previous state
git reset --hard origin/main~7
git push --force

# Or create fix commit
# (preferred for public branches)
```

---

## Branch Protection

Consider adding to GitHub:
- Require PR reviews
- Require CI checks pass
- Require up-to-date branches
- Block force pushes to main

---

**Ready to commit? Start with Commit 1 (documentation)!**
