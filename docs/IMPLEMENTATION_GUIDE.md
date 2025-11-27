# Phase 3-4 Implementation Guide

**READ THIS FIRST** - Complete step-by-step implementation instructions

---

## 📋 What This Document Contains

1. **Immediate Actions** - What to do right now
2. **Step-by-Step Instructions** - Detailed execution guide
3. **Verification Steps** - How to confirm success
4. **Troubleshooting** - Common issues and fixes

---

## 🎯 Immediate Actions (Start Here)

### Prerequisites Check

```bash
# 1. Verify you're in the repo root
pwd
# Should show: /Users/jeanbosco/workspace/easymo-

# 2. Check git status
git status
# Commit any work in progress

# 3. Create working branch
git checkout -b feat/phase-3-4-implementation

# 4. Verify pnpm
pnpm --version
# Should be >= 8.0.0
```

---

## 📊 Step 1: Baseline Assessment (10 minutes)

### 1.1 Check Workspace Dependencies

```bash
# Run the checker
node scripts/check-workspace-deps.js

# Expected output:
# - Either: "✅ All workspace dependencies use correct protocol!"
# - Or: List of packages needing fixes
```

**If issues found:**
Edit each package.json manually:
```json
{
  "dependencies": {
-   "@easymo/commons": "*",
+   "@easymo/commons": "workspace:*",
  }
}
```

### 1.2 Count Console.log Usage

```bash
# Run the counter
node scripts/count-console-logs.js

# This creates: console-log-baseline.json
# Shows current usage to track progress
```

### 1.3 TypeScript Version Check

```bash
# Quick check
find . -name "package.json" \
  -not -path "*/node_modules/*" \
  -not -path "*/.archive/*" \
  -exec grep -H '"typescript"' {} \; \
  | grep -v "5.5.4" \
  | grep -v "workspace:*"

# Should return nothing or very few results
# Root package.json has override set to 5.5.4
```

### 1.4 Build Shared Packages

```bash
# Critical: Build dependencies first
pnpm --filter @va/shared build
pnpm --filter @easymo/commons build
pnpm --filter @easymo/ui build
pnpm --filter @easymo/video-agent-schema build

# Verify builds
ls -la packages/shared/dist
ls -la packages/commons/dist
ls -la packages/ui/dist
```

### 1.5 Capture Lint Baseline

```bash
# Run lint and save output
pnpm lint 2>&1 | tee lint-baseline.txt

# Count warnings
grep -c "warning" lint-baseline.txt || echo "0"
```

---

## 📁 Step 2: Root Directory Cleanup (30 minutes)

### 2.1 Review Cleanup Script

```bash
# View what will be moved
cat scripts/maintenance/cleanup-root-directory.sh

# Dry run first
bash scripts/maintenance/cleanup-root-directory.sh --dry-run

# Review the output carefully
# Files are MOVED not DELETED
```

### 2.2 Execute Cleanup

```bash
# Run for real
bash scripts/maintenance/cleanup-root-directory.sh

# Verify results
ls -1 *.md | head -20
# Should only see: README.md, CONTRIBUTING.md, CHANGELOG.md, QUICKSTART.md

# Check sessions directory
ls -1 docs/sessions/ | wc -l
# Should show ~40 files

# Check archive
ls -1 .archive/orphaned/
# Should show: App.tsx, index.tsx, types.ts (if they existed)
```

### 2.3 Commit Cleanup

```bash
git add .
git commit -m "phase3: cleanup root directory - move session files to docs/"
```

---

## 🔧 Step 3: Fix Workspace Dependencies (15 minutes)

**Only needed if Step 1.1 found issues**

### 3.1 Fix Each Package

For each package flagged in Step 1.1:

```bash
# Example: Fix admin-app
cd admin-app
# Edit package.json manually
# Change all @easymo/* and @va/* deps to use workspace:*

# Or use sed (Mac):
sed -i '' 's/"@easymo\/\([^"]*\)": "\*"/"@easymo\/\1": "workspace:*"/g' package.json
sed -i '' 's/"@va\/\([^"]*\)": "\*"/"@va\/\1": "workspace:*"/g' package.json

cd ..
```

### 3.2 Verify Fix

```bash
# Re-run checker
node scripts/check-workspace-deps.js
# Should now show: ✅ All workspace dependencies use correct protocol!
```

### 3.3 Commit

```bash
git add .
git commit -m "phase3: fix workspace dependencies - use workspace:* protocol"
```

---

## 📝 Step 4: Generate Status Report (5 minutes)

```bash
# Create status report
cat > docs/IMPLEMENTATION_STATUS_$(date +%Y%m%d).md << 'EOFSTATUS'
# Phase 3-4 Implementation Status

**Date:** $(date +%Y-%m-%d)
**Branch:** feat/phase-3-4-implementation

## Completed ✅

1. **Baseline Assessment**
   - Workspace dependencies: $(node scripts/check-workspace-deps.js > /dev/null 2>&1 && echo "PASS" || echo "ISSUES FOUND")
   - Console.log count: $(cat console-log-baseline.json | grep totalCount | awk '{print $2}' | tr -d ',')
   - TypeScript version: 5.5.4 (enforced)
   - Lint warnings: $(grep -c "warning" lint-baseline.txt 2>/dev/null || echo "0")

2. **Root Directory Cleanup**
   - Files moved: ~40
   - Session files: docs/sessions/
   - Orphaned files: .archive/orphaned/

3. **Workspace Dependencies**
   - Status: Fixed (if issues found in step 3)

## Next Steps ⏭️

1. **Console.log Replacement** (3-4 hours)
   - Use structured logging from @easymo/commons
   - Target: 0 console.log calls

2. **Test Framework Migration** (6-8 hours)
   - wallet-service: Jest → Vitest
   - profile-service: Jest → Vitest
   - ranking-service: Jest → Vitest

3. **ESLint Zero Warnings** (2-3 hours)
   - Fix remaining warnings
   - Enable strict rules

4. **Observability Audit** (4-6 hours)
   - Correlation IDs
   - PII masking
   - Structured logging compliance

## Metrics 📊

| Metric | Baseline | Target |
|--------|----------|--------|
| Console.log | $(cat console-log-baseline.json | grep totalCount | awk '{print $2}' | tr -d ',') | 0 |
| Lint warnings | $(grep -c "warning" lint-baseline.txt 2>/dev/null || echo "0") | 0 |
| Root MD files | ~45 | 4-5 |
| Test framework | Mixed | 100% Vitest |

EOFSTATUS

cat docs/IMPLEMENTATION_STATUS_$(date +%Y%m%d).md
```

---

## ✅ Step 5: Verification Checklist

Run through this checklist to confirm everything is working:

```bash
# 1. Workspace dependencies pass
node scripts/check-workspace-deps.js
# Expected: ✅ All workspace dependencies use correct protocol!

# 2. Root is clean
ls -1 *.md | wc -l
# Expected: 4-5 files

# 3. Builds work
pnpm run build:deps
# Expected: All builds succeed

# 4. Lint runs
pnpm lint
# Expected: May have warnings but should complete

# 5. Tests pass
pnpm test
# Expected: Most tests pass (some may fail, that's OK for now)

# 6. Git status clean
git status
# Expected: Nothing uncommitted (all changes committed)
```

---

## 🚨 Troubleshooting

### Build Failures

```bash
# Clean and rebuild
rm -rf node_modules
rm -rf packages/*/dist
rm -rf packages/*/node_modules
pnpm install --frozen-lockfile
pnpm run build:deps
```

### Workspace Dependency Errors

```bash
# Check pnpm version
pnpm --version
# Should be >= 8.0.0

# Update if needed
npm install -g pnpm@latest

# Re-install
rm -rf node_modules
pnpm install --frozen-lockfile
```

### Cleanup Script Issues

```bash
# If files moved incorrectly, restore from git
git checkout -- <file-path>

# Or reset all cleanup
git checkout -- .
bash scripts/maintenance/cleanup-root-directory.sh
```

---

## 📊 Success Criteria

After completing these steps, you should have:

- [x] Baseline metrics captured
- [x] Root directory organized (only 4-5 .md files)
- [x] Workspace dependencies verified
- [x] Shared packages built
- [x] Status report generated
- [x] All changes committed

**Total time:** ~1.5 hours

---

## 🔜 What's Next?

See the following documents for next phases:

1. **Console.log Replacement**
   - Automated codemod approach
   - Manual replacement guide
   - Testing strategy

2. **Jest to Vitest Migration**
   - Service-by-service guide
   - Test migration script
   - Verification steps

3. **ESLint & Observability**
   - Strict linting rules
   - Observability compliance audit
   - CI/CD integration

---

## 📞 Need Help?

- Review `docs/PHASE_3_4_CURRENT_STATUS.md` for current state
- Check `docs/QUICK_CHECKLIST.md` for quick commands
- See `DETAILED_IMPLEMENTATION_PLAN.md` for complete context

---

**Current Step:** Run the verification checklist above ☝️
