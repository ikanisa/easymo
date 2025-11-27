# PENDING IMPLEMENTATION - Phase 3 & 4
## What Still Needs to Be Done

**Generated:** 2025-11-27  
**Status:** 0% Complete (0/9 tasks done)  
**Total Time:** 33 hours over 4 days

---

## ⚠️ CRITICAL PATH - DO THESE FIRST (4 hours)

### 🔴 Task 3.1: TypeScript Version Alignment [2h] - P0 BLOCKER
**Current State:** Mixed TypeScript versions across packages  
**Goal:** All packages at TypeScript 5.5.4  
**Status:** ❌ NOT STARTED  
**Blocks:** All other tasks

**What to Do:**
1. Audit current versions: `find . -name "package.json" -not -path "*/node_modules/*" -exec grep -H '"typescript"' {} \;`
2. Add to root package.json:
   ```json
   {
     "devDependencies": { "typescript": "5.5.4" },
     "pnpm": { "overrides": { "typescript": "5.5.4" } }
   }
   ```
3. Fix bar-manager-app dependencies
4. Clean reinstall: `rm -rf node_modules pnpm-lock.yaml && pnpm install`
5. Verify: `pnpm type-check`

**Success:** ✅ `pnpm type-check` passes with TypeScript 5.5.4

---

### 🔴 Task 3.2: Workspace Dependencies [2h] - P0 BLOCKER
**Current State:** Some packages use `"*"` instead of `"workspace:*"`  
**Goal:** All internal deps use correct protocol  
**Status:** ❌ NOT STARTED  
**Blocks:** Build consistency

**What to Do:**
1. Create script: `scripts/verify/workspace-deps.sh`
2. Find violations: `grep -r '"@easymo/.*": "\*"' --include="package.json" | grep -v node_modules`
3. Fix admin-app/package.json: Change `"*"` → `"workspace:*"` for all @easymo/* deps
4. Reinstall: `pnpm install`
5. Add check to CI

**Success:** ✅ Script passes, no `"*"` protocol for internal deps

---

## 🟡 HIGH PRIORITY (6 hours)

### Task 3.3: Admin App Consolidation [4h] - P1
**Current State:** Two admin apps exist (admin-app and admin-app-v2)  
**Goal:** Keep admin-app, deprecate admin-app-v2  
**Status:** ❌ NOT STARTED  
**Depends On:** Tasks 3.1, 3.2

**What to Do:**
1. Compare features between admin-app and admin-app-v2
2. Create migration script if unique features exist in v2
3. Create `admin-app-v2/DEPRECATED.md`
4. Comment out admin-app-v2 in `pnpm-workspace.yaml`
5. Update CI to exclude admin-app-v2
6. Test: `pnpm --filter @easymo/admin-app build && pnpm --filter @easymo/admin-app test`

**Success:** ✅ admin-app builds, admin-app-v2 marked deprecated

---

### Task 3.4: Relocate Stray Files [2h] - P1
**Current State:** audioUtils.ts and gemini.ts in services/ root  
**Goal:** Move to proper packages  
**Status:** ❌ NOT STARTED  
**Depends On:** None

**What to Do:**
1. Create `packages/media-utils` for audioUtils.ts
2. Create/update `packages/ai-core` for gemini.ts
3. Move files and update imports across codebase
4. Archive old files
5. Build new packages

**Success:** ✅ New packages build, old files removed, all imports updated

---

## 🟢 MEDIUM PRIORITY (12 hours)

### Task 3.5: Jest → Vitest Migration [8h] - P2
**Current State:** Mixed test frameworks (Jest in wallet/profile/ranking)  
**Goal:** All services use Vitest  
**Status:** ❌ NOT STARTED  
**Depends On:** Task 3.1

**What to Do:**
1. Create migration script: `scripts/migration/jest-to-vitest.ts`
2. Migrate wallet-service (3h)
3. Migrate profile service (2h)
4. Migrate ranking-service (1h)
5. Add tests to bar-manager-app (2h)
6. Update CI

**Success:** ✅ All services pass tests with Vitest

---

### Task 3.6: ESLint Zero Warnings [4h] - P2
**Current State:** 2 console.log warnings accepted  
**Goal:** Zero ESLint warnings  
**Status:** ❌ NOT STARTED  
**Depends On:** None

**What to Do:**
1. Update eslint.config.mjs to error on console.log
2. Create console wrapper: `packages/commons/src/logger/console-wrapper.ts`
3. Create codemod: `scripts/codemod/replace-console.ts`
4. Run codemod across codebase
5. Manual fixes for semantic event names
6. Verify: `pnpm lint` shows 0 warnings

**Success:** ✅ `pnpm lint` outputs 0 warnings

---

## 🔵 PHASE 4: CLEANUP (11 hours)

### Task 4.1: Root Directory Cleanup [3h] - P1
**Current State:** 30+ session/status files scattered in root  
**Goal:** Organized docs/ and scripts/ structure  
**Status:** ❌ NOT STARTED  
**Depends On:** None

**What to Do:**
1. Create script: `scripts/maintenance/cleanup-root-directory.sh`
2. Run dry-run: `bash scripts/maintenance/cleanup-root-directory.sh --dry-run`
3. Execute: `bash scripts/maintenance/cleanup-root-directory.sh`
4. Move:
   - All `*_COMPLETE*.md` → `docs/sessions/`
   - All `*_STATUS*.md` → `docs/sessions/`
   - All `*_VISUAL*.txt` → `docs/architecture/diagrams/`
   - All `deploy-*.sh` → `scripts/deploy/`
   - `App.tsx`, `index.tsx`, `types.ts` → `.archive/orphaned/`
5. Generate `docs/archive/INDEX.md`

**Success:** ✅ Root has < 15 essential config files

---

### Task 4.2: Observability Compliance [5h] - P1
**Current State:** Observability not verified across all services  
**Goal:** All services follow ground rules  
**Status:** ❌ NOT STARTED  
**Depends On:** Task 3.6

**What to Do:**
1. Create script: `scripts/audit/observability-compliance.ts`
2. Run baseline: `npx tsx scripts/audit/observability-compliance.ts > compliance-baseline.txt`
3. Fix violations:
   - Add correlation IDs where missing
   - Add PII masking
   - Add health endpoints
   - Add metrics recording
4. Re-audit: `npx tsx scripts/audit/observability-compliance.ts > compliance-final.txt`

**Success:** ✅ Compliance script shows 100% pass rate

---

### Task 4.3: CI/CD Enhancements [3h] - P2
**Current State:** Missing quality checks in CI  
**Goal:** Automated quality gates  
**Status:** ❌ NOT STARTED  
**Depends On:** Tasks 3.2, 4.1, 4.2

**What to Do:**
1. Add workspace deps check to `.github/workflows/ci.yml`
2. Add observability compliance check
3. Add console.log detection
4. Test CI pipeline

**Success:** ✅ CI passes with all new checks

---

## 📊 SUMMARY

### By Priority
| Priority | Tasks | Hours | Status |
|----------|-------|-------|--------|
| P0 (Blockers) | 2 | 4h | ❌ Not started |
| P1 (High) | 4 | 14h | ❌ Not started |
| P2 (Medium) | 3 | 15h | ❌ Not started |
| **TOTAL** | **9** | **33h** | **0% done** |

### By Phase
| Phase | Tasks | Hours | Status |
|-------|-------|-------|--------|
| Phase 3: Code Quality | 6 | 22h | ❌ 0/6 done |
| Phase 4: Documentation | 3 | 11h | ❌ 0/3 done |
| **TOTAL** | **9** | **33h** | **0% done** |

---

## 🎯 RECOMMENDED ORDER

Follow this sequence to avoid blockers:

### Day 1 (4h) - Blockers
1. ✅ Task 3.1: TypeScript Alignment [2h]
2. ✅ Task 3.2: Workspace Dependencies [2h]

### Day 2 (6h) - High Priority
3. ✅ Task 3.4: Stray Files [2h]
4. ✅ Task 3.3: Admin App Consolidation [4h]

### Day 3 (8h) - Testing
5. ✅ Task 3.5: Jest → Vitest Migration [8h]

### Day 4 (15h) - Polish & Cleanup
6. ✅ Task 3.6: ESLint Zero Warnings [4h]
7. ✅ Task 4.1: Root Cleanup [3h]
8. ✅ Task 4.2: Observability Compliance [5h]
9. ✅ Task 4.3: CI Enhancements [3h]

---

## 🚀 HOW TO START

```bash
# 1. Read the full tracker
cat PHASE_3_4_IMPLEMENTATION_TRACKER.md

# 2. Read the start guide
cat docs/PHASE_3_4_START_HERE.md

# 3. Start with Task 3.1 (TypeScript)
# Follow steps in PHASE_3_4_IMPLEMENTATION_TRACKER.md

# 4. Update this file as you complete tasks
# Change ❌ to 🚧 (in progress) or ✅ (complete)
```

---

## 📁 FILES TO CREATE

As you work through tasks, you'll create these files:

### Scripts
- [ ] `scripts/verify/workspace-deps.sh`
- [ ] `scripts/migration/merge-admin-apps.ts`
- [ ] `scripts/migration/jest-to-vitest.ts`
- [ ] `scripts/codemod/replace-console.ts`
- [ ] `scripts/maintenance/cleanup-root-directory.sh`
- [ ] `scripts/maintenance/remove-stray-service-files.sh`
- [ ] `scripts/audit/observability-compliance.ts`

### Documentation
- [ ] `docs/admin-app-comparison.md`
- [ ] `admin-app-v2/DEPRECATED.md`
- [ ] `docs/archive/INDEX.md`
- [ ] `docs/OBSERVABILITY_COMPLIANCE.md`

### Packages
- [ ] `packages/media-utils/` (new package)
- [ ] `packages/ai-core/src/providers/gemini.ts` (new file)

### Config Updates
- [ ] `package.json` (TypeScript version + pnpm overrides)
- [ ] `pnpm-workspace.yaml` (comment out admin-app-v2)
- [ ] `eslint.config.mjs` (error on console.log)
- [ ] `.github/workflows/ci.yml` (add quality checks)

---

## ✅ COMPLETION CRITERIA

You're done when:
- [ ] All 9 tasks marked ✅ in tracker
- [ ] `pnpm type-check` passes
- [ ] `pnpm lint` shows 0 warnings
- [ ] `pnpm test` all passing
- [ ] `pnpm build` succeeds
- [ ] CI pipeline green
- [ ] Root directory has < 15 files
- [ ] All scripts in scripts/
- [ ] All docs in docs/

---

**Next Step:** → Start with Task 3.1 in `PHASE_3_4_IMPLEMENTATION_TRACKER.md`
