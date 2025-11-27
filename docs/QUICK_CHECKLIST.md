# Phase 3-4 Quick Implementation Checklist

**Use this for quick reference during implementation**

## 🚀 Quick Commands

```bash
# 1. WORKSPACE DEPS (15min) - Run first
bash scripts/phase3-quick-start.sh --dry-run

# 2. ROOT CLEANUP (30min) - Makes repo navigable  
bash scripts/maintenance/cleanup-root-directory.sh --dry-run
# If looks good:
bash scripts/maintenance/cleanup-root-directory.sh

# 3. TYPESCRIPT CHECK (5min)
find . -name "package.json" -not -path "*/node_modules/*" -exec grep -H '"typescript"' {} \; | grep -v "5.5.4"

# 4. CONSOLE.LOG BASELINE (2min)
grep -r "console\.log" services/ packages/ admin-app/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l

# 5. BUILD DEPS (10min) - Critical!
pnpm --filter @va/shared build && pnpm --filter @easymo/commons build && pnpm --filter @easymo/ui build

# 6. LINT (5min)
pnpm lint 2>&1 | tee lint-baseline.txt
```

## ✅ Task Checklist

### Phase 3A: Foundation (1-2 hours)
- [ ] Workspace dependencies verified
- [ ] TypeScript 5.5.4 confirmed everywhere
- [ ] Root directory cleaned (40+ files moved)
- [ ] Shared packages built
- [ ] Lint baseline captured
- [ ] Console.log count baseline

### Phase 3B: Code Quality (8-12 hours)
- [ ] Console.log → structured logging (automated)
- [ ] wallet-service: Jest → Vitest
- [ ] profile-service: Jest → Vitest  
- [ ] ranking-service: Jest → Vitest
- [ ] bar-manager-app: Add tests
- [ ] ESLint warnings → 0
- [ ] Fix `any` types

### Phase 3C: Reorganization (2-4 hours)
- [ ] audioUtils.ts → packages/media-utils
- [ ] gemini.ts → packages/ai-core
- [ ] admin-app-v2 archived (if needed)
- [ ] Update imports across codebase

### Phase 4: Documentation & CI (6-8 hours)
- [ ] Security audit (.env.example)
- [ ] Observability compliance audit
- [ ] CI: Add workspace deps check
- [ ] CI: Add TypeScript version check
- [ ] CI: Add console.log detection
- [ ] CI: Add observability check
- [ ] Update docs

## 📊 Current State (Baseline)

| Metric | Value |
|--------|-------|
| Console.log count | _run step 4_ |
| Lint warnings | _run step 6_ |
| TypeScript version | 5.5.4 (override set) |
| Test framework | Mixed (Jest/Vitest) |
| Admin apps | 1 active, 1 deprecated |
| Root clutter files | ~40 |

## 🎯 Success Metrics (Target)

| Metric | Target |
|--------|--------|
| Console.log count | 0 |
| Lint warnings | 0 |
| TypeScript version | 5.5.4 (all packages) |
| Test framework | Vitest (100%) |
| Admin apps | 1 active |
| Root clutter files | 5 (essential only) |

## 🚨 Before You Start

1. **Commit current work:**
   ```bash
   git status
   git add .
   git commit -m "checkpoint: before phase 3-4 implementation"
   ```

2. **Create branch:**
   ```bash
   git checkout -b feat/phase-3-4-implementation
   ```

3. **Backup .env:**
   ```bash
   cp .env .env.backup.$(date +%Y%m%d)
   ```

## 📝 After Each Step

```bash
# Quick git checkpoint
git add .
git commit -m "phase3: [step name] complete"
```

## 🔗 Full Docs

- Full plan: `docs/DETAILED_IMPLEMENTATION_PLAN.md` (from your input)
- Current status: `docs/PHASE_3_4_CURRENT_STATUS.md`
- Step-by-step: `docs/START_IMPLEMENTATION_NOW.md`

## ⚡ Emergency Rollback

```bash
# If something breaks
git log --oneline -10  # find commit before you started
git reset --hard <commit-sha>

# Or just abort current
git checkout main
git branch -D feat/phase-3-4-implementation
```

---

**Start now:** `cat docs/START_IMPLEMENTATION_NOW.md`
