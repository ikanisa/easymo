# Phase 3 & 4 Implementation Guide

## Quick Start (5 minutes)

```bash
# 1. Review the execution plan
cat PHASE_3_4_EXECUTION_PLAN.md

# 2. Run P0 tasks (critical blockers)
chmod +x scripts/phase3-tasks.sh
./scripts/phase3-tasks.sh typescript --dry-run
./scripts/phase3-tasks.sh typescript --execute
pnpm install

./scripts/phase3-tasks.sh workspace --dry-run
./scripts/phase3-tasks.sh workspace --execute
pnpm install && pnpm build

# 3. Continue with remaining tasks
./scripts/phase3-tasks.sh admin --dry-run
./scripts/phase3-tasks.sh cleanup --dry-run
```

## What's Included

### Scripts Created

1. **`PHASE_3_4_EXECUTION_PLAN.md`** - Complete implementation roadmap
   - 9 tasks organized by priority
   - Time estimates (33 hours total)
   - Success criteria
   - Risk mitigation

2. **`scripts/phase3-tasks.sh`** - Automated task runner
   - TypeScript version alignment
   - Workspace dependencies fix
   - Admin app consolidation
   - Root directory cleanup
   - Supports --dry-run and --execute modes

3. **`scripts/execute-phase3-4.sh`** - Master orchestration script
   - Runs all tasks in sequence
   - Progress tracking
   - Automatic rollback on failure

### Task Breakdown

#### ✅ P0 - Critical Blockers (4h) - **DO THESE FIRST**

**Task 1: TypeScript Alignment (2h)**
```bash
./scripts/phase3-tasks.sh typescript --dry-run
./scripts/phase3-tasks.sh typescript --execute
pnpm install
```
**What it does:**
- Audits all package.json for TypeScript versions
- Sets all to 5.5.4
- Adds pnpm override to root package.json
- Fixes bar-manager-app dependencies

**Task 2: Workspace Dependencies (2h)**
```bash
./scripts/phase3-tasks.sh workspace --dry-run
./scripts/phase3-tasks.sh workspace --execute
pnpm install
```
**What it does:**
- Finds all internal deps using `*` instead of `workspace:*`
- Fixes to use proper protocol
- Ensures builds work locally

#### ⚠️ P1 - High Priority (4h)

**Task 3: Admin App Consolidation (4h)**
```bash
./scripts/phase3-tasks.sh admin --dry-run
./scripts/phase3-tasks.sh admin --execute
```
**What it does:**
- Creates DEPRECATED.md in admin-app-v2
- Documents removal timeline
- Suggests archiving (manual step)

#### 📝 P2 - Standard Priority (14h)

**Task 4: Stray Files (2h) - MANUAL**
- Create `@easymo/media-utils` package
- Create `@easymo/ai-core` package
- Migrate `services/audioUtils.ts` → `packages/media-utils/src/audio.ts`
- Migrate `services/gemini.ts` → `packages/ai-core/src/providers/gemini.ts`
- Update imports everywhere

**Task 5: Jest → Vitest (8h) - SEMI-AUTOMATED**
```bash
# For each service:
npx tsx scripts/migration/jest-to-vitest.ts --target=services/wallet-service --dry-run
npx tsx scripts/migration/jest-to-vitest.ts --target=services/wallet-service
# Then manually create vitest.config.ts
```
Services: wallet-service (3h), profile-service (2h), ranking-service (1h), bar-manager-app (2h)

**Task 6: ESLint Zero Warnings (6h) - SEMI-AUTOMATED**
```bash
node scripts/count-console-logs.js
npx tsx scripts/codemod/replace-console.ts --dry-run
# Review and apply fixes
pnpm lint
```

#### 🧹 Phase 4: Cleanup (11h)

**Task 7: Root Cleanup (3h)**
```bash
./scripts/phase3-tasks.sh cleanup --dry-run
./scripts/phase3-tasks.sh cleanup --execute
```
**What it does:**
- Moves 40+ session files to `docs/sessions/`
- Moves roadmaps to `docs/roadmaps/`
- Moves architecture to `docs/architecture/`
- Archives orphaned files to `.archive/`

**Task 8: Observability (5h) - MANUAL**
- Complete `scripts/audit/observability-compliance.ts`
- Run audit and fix violations
- Add to CI

**Task 9: CI/CD Updates (3h) - MANUAL**
- Add TypeScript version check
- Add workspace deps check
- Add console.log detection
- Add observability compliance

## Execution Timeline

### Week 1: P0 + P1 (6 hours)
```bash
# Monday-Tuesday: P0 tasks (4h)
./scripts/phase3-tasks.sh typescript --execute
pnpm install
./scripts/phase3-tasks.sh workspace --execute
pnpm install && pnpm build

# Wednesday: P1 task (2h)
./scripts/phase3-tasks.sh admin --execute

# Verify everything builds
pnpm build
```

### Week 2: P2 Tasks (16 hours)
```bash
# Monday: Stray files (2h) - manual
# Create packages, migrate files

# Tuesday-Wednesday: Jest → Vitest (8h)
# Migrate wallet, profile, ranking services

# Thursday-Friday: ESLint (6h)
# Replace console.log, fix warnings
pnpm lint  # Should have 0 warnings
```

### Week 3: Phase 4 (11 hours)
```bash
# Monday: Root cleanup (3h)
./scripts/phase3-tasks.sh cleanup --execute
git add docs/ .archive/
git commit -m "chore: reorganize documentation"

# Tuesday-Wednesday: Observability (5h)
npx tsx scripts/audit/observability-compliance.ts
# Fix violations

# Thursday: CI/CD (3h)
# Update workflows
```

## Progress Tracking

The master script (`scripts/execute-phase3-4.sh`) creates `.phase3-progress.txt` to track completion:

```bash
# View progress
cat .phase3-progress.txt

# Resume from where you left off
./scripts/execute-phase3-4.sh
```

## Safety Features

### Dry Run Mode
All scripts support `--dry-run` to preview changes without modifying files:
```bash
./scripts/phase3-tasks.sh all --dry-run
```

### Progress Persistence
State is saved between runs. If a task fails:
1. Fix the issue
2. Re-run the script
3. It will resume from the failed task

### Git-Friendly
Each major task completion should be committed:
```bash
git add -A
git commit -m "feat: complete TypeScript alignment"
git push
```

## Troubleshooting

### "Command not found: jq"
```bash
# macOS
brew install jq

# Linux
sudo apt-get install jq
```

### "pnpm install fails"
```bash
# Clear cache and retry
rm -rf node_modules pnpm-lock.yaml
pnpm install --frozen-lockfile
```

### "TypeScript errors after alignment"
```bash
# Rebuild shared packages first
pnpm --filter @va/shared build
pnpm --filter @easymo/commons build
pnpm build
```

### "Workspace protocol not working"
Make sure pnpm-workspace.yaml includes all packages:
```yaml
packages:
  - services/*
  - packages/*
  - admin-app
  - apps/*
```

## Success Criteria

### Phase 3 Complete ✅ When:
- [ ] TypeScript 5.5.4 everywhere
- [ ] All workspace deps use `workspace:*`
- [ ] admin-app-v2 deprecated
- [ ] No stray files in services/
- [ ] All services use Vitest
- [ ] Zero ESLint warnings
- [ ] All console.log replaced

### Phase 4 Complete ✅ When:
- [ ] Root has <10 files
- [ ] All session docs in docs/sessions/
- [ ] 100% observability compliance
- [ ] CI enforces all standards

## Estimated Completion

- **Fast track** (full-time): 5 days
- **Part-time** (4h/day): 9 days
- **Leisurely** (2h/day): 17 days

## Next Steps After Completion

1. **Deploy to staging**
   ```bash
   git checkout -b phase3-4-complete
   git push origin phase3-4-complete
   # Create PR and merge to main
   ```

2. **Monitor CI**
   - All checks should pass
   - No new warnings
   - Build times should be similar

3. **Update documentation**
   - Mark Phase 3&4 as complete
   - Update README with new structure
   - Document new standards

4. **Team communication**
   - Announce completion
   - Share new standards
   - Update development guides

## Support

If you encounter issues:
1. Check troubleshooting section above
2. Review `.phase3-progress.txt` for last completed task
3. Run failed task in `--dry-run` mode to see what would change
4. Check git status to see what was modified

## Files Reference

### Created by this implementation:
- `PHASE_3_4_EXECUTION_PLAN.md` - Master plan
- `scripts/execute-phase3-4.sh` - Orchestrator
- `scripts/phase3-tasks.sh` - Task runner
- `PHASE_3_4_START_HERE.md` - This file

### To be created during execution:
- `.phase3-progress.txt` - Progress tracker
- `docs/sessions/` - Moved session files
- `docs/roadmaps/` - Moved roadmaps
- `docs/architecture/` - Architecture docs
- `.archive/orphaned/` - Orphaned files
- `admin-app-v2/DEPRECATED.md` - Deprecation notice

---

**Ready to start?**

```bash
# Begin with P0 tasks
chmod +x scripts/phase3-tasks.sh
./scripts/phase3-tasks.sh typescript --dry-run
```

Good luck! 🚀
