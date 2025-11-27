# EasyMO Implementation Plan - Next Steps
**Updated:** 2025-11-27 20:30 UTC
**Current Phase:** Phase 3 - Code Quality & Standardization

## 🎯 Immediate Actions (Next 2 Hours)

### 1. Fix Workspace Dependencies (Priority: P1, Time: 1 hour)

**Why:** Ensures consistent package resolution and prevents version conflicts.

```bash
# 1. Check current state
cd /Users/jeanbosco/workspace/easymo-
bash scripts/verify/workspace-deps.sh

# 2. Fix packages automatically
npx tsx scripts/migration/fix-workspace-deps.ts

# Or manually update each package.json:
# Find: "@easymo/commons": "*"
# Replace: "@easymo/commons": "workspace:*"

# 3. Verify fix
pnpm install --frozen-lockfile
bash scripts/verify/workspace-deps.sh
# Should output: ✅ All workspace dependencies use correct protocol
```

**Files to Update:**
- `admin-app/package.json`
- `bar-manager-app/package.json`
- `services/*/package.json`
- `packages/*/package.json`

---

### 2. Run Observability Compliance Check (Priority: P1, Time: 15 min)

```bash
# Get baseline
npx tsx scripts/audit/observability-compliance.ts > compliance-current.txt

# Review non-compliant files
cat compliance-current.txt

# Compare with previous baseline
diff compliance-baseline.txt compliance-current.txt
```

**Expected Output:** List of files with:
- Missing structured logging
- console.log usage
- No correlation IDs

---

### 3. Start Console.log Replacement (Priority: P2, Time: 45 min)

```bash
# Dry run first to see changes
npx tsx scripts/codemod/replace-console.ts --target=services/wallet-service --dry-run

# Apply to one service
npx tsx scripts/codemod/replace-console.ts --target=services/wallet-service

# Test the change
cd services/wallet-service
pnpm test
pnpm lint

# If successful, continue with other services
```

---

## 📅 This Week (Phase 3 Completion)

### Tuesday-Wednesday: Code Quality (8 hours)

**Task 3.5: Fix Workspace Dependencies**
- [x] Verification script exists
- [ ] Run check on all packages
- [ ] Update package.json files
- [ ] Add to CI pipeline
- [ ] Documentation updated

**Task 3.6: Achieve Zero ESLint Warnings**
- [ ] Update ESLint config (error on warnings)
- [ ] Replace console.log (50 files)
- [ ] Fix any type violations
- [ ] Add pre-commit hook
- [ ] CI verification

### Thursday: Test Framework Migration (8 hours)

**Migrate Jest → Vitest:**
1. wallet-service (2 hours)
2. profile service (2 hours)
3. bar-manager-app (add tests, 2 hours)
4. Update CI workflows (1 hour)
5. Verification (1 hour)

**Steps per service:**
```bash
# 1. Run migration script
npx tsx scripts/migration/jest-to-vitest.ts --target=services/<service-name>

# 2. Create vitest.config.ts (use template from vitest.shared.ts)

# 3. Update package.json
# "test": "jest" → "test": "vitest run"

# 4. Update dependencies
pnpm remove jest @types/jest ts-jest
pnpm add -D vitest @vitest/ui

# 5. Test
pnpm test
```

### Friday: TypeScript & Cleanup (4 hours)

**Task 3.4: TypeScript Version Alignment**
```bash
# Enforce 5.5.4 everywhere
jq '.devDependencies.typescript = "5.5.4"' package.json > tmp.json && mv tmp.json package.json

# Add pnpm override (already in root package.json)
# "pnpm": { "overrides": { "typescript": "5.5.4" } }

# Rebuild
pnpm install
pnpm build
```

**Verification:**
```bash
# Check all packages use 5.5.4
find . -name "package.json" -not -path "*/node_modules/*" -exec grep -H "typescript" {} \;
```

---

## 📊 Week 4: Phase 4 - Documentation & Cleanup

### Monday: Root Directory Cleanup (4 hours)

```bash
# Dry run first
bash scripts/maintenance/cleanup-root-directory.sh --dry-run

# Apply cleanup
bash scripts/maintenance/cleanup-root-directory.sh

# Verify
git status
# Review moved files before committing
```

**Expected Moves:**
- Session notes → `docs/sessions/`
- Architecture diagrams → `docs/architecture/diagrams/`
- Scripts → `scripts/{deploy,verify,test,checks}/`
- Orphaned files → `.archive/orphaned/`

### Tuesday: Security & Observability (4 hours)

**Security Audit:**
```bash
# Check environment files
bash scripts/security/audit-env-files.sh

# Fix any exposed secrets
# Update .env.example with placeholder values only
```

**Observability Verification:**
```bash
# Final compliance check
npx tsx scripts/audit/observability-compliance.ts

# Target: 100% compliance
# Fix remaining non-compliant files
```

### Wednesday: CI/CD Updates (2 hours)

**Update `.github/workflows/ci.yml`:**
```yaml
- name: Verify Workspace Dependencies
  run: bash scripts/verify/workspace-deps.sh

- name: Check Observability Compliance
  run: npx tsx scripts/audit/observability-compliance.ts

- name: Security Audit
  run: bash scripts/security/audit-env-files.sh
```

### Thursday-Friday: Documentation & Final Verification (4 hours)

1. Update README.md
2. Consolidate documentation
3. Create production readiness checklist
4. Final testing
5. Deployment preparation

---

## 🛠️ Helper Scripts Reference

### Created & Ready to Use

| Script | Purpose | Usage |
|--------|---------|-------|
| `scripts/verify/workspace-deps.sh` | Check workspace:* protocol | `bash scripts/verify/workspace-deps.sh` |
| `scripts/audit/observability-compliance.ts` | Check observability | `npx tsx scripts/audit/observability-compliance.ts` |
| `scripts/security/audit-env-files.sh` | Security audit | `bash scripts/security/audit-env-files.sh` |
| `scripts/migration/jest-to-vitest.ts` | Migrate tests | `npx tsx scripts/migration/jest-to-vitest.ts --target=<path>` |
| `scripts/codemod/replace-console.ts` | Replace console.log | `npx tsx scripts/codemod/replace-console.ts --target=<path>` |
| `scripts/maintenance/cleanup-root-directory.sh` | Clean root | `bash scripts/maintenance/cleanup-root-directory.sh` |

### To Be Created

| Script | Purpose | Priority |
|--------|---------|----------|
| `scripts/migration/fix-workspace-deps.ts` | Auto-fix workspace deps | High |
| `scripts/checks/pre-commit.sh` | Pre-commit validation | Medium |
| `scripts/deploy/production-checklist.sh` | Pre-deploy validation | High |

---

## 📈 Success Metrics

### Phase 3 Targets (This Week)
- [ ] Zero ESLint warnings
- [ ] 100% workspace:* protocol usage
- [ ] All services on Vitest (except Edge = Deno)
- [ ] TypeScript 5.5.4 everywhere
- [ ] No console.log in services

### Phase 4 Targets (Next Week)
- [ ] Root directory < 20 files
- [ ] 90%+ observability compliance
- [ ] All secrets in .env.example are placeholders
- [ ] CI includes all verification checks
- [ ] Documentation consolidated

---

## 🚨 Blockers & Risks

### Current Blockers
- None identified

### Risks
1. **Test Migration Breakage** (Medium)
   - Mitigation: Test one service at a time, use automation script
   
2. **Console.log Replacement Volume** (Medium)
   - Mitigation: Use codemod, prioritize services over UI

3. **Workspace Dep Conflicts** (Low)
   - Mitigation: Test build after each package update

---

## 📚 Documentation Updates Needed

### High Priority
- [ ] Update QUICK_START.md with new scripts
- [ ] Update GROUND_RULES.md with enforcement
- [ ] Create OBSERVABILITY_COMPLIANCE.md

### Medium Priority
- [ ] Update ARCHITECTURE.md
- [ ] Consolidate session notes
- [ ] Archive old documentation

---

## 🔄 Daily Workflow

### Morning (9:00-12:00)
1. Pull latest: `git pull origin main`
2. Build shared packages: `pnpm --filter @va/shared build && pnpm --filter @easymo/commons build`
3. Run tests: `pnpm test`
4. Pick task from Phase 3 Quick Action Guide

### Afternoon (13:00-17:00)
1. Implement task
2. Test changes: `pnpm lint && pnpm test && pnpm build`
3. Run relevant verification scripts
4. Commit: `git commit -m "refactor: <description>"`
5. Push and monitor CI

### Evening (Optional)
1. Review PR feedback
2. Update documentation
3. Plan next day

---

## 🎯 Quick Decision Tree

**Q: Should I fix workspace dependencies first?**
A: YES - This is P1 and blocks other work.

**Q: Can I skip console.log replacement?**
A: NO - Required for observability compliance (ground rules).

**Q: Do I need to migrate all tests to Vitest?**
A: Edge Functions use Deno Test (keep), everything else → Vitest.

**Q: What's the minimum for Phase 3 completion?**
A: All 6 tasks must be completed (see Phase 3 Status doc).

---

## 📞 Getting Help

### Stuck on a task?
1. Check existing scripts in `scripts/` directory
2. Review `docs/GROUND_RULES.md`
3. Check `compliance-baseline.txt` for examples
4. Ask the team

### CI Failing?
1. Check `.github/workflows/ci.yml`
2. Review recent commits
3. Test locally: `pnpm lint && pnpm test && pnpm build`
4. Check logs in GitHub Actions

---

**Next Review:** 2025-11-28 09:00 UTC
**Owner:** Development Team
**Status:** Phase 3 - 43% Complete
