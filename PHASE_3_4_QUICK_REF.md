# Phase 3 & 4 - Quick Reference Card

## 📌 Files Created

| File | Purpose |
|------|---------|
| `START_PHASE_3_4_HERE.md` | **Read this first** - Quick start guide |
| `PHASE_3_4_IMPLEMENTATION_GUIDE.md` | Detailed instructions with all code |
| `PHASE_3_4_STATUS.md` | Status dashboard & checklists |
| This file | Quick command reference |

---

## ⚡ Super Quick Start

```bash
# 1. Read the start guide
cat START_PHASE_3_4_HERE.md

# 2. Run automated check
bash scripts/phase3-quick-start.sh --dry-run

# 3. Start with P0 tasks
# See detailed commands below
```

---

## 🎯 Critical Commands (P0 - Do First!)

### Check TypeScript Versions
```bash
grep -r '"typescript"' --include="package.json" | grep -v node_modules | grep -v "5.5.4"
```

### Fix TypeScript
```bash
pnpm add -D -w typescript@5.5.4
pnpm type-check
```

### Check Workspace Deps
```bash
bash scripts/verify/workspace-deps.sh
```

### Fix Workspace Deps
```bash
bash scripts/verify/workspace-deps.sh --fix
pnpm install --frozen-lockfile
pnpm build:deps
```

---

## 🔧 Essential Commands

### Build Pipeline
```bash
pnpm install --frozen-lockfile  # Fresh install
pnpm build:deps                 # Build shared packages first
pnpm build                      # Build main app
pnpm test                       # Run tests
pnpm lint                       # Check code quality
```

### Verification
```bash
bash scripts/verify/workspace-deps.sh              # Workspace protocol
npx tsx scripts/audit/observability-compliance.ts  # Observability
pnpm lint 2>&1 | tee lint-baseline.txt            # Lint baseline
```

### Search & Find
```bash
# Find Jest packages
find . -name "package.json" -exec grep -l '"jest"' {} \; | grep services

# Find console.log
grep -r "console\.log(" services/ packages/ --include="*.ts" --exclude-dir=node_modules

# Find any types
grep -rn ": any" services/ packages/ --include="*.ts" --exclude-dir=node_modules

# Find TypeScript versions
grep -r '"typescript"' --include="package.json" | grep -v node_modules
```

---

## 📋 Task Quick Links

### P0: Critical (4h)
1. TypeScript alignment → `PHASE_3_4_IMPLEMENTATION_GUIDE.md` Task 3.1
2. Workspace deps → `PHASE_3_4_IMPLEMENTATION_GUIDE.md` Task 3.2

### P1: Code Quality (18h)
3. Admin consolidation → `PHASE_3_4_IMPLEMENTATION_GUIDE.md` Task 3.3
4. Stray files → `PHASE_3_4_IMPLEMENTATION_GUIDE.md` Task 3.4
5. Jest→Vitest → `PHASE_3_4_IMPLEMENTATION_GUIDE.md` Task 3.5
6. ESLint zero → `PHASE_3_4_IMPLEMENTATION_GUIDE.md` Task 3.6

### P2: Documentation (11h)
7. Root cleanup → `PHASE_3_4_IMPLEMENTATION_GUIDE.md` Task 4.1
8. Observability → `PHASE_3_4_IMPLEMENTATION_GUIDE.md` Task 4.2
9. CI/CD → `PHASE_3_4_IMPLEMENTATION_GUIDE.md` Task 4.3

---

## ✅ Success Checklist

```bash
# All these should pass:
pnpm install --frozen-lockfile  # ✅
pnpm build:deps                 # ✅
pnpm build                      # ✅
pnpm lint                       # ✅ 0 warnings
pnpm test                       # ✅ All passing
bash scripts/verify/workspace-deps.sh  # ✅ Exit 0
```

---

## 🚨 Emergency Rollback

```bash
# Restore everything
git restore .

# Or revert last commit
git revert HEAD

# Clean install
rm -rf node_modules pnpm-lock.yaml
pnpm install --frozen-lockfile
```

---

## 📊 Progress Tracking

Edit `PHASE_3_4_STATUS.md` to check off completed tasks.

---

## 🎯 What to Do Right Now

1. **Read**: `START_PHASE_3_4_HERE.md` (5 min)
2. **Check**: Run `pnpm lint` to see baseline
3. **Start**: P0 Task 3.1 (TypeScript alignment)
4. **Track**: Mark progress in `PHASE_3_4_STATUS.md`

---

## 📞 Need Help?

1. Check the implementation guide for detailed steps
2. Review docs/GROUND_RULES.md for requirements
3. Check .github/copilot-instructions.md for build commands

---

## 🎓 Key Learnings

- **Workspace protocol**: Always use `workspace:*` for internal deps
- **TypeScript**: Keep versions aligned across monorepo
- **Testing**: Vitest is the standard (except Deno edge functions)
- **Logging**: No console.log, use structured logging
- **CI**: Automated checks prevent issues

---

**Ready to start? → Read `START_PHASE_3_4_HERE.md` next!**
