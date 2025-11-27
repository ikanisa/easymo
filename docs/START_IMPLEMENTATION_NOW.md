# Phase 3-4 Implementation: Immediate Next Steps

**Priority Level:** P0 (Blocking)  
**Estimated Time:** 2-4 hours  
**Date:** 2025-11-27

---

## 🎯 What to Do Right Now

Execute these tasks in order. Each has been prepared with scripts and can be run safely.

---

## Step 1: Workspace Dependencies Check (15 min) [P0]

**Purpose:** Ensure all internal dependencies use `workspace:*` protocol  
**Risk:** Low (read-only check)  
**Blocking:** Build consistency

```bash
# Check current state (included in phase3-quick-start.sh)
bash scripts/phase3-quick-start.sh --dry-run

# Or manually check
find . -name "package.json" -not -path "*/node_modules/*" | while read pkg; do
  jq -r '(.dependencies // {}) + (.devDependencies // {}) | to_entries[] | select(.key | startswith("@easymo/") or startswith("@va/")) | select(.value | test("^workspace:") | not) | "\($pkg): \(.key) = \(.value)"' "$pkg" 2>/dev/null
done
```

**Expected Outcome:** List of packages needing workspace:* fix

**If Issues Found:**
```bash
# Fix manually in each package.json:
# Change: "@easymo/commons": "*"
# To:     "@easymo/commons": "workspace:*"
```

---

## Step 2: Root Directory Cleanup (30 min) [P1]

**Purpose:** Move 40+ session files out of root  
**Risk:** Low (files moved, not deleted)  
**Impact:** Much cleaner repository

```bash
# Dry run first to see what would be moved
bash scripts/maintenance/cleanup-root-directory.sh --dry-run

# Review the output, then run for real
bash scripts/maintenance/cleanup-root-directory.sh

# Verify
ls -la | grep -E "\.md|\.txt" | head -20
```

**Expected Outcome:**
- Root has only: README.md, CONTRIBUTING.md, CHANGELOG.md, QUICKSTART.md
- All session files in docs/sessions/
- Architecture in docs/architecture/
- Orphaned files in .archive/

---

## Step 3: TypeScript Version Audit (15 min) [P0]

**Purpose:** Ensure TypeScript 5.5.4 everywhere  
**Risk:** Low (version check only)

```bash
# Find all TypeScript versions
find . -name "package.json" -not -path "*/node_modules/*" -exec grep -H '"typescript"' {} \; | grep -v "5.5.4" | grep -v "workspace:*"

# Expected: Should be empty or very few
# Root package.json already has override: "typescript": "5.5.4"
```

**If Issues Found:**
```bash
# For each package with wrong version:
cd services/wallet-service  # example
pnpm add -D typescript@5.5.4
```

---

## Step 4: Count Console.log Usage (5 min)

**Purpose:** Baseline before cleanup  
**Risk:** None (read-only)

```bash
# Count console.log statements
echo "Counting console.log usage..."
grep -r "console\.log" services/ packages/ admin-app/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l

# Get breakdown by directory
echo -e "\nBy directory:"
grep -r "console\.log" services/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l | xargs echo "services/:"
grep -r "console\.log" packages/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l | xargs echo "packages/:"
grep -r "console\.log" admin-app/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l | xargs echo "admin-app/:"

# Save baseline
grep -r "console\.log" services/ packages/ admin-app/ --include="*.ts" --include="*.tsx" 2>/dev/null > compliance-baseline.txt
echo "Baseline saved to compliance-baseline.txt"
```

---

## Step 5: Build Shared Packages (10 min) [Critical]

**Purpose:** Ensure dependencies are built before testing  
**Risk:** Low (standard build)

```bash
# Build in correct order
pnpm --filter @va/shared build
pnpm --filter @easymo/commons build
pnpm --filter @easymo/ui build

# Verify
ls -la packages/shared/dist
ls -la packages/commons/dist
ls -la packages/ui/dist
```

---

## Step 6: Run Lint (5 min)

**Purpose:** Establish current baseline of warnings  
**Risk:** None (read-only)

```bash
# Run lint and capture output
pnpm lint 2>&1 | tee lint-baseline.txt

# Count warnings
grep -c "warning" lint-baseline.txt || echo "0 warnings"
```

---

## Step 7: Generate Status Report (5 min)

**Purpose:** Document current state  
**Risk:** None

```bash
# Create implementation status
cat > docs/IMPLEMENTATION_STATUS_$(date +%Y%m%d).md << 'EOF'
# Implementation Status - $(date +%Y-%m-%d)

## Completed
- [x] Workspace dependency check
- [x] Root directory cleanup  
- [x] TypeScript version audit
- [x] Console.log baseline
- [x] Shared packages built
- [x] Lint baseline

## Metrics
- Console.log count: $(grep -r "console\.log" services/ packages/ admin-app/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
- Lint warnings: $(grep -c "warning" lint-baseline.txt 2>/dev/null || echo "0")
- TypeScript version: 5.5.4 (enforced via override)
- Admin apps: 1 active, 1 deprecated

## Next Steps
1. Fix workspace dependencies (if any found)
2. Replace console.log with structured logging
3. Migrate Jest to Vitest (3 services)
4. Achieve zero ESLint warnings

EOF
```

---

## ✅ Success Criteria

After completing these steps, you should have:

- [ ] Clear understanding of workspace dependency issues (if any)
- [ ] Clean root directory (only 4-5 MD files)
- [ ] Confirmed TypeScript 5.5.4 everywhere
- [ ] Baseline count of console.log usage
- [ ] All shared packages built successfully
- [ ] Lint baseline documented
- [ ] Status report generated

---

## 🚨 If Something Goes Wrong

### Cleanup script moved wrong files?
```bash
# Files are moved, not deleted - can restore
git checkout -- <file-path>
```

### Build failures?
```bash
# Clean and rebuild
pnpm clean  # if script exists
rm -rf node_modules packages/*/dist
pnpm install --frozen-lockfile
pnpm --filter @va/shared build && pnpm --filter @easymo/commons build
```

### Workspace dependency errors?
```bash
# Revert changes
git diff package.json  # review
git checkout -- package.json  # if needed
```

---

## 📊 Time Estimate Breakdown

| Step | Time | Type |
|------|------|------|
| Workspace deps check | 15 min | Verification |
| Root cleanup | 30 min | Reorganization |
| TypeScript audit | 15 min | Verification |
| Console.log count | 5 min | Metrics |
| Build shared | 10 min | Build |
| Lint baseline | 5 min | Verification |
| Status report | 5 min | Documentation |
| **TOTAL** | **85 min** | **~1.5 hours** |

---

## 🔄 After This Session

Once these are complete, next session will focus on:

1. **Console.log Replacement** (3-4 hours)
   - Automated codemod
   - Manual review
   - Testing

2. **Jest → Vitest Migration** (6-8 hours)
   - wallet-service
   - profile-service
   - ranking-service

3. **CI/CD Updates** (2 hours)
   - Add new checks
   - Update workflows

---

## 📁 Files Created by This Session

- `compliance-baseline.txt` - Console.log usage baseline
- `lint-baseline.txt` - Current lint output
- `docs/IMPLEMENTATION_STATUS_YYYYMMDD.md` - Status report
- `docs/sessions/*.md` - Moved session files
- `.archive/orphaned/*` - Moved orphaned files

---

**Ready to start?** Begin with Step 1 above. Each step is safe and reversible.
