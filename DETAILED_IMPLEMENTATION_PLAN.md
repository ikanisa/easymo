# EasyMO - Detailed Implementation Plan
**Version:** 3.0 (Complete & Actionable)  
**Date:** 2025-11-27  
**Status:** Ready for Execution  
**Total Remaining Effort:** ~33 hours (2 weeks at 20h/week)

---

## 📊 EXECUTIVE SUMMARY

### Overall Progress
- **Phase 1-2 (Security & Infrastructure):** ✅ 90% Complete
- **Phase 3 (Code Quality):** 🟡 25% Complete (22 hours remaining)
- **Phase 4 (Documentation & Cleanup):** ❌ 5% Complete (11 hours remaining)

### Critical Path Items (Must Do First)
1. ✅ TypeScript version alignment (BLOCKING other tasks)
2. ✅ Workspace dependency verification (BLOCKING builds)
3. ⚠️ Admin app consolidation (BLOCKING CI/CD)
4. ⚠️ Jest → Vitest migration (BLOCKING test standardization)

---

## 🎯 PHASE 3: CODE QUALITY & STANDARDIZATION

### 3.1 TypeScript Version Alignment [P0 - BLOCKING]
**Status:** 🟡 50% Complete  
**Priority:** P0 (MUST DO FIRST)  
**Time:** 2 hours  
**Owner:** Build Engineer

#### Current State
```bash
# ✅ Root has TypeScript 5.5.4
# ❌ Some packages may deviate
# ❌ bar-manager-app not aligned
# ❌ No enforcement in CI
```

#### Implementation Steps

**Step 1: Audit Current Versions (15 min)**
```bash
# Check all TypeScript versions
find . -name "package.json" -not -path "*/node_modules/*" \
  -exec grep -H "\"typescript\"" {} \; > /tmp/ts-versions.txt

# Show non-5.5.4 versions
cat /tmp/ts-versions.txt | grep -v "5.5.4"

# Check installed versions
pnpm ls typescript --depth=Infinity | grep -v "5.5.4"
```

**Step 2: Update Root package.json (15 min)**
```bash
cd /Users/jeanbosco/workspace/easymo-

# Edit package.json to add/verify pnpm overrides
cat > /tmp/ts-override.json << 'EOF'
{
  "pnpm": {
    "overrides": {
      "typescript": "5.5.4"
    }
  }
}
EOF

# Merge into package.json (manual or with jq)
```

**Step 3: Fix bar-manager-app (30 min)**
```bash
cd bar-manager-app

# Update package.json
pnpm add -D typescript@5.5.4

# Verify
grep "typescript" package.json
# Should show: "typescript": "5.5.4"

# Test build
pnpm run type-check
```

**Step 4: Reinstall Everything (30 min)**
```bash
cd /Users/jeanbosco/workspace/easymo-

# Clean install
rm -rf node_modules
rm -rf services/*/node_modules
rm -rf packages/*/node_modules
rm -rf apps/*/node_modules

pnpm install --frozen-lockfile

# Verify NO other versions
pnpm ls typescript | grep -v "5.5.4" || echo "✅ All aligned"
```

**Step 5: Add CI Check (15 min)**
```bash
# Edit .github/workflows/ci.yml
# Add after "pnpm install" step:
```

```yaml
- name: Verify TypeScript Version
  run: |
    echo "Checking TypeScript versions..."
    WRONG_VERSIONS=$(pnpm ls typescript --depth=Infinity | grep -v "5.5.4" | grep -v "^$" || true)
    if [ -n "$WRONG_VERSIONS" ]; then
      echo "❌ Found packages with wrong TypeScript version:"
      echo "$WRONG_VERSIONS"
      exit 1
    fi
    echo "✅ All packages use TypeScript 5.5.4"
```

#### Acceptance Criteria
- [ ] All packages show TypeScript 5.5.4
- [ ] bar-manager-app builds successfully
- [ ] CI fails if wrong version detected
- [ ] pnpm-lock.yaml updated

#### Deliverables
1. Updated root package.json with overrides
2. Fixed bar-manager-app dependencies
3. CI check added
4. Documentation in CONTRIBUTING.md

---

### 3.2 Workspace Dependencies Verification [P0 - BLOCKING]
**Status:** ❌ 0% Complete  
**Priority:** P0 (MUST DO FIRST)  
**Time:** 2 hours  
**Owner:** Build Engineer

#### Current State
```bash
# Some packages use "*" instead of "workspace:*"
# Example:
# "@easymo/commons": "*"  ❌ WRONG
# "@easymo/commons": "workspace:*"  ✅ CORRECT
```

#### Implementation Steps

**Step 1: Create Verification Script (45 min)**
```bash
# Create scripts/verify/workspace-deps.sh
cat > scripts/verify/workspace-deps.sh << 'EOFSCRIPT'
#!/bin/bash
set -euo pipefail

echo "🔍 Verifying workspace dependencies..."

PACKAGES=$(find . -name "package.json" \
  -not -path "*/node_modules/*" \
  -not -path "*/.archive/*" \
  -not -path "*/dist/*")

ERRORS=0
WARNINGS=0

for pkg in $PACKAGES; do
  PKG_DIR=$(dirname "$pkg")
  PKG_NAME=$(jq -r '.name // "unnamed"' "$pkg")
  
  # Check dependencies
  BAD_DEPS=$(jq -r '
    ((.dependencies // {}) + (.devDependencies // {})) | 
    to_entries[] | 
    select(.key | startswith("@easymo/") or startswith("@va/")) | 
    select(.value | test("^workspace:") | not) | 
    "\(.key): \(.value)"
  ' "$pkg" 2>/dev/null || true)
  
  if [ -n "$BAD_DEPS" ]; then
    echo "❌ $PKG_NAME ($pkg)"
    echo "$BAD_DEPS" | sed 's/^/   /'
    echo ""
    ERRORS=$((ERRORS + 1))
  fi
done

echo ""
if [ $ERRORS -gt 0 ]; then
  echo "❌ Found $ERRORS packages with incorrect workspace dependencies"
  echo ""
  echo "Fix by changing:"
  echo '  "@easymo/pkg": "*"        (WRONG)'
  echo '  "@easymo/pkg": "workspace:*"  (CORRECT)'
  exit 1
fi

echo "✅ All workspace dependencies use correct protocol"
EOFSCRIPT

chmod +x scripts/verify/workspace-deps.sh
```

**Step 2: Run Audit (15 min)**
```bash
# Find all violations
bash scripts/verify/workspace-deps.sh > /tmp/workspace-violations.txt 2>&1 || true

# Review
cat /tmp/workspace-violations.txt
```

**Step 3: Fix Violations (45 min)**
```bash
# Auto-fix with sed or manual edit
# For each violation, update package.json

# Example fix for admin-app/package.json:
cd admin-app
jq '.dependencies |= with_entries(
  if (.key | startswith("@easymo/") or startswith("@va/")) 
  then .value = "workspace:*" 
  else . 
  end
) | .devDependencies |= with_entries(
  if (.key | startswith("@easymo/") or startswith("@va/")) 
  then .value = "workspace:*" 
  else . 
  end
)' package.json > package.json.tmp && mv package.json.tmp package.json

# Repeat for all violated packages
```

**Step 4: Reinstall & Verify (15 min)**
```bash
cd /Users/jeanbosco/workspace/easymo-

pnpm install

# Verify fix
bash scripts/verify/workspace-deps.sh
# Should show: ✅ All workspace dependencies use correct protocol
```

**Step 5: Add to CI (15 min)**
```yaml
# .github/workflows/ci.yml
- name: Verify Workspace Dependencies
  run: bash scripts/verify/workspace-deps.sh
```

#### Acceptance Criteria
- [ ] Verification script runs without errors
- [ ] All internal deps use `workspace:*`
- [ ] CI fails on violations
- [ ] pnpm install succeeds

#### Deliverables
1. scripts/verify/workspace-deps.sh
2. All package.json files fixed
3. CI check added
4. Documentation updated

---

### 3.3 Admin App Consolidation [P1]
**Status:** 🟡 40% Complete  
**Priority:** P1  
**Time:** 4 hours  
**Owner:** Frontend Lead

#### Current State
```
✅ admin-app-v2 marked DEPRECATED
✅ DEPRECATED.md created
❌ Features not analyzed
❌ Migration not executed
❌ CI still builds admin-app-v2
❌ pnpm-workspace still includes it
```

#### Implementation Steps

**Step 1: Feature Comparison Analysis (2 hours)**
```bash
# Run comparison script (already exists)
npx tsx scripts/migration/merge-admin-apps.ts --dry-run > /tmp/admin-comparison.txt

# Manual review of differences
diff -qr admin-app/components admin-app-v2/components | tee /tmp/component-diff.txt
diff -qr admin-app/app admin-app-v2/app | tee /tmp/app-diff.txt
diff -qr admin-app/lib admin-app-v2/lib | tee /tmp/lib-diff.txt

# Check for unique features in v2
echo "=== Unique files in admin-app-v2 ===" > /tmp/unique-features.txt
find admin-app-v2 -type f -name "*.tsx" -o -name "*.ts" | while read file; do
  RELATIVE=${file#admin-app-v2/}
  if [ ! -f "admin-app/$RELATIVE" ]; then
    echo "$file" >> /tmp/unique-features.txt
  fi
done

# Review
cat /tmp/unique-features.txt
```

**Decision Matrix:**
```markdown
| Feature | admin-app | admin-app-v2 | Decision |
|---------|-----------|--------------|----------|
| Tauri Desktop | ✅ | ❌ | Keep admin-app |
| Sentry | ✅ | ❌ | Keep admin-app |
| Shared packages | ✅ | ❌ | Keep admin-app |
| React Query | ✅ | ❌ | Keep admin-app |
| Unique components | ? | ? | INVESTIGATE |

**Action:** IF admin-app-v2 has NO unique critical features → DELETE
**Action:** IF admin-app-v2 has unique features → MIGRATE then DELETE
```

**Step 2: Update pnpm-workspace.yaml (15 min)**
```bash
# Remove admin-app-v2 from workspace
cat pnpm-workspace.yaml

# Edit to comment out or remove:
# packages:
#   - services/*
#   - packages/*
#   - admin-app
#   # - admin-app-v2  # DEPRECATED 2025-11-27
```

**Step 3: Update CI/CD (45 min)**
```bash
# .github/workflows/admin-app-ci.yml
# Remove any references to admin-app-v2

# Or delete workflow if it's dedicated to v2
# mv .github/workflows/admin-app-v2-ci.yml .archive/workflows/
```

**Step 4: Archive (Physical Removal) (1 hour)**
```bash
# ONLY AFTER feature comparison confirms safe to delete
mkdir -p .archive/deprecated-apps
git mv admin-app-v2 .archive/deprecated-apps/admin-app-v2

# Commit
git add .
git commit -m "chore: archive deprecated admin-app-v2

- Feature comparison completed
- No unique critical features found
- All functionality available in admin-app
- CI/CD updated
- pnpm-workspace.yaml updated

See .archive/deprecated-apps/admin-app-v2/DEPRECATED.md for migration history"

# Verify build still works
pnpm install
pnpm --filter @easymo/admin-app build
```

#### Acceptance Criteria
- [ ] Feature comparison documented
- [ ] Decision matrix completed
- [ ] pnpm-workspace.yaml updated
- [ ] CI no longer builds admin-app-v2
- [ ] admin-app builds successfully
- [ ] All tests pass

#### Deliverables
1. Feature comparison document
2. Updated pnpm-workspace.yaml
3. Updated CI workflows
4. Git commit archiving admin-app-v2

---

### 3.4 Relocate Stray Service Files [P2]
**Status:** ❌ 0% Complete  
**Priority:** P2  
**Time:** 2 hours  
**Owner:** Backend Developer

#### Files to Migrate
1. `services/audioUtils.ts` → `packages/media-utils/src/audio.ts`
2. `services/gemini.ts` → `packages/ai-core/src/providers/gemini.ts`

#### Implementation Steps

**Step 1: Check if files exist (5 min)**
```bash
ls -la services/audioUtils.ts 2>/dev/null || echo "audioUtils.ts not found"
ls -la services/gemini.ts 2>/dev/null || echo "gemini.ts not found"

# If files don't exist, SKIP this task
```

**Step 2: Create media-utils package (45 min)**
```bash
# Only if audioUtils.ts exists

mkdir -p packages/media-utils/src
mkdir -p packages/media-utils/test

# Copy and refactor
cp services/audioUtils.ts packages/media-utils/src/audio.ts

# Create package.json (use template from implementation plan)
cat > packages/media-utils/package.json << 'EOF'
{
  "name": "@easymo/media-utils",
  "version": "1.0.0",
  "description": "Media processing utilities for EasyMO platform",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsup src/index.ts --format esm,cjs --dts",
    "dev": "tsup src/index.ts --format esm,cjs --dts --watch",
    "test": "vitest run",
    "lint": "eslint src/"
  },
  "dependencies": {},
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "5.5.4",
    "vitest": "^3.2.4"
  }
}
EOF

# Create index.ts
cat > packages/media-utils/src/index.ts << 'EOF'
export * from './audio';
EOF

# Build
cd packages/media-utils
pnpm install
pnpm build
```

**Step 3: Update imports (30 min)**
```bash
# Find all imports
grep -r "from.*audioUtils" services/ packages/ apps/ --include="*.ts" > /tmp/audio-imports.txt

# For each file, update import:
# FROM: import { ... } from '../audioUtils'
# TO:   import { ... } from '@easymo/media-utils'

# Example sed replacement (verify before running):
# find services packages apps -type f -name "*.ts" -exec \
#   sed -i '' "s|from ['\"].*audioUtils['\"]|from '@easymo/media-utils'|g" {} \;
```

**Step 4: Migrate gemini.ts (similar process, 30 min)**

**Step 5: Remove old files & verify (15 min)**
```bash
# Archive first
mkdir -p .archive/services-stray
cp services/audioUtils.ts .archive/services-stray/ 2>/dev/null || true
cp services/gemini.ts .archive/services-stray/ 2>/dev/null || true

# Delete
rm services/audioUtils.ts 2>/dev/null || true
rm services/gemini.ts 2>/dev/null || true

# Build everything
pnpm build

# Test
pnpm test
```

#### Acceptance Criteria
- [ ] New packages created and built
- [ ] All imports updated
- [ ] Old files removed
- [ ] All tests pass
- [ ] CI passes

#### Deliverables
1. @easymo/media-utils package (if needed)
2. Updated imports across codebase
3. Removed stray files
4. Updated pnpm-workspace.yaml

---

### 3.5 Test Framework Standardization [P2]
**Status:** 🟡 30% Complete  
**Priority:** P2  
**Time:** 8 hours  
**Owner:** QA Engineer

#### Current State
```
✅ Vitest: admin-app, agent-core, broker-orchestrator
❌ Jest: wallet-service, profile-service, ranking-service
❌ No tests: bar-manager-app
```

#### Implementation Steps

**Step 1: wallet-service Migration (3 hours)**
```bash
cd services/wallet-service

# 1.1 Check current tests
ls -la __tests__/ test/ *.test.ts *.spec.ts 2>/dev/null

# 1.2 Install Vitest
pnpm add -D vitest @vitest/ui vite

# 1.3 Run migration script
npx tsx ../../scripts/migration/jest-to-vitest.ts \
  --target=services/wallet-service \
  > /tmp/wallet-migration.log 2>&1

# Review changes
cat /tmp/wallet-migration.log

# 1.4 Create vitest.config.ts
cat > vitest.config.ts << 'EOF'
import { defineConfig, mergeConfig } from 'vitest/config';
import { nodeConfig } from '../../vitest.shared';
import path from 'path';

export default mergeConfig(nodeConfig, defineConfig({
  test: {
    root: __dirname,
    coverage: {
      thresholds: {
        global: {
          statements: 90,
          branches: 85,
          functions: 90,
          lines: 90
        }
      }
    },
    testTimeout: 30000,
    hookTimeout: 30000
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  }
}));
EOF

# 1.5 Update package.json
# Remove: jest, @types/jest, ts-jest, jest.config.js
# Update scripts:
jq '.scripts.test = "vitest run" | 
    .scripts["test:watch"] = "vitest" |
    .scripts["test:ui"] = "vitest --ui"' package.json > package.json.tmp
mv package.json.tmp package.json

# Remove Jest config
rm jest.config.js 2>/dev/null || true
rm jest.config.ts 2>/dev/null || true

# 1.6 Run tests
pnpm test

# 1.7 Fix any failures
# (Manual process - fix imports, mocks, etc.)
```

**Step 2: profile-service Migration (2 hours)**
```bash
# Same process as wallet-service, but:
# - Lower coverage thresholds (70%)
# - Simpler service, fewer edge cases
```

**Step 3: ranking-service Migration (1 hour)**
```bash
# Same process, fastest migration
```

**Step 4: bar-manager-app Add Tests (2 hours)**
```bash
cd bar-manager-app

# 4.1 Install Vitest
pnpm add -D vitest @vitest/ui @vitejs/plugin-react jsdom

# 4.2 Create vitest.config.ts
cat > vitest.config.ts << 'EOF'
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts']
  }
});
EOF

# 4.3 Create test setup
mkdir -p test
cat > test/setup.ts << 'EOF'
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(() => {
  cleanup();
});
EOF

# 4.4 Write first test
mkdir -p __tests__/components
cat > __tests__/components/sample.test.tsx << 'EOF'
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('Sample Test', () => {
  it('should pass', () => {
    expect(true).toBe(true);
  });
});
EOF

# 4.5 Update package.json
jq '.scripts.test = "vitest run"' package.json > package.json.tmp
mv package.json.tmp package.json

# 4.6 Run
pnpm test
```

**Step 5: Verify No Jest Remains (15 min)**
```bash
# Check for Jest configs
find . -name "jest.config.*" -not -path "*/node_modules/*"
# Should be empty

# Check package.json scripts
grep -r "jest" services/*/package.json packages/*/package.json
# Should be empty (except @types/jest in devDeps)

# Check for Jest imports in code
grep -r "from ['\"]jest" services/ packages/ --include="*.ts"
# Should be empty
```

#### Acceptance Criteria
- [ ] All services use Vitest
- [ ] No jest.config.* files remain
- [ ] All tests pass
- [ ] Coverage thresholds met
- [ ] CI uses Vitest

#### Deliverables
1. Migrated test suites
2. Updated package.json files
3. vitest.config.ts for each service
4. CI workflow updated

---

### 3.6 ESLint Zero Warnings [P2]
**Status:** 🟡 20% Complete  
**Priority:** P2  
**Time:** 6 hours  
**Owner:** All Developers

#### Current State
```
✅ ESLint config updated to error on warnings
✅ Console replacement script created
❌ Console.log still in code (not executed)
❌ `any` types still present
❌ Missing return types
```

#### Implementation Steps

**Step 1: Count Current Issues (15 min)**
```bash
# Console.log count
echo "=== console.log usage ===" > /tmp/lint-baseline.txt
grep -r "console\.log" services/ packages/ apps/ --include="*.ts" --include="*.tsx" | \
  wc -l >> /tmp/lint-baseline.txt

# Any types count
echo "=== any types ===" >> /tmp/lint-baseline.txt
grep -r ": any\b" services/ packages/ apps/ --include="*.ts" --include="*.tsx" | \
  wc -l >> /tmp/lint-baseline.txt

# ESLint warnings
echo "=== ESLint baseline ===" >> /tmp/lint-baseline.txt
pnpm lint 2>&1 | tee -a /tmp/lint-baseline.txt

cat /tmp/lint-baseline.txt
```

**Step 2: Replace console.log (3 hours)**
```bash
# 2.1 Dry run first
chmod +x scripts/maintenance/replace-console-logs.sh
./scripts/maintenance/replace-console-logs.sh --dry-run | tee /tmp/console-replacement-plan.txt

# Review plan
less /tmp/console-replacement-plan.txt

# 2.2 Execute (BACKUP FIRST!)
git add .
git commit -m "chore: backup before console.log replacement"

./scripts/maintenance/replace-console-logs.sh

# 2.3 Review changes
git diff

# 2.4 Fix compilation errors
pnpm build 2>&1 | tee /tmp/build-errors.txt

# 2.5 Fix errors manually
# Common issues:
# - Missing log import
# - Incorrect log method (info vs error)
# - Context data not properly structured

# 2.6 Test
pnpm test
```

**Step 3: Fix `any` Types (2 hours)**
```bash
# Find all any types
grep -rn ": any\b" services/ packages/ apps/ --include="*.ts" --include="*.tsx" \
  > /tmp/any-types.txt

# Review
cat /tmp/any-types.txt

# Fix strategy:
# 1. unknown (safest)
# 2. Proper type (best)
# 3. Generic constraint (good)
# 4. any (only if truly necessary, add // eslint-disable-next-line)

# Example fixes:
# ❌ function process(data: any)
# ✅ function process(data: unknown)
# ✅ function process<T>(data: T)
# ✅ function process(data: ProcessData)
```

**Step 4: Add Return Types (1 hour)**
```bash
# ESLint should now error on missing return types
pnpm lint 2>&1 | grep "return type" > /tmp/missing-returns.txt

# Fix each one:
# ❌ function getData() { return 42; }
# ✅ function getData(): number { return 42; }
# ✅ async function getData(): Promise<number> { return 42; }
```

**Step 5: Verify Zero Warnings (15 min)**
```bash
# Should show NO warnings
pnpm lint

# CI check should pass
# (CI already has max-warnings=0 in workflows)
```

#### Acceptance Criteria
- [ ] Zero console.log in production code
- [ ] No `any` types (or justified with disable comment)
- [ ] All functions have return types
- [ ] `pnpm lint` shows 0 warnings
- [ ] CI passes

#### Deliverables
1. All console.log replaced with structured logging
2. All any types fixed
3. All return types added
4. Zero ESLint warnings

---

## 🔵 PHASE 4: DOCUMENTATION & CLEANUP

### 4.1 Root Directory Cleanup [P1]
**Status:** ❌ 0% Complete  
**Priority:** P1  
**Time:** 3 hours  
**Owner:** DevOps Engineer

#### Current State
```
❌ 30+ session/status markdown files in root
❌ Orphaned source files (App.tsx, index.tsx, types.ts)
❌ Old shell scripts scattered
❌ No organized documentation structure
```

#### Target State
```
✅ docs/sessions/ (all session notes)
✅ docs/architecture/ (diagrams and architecture)
✅ docs/roadmaps/ (planning docs)
✅ .archive/orphaned/ (old source files)
✅ Clean root with only essential configs
```

#### Implementation Steps

**Step 1: Review Cleanup Script (30 min)**
```bash
# Script already exists (from implementation plan)
cat scripts/maintenance/cleanup-root-directory.sh

# Make executable
chmod +x scripts/maintenance/cleanup-root-directory.sh

# Dry run
./scripts/maintenance/cleanup-root-directory.sh --dry-run | tee /tmp/cleanup-plan.txt

# Review what will be moved
cat /tmp/cleanup-plan.txt
```

**Step 2: Execute Cleanup (1 hour)**
```bash
# Backup first
git add .
git commit -m "chore: backup before root cleanup"

# Execute
./scripts/maintenance/cleanup-root-directory.sh

# Review changes
git status
ls -la docs/sessions/
ls -la .archive/orphaned/

# Verify nothing critical was moved
ls -la | grep -E "\.(md|sh|ts|tsx|json)$"
```

**Step 3: Update References (1 hour)**
```bash
# Find any broken links in documentation
grep -r "CLIENT_PWA_" docs/ --include="*.md" | \
  grep -v "docs/sessions/" > /tmp/broken-links.txt

# Fix references
# Example:
# ❌ See CLIENT_PWA_COMPLETE.md
# ✅ See docs/sessions/CLIENT_PWA_COMPLETE.md

# Check README.md references
cat README.md | grep -E "\./(.*\.md)" | \
  while read line; do
    file=$(echo "$line" | grep -oE "\./[^)]*\.md")
    if [ -n "$file" ] && [ ! -f "$file" ]; then
      echo "Broken link: $file"
    fi
  done
```

**Step 4: Update .gitignore (30 min)**
```bash
# Add to .gitignore
cat >> .gitignore << 'EOF'

# Session-specific temporary files
*_SESSION_*.md
*_TEMP_*.md
*_WIP_*.md

# Local scripts (keep local only)
*.local.sh
EOF

# Verify
git status
git add .gitignore
git commit -m "chore: update gitignore for session files"
```

#### Acceptance Criteria
- [ ] Root has < 15 markdown files
- [ ] All session notes in docs/sessions/
- [ ] All orphaned files in .archive/
- [ ] No broken documentation links
- [ ] Updated .gitignore

#### Deliverables
1. Organized docs/ directory
2. Clean root directory
3. Archive index (docs/archive/INDEX.md)
4. Updated .gitignore

---

### 4.2 Observability Compliance Audit [P1]
**Status:** 🟡 30% Complete  
**Priority:** P1  
**Time:** 5 hours  
**Owner:** SRE Engineer

#### Current State
```
✅ Compliance script skeleton created
✅ Ground rules documented
❌ Script not complete
❌ Not executed
❌ Violations not identified
❌ Fixes not applied
```

#### Implementation Steps

**Step 1: Complete Compliance Script (2 hours)**
```bash
# Location: scripts/audit/observability-compliance.ts
# (Script template provided in implementation plan)

# Add missing checks:
# 1. PII masking patterns
# 2. Metrics recording
# 3. Health endpoints
# 4. Error handling

# Test script
npx tsx scripts/audit/observability-compliance.ts \
  --target=services/wallet-service \
  --dry-run
```

**Step 2: Run Baseline Audit (30 min)**
```bash
# Full audit
npx tsx scripts/audit/observability-compliance.ts > compliance-baseline.txt 2>&1

# Review violations
cat compliance-baseline.txt | grep "❌" | wc -l
cat compliance-baseline.txt | grep "⚠️" | wc -l

# Categorize
cat compliance-baseline.txt | grep "❌" | sort | uniq -c > /tmp/critical-violations.txt
cat /tmp/critical-violations.txt
```

**Step 3: Fix Violations (2 hours)**

**Common Violation Types:**

1. **Missing Correlation IDs**
```typescript
// ❌ BEFORE
export async function processPayment(data: PaymentData) {
  await logEvent('payment_processed', data);
}

// ✅ AFTER
export async function processPayment(
  data: PaymentData,
  correlationId: string
) {
  await logStructuredEvent('payment_processed', {
    ...data,
    correlationId,
  });
}
```

2. **PII in Logs**
```typescript
// ❌ BEFORE
log.info({ email: user.email, phone: user.phone }, 'User created');

// ✅ AFTER
log.info(
  { 
    userId: user.id,
    email: maskEmail(user.email),
    phone: maskPhone(user.phone)
  },
  'User created'
);
```

3. **Missing Health Endpoints**
```typescript
// Add to each service
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'wallet-service',
    version: process.env.APP_VERSION
  });
});
```

**Step 4: Re-audit & Verify (30 min)**
```bash
# Re-run audit
npx tsx scripts/audit/observability-compliance.ts > compliance-after-fixes.txt 2>&1

# Compare
diff compliance-baseline.txt compliance-after-fixes.txt

# Should show significant reduction in violations
```

#### Acceptance Criteria
- [ ] Compliance script complete
- [ ] All services audited
- [ ] Critical violations < 5
- [ ] All services have health endpoints
- [ ] Correlation IDs used consistently

#### Deliverables
1. Complete observability-compliance.ts script
2. Baseline audit report
3. Fixed violations
4. Updated documentation

---

### 4.3 CI/CD Enhancements [P2]
**Status:** ❌ 0% Complete  
**Priority:** P2  
**Time:** 3 hours  
**Owner:** DevOps Engineer

#### Implementation Steps

**Step 1: Add Workspace Dependency Check (30 min)**
```yaml
# .github/workflows/ci.yml
# Add after "pnpm install" step:

- name: Verify Workspace Dependencies
  run: |
    echo "Checking workspace dependencies..."
    bash scripts/verify/workspace-deps.sh
```

**Step 2: Add Observability Compliance Check (45 min)**
```yaml
# .github/workflows/ci.yml

- name: Observability Compliance
  run: |
    echo "Checking observability compliance..."
    npx tsx scripts/audit/observability-compliance.ts --ci
  continue-on-error: true  # Warning only for now
```

**Step 3: Add Console.log Check (30 min)**
```yaml
# .github/workflows/ci.yml

- name: Check for console.log
  run: |
    echo "Checking for console.log in production code..."
    LOGS=$(grep -r "console\.log" services/ packages/ apps/ \
      --include="*.ts" --include="*.tsx" \
      --exclude="*.test.ts" --exclude="*.spec.ts" \
      || true)
    if [ -n "$LOGS" ]; then
      echo "❌ Found console.log in production code:"
      echo "$LOGS"
      exit 1
    fi
    echo "✅ No console.log found"
```

**Step 4: Add TypeScript Version Check (30 min)**
```yaml
# Already covered in section 3.1
```

**Step 5: Test CI Locally (45 min)**
```bash
# Install act (GitHub Actions local runner)
brew install act  # macOS
# or: curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Run CI workflow locally
act -j build

# Fix any failures
```

#### Acceptance Criteria
- [ ] All new checks added to CI
- [ ] CI passes locally
- [ ] CI passes on GitHub
- [ ] Check failures are actionable

#### Deliverables
1. Updated .github/workflows/ci.yml
2. All checks passing
3. Documentation updated

---

## 📋 IMPLEMENTATION TIMELINE

### Week 1 (20 hours)
**Days 1-2: Blocking Issues (P0)**
- [ ] 3.1 TypeScript Alignment (2h)
- [ ] 3.2 Workspace Dependencies (2h)
- [ ] Build & verify (1h)

**Days 3-4: Admin & Migration (P1)**
- [ ] 3.3 Admin App Consolidation (4h)
- [ ] 3.4 Stray Files (2h)
- [ ] 3.5 Jest→Vitest: wallet-service (3h)

**Day 5: More Migrations**
- [ ] 3.5 Jest→Vitest: profile-service (2h)
- [ ] 3.5 Jest→Vitest: ranking-service (1h)
- [ ] 3.5 bar-manager tests (2h)
- [ ] Verify all tests pass (1h)

### Week 2 (13 hours)
**Days 1-2: Code Quality**
- [ ] 3.6 ESLint: console.log replacement (3h)
- [ ] 3.6 ESLint: fix any types (2h)
- [ ] 3.6 ESLint: return types (1h)
- [ ] Verify zero warnings (1h)

**Days 3-4: Cleanup & Compliance**
- [ ] 4.1 Root Directory Cleanup (3h)
- [ ] 4.2 Observability Compliance (3h)

**Day 5: CI/CD & Final**
- [ ] 4.3 CI/CD Enhancements (3h)
- [ ] Final verification (1h)
- [ ] Documentation (2h)

---

## 🚀 GETTING STARTED NOW

### Immediate Actions (Next 30 Minutes)
```bash
cd /Users/jeanbosco/workspace/easymo-

# 1. Check current state
echo "=== TypeScript Versions ==="
pnpm ls typescript | grep -v "5.5.4" || echo "✅ All aligned"

echo -e "\n=== Workspace Dependencies ==="
bash scripts/verify/workspace-deps.sh 2>&1 | head -20

echo -e "\n=== Console.log Count ==="
grep -r "console\.log" services/ packages/ apps/ --include="*.ts" | wc -l

echo -e "\n=== Jest Configs ==="
find services packages -name "jest.config.*" -not -path "*/node_modules/*"

echo -e "\n=== Admin Apps ==="
ls -la | grep "admin-app"

# 2. Make scripts executable
chmod +x scripts/verify/workspace-deps.sh
chmod +x scripts/maintenance/*.sh
chmod +x scripts/audit/*.ts

# 3. Review this plan
cat DETAILED_IMPLEMENTATION_PLAN.md | less
```

### First Task: TypeScript Alignment (Start Now!)
```bash
# Follow Section 3.1 above
# Estimated time: 2 hours
# Must complete before other tasks
```

---

## 📊 SUCCESS METRICS

### Code Quality Metrics
- [ ] TypeScript: 100% on v5.5.4
- [ ] Workspace deps: 100% use workspace:*
- [ ] Test framework: 100% Vitest (0% Jest)
- [ ] ESLint warnings: 0
- [ ] console.log in prod code: 0

### Observability Metrics
- [ ] Services with correlation IDs: 100%
- [ ] Services with health endpoints: 100%
- [ ] PII masking compliance: 100%
- [ ] Structured logging: 100%

### Documentation Metrics
- [ ] Root directory markdown files: < 15
- [ ] Session docs organized: 100%
- [ ] Broken doc links: 0
- [ ] CI checks: 100% passing

---

## 📞 SUPPORT & QUESTIONS

### Decision Points
- **Admin app features:** Review comparison, decide keep or migrate
- **Stray files:** Verify they still exist before creating new packages
- **Test coverage:** Adjust thresholds per service criticality
- **Observability:** Continue-on-error vs fail-fast in CI

### Common Issues & Solutions
| Issue | Solution |
|-------|----------|
| TypeScript build fails | Check all use 5.5.4, clear node_modules, reinstall |
| Workspace dep error | Use workspace:* protocol, not * or ^version |
| Jest→Vitest failures | Check vi vs jest mocks, update imports |
| ESLint errors after console.log replacement | Add log import, fix structured logging syntax |
| CI timeout | Increase timeout in workflow, optimize builds |

---

**Ready to start?** Begin with Section 3.1 (TypeScript Alignment).

**Questions?** Review docs/GROUND_RULES.md or this plan.

**Track progress:** Update checkboxes in this file as you complete tasks.
