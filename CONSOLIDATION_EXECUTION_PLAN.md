# EasyMO Consolidation: Phase 1 Execution Plan

**Status:** 🚀 Ready to Execute  
**Branch:** `consolidation-phase1-migrations`  
**Priority:** P0 - CRITICAL (Data Integrity Risk)  
**Estimated Time:** 2-3 hours  
**Risk Level:** Medium (with rollback plan)

---

## 📋 Pre-Execution Checklist

- [x] Executive summary validated
- [x] Repository structure analyzed
- [x] Migration audit completed (487 files across 9 folders)
- [x] Consolidation scripts created
- [x] Current branch: `consolidation-phase1-migrations`
- [ ] Team notification sent
- [ ] Database backup confirmed
- [ ] Staging environment ready

---

## 🎯 Phase 1 Objectives

### Primary Goal
**Consolidate 9 migration folders → 1 canonical folder**

### Success Criteria
1. ✅ Single migration folder: `supabase/migrations/`
2. ✅ 44 canonical migrations preserved
3. ✅ 443 files archived to separate branch
4. ✅ No data loss
5. ✅ CI/CD pipelines updated

---

## 📊 Current State Analysis

### Migration Folders (9 folders, 487 files)

| Folder | Files | Size | Status | Action |
|--------|-------|------|--------|--------|
| `supabase/migrations/` | 44 | Core | ✅ KEEP | Canonical |
| `supabase/migrations/ibimina/` | 121 | Large | ⚠️ ARCHIVE | Ibimina-specific |
| `supabase/migrations/phased/` | 1 | Small | 🟡 ARCHIVE | Phase migrations |
| `supabase/migrations/_disabled/` | 7 | Small | 🟡 ARCHIVE | Disabled |
| `supabase/migrations/backup_20251114_104454/` | 281 | Huge | 🔴 ARCHIVE | Backup |
| `supabase/migrations-deleted/` | 11 | Small | 🟡 ARCHIVE | Deleted |
| `supabase/migrations-fixed/` | 12 | Small | 🟡 ARCHIVE | Fixed |
| `supabase/migrations__archive/` | 2 | Tiny | 🟡 ARCHIVE | Archive |
| `migrations/` | 8 | Medium | ⚠️ ARCHIVE | Root level |

**Total to archive:** 443 files in 8 folders

---

## 🚀 Execution Steps

### Step 1: Run Migration Audit (COMPLETED ✅)

```bash
cd /Users/jeanbosco/workspace/easymo
bash scripts/consolidation/audit-migrations.sh
```

**Result:**
- ✅ Audit complete
- ✅ Report: `.consolidation-audit/migrations-20251210-222359/audit-report.md`
- ✅ No duplicate migration names found

### Step 2: Run Consolidation Script

```bash
bash scripts/consolidation/consolidate-migrations.sh
```

**What it does:**
1. Creates `migration-archive` branch (orphan)
2. Adds 8 folders (443 files) to archive branch
3. Commits archive with full audit report
4. Returns to `consolidation-phase1-migrations` branch
5. Removes archived folders from current branch
6. Creates `MIGRATION_CONSOLIDATION.md` summary

**Expected Output:**
```
✅ Consolidation complete!

📊 Results:
- Canonical migrations: supabase/migrations/ (44 files)
- Archived folders: 8 folders (443 files)
- Archive branch: migration-archive
```

### Step 3: Verify Consolidation

```bash
# Check canonical migrations
ls -1 supabase/migrations/*.sql | wc -l  # Should be: 44

# Check folders removed
ls supabase/migrations/ibimina/  # Should error: No such file

# Check archive branch exists
git branch | grep migration-archive  # Should show: migration-archive
```

### Step 4: Update CI/CD Configuration

**File:** `.github/workflows/ci.yml`

```yaml
# Before:
- name: Validate migrations
  run: find supabase/migrations* -name "*.sql"

# After:
- name: Validate migrations
  run: find supabase/migrations -maxdepth 1 -name "*.sql"
```

**Files to update:**
- `.github/workflows/ci.yml`
- `.github/workflows/validate.yml`
- `Makefile` (if references migration folders)
- `README.md` (documentation)

### Step 5: Update Documentation

**Create:** `docs/migrations/MIGRATION_POLICY.md`

```markdown
# Migration Policy

## Canonical Location
All migrations MUST be in: `supabase/migrations/`

## Naming Convention
`YYYYMMDDHHMMSS_description.sql`

## Archived Migrations
Historical migrations are in the `migration-archive` branch.

Access with:
\`\`\`bash
git checkout migration-archive
\`\`\`
```

### Step 6: Commit and Push

```bash
# Add all changes
git add -A

# Commit
git commit -m "refactor(migrations): Consolidate to single canonical folder

BREAKING CHANGE: Migration folders consolidated

- Consolidated 9 folders → 1 canonical folder
- Kept: supabase/migrations/ (44 files)
- Archived: 443 files to migration-archive branch
- Risk mitigation: Full archive in separate branch

Closes #ISSUE_NUMBER

Details:
- Total migration folders before: 9
- Total migration folders after: 1 (-89%)
- Canonical migrations: 44 files
- Archived migrations: 443 files (migration-archive branch)
- Schema validation: No duplicate names found

References:
- Executive Summary: Technical Debt Analysis
- Audit Report: .consolidation-audit/ (in archive branch)
- Archive Branch: migration-archive"

# Push changes
git push origin consolidation-phase1-migrations
git push origin migration-archive
```

---

## ⚠️ Risk Management

### High Risks

#### Risk 1: Schema Drift
**Probability:** Low  
**Impact:** Critical  
**Mitigation:**
- Audit confirmed no duplicate names
- Archive branch preserves all files
- Can restore any archived migration

**Rollback:**
```bash
git checkout migration-archive -- supabase/migrations/ibimina
git checkout migration-archive -- migrations
```

#### Risk 2: CI/CD Failures
**Probability:** Medium  
**Impact:** High  
**Mitigation:**
- Update CI/CD before deploying
- Test on staging first
- Feature flag new migration path

**Rollback:**
```bash
git revert HEAD
git push origin consolidation-phase1-migrations --force
```

#### Risk 3: Lost Context
**Probability:** Low  
**Impact:** Medium  
**Mitigation:**
- Full audit report in archive branch
- Consolidation summary document
- Git history preserved

---

## 🧪 Testing Plan

### Pre-Deployment Tests

1. **Build Test:**
```bash
pnpm --filter @va/shared build
pnpm --filter @easymo/commons build
pnpm build
```

2. **Lint Test:**
```bash
pnpm lint
```

3. **Migration Validation:**
```bash
supabase db push --dry-run
```

### Staging Deployment

1. Deploy to staging
2. Run migrations
3. Verify schema integrity
4. Check application functionality

### Production Deployment

1. ✅ Staging validated
2. Schedule maintenance window
3. Database backup confirmed
4. Deploy migrations
5. Monitor error rates
6. Rollback if errors > 0.1%

---

## 📈 Success Metrics

| Metric | Before | Target | Status |
|--------|--------|--------|--------|
| Migration Folders | 9 | 1 | 🔄 In Progress |
| Total SQL Files | 487 | 44 | 🔄 In Progress |
| Schema Conflicts | Unknown | 0 | ✅ Validated |
| CI/CD Complexity | High | Low | 🔄 Pending |
| Deployment Time | ~5min | ~2min | 🔄 TBD |

---

## 🗓️ Timeline

### Today (2025-12-10)
- [x] **22:00-22:30** - Run audit script
- [ ] **22:30-23:00** - Run consolidation script
- [ ] **23:00-23:30** - Update CI/CD and docs
- [ ] **23:30-24:00** - Commit and create PR

### Tomorrow (2025-12-11)
- [ ] **09:00-10:00** - Team review
- [ ] **10:00-12:00** - Staging deployment
- [ ] **14:00-16:00** - Production deployment

---

## 📞 Communication Plan

### Team Notification

**Subject:** 🚨 CRITICAL: Migration Consolidation (Phase 1)

**Body:**
```
Team,

We're executing Phase 1 of the consolidation plan: Migration Folder Consolidation.

WHAT'S HAPPENING:
- 9 migration folders → 1 canonical folder
- 443 files archived to migration-archive branch
- 44 canonical migrations preserved

IMPACT:
- Migration path changes
- CI/CD updates required
- No data loss (full archive preserved)

TIMELINE:
- Today: Consolidation and PR
- Tomorrow: Staging test and production deploy

ROLLBACK:
- Full rollback plan documented
- Archive branch preserves all files

Details: See CONSOLIDATION_EXECUTION_PLAN.md

Questions? DM me or comment on PR #XXX
```

---

## 📚 References

- **Audit Report:** `.consolidation-audit/migrations-20251210-222359/audit-report.md`
- **Consolidation Script:** `scripts/consolidation/consolidate-migrations.sh`
- **Executive Summary:** Technical Debt Analysis (user-provided)
- **Archive Branch:** `migration-archive`

---

## ✅ Post-Execution Checklist

- [ ] Consolidation script completed successfully
- [ ] Migration count verified (44 canonical)
- [ ] Archive branch created and pushed
- [ ] CI/CD configuration updated
- [ ] Documentation updated
- [ ] PR created with detailed description
- [ ] Team notified
- [ ] Staging deployment scheduled
- [ ] Production deployment scheduled

---

## 🆘 Emergency Contacts

**If issues arise:**
1. Stop execution immediately
2. Document the issue
3. Run rollback commands
4. Notify team
5. Schedule retrospective

---

**Next Phase:** Package Consolidation (UI, Localization, Config)  
**Estimated Start:** Week of 2025-12-16
