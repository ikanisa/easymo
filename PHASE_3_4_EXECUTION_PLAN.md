# Phase 3 & 4 Implementation - Execution Plan

**Status**: Ready to Execute  
**Date**: 2025-11-27  
**Total Effort**: 33 hours (Phase 3: 22h, Phase 4: 11h)

## Priority Order (P0 = MUST DO FIRST)

### 🔴 Phase 3: Code Quality & Standardization (22 hours)

#### P0 - Critical Blocking Issues (4 hours)

**1. TypeScript Version Alignment [2h]**
- **Status**: Not Started
- **Blocker**: Yes - inconsistent versions break builds
- **Script**: `scripts/phase3/01-typescript-alignment.sh`
- **Steps**:
  1. Audit all package.json for TypeScript versions
  2. Enforce 5.5.4 everywhere
  3. Add pnpm override to root package.json
  4. Fix bar-manager-app dependencies
  5. Run: `pnpm install && pnpm build`
  6. Add CI check

**2. Workspace Dependencies [2h]**
- **Status**: Not Started
- **Blocker**: Yes - breaks local dev and builds
- **Script**: `scripts/phase3/02-workspace-deps.sh`
- **Steps**:
  1. Find all internal deps using `*` instead of `workspace:*`
  2. Create verification script
  3. Fix all violations
  4. Run: `pnpm install`
  5. Add to CI

#### P1 - High Priority (4 hours)

**3. Admin App Consolidation [4h]**
- **Status**: Partially Done (admin-app-v2 commented out in workspace)
- **Script**: `scripts/phase3/03-admin-app-consolidation.sh`
- **Steps**:
  1. Feature comparison document
  2. Migrate unique components (if any)
  3. Create DEPRECATED.md in admin-app-v2
  4. Update CI to exclude
  5. Archive directory after 2 weeks

#### P2 - Standard Priority (14 hours)

**4. Stray Files Relocation [2h]**
- **Status**: Not Started
- **Files to relocate**:
  - `services/audioUtils.ts` → `packages/media-utils/src/audio.ts`
  - `services/gemini.ts` → `packages/ai-core/src/providers/gemini.ts`
- **Steps**:
  1. Create @easymo/media-utils package
  2. Create @easymo/ai-core package structure
  3. Migrate files with proper typing
  4. Update all imports
  5. Remove old files

**5. Jest → Vitest Migration [8h]**
- **Status**: Not Started
- **Services to migrate**:
  - wallet-service (3h) - Critical financial service
  - profile-service (2h)
  - ranking-service (1h)
  - bar-manager-app tests (2h)
- **Script**: `scripts/migration/jest-to-vitest.ts`
- **Steps**:
  1. Run migration script in dry-run mode
  2. Create vitest.config.ts for each service
  3. Update package.json scripts
  4. Remove jest.config.js
  5. Run tests: `pnpm test`
  6. Update CI workflows

**6. ESLint Zero Warnings [6h]**
- **Status**: Partially Done (baseline check exists)
- **Current**: 2 console warnings (acceptable)
- **Target**: 0 warnings, all console.log replaced
- **Scripts**:
  - `scripts/codemod/replace-console.ts`
  - `scripts/maintenance/replace-console-logs.sh`
- **Steps**:
  1. Run count script: `node scripts/count-console-logs.js`
  2. Create console wrapper: `packages/commons/src/logger/console-wrapper.ts`
  3. Run codemod in dry-run: `npx tsx scripts/codemod/replace-console.ts --dry-run`
  4. Apply fixes
  5. Update eslint config to error on console
  6. Run: `pnpm lint` (should pass with 0 warnings)

### 🔵 Phase 4: Documentation & Cleanup (11 hours)

#### P1 - Critical Cleanup (8 hours)

**7. Root Directory Cleanup [3h]**
- **Status**: Not Started
- **Script**: `scripts/phase3/04-root-cleanup.sh`
- **Files to move**: 40+ session files, status docs, roadmaps
- **Target structure**:
  ```
  docs/
    ├── sessions/          # All *_COMPLETE.md, *_STATUS.md, etc.
    ├── roadmaps/          # All *_ROADMAP.md, DETAILED_IMPLEMENTATION_PLAN.md
    ├── architecture/      # Architecture docs and diagrams
    └── archive/           # Index of archived content
  
  .archive/
    └── orphaned/          # App.tsx, index.tsx, types.ts
  ```

**8. Observability Compliance [5h]**
- **Status**: Baseline established (compliance-baseline.txt exists)
- **Script**: `scripts/audit/observability-compliance.ts`
- **Steps**:
  1. Complete compliance checker script
  2. Run audit: `npx tsx scripts/audit/observability-compliance.ts`
  3. Fix violations:
     - Missing correlation IDs
     - Missing PII masking
     - Missing health endpoints
     - Missing metric recording
  4. Re-run audit until 100% compliant
  5. Add to CI

#### P2 - CI/CD Enhancements (3 hours)

**9. CI/CD Workflow Updates [3h]**
- **Status**: Not Started
- **New checks to add**:
  - TypeScript version consistency
  - Workspace dependencies validation
  - Console.log detection
  - Observability compliance
- **Files to update**:
  - `.github/workflows/ci.yml`
  - `.github/workflows/validate.yml`

## Execution Strategy

### Week 1: Critical Blockers (6 hours)
```bash
# Day 1-2: P0 Tasks (4h)
./scripts/phase3/01-typescript-alignment.sh --dry-run
./scripts/phase3/01-typescript-alignment.sh
pnpm install

./scripts/phase3/02-workspace-deps.sh --dry-run
./scripts/phase3/02-workspace-deps.sh
pnpm install && pnpm build

# Day 3: P1 Task (2h)
./scripts/phase3/03-admin-app-consolidation.sh --dry-run
./scripts/phase3/03-admin-app-consolidation.sh
```

### Week 2: Code Quality (16 hours)
```bash
# Day 1: Stray Files (2h)
# Create packages, migrate files, update imports

# Day 2-3: Jest → Vitest (8h)
npx tsx scripts/migration/jest-to-vitest.ts --target=services/wallet-service --dry-run
npx tsx scripts/migration/jest-to-vitest.ts --target=services/wallet-service
# Repeat for profile, ranking services

# Day 4-5: ESLint (6h)
node scripts/count-console-logs.js
./scripts/maintenance/replace-console-logs.sh --dry-run
./scripts/maintenance/replace-console-logs.sh
pnpm lint
```

### Week 3: Cleanup & Compliance (11 hours)
```bash
# Day 1: Root Cleanup (3h)
./scripts/phase3/04-root-cleanup.sh --dry-run
./scripts/phase3/04-root-cleanup.sh

# Day 2-3: Observability (5h)
npx tsx scripts/audit/observability-compliance.ts
# Fix violations
npx tsx scripts/audit/observability-compliance.ts  # Re-run

# Day 4: CI/CD (3h)
# Update workflows, add new checks
```

## Success Criteria

### Phase 3 Complete When:
- ✅ TypeScript 5.5.4 everywhere (verified by CI)
- ✅ All workspace deps use `workspace:*` protocol
- ✅ admin-app-v2 deprecated/archived
- ✅ No stray files in services/
- ✅ All services use Vitest (Jest removed)
- ✅ Zero ESLint warnings
- ✅ All console.log replaced with structured logging

### Phase 4 Complete When:
- ✅ Root directory has <10 config files only
- ✅ All session docs in docs/sessions/
- ✅ 100% observability compliance
- ✅ CI enforces all new standards

## Risk Mitigation

### High Risk Items:
1. **Jest → Vitest migration** - May break tests
   - Mitigation: Dry-run first, migrate one service at a time
   
2. **Console.log replacement** - May break functionality
   - Mitigation: Use wrapper pattern, test after each file

3. **Root cleanup** - May break CI references
   - Mitigation: Dry-run, update CI first

### Rollback Plan:
All scripts support `--dry-run` flag. Git commits after each phase.

## Quick Start

```bash
# 1. Make scripts executable
chmod +x scripts/phase3/*.sh
chmod +x scripts/maintenance/*.sh

# 2. Start with P0 tasks
cd /Users/jeanbosco/workspace/easymo-
./scripts/phase3/01-typescript-alignment.sh --dry-run

# 3. Review output, then execute
./scripts/phase3/01-typescript-alignment.sh
pnpm install

# 4. Continue with next task
./scripts/phase3/02-workspace-deps.sh --dry-run
./scripts/phase3/02-workspace-deps.sh

# 5. Proceed through remaining tasks in order
```

## Progress Tracking

Update this section as tasks complete:

- [ ] TypeScript Alignment
- [ ] Workspace Dependencies
- [ ] Admin App Consolidation
- [ ] Stray Files Relocation
- [ ] Jest → Vitest Migration
- [ ] ESLint Zero Warnings
- [ ] Root Directory Cleanup
- [ ] Observability Compliance
- [ ] CI/CD Updates

## Next Session Handoff

**If pausing mid-implementation:**
1. Check last completed task above
2. Review git status
3. Run relevant dry-run scripts to see what's next
4. Continue from next unchecked task

**Files to review before continuing:**
- `compliance-baseline.txt` - Observability baseline
- `docs/NEXT_STEPS.md` - Additional context
- `scripts/phase3/*.sh` - Implementation scripts
