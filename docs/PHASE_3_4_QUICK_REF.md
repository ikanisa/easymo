# Phase 3 & 4 - QUICK REFERENCE CARD

## 🚀 One-Page Cheat Sheet

### Start Here (5 minutes)
```bash
cd /Users/jeanbosco/workspace/easymo-
bash scripts/phase0-blockers.sh
```

---

## 📊 Task Overview

| ID | Task | Time | Command |
|----|------|------|---------|
| **P0-1** | TypeScript 5.5.4 | 2h | `node scripts/verify/typescript-versions.js` |
| **P0-2** | Workspace Deps | 2h | `bash scripts/verify/workspace-deps.sh` |
| **P1-1** | Admin Consolidation | 4h | Manual |
| **P2-1** | Stray Files | 2h | Manual |
| **P2-2** | Jest→Vitest | 8h | `npx tsx scripts/migration/jest-to-vitest.ts` |
| **P2-3** | ESLint Zero | 6h | `pnpm lint:fix` + manual |
| **P1-2** | Root Cleanup | 3h | `bash scripts/maintenance/cleanup-root-directory.sh` |
| **P1-3** | Observability | 5h | `npx tsx scripts/audit/observability-compliance.ts` |
| **P2-4** | CI/CD | 3h | Manual edits to `.github/workflows/` |

**Total:** 33 hours

---

## 🔥 Critical Path

```
P0-1 (TypeScript) → P0-2 (Workspace) → Phase 3 → Phase 4
         ↓                ↓                ↓          ↓
    MUST PASS       MUST PASS      High Priority  Medium Priority
```

**⚠️ Cannot skip P0!**

---

## ✅ Quick Verification

### Phase 0 Complete?
```bash
node scripts/verify/typescript-versions.js && \
bash scripts/verify/workspace-deps.sh && \
pnpm install && \
pnpm run build:deps && \
echo "✅ P0 COMPLETE"
```

### Phase 3 Complete?
```bash
pnpm lint && \
pnpm test && \
[ ! -d "admin-app-v2" ] && \
echo "✅ Phase 3 COMPLETE"
```

### Phase 4 Complete?
```bash
[ $(find . -maxdepth 1 -type f -name "*.md" | wc -l) -lt 15 ] && \
npx tsx scripts/audit/observability-compliance.ts && \
echo "✅ Phase 4 COMPLETE"
```

---

## 🛠️ Essential Commands

### Diagnostics
```bash
# What needs doing?
bash scripts/analyze-phase3.sh --dry-run

# TypeScript versions
node scripts/verify/typescript-versions.js

# Workspace deps
bash scripts/verify/workspace-deps.sh

# ESLint status
pnpm lint 2>&1 | grep -E "(warning|error)"
```

### Fixes
```bash
# TypeScript alignment
pnpm add -D -w typescript@5.5.4 && pnpm install

# Workspace deps (manual in package.json):
# "*" → "workspace:*"

# ESLint auto-fix
pnpm lint:fix

# Replace console.log
bash scripts/maintenance/replace-console-logs.sh

# Root cleanup
bash scripts/maintenance/cleanup-root-directory.sh
```

### Migration
```bash
# Jest → Vitest (per service)
npx tsx scripts/migration/jest-to-vitest.ts --target=services/wallet-service --dry-run
npx tsx scripts/migration/jest-to-vitest.ts --target=services/wallet-service
```

### Verification
```bash
# Full build
pnpm run build:deps && pnpm run build

# Tests
pnpm test

# Type check
pnpm run type-check

# Lint
pnpm lint
```

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `docs/PHASE_3_4_START_HERE.md` | Full instructions |
| `docs/IMPLEMENTATION_STATUS.md` | Progress tracker |
| `docs/PHASE_3_4_EXECUTIVE_SUMMARY.md` | Overview |
| `scripts/phase0-blockers.sh` | P0 automated check |
| `scripts/analyze-phase3.sh` | Phase 3 analysis |
| `scripts/verify/typescript-versions.js` | TS audit |
| `scripts/verify/workspace-deps.sh` | Workspace check |

---

## 🎯 Success Criteria

### Phase 0
- [x] TS 5.5.4 everywhere
- [x] `workspace:*` protocol
- [x] pnpm install works
- [x] Build succeeds

### Phase 3
- [ ] One admin-app
- [ ] Vitest standard
- [ ] Zero ESLint warnings
- [ ] No console.log

### Phase 4
- [ ] Root <15 files
- [ ] 100% observability
- [ ] CI checks added

---

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| pnpm install fails | Check P0-1 and P0-2 first |
| Build fails | Run `build:deps` first |
| Tests fail after migration | Check vitest.config.ts paths |
| ESLint errors persist | Some need manual review |
| Scripts not executable | Run `chmod +x scripts/**/*.sh` |

---

## 📝 Commit Strategy

```bash
# After each major task:
git add -A
git commit -m "feat: [task description]"

# Example commits:
git commit -m "feat: align TypeScript to 5.5.4"
git commit -m "feat: fix workspace dependencies"
git commit -m "feat: migrate wallet-service to Vitest"
git commit -m "feat: achieve ESLint zero warnings"
git commit -m "feat: cleanup root directory"
```

---

## 🔄 Rollback

```bash
# If something breaks:
git stash                    # Save current work
git checkout main            # Back to stable

# Or revert last commit:
git revert HEAD

# Or revert specific commit:
git revert <commit-hash>
```

---

## 📞 Help

**Stuck?**
1. Re-read `docs/PHASE_3_4_START_HERE.md`
2. Check `docs/GROUND_RULES.md`
3. Review error messages carefully
4. Use `--dry-run` flags to preview

**Key Principle:** Small steps, frequent commits, continuous verification

---

## ⏱️ Time Estimates

| Phase | Minimum | Typical | Maximum |
|-------|---------|---------|---------|
| P0 | 2h | 4h | 6h |
| Phase 3 | 12h | 18h | 24h |
| Phase 4 | 8h | 11h | 14h |
| **Total** | **22h** | **33h** | **44h** |

**Recommended:** 2-3 weeks, 2-3 hours/day

---

## 🎯 Priority if Time-Limited

1. **P0-1, P0-2** (MUST)
2. **P2-2, P2-3** (SHOULD)
3. **P1-2, P1-3** (NICE)

Minimum viable: P0 + ESLint = 10 hours

---

**Ready? Run this:**
```bash
cd /Users/jeanbosco/workspace/easymo- && bash scripts/phase0-blockers.sh
```
